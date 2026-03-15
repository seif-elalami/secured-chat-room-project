import express from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import {
  sendMessage,
  getMessages,
  getRoomMedia,
  deleteMessage,
  pinMessage,
  getPinnedMessages,
  editMessage,
  toggleReaction,
  getReactions,
  markAsRead,
  markMultipleAsRead,
  getReadReceipts,
  getUnreadCount
} from "../controllers/messageController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, "../uploads/messages"));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "message-" + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif|webp|bmp|svg/i;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = file.mimetype.startsWith("image/");

    if (mimetype && extname) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed (jpeg, jpg, png, gif, webp)"), false);
    }
  }
});

// ========================================
// 📨 MESSAGE ROUTES
// ========================================

// ✅ Send message - Supports BOTH JSON and file upload
router.post("/send", authMiddleware, upload.single("file"), sendMessage);
//                                    ↑ Changed from "image" to "file"

// Get all messages in a room
router.get("/:roomId", authMiddleware, getMessages);

// Get media (images) in a room
router.get("/:roomId/media", authMiddleware, getRoomMedia);

// Get pinned messages in a room
router.get("/:roomId/pinned", authMiddleware, getPinnedMessages);

// Edit own message
router.put("/:messageId", authMiddleware, editMessage);

// Delete message (own or moderation)
router.delete("/:messageId", authMiddleware, deleteMessage);

// Pin/unpin message (moderators+)
router.post("/:messageId/pin", authMiddleware, pinMessage);

// ========================================
// 🎭 REACTIONS
// ========================================

// Add/remove reaction
router.post("/:messageId/react", authMiddleware, toggleReaction);

// Get all reactions for a message
router.get("/:messageId/reactions", authMiddleware, getReactions);

// ========================================
// ✓✓ READ RECEIPTS
// ========================================

// Mark single message as read
router.post("/:messageId/read", authMiddleware, markAsRead);

// Mark multiple messages as read (batch)
router.post("/read-batch", authMiddleware, markMultipleAsRead);

// Get read receipts for a message (author/admins only)
router.get("/:messageId/read-receipts", authMiddleware, getReadReceipts);

// Get unread message count in a room
router.get("/room/:roomId/unread", authMiddleware, getUnreadCount);

export default router;
