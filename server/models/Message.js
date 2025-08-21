import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
  from_user_id: {
    type: String,
    ref: "User",
    required: true,
  },
  to_user_id: {
    type: String,
    ref: "User",
    required: true,
  },
  text: {
    type: String, // free-form text allowed
    required: function () {
      return this.message_type === "text";
    },
  },
  message_type: {
    type: String,
    enum: ["text", "image"],
    required: true,
  },
  media_url: {
    type: String, // optional, only for images
  },
  seen: {
    type: Boolean,
    default: false,
  },
}, { timestamps: true, minimize: false });

const Message = mongoose.model("Message", messageSchema);

export default Message;
