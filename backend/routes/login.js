import express from "express";
import User from "../models/User.js";

const router = express.Router();

router.post("/", async (req, res) => {
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