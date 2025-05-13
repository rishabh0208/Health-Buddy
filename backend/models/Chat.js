// models/Chat.js
import mongoose from "mongoose";

const chatSchema = new mongoose.Schema({
  timestamp: {
    type: Date,
    default: Date.now,
  },
  email:{
    type: String,
    required: true,
  },
  name:{
    type: String,
  },
  convo:[ {
    sender: {
        type: String,
        enum: ['user', 'ai', 'system'], // Only allow these values
        required: true,
      },
      message: {
        type: String,
        required: true,
      },
      createdAt: {
        type: Date,
        default: Date.now, // Auto-set when the message is created
      },
  }],
});

export default mongoose.model("Chat", chatSchema);