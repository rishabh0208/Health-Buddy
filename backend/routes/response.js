import express from "express";
import User from "../models/User.js";
import Chat from "../models/Chat.js";
import {
  generateGeminiResponse,
  generatePromptBasedResponse,
} from "../services/gemini.js";
import { retrieveContext } from "../services/rag.js";

const router = express.Router();

router.post("/generate", async (req, res) => {
  try {
    const { prompt, userId, chatId } = req.body;
    if (!prompt || !userId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    let chat;
    let currentChatId = chatId;
    const isFirstMessage = !chatId;

    // New chat
    if (!chatId) {
      const titlePrompt = `Generate a concise 1-3 word title for this health query: ${prompt}. No explanation.`;
      const title = await generatePromptBasedResponse({
        prompt: titlePrompt,
        fallback: "Health Query",
      });

      chat = new Chat({ email: user.email, name: title, convo: [] });
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
      chat = await Chat.findById(chatId);
      if (!chat) return res.status(404).json({ error: "Chat not found" });
    }

    // Save user message
    chat.convo.push({ sender: "user", message: prompt, createdAt: new Date() });
    await chat.save();

    const chatHistory = chat.convo.map((m) => ({
      role: m.sender === "user" ? "user" : "model",
      parts: [{ text: m.message }],
    }));

    // RAG
    const retrievedChunks = await retrieveContext(prompt);
    const context = retrievedChunks.join("\n\n");

    if (context) {
      chat.convo.push({
        sender: "system",
        message: context,
        createdAt: new Date(),
      });
      await chat.save();
    }

    const baseSystemMessage = isFirstMessage
      ? "User has observed a health symptom. Ask minimal questions."
      : "You are a helpful women's health assistant.";

    const systemMessage = context
      ? `${baseSystemMessage}\n\nContext:\n${context}`
      : baseSystemMessage;

    const stream = await generateGeminiResponse({
      prompt,
      chatHistory,
      systemMessage,
    });

 // 1️⃣ SSE headers (FIRST)
res.setHeader("Content-Type", "text/event-stream");
res.setHeader("Cache-Control", "no-cache");
res.setHeader("Connection", "keep-alive");

// 2️⃣ RAG metadata for frontend (BEFORE streaming)
const encodedContext = Buffer.from(
  JSON.stringify(retrievedChunks)   // or slice if large
).toString("base64");

res.setHeader("X-Retrieved-Context", encodedContext);
res.setHeader(
  "Access-Control-Expose-Headers",
  "X-Retrieved-Context, X-Chat-Id"
);

// 3️⃣ Chat ID (if new chat)
if (!chatId) {
  res.setHeader("X-Chat-Id", currentChatId.toString());
        res.setHeader("Access-Control-Expose-Headers", "X-Chat-Id");
}

    let fullResponse = "";
    for await (const chunk of stream) {
      if (chunk.text) {
        fullResponse += chunk.text;
        res.write(chunk.text);
      }
    }

    chat.convo.push({
      sender: "ai",
      message: fullResponse,
      createdAt: new Date(),
    });
    await chat.save();

    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
