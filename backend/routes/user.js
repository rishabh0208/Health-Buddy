const express = require("express");
const router = express.Router();
const User = require("../models/User");


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
    if (error.code === 11000 && error.keyValue.email) {
      return res.status(400).json({ error: "Email already exists" });
    }

    res.status(400).json({ error: "Failed to create user" });
  }
});

// Get symptoms for a user with optional time filter
router.get(":userId/symptoms", async (req, res) => {
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
app.get("/:userId", async (req, res) => {
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


// generate health summary for user
router.get("/:userId/health-summary", async (req, res) => {
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



module.exports = router;
