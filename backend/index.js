// server.js
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { GoogleGenAI } from "@google/genai";
import mongoose from "mongoose";
import User from "./models/User.js";
import Chat from "./models/Chat.js";
import { FaissStore } from "@langchain/community/vectorstores/faiss";
import { HuggingFaceTransformersEmbeddings } from "@langchain/community/embeddings/hf_transformers";
import { pipeline } from "@xenova/transformers";
import { env } from "@xenova/transformers";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Configure environment for local models
env.allowLocalModels = true;
env.localModelPath = "./models";
env.cacheDir = "./models";
env.useCache = true;

// Initialize the embedding model and vector store at startup
let vectorStore;
let embeddingPipeline;

dotenv.config();

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB error:", err));

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const genAI = new GoogleGenAI({ apiKey: process.env.API_KEY });

// New route to get chat history
// server.js - Update the chat history endpoint

app.get("/chats/:chatId", async (req, res) => {
  try {
    const chat = await Chat.findById(req.params.chatId)
      .select("name convo createdAt")
      .lean();

    if (!chat) {
      return res.status(404).json({ error: "Chat not found" });
    }

    // Transform the convo array for better frontend consumption
    const transformedChat = {
      ...chat,
      convo: chat.convo.map((msg) => ({
        sender: msg.sender,
        message: msg.message,
        createdAt: msg.createdAt,
      })),
    };

    res.json(transformedChat);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch chat history" });
  }
});

// Add login route before /generate route
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // In a real application, you should compare hashed passwords
    if (user.password !== password) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    res.json({
      userId: user._id,
      name: user.name,
      cycleType: user.menstruationCycleType,
    });
  } catch (error) {
    res.status(500).json({ error: "Login failed" });
  }
});

// Add this to server.js before the /generate route
app.post("/users", async (req, res) => {
  try {
    const { name, age, email, password, menstruationCycleType } = req.body;

    const user = new User({
      name,
      age,
      email,
      password,
      menstruationCycleType: menstruationCycleType || "unknown",
    });

    await user.save();
    res.status(201).json(user);
  } catch (error) {
    if (error.code === 11000 && error.keyValue.email) {
      return res.status(400).json({ error: "Email already exists" });
    }

    res.status(400).json({ error: "Failed to create user" });
  }
});

app.get("/chats/user/:userId", async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const chats = await Chat.find({ email: user.email })
      .sort({ "convo.createdAt": -1 })
      .select("name _id");

    res.json(chats);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch chat history" });
  }
});

app.get("/users/:userId/symptoms", async (req, res) => {
  try {
    const { filter } = req.query;
    const user = await User.findById(req.params.userId);

    if (!user) return res.status(404).json({ error: "User not found" });

    const now = new Date();
    const timeFilter =
      filter === "month"
        ? new Date(now.setMonth(now.getMonth() - 1))
        : new Date(now.setDate(now.getDate() - 7));

    const symptomsData = Array.from(user.symptoms.entries())
      .map(([symptom, dates]) => ({
        symptom,
        count: dates.filter((d) => new Date(d) > timeFilter).length,
        dates: dates.filter((d) => new Date(d) > timeFilter),
      }))
      .filter((item) => item.count > 0);

    res.json(symptomsData);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch symptoms" });
  }
});

// Add this to server.js before other routes
// Update the /users/:userId endpoint in server.js
// Update the /users/:userId endpoint
app.get("/users/:userId", async (req, res) => {
  try {
    const user = await User.findById(req.params.userId)
      .select("-password")
      .lean();

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Convert MongoDB Map to JavaScript object properly
    const symptoms = user.symptoms
      ? Object.entries(user.symptoms).map(([symptom, dates]) => ({
          symptom,
          dates: Array.isArray(dates) ? dates : [dates], // Ensure dates is always an array
        }))
      : [];

    res.json({
      ...user,
      symptoms,
    });
  } catch (error) {
    console.error("User endpoint error:", error);
    res.status(500).json({ error: "Failed to fetch user data" });
  }
});

// Add this endpoint before the /generate route
app.get("/users/:userId/health-summary", async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Get all chats for the user
    const chats = await Chat.find({ email: user.email });

    // Extract and format conversation history
    const conversationHistory = chats.flatMap((chat) =>
      chat.convo
        .map(
          (msg) => `${msg.sender === "user" ? "User" : "AI"}: ${msg.message}`
        )
        .join("\n")
    );

    // Generate summary using Gemini
    const response = await genAI.models.generateContent({
      model: "gemini-2.0-flash",
      contents: `Generate a comprehensive health summary (max 150 words) of the user based on this conversation history:
      \n${conversationHistory}\n
      
      Use bullet points and clear headings. Avoid medical jargon.`,
    });

    res.json({
      summary: response.text,
    });
  } catch (error) {
    console.error("Health summary error:", error);
    res.status(500).json({
      error: "Failed to generate health summary",
      details: error.message,
    });
  }
});

// Add this endpoint to server.js
app.delete("/chats/:chatId", async (req, res) => {
  try {
    const { chatId } = req.params;

    // Find and delete the chat
    const result = await Chat.findByIdAndDelete(chatId);

    if (!result) {
      return res.status(404).json({ error: "Chat not found" });
    }

    res.status(200).json({ message: "Chat deleted successfully" });
  } catch (error) {
    console.error("Delete chat error:", error);
    res.status(500).json({ error: "Failed to delete chat" });
  }
});

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

app.post("/generate", async (req, res) => {
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
      const generateTitle = await genAI.models.generateContent({
        model: "gemini-2.0-flash",
        contents: `Generate a 1-3 word title for this health related query: ${prompt}. You can Output a maximum of 3 words and nothing else. NO EXPLANATION OR PREAMBLE IS NEEDED.`,
      });
      const title = generateTitle.text;

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
        console.log(
          "Retrieved relevant context:",
          retrievedChunks.length,
          "chunks"
        );
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

    // Generate AI response
    const resp = genAI.chats.create({
      model: "gemini-2.0-flash",
      config: {
        systemInstruction: systemMessage,
      },
      history: chat_history,
    });

    const response = await resp.sendMessageStream({
      message: prompt,
    });

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

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});