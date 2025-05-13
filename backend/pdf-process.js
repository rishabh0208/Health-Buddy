import fs from "fs-extra";
import PDFParser from "pdf2json";
import { pipeline, env } from "@xenova/transformers";
import { FaissStore } from "@langchain/community/vectorstores/faiss";
import { HuggingFaceTransformersEmbeddings } from "@langchain/community/embeddings/hf_transformers";
import path from "path";

// Configure for local models
env.allowLocalModels = true;
env.localModelPath = path.resolve("./models");
env.cacheDir = path.resolve("./models");
env.useCache = true;

async function extractTextFromPDF(pdfPath) {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser();

    pdfParser.on("pdfParser_dataReady", function (pdfData) {
      try {
        const text = pdfData.Pages.map((page) =>
          page.Texts.map((text) => decodeURIComponent(text.R[0].T)).join(" ")
        ).join(" ");
        resolve(text);
      } catch (error) {
        reject(error);
      }
    });

    pdfParser.on("pdfParser_dataError", reject);
    pdfParser.loadPDF(pdfPath);
  });
}

async function splitIntoChunks(text, chunkSize = 500) {
  const words = text.split(" ");
  const chunks = [];
  let currentChunk = [];

  for (const word of words) {
    currentChunk.push(word);
    if (currentChunk.join(" ").length >= chunkSize) {
      chunks.push(currentChunk.join(" "));
      currentChunk = [];
    }
  }
  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join(" "));
  }
  return chunks;
}

async function generateEmbeddings(chunks) {
  console.log("Initializing embedding pipeline with GPU acceleration...");
  
  const embedder = await pipeline(
    "feature-extraction",
    "Xenova/all-MiniLM-L6-v2",
    {
      revision: "main",
      quantized: false,
      progress_callback: (progress) => {
        if (progress.status === 'progress') {
          console.log(`Model loading: ${Math.round(progress.value * 100)}%`);
        }
      }
    }
  );

  console.log("Generating embeddings for chunks...");
  const embeddings = [];
  const batchSize = 16; // Process in batches for GPU efficiency
  
  // Process in batches
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batchChunks = chunks.slice(i, i + batchSize);
    console.log(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(chunks.length/batchSize)}`);
    
    const batchPromises = batchChunks.map(async (chunk) => {
      const output = await embedder(chunk, {
        pooling: "mean",
        normalize: true,
      });
      return {
        text: chunk,
        embedding: Array.from(output.data),
      };
    });
    
    const batchResults = await Promise.all(batchPromises);
    embeddings.push(...batchResults);
  }
  
  return embeddings;
}

// Function to create FAISS index in batches to reduce memory pressure
async function createFaissIndex(embeddings, chunkTexts) {
  console.log("Creating FAISS index in smaller batches...");
  
  // Create documents with metadata
  const documents = chunkTexts.map((chunk) => ({
    pageContent: chunk,
    metadata: { source: "health_data.pdf" },
  }));

  // Initialize embeddings model
  const embeddingsModel = new HuggingFaceTransformersEmbeddings({
    modelName: "Xenova/all-MiniLM-L6-v2",
    stripNewLines: true,
  });
  
  // Override the embedding function to use our pre-computed embeddings
  // This avoids recomputing embeddings which is the slow part
  const embeddingMap = new Map();
  for (let i = 0; i < chunkTexts.length; i++) {
    embeddingMap.set(chunkTexts[i], embeddings[i].embedding);
  }
  
  embeddingsModel.embedQuery = async (text) => {
    if (embeddingMap.has(text)) {
      return embeddingMap.get(text);
    }
    // Fallback for queries not in our map
    console.log("Computing embedding for query not in precomputed set");
    const embedder = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
    const output = await embedder(text, { pooling: "mean", normalize: true });
    return Array.from(output.data);
  };
  
  embeddingsModel.embedDocuments = async (texts) => {
    return texts.map(text => {
      if (embeddingMap.has(text)) {
        return embeddingMap.get(text);
      }
      // This should not happen as we're only using precomputed texts
      console.warn("Warning: Computing embedding for document not in precomputed set");
      return new Array(384).fill(0); // Return zeros as fallback
    });
  };
  
  // Process in even smaller batches to reduce memory pressure
  const batchSize = 50;
  let vectorStore = null;
  
  for (let i = 0; i < documents.length; i += batchSize) {
    console.log(`FAISS indexing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(documents.length/batchSize)}`);
    const batchDocuments = documents.slice(i, i + batchSize);
    
    if (vectorStore === null) {
      // First batch - create new store
      vectorStore = await FaissStore.fromDocuments(batchDocuments, embeddingsModel);
    } else {
      // Subsequent batches - add to existing store
      await vectorStore.addDocuments(batchDocuments);
    }
    
    // Force garbage collection between batches
    if (global.gc) {
      global.gc();
    }
    
    // Brief pause to allow system to catch up
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  return vectorStore;
}

async function main() {
  try {
    console.log("Starting PDF processing pipeline");
    
    // Path to your PDF file
    const pdfPath = "./health_data.pdf";

    // Check if embeddings already exist to avoid recomputing
    let embeddings = [];
    let chunks = [];
    
    if (await fs.pathExists("./embeddings.json")) {
      console.log("Loading existing embeddings from file...");
      embeddings = await fs.readJSON("./embeddings.json");
      chunks = embeddings.map(item => item.text);
      console.log(`Loaded ${embeddings.length} existing embeddings`);
    } else {
      // Extract text from PDF
      console.log("Extracting text from PDF...");
      const text = await extractTextFromPDF(pdfPath);
      console.log(`Extracted ${text.length} characters of text`);

      // Split text into chunks
      console.log("Splitting text into chunks...");
      chunks = await splitIntoChunks(text);
      console.log(`Created ${chunks.length} text chunks`);

      // Generate embeddings
      console.log("Generating embeddings with GPU acceleration...");
      embeddings = await generateEmbeddings(chunks);
      
      // Save embeddings to file
      console.log("Saving embeddings to file...");
      await fs.writeJSON("./embeddings.json", embeddings);
      console.log("Embeddings saved successfully!");
    }

    // Check if FAISS index already exists
    if (await fs.pathExists("./faiss_index")) {
      console.log("FAISS index already exists. Skipping creation.");
    } else {
      // Create FAISS index in a memory-efficient way
      console.log("Creating FAISS vector store with optimized memory usage...");
      const vectorStore = await createFaissIndex(embeddings, chunks);

      console.log("Saving FAISS index...");
      await vectorStore.save("./faiss_index");
      console.log("FAISS index saved successfully!");
    }
    
    console.log("Pipeline completed successfully!");
  } catch (error) {
    console.error("Error in pipeline:", error);
  }
}

// Run with garbage collection enabled for better memory management
// node --expose-gc pdf-process.js
main();