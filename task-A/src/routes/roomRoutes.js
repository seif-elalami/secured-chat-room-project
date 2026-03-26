import express from "express";
import {
  createRoom,
  getUserRooms,
  createDirectRoom,
  addMember,
  removeMember,
  promoteToModerator,
  getRoomById,
  deleteRoom,
  debugRoomArrays,
  getUserRoleInfo,
  promoteMember,
  cleanRoomArrays,
  demoteMember,
  updateRoomSettings,
  getRoomStatistics,
  generateInviteLink,
  getInviteLink,
  revokeInviteLink,
  joinViaInviteCode
} from "../controllers/roomController.js";

import { authMiddleware } from "../middleware/authMiddleware.js";
import { getRoomMedia } from "../controllers/messageController.js";
import {
  requireRoomAdmin,
  requireRoomModerator,
  requireMemberManagement,
  requireRoomMember
} from "../middleware/roomRoleMiddleware.js";
import { body, param, query, validationResult } from "express-validator";

const router = express.Router();

// Universal validation error handler
function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
}

// Apply authMiddleware globally to all routes
router.use(authMiddleware);

// 🟢 ROOM CREATION & FETCHING

router.post("/direct",
  [
    body().custom((value) => {
      if (value?.otherUserId || value?.username) return true;
      throw new Error("Provide otherUserId or username");
    }),
    handleValidationErrors,
  ],
  createDirectRoom
);

router.post("/",
  [
    body("name").notEmpty().isString().withMessage("Room name must be provided"),
    body("type").isIn(["group", "channel", "classroom"]).withMessage("Invalid room type"),
    // Add more as your model requires (e.g., members list)
    handleValidationErrors,
  ],
  createRoom
);

router.get("/", getUserRooms);

router.get("/:roomId",
  [
    param("roomId").isMongoId().withMessage("Invalid room ID"),
    handleValidationErrors,
  ],
  getRoomById
);

router.delete("/:roomId",
  [
    param("roomId").isMongoId().withMessage("Invalid room ID"),
    handleValidationErrors,
  ],
  deleteRoom
);

// ======================================================
// 🟠 MEMBER MANAGEMENT
// ======================================================
router.post("/:roomId/members",
  [
    param("roomId").isMongoId().withMessage("Invalid room ID"),
    body().custom((value) => {
      if (value?.userId || value?.username) return true;
      throw new Error("Provide userId or username");
    }),
    handleValidationErrors,
  ],
  requireMemberManagement,
  addMember
);

router.delete("/:roomId/members/:userId",
  [
    param("roomId").isMongoId().withMessage("Invalid room ID"),
    param("userId").isMongoId().withMessage("Invalid user ID"),
    handleValidationErrors,
  ],
  removeMember
);

// ======================================================
// 🔵 ROLE MANAGEMENT (PROMOTE / DEMOTE)
// ======================================================
router.post("/:roomId/promote",
  [
    param("roomId").isMongoId().withMessage("Invalid room ID"),
    body("userId").isMongoId().withMessage("userId to promote required in body"),
    handleValidationErrors,
  ],
  promoteMember
);

router.post("/:roomId/demote",
  [
    param("roomId").isMongoId().withMessage("Invalid room ID"),
    body("userId").isMongoId().withMessage("userId to demote required in body"),
    handleValidationErrors,
  ],
  demoteMember
);

router.post("/:roomId/promote/moderator/:userId",
  [
    param("roomId").isMongoId().withMessage("Invalid room ID"),
    param("userId").isMongoId().withMessage("Invalid user ID"),
    handleValidationErrors,
  ],
  promoteToModerator
);

// ======================================================
// 🟣 UTILITIES
// ======================================================
router.get("/:roomId/media",
  [
    param("roomId").isMongoId().withMessage("Invalid room ID"),
    handleValidationErrors,
  ],
  getRoomMedia
);

router.get("/:roomId/debug-arrays",
  [
    param("roomId").isMongoId().withMessage("Invalid room ID"),
    handleValidationErrors,
  ],
  debugRoomArrays
);

router.get("/:roomId/user-role",
  [
    param("roomId").isMongoId().withMessage("Invalid room ID"),
    handleValidationErrors,
  ],
  getUserRoleInfo
);

// ======================================================
// 🧪 TEST ROUTES (for local validation)
// ======================================================
router.post("/:roomId/clean-arrays",
  [
    param("roomId").isMongoId().withMessage("Invalid room ID"),
    handleValidationErrors,
  ],
  cleanRoomArrays
);

router.put("/:roomId/settings",
  [
    param("roomId").isMongoId().withMessage("Invalid room ID"),
    // Add body checks for settings fields as needed
    handleValidationErrors,
  ],
  updateRoomSettings
);

router.get("/:roomId/statistics",
  [
    param("roomId").isMongoId().withMessage("Invalid room ID"),
    handleValidationErrors,
  ],
  getRoomStatistics
);

router.post("/:roomId/invite",
  [
    param("roomId").isMongoId().withMessage("Invalid room ID"),
    handleValidationErrors,
  ],
  generateInviteLink
);

router.get("/:roomId/invite",
  [
    param("roomId").isMongoId().withMessage("Invalid room ID"),
    handleValidationErrors,
  ],
  getInviteLink
);

router.delete("/:roomId/invite",
  [
    param("roomId").isMongoId().withMessage("Invalid room ID"),
    handleValidationErrors,
  ],
  revokeInviteLink
);

router.post("/join/:inviteCode",
  [
    param("inviteCode").isLength({ min: 6 }).withMessage("Invalid invite code"), // adjust length & format as needed
    handleValidationErrors,
  ],
  joinViaInviteCode
);

export default router;
