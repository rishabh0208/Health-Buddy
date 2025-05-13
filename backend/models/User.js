// models/User.js
import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email:{
     type: String,
     required:true,
     unique:true,
  },
  password:{
    type:String,
    required:true,
  },
  age: {
    type: Number,
    required: true,
  },
  menstruationCycleType: {
    type: String,
    enum: ["regular", "irregular", "unknown"],
    default: "unknown",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  symptoms:{
    type: Map,
    of: [Date],
    default: {},
  }
});

export default mongoose.model("User", userSchema);