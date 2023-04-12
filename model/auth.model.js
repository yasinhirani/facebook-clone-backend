const mongoose = require("mongoose");

const AuthModel = new mongoose.Schema({
  userId: { type: String, required: [true, "User ID is required"] },
  userName: { type: String, required: [true, "UserName is required"] },
  email: { type: String, required: [true, "Email is required"], unique: true },
  password: { type: String, required: [true, "Password is required"] },
  avatarURL: { type: String, default: "" },
  avatarName: { type: String, default: "" },
  coverImage: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now },
  followers: { type: Array, default: [] },
  following: { type: Array, default: [] },
  relationshipStatus: { type: String, default: "" },
});

module.exports = mongoose.model("users", AuthModel);
