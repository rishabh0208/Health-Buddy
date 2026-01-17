import express from "express";
import User from "../models/User.js";
import Chat from "../models/Chat.js";   
import { env } from "@xenova/transformers";
import { fileURLToPath } from "url";
import { FaissStore } from "@langchain/community/vectorstores/faiss";
import { HuggingFaceTransformersEmbeddings } from "@langchain/community/embeddings/hf_transformers";
import { pipeline } from "@xenova/transformers";
import { generateGeminiResponse, generatePromptBasedResponse } from "../services/gemini.js";

const router = express.Router();

// Initialize the embedding model and vector store at startup
let embeddingPipeline;
let vectorStore;


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Configure environment for local models
env.allowLocalModels = true;
env.localModelPath = "../models";
env.cacheDir = "../models";
env.useCache = true;


async function initializeRAG() {
  try {
    console.log("Initializing RAG system...");

    // Initialize the embedding model
    console.log("Loading embedding model...");
    embeddingPipeline = await pipeline(
      "feature-extraction",
      "Xenova/all-MiniLM-L6-v2",
      { revision: "main" }
    );

    // Create embeddings object for FAISS
    const embeddings = new HuggingFaceTransformersEmbeddings({
      modelName: "Xenova/all-MiniLM-L6-v2",
    });

    // Override the embedding method to use our pipeline
    embeddings.embedQuery = async (text) => {
      const output = await embeddingPipeline(text, {
        pooling: "mean",
        normalize: true,
      });
      return Array.from(output.data);
    };

    // Load FAISS index
    console.log("Loading FAISS index...");
    vectorStore = await FaissStore.load("./faiss_index", embeddings);
    console.log("RAG system initialized successfully");
  } catch (error) {
    console.error("Failed to initialize RAG system:", error);
    throw error;
  }
}

// generate response from Gemini with RAG and stores response from user and ai in chat history
router.post("/generate", async (req, res) => {
  try {
    const { prompt, userId, chatId } = req.body;

    // Validate input
    if (!prompt || !userId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    let isFirstMessage = !chatId ? true : false;
    let chat;
    let currentChatId = chatId;

    // Create new chat if no chatId provided
    if (!chatId) {
      // Generate chat title using Gemini
      const titlePrompt = `Generate a concise and relevant title (1-3 words) for a health chat based on the following symptom: ${prompt}. Keep it under 3 words. No explanation needed.`;
      const title = await generatePromptBasedResponse({prompt: titlePrompt});

      // Create new chat document
      chat = new Chat({
        email: user.email,
        name: title,
        convo: [],
      });
      await chat.save();
      currentChatId = chat._id;

      const symptomText = prompt.trim().toLowerCase(); // Normalize symptom text
      const currentDate = new Date();

      // Update symptoms map
      const existingDates = user.symptoms.get(symptomText) || [];
      existingDates.push(currentDate);
      user.symptoms.set(symptomText, existingDates);

      // Save updated user
      await user.save();
    } else {
      // Find existing chat
      chat = await Chat.findById(chatId);
      if (!chat) {
        return res.status(404).json({ error: "Chat not found" });
      }
    }

    chat.convo.push({
      sender: "user",
      message: prompt,
      createdAt: new Date(),
    });
    await chat.save();

    // Build conversation history for Gemini
    const chat_history = chat.convo.map((msg) => ({
      role: msg.sender === "user" ? "user" : "model",
      parts: [{ text: msg.message }],
    }));

    // Check if RAG system is ready
    if (!vectorStore) {
      console.warn(
        "RAG system not initialized. Proceeding without context retrieval."
      );
    }

    // Retrieve relevant context using the FAISS vector store
    let retrievedChunks = [];

    try {
      // Use the vectorStore to find similar content
      if (vectorStore) {
        const results = await vectorStore.similaritySearch(prompt, 5);
        retrievedChunks = results.map((doc) => doc.pageContent);
        console.log("Retrieved relevant context:",retrievedChunks.length,"chunks");
      }
    } catch (error) {
      console.error("Error retrieving context:", error);
      // Continue without context if retrieval fails
    }

    // Format the retrieved context
    const context = retrievedChunks.join("\n\n");

    if (retrievedChunks.length > 0) {
      chat.convo.push({
        sender: "system",
        message: `Relevant information retrieved:\n\n${context}`,
        createdAt: new Date(),
      });
      await chat.save(); // Save the context additions before generating the real response
    }

    // Add context to system message
    const baseSystemMessage = isFirstMessage
      ? "User has observed a health symptom. Ask very few questions to gather more insights."
      : "You are a helpful women's health assistant. Keep responses friendly and concise. Get to the root of the user's health cause. You have been provided with relevant information to assist the user. Do not ask the user to visit the doctor. Do not make up any information. Do not pass the provided information to the user. Do not say 'I am an AI model' or anything similar.";

    const systemMessage = context
      ? `${baseSystemMessage}\n\nRelevant Context:\n${context}`
      : baseSystemMessage;

    const response = await generateGeminiResponse({ prompt, chatHistory: chat_history, systemMessage});

    // Set headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    const encodedContext = Buffer.from(
      JSON.stringify(retrievedChunks)
    ).toString("base64");
    res.setHeader("X-Retrieved-Context", encodedContext);
    res.setHeader(
      "Access-Control-Expose-Headers",
      "X-Retrieved-Context, X-Chat-Id"
    );

    if (!chatId) {
      res.setHeader("X-Chat-Id", currentChatId.toString());
      res.setHeader("Access-Control-Expose-Headers", "X-Chat-Id");
    }

    let fullResponse = "";
    for await (const chunk of response) {
      if (chunk.text) {
        fullResponse += chunk.text;
        res.write(chunk.text);
      }
    }

    // Add AI response to conversation
    chat.convo.push({
      sender: "ai",
      message: fullResponse,
      createdAt: new Date(),
    });
    await chat.save();

    res.end();
  } catch (error) {
    console.error("Error in generate endpoint:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});



app.use('/assets', express.static(path.join(__dirname, 'dist', 'assets'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css');
    } else if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    }
  }
}));

app.use(express.static(path.join(__dirname,'client', 'dist')));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname,'client','dist', 'index.html'));
});

await initializeRAG();