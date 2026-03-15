import express from "express";
import {
  getMyProfile,
  getUserById,
  updateMyProfile,
  deleteMyAccount,
  blockUser,
  unblockUser,
  getBlockedUsers,
} from "../controllers/userController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

// ============================
// PROFILE ROUTES
// ============================
router.get("/me", authMiddleware, getMyProfile);
router.put("/me", authMiddleware, updateMyProfile);
router.delete("/me", authMiddleware, deleteMyAccount);

// ============================
// BLOCK / UNBLOCK / LIST ROUTES
// ============================

// Get list of blocked users
router.get("/blocked", authMiddleware, getBlockedUsers);

// ✅ Block user (two-way)
router.put("/block/:userIdToBlock", authMiddleware, blockUser);

// ✅ Unblock user (two-way)
router.put("/unblock/:userIdToUnblock", authMiddleware, unblockUser);

// ============================
// PUBLIC PROFILE ROUTE
// ============================
router.get("/:userId", authMiddleware, getUserById);

export default router;
