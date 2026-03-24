import express from "express";
import {
  getMyProfile,
  getUserById,
  getUserByUsername,
  searchUsersByUsername,
  updateMyProfile,
  deleteMyAccount,
  blockUser,
  unblockUser,
  getBlockedUsers,
} from "../controllers/userController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { check, param, query, validationResult } from "express-validator";

const router = express.Router();

// Helper: Universal validation errors handler
function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
}

// ============================
// PROFILE ROUTES
// ============================
router.get("/me", authMiddleware, getMyProfile);

router.put(
  "/me",
  authMiddleware,
  [
    // Example: If updating email, username, etc
    check("email").optional().isEmail().withMessage("Valid email required"),
    check("username")
      .optional()
      .isAlphanumeric()
      .withMessage("Username must be alphanumeric"),
    check("fullName")
      .optional()
      .isLength({ min: 2 })
      .withMessage("Full name is too short"),
    // Add more for other profile fields as needed
  ],
  handleValidationErrors,
  updateMyProfile
);

router.delete("/me", authMiddleware, deleteMyAccount);

// ============================
// BLOCK / UNBLOCK / LIST ROUTES
// ============================

router.get("/blocked", authMiddleware, getBlockedUsers);

router.put(
  "/block/:userIdToBlock",
  authMiddleware,
  [
    param("userIdToBlock")
      .isMongoId()
      .withMessage("Invalid ID to block")
  ],
  handleValidationErrors,
  blockUser
);

router.put(
  "/unblock/:userIdToUnblock",
  authMiddleware,
  [
    param("userIdToUnblock")
      .isMongoId()
      .withMessage("Invalid ID to unblock")
  ],
  handleValidationErrors,
  unblockUser
);

// ============================
// PUBLIC PROFILE ROUTES
// ============================
router.get(
  "/search",
  authMiddleware,
  [
    query("username")
      .optional()
      .isAlphanumeric()
      .withMessage("Search username must be alphanumeric")
      // Add more query validations as needed
  ],
  handleValidationErrors,
  searchUsersByUsername
);

router.get(
  "/lookup/username/:username",
  authMiddleware,
  [
    param("username")
      .isAlphanumeric()
      .withMessage("Username must be alphanumeric"),
  ],
  handleValidationErrors,
  getUserByUsername
);

router.get(
  "/:userId",
  authMiddleware,
  [
    param("userId")
      .isMongoId()
      .withMessage("Invalid user ID"),
  ],
  handleValidationErrors,
  getUserById
);

export default router;
