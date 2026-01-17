import express from "express";
import Chat from "../models/Chat.js";
import User from "../models/User.js";

const router = express.Router();

// get chat history by chatId
router.get("/:chatId", async (req, res) => {
  try {
    const chat = await Chat.findById(req.params.chatId)
      .select("name convo createdAt")
      .lean();

    if (!chat) {
      return res.status(404).json({ error: "Chat not found" });
    }

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

// get chats by userId
router.get("/user/:userId", async (req, res) => {
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

// delete chat by chatId
router.delete("/:chatId", async (req, res) => {
  try {
    const { chatId } = req.params;

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

export default router;
