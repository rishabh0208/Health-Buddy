import express from "express";
import User from "../models/User.js";
import Chat from "../models/Chat.js";
import { generatePromptBasedResponse } from "../services/gemini.js";

const router = express.Router();

// create user
router.post("/", async (req, res) => {
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
    if (error.code === 11000 && error.keyValue?.email) {
      return res.status(400).json({ error: "Email already exists" });
    }
    res.status(400).json({ error: "Failed to create user" });
  }
});

// get symptoms for a user
router.get("/:userId/symptoms", async (req, res) => {
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

// get user info by userId
router.get("/:userId", async (req, res) => {
  try {
    const user = await User.findById(req.params.userId)
      .select("-password")
      .lean();

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const symptoms = user.symptoms
      ? Object.entries(user.symptoms).map(([symptom, dates]) => ({
          symptom,
          dates: Array.isArray(dates) ? dates : [dates],
        }))
      : [];

    res.json({ ...user, symptoms });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch user data" });
  }
});

// generate health summary
router.get("/:userId/health-summary", async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    const chats = await Chat.find({ email: user.email });

    const conversationHistory = chats.flatMap((chat) =>
      chat.convo.map(
        (msg) => `${msg.sender === "user" ? "User" : "AI"}: ${msg.message}`
      )
    ).join("\n");

    const summaryPrompt = `Based on the following conversation history, generate a concise health summary for the user. Use bullet points and clear headings. Avoid medical jargon. ${conversationHistory}`;
    const response = await generatePromptBasedResponse({ summaryPrompt });

    res.json({ summary: response });
  } catch (error) {
    res.status(500).json({ error: "Failed to generate health summary" });
  }
});

export default router;
