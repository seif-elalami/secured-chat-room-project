import mongoose from "./mongoose.js";
import { messageTypes } from "./messageTypes.js";

const { Schema } = mongoose;

const MessageSchema = new Schema(
  {
    author: { type: Schema.ObjectId, ref: "users", required: true },
    content: { type: String },

    type: {
      type: String,
      enum: Object.values(messageTypes),
      default: messageTypes.text,
    },

    file: { type: Schema.ObjectId, ref: "files" },
    room: { type: Schema.ObjectId, ref: "rooms", required: true },

    date: { type: Date, default: Date.now },

    // ✅ LOCATION FIELDS (NEW)
    location: {
       url: { type: String },
      latitude: { type: Number },
      longitude: { type: Number },
      address: { type: String },           // Optional: "123 Main St, City"
      googleMapsUrl: { type: String },     // Auto-generated Google Maps link
      originalUrl: { type: String },
      provider: {                               // ✅ NEW: Track which map service
        type: String,
        enum: ['google', 'apple', 'other'],
        default: 'google'
      }
    },

    // Reply fields
    replyTo: {
      type: Schema.ObjectId,
      ref: "messages",
      default: null
    },
    replyToContent: {
      type: { type: String },      // 'text', 'image', 'location', etc.
      content: { type: String },   // Original message content
      author: { type: Schema.ObjectId, ref: "users" }
    },

    statuses: [
      {
        userId: { type: Schema.ObjectId, ref: "users", required: true },
        deliveredAt: { type: Date, default: null },
        seenAt: { type: Date, default: null },
      },
    ],

    editedAt: Date,
    isDeleted: { type: Boolean, default: false },

    // Pinning fields
    isPinned: { type: Boolean, default: false },
    pinnedBy: { type: Schema.ObjectId, ref: "users" },
    pinnedAt: { type: Date },

    // Reactions
    reactions: [
      {
        emoji: { type: String, required: true },  // e.g., "👍", "❤️", "😂"
        userId: { type: Schema.ObjectId, ref: "users", required: true },
        createdAt: { type: Date, default: Date.now }
      }
    ]
  },

  { timestamps: true }
);

// Indexes for performance
MessageSchema.index({ 'reactions.userId': 1, 'reactions.emoji': 1 });
MessageSchema.index({ room: 1, date: -1 });
MessageSchema.index({ "statuses.userId": 1 });
MessageSchema.index({ room: 1, isPinned: 1 });
MessageSchema.index({ replyTo: 1 });
MessageSchema.index({ type: 1 });  // ✅ NEW: Index for filtering by message type
MessageSchema.index({ 'location.latitude': 1, 'location.longitude': 1 });  // ✅ NEW: Index for location queries

const Message = mongoose.model("messages", MessageSchema);
export default Message;
