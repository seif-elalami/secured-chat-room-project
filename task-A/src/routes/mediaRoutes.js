import express from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { uploadMedia, getRoomImages, getGallery, deleteMedia } from "../controllers/mediaController.js";
import { requireRoomMember } from '../middleware/roomRoleMiddleware.js';
import { param, validationResult } from "express-validator";
import fs from "fs";

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

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

// Universal validation error handler
function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
}

// -------------------------- UPLOAD MEDIA (POST) --------------------------
router.post(
  "/upload",
  authMiddleware,
  upload.single("file"),
  handleValidationErrors,
  uploadMedia
);

// -------------------------- IMAGE GALLERY ROUTE (GET) --------------------------
router.get(
  '/chats/:roomId/media',
  authMiddleware,
  requireRoomMember,
  [
    param("roomId").isMongoId().withMessage("Invalid room ID"),
    handleValidationErrors,
  ],
  getRoomImages
);

router.delete(
  "/:mediaId",
  authMiddleware,
  [
    param("mediaId").isMongoId().withMessage("Invalid media ID"),
    handleValidationErrors,
  ],
  deleteMedia
);

export default router;
