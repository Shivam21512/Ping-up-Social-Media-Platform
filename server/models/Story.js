import mongoose from "mongoose";

const storySchema = new mongoose.Schema({
  user: {
    type: String,   // 👈 Clerk ID (string)
    ref: "User",
    required: true
  },
  content: String,
  media_url: String,
  media_type: {
    type: String,
    enum: ['text', 'image', 'video'],
    required: true
  },
  view_count: [{
    type: String,  // 👈 Clerk ID (string)
    ref: 'User'
  }],
  background_color: String
}, { timestamps: true, minimize: false });


const Story = mongoose.model('Story', storySchema);

export default Story;