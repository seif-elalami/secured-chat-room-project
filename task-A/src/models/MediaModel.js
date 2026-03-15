import mongoose from "mongoose";

const mediaSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },
    room: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "rooms",
      required: true,
    },
    fileUrl: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

// Optional index for faster queries by room
mediaSchema.index({ room: 1, createdAt: -1 });

export const Media = mongoose.model("media", mediaSchema);
