import express from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { uploadMedia, getRoomImages,getGallery,deleteMedia  } from "../controllers/mediaController.js"; // Remove getGallery
import { requireRoomMember } from '../middleware/roomRoleMiddleware.js';

const router = express.Router();

import fs from "fs";

// Handle correct paths in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure Multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

/* -------------------------- UPLOAD MEDIA (POST) -------------------------- */
router.post("/upload", authMiddleware, upload.single("file"), uploadMedia);
/* -------------------------- IMAGE GALLERY ROUTE (GET) -------------------------- */
// Unified route for getting room images - REPLACES BOTH OLD ROUTES
router.get('/chats/:roomId/media', authMiddleware, requireRoomMember, getRoomImages);
router.delete("/:mediaId", authMiddleware, deleteMedia);


export default router;
