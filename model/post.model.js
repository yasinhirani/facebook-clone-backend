const mongoose = require("mongoose");

const PostModel = mongoose.Schema({
  name: { type: String, required: true },
  content: { type: String, required: true },
  userId: { type: String, required: true },
  postId: { type: String, required: true },
  imageURL: { type: String, required: false, default: "" },
  likeCount: { type: Number, default: 0 },
  likedBy: { type: Array, default: [] },
  createdAt: { type: Date, default: Date.now },
  avatar: { type: String, default: "" },
  postName: { type: String, default: "" },
});

module.exports = mongoose.model("posts", PostModel);
