import { env, pipeline } from "@xenova/transformers";
import { FaissStore } from "@langchain/community/vectorstores/faiss";
import { HuggingFaceTransformersEmbeddings } from "@langchain/community/embeddings/hf_transformers";
import path from "path";
import { fileURLToPath } from "url";

let vectorStore;
let embeddingPipeline;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

env.allowLocalModels = true;
env.localModelPath = path.join(__dirname, "..", "models");
env.cacheDir = path.join(__dirname, "..", "models");
env.useCache = true;

export async function initializeRAG() {
  console.log("Initializing RAG system...");

  embeddingPipeline = await pipeline(
    "feature-extraction",
    "Xenova/all-MiniLM-L6-v2"
  );

  const embeddings = new HuggingFaceTransformersEmbeddings({
    modelName: "Xenova/all-MiniLM-L6-v2",
  });

  embeddings.embedQuery = async (text) => {
    const output = await embeddingPipeline(text, {
      pooling: "mean",
      normalize: true,
    });
    return Array.from(output.data);
  };

  vectorStore = await FaissStore.load("./faiss_index", embeddings);

  console.log("RAG system initialized");
}

export async function retrieveContext(prompt, k = 5) {
  if (!vectorStore) return [];

  const results = await vectorStore.similaritySearch(prompt, k);
  return results.map((doc) => doc.pageContent);
}
