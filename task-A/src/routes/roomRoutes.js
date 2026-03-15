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

  //  Controllers for RBAC:
  promoteMember,
  cleanRoomArrays,
  demoteMember,updateRoomSettings,
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

const router = express.Router();

//  Apply authMiddleware globally to all routes

router.use(authMiddleware);


// 🟢 ROOM CREATION & FETCHING

router.post("/direct", createDirectRoom);        // Create direct DM room
router.post("/", createRoom);                   // Create group room
router.get("/", getUserRooms);                  // Get all rooms for user
router.get("/:roomId", getRoomById);            // Get room details
router.delete("/:roomId", deleteRoom);          // Delete room (creator only)

// ======================================================
// 🟠 MEMBER MANAGEMENT
// ======================================================
router.post("/:roomId/members", requireMemberManagement, addMember);  // Add member
router.delete("/:roomId/members/:userId", removeMember);              // Remove member

// ======================================================
// 🔵 ROLE MANAGEMENT (PROMOTE / DEMOTE)
// ======================================================
// Promote user to moderator/admin (admin or creator)
router.post("/:roomId/promote", promoteMember);

// Demote user (creator or higher admin)
router.post("/:roomId/demote", demoteMember);

// Legacy test route (still works)
router.post("/:roomId/promote/moderator/:userId", promoteToModerator);

// ======================================================
// 🟣 UTILITIES
// ======================================================
router.get("/:roomId/media", getRoomMedia);            // Get media in room
router.get("/:roomId/debug-arrays", debugRoomArrays);  // Debug helper
router.get("/:roomId/user-role", getUserRoleInfo);     // Get current user’s role in room

// ======================================================
// 🧪 TEST ROUTES (for local validation)
// ======================================================
router.post("/:roomId/clean-arrays", cleanRoomArrays);
router.put("/:roomId/settings", updateRoomSettings);
router.get("/:roomId/statistics", getRoomStatistics);
router.post("/:roomId/invite", generateInviteLink);      // Generate new invite link
router.get("/:roomId/invite", getInviteLink);            // Get current invite link
router.delete("/:roomId/invite", revokeInviteLink);      // Revoke invite link
router.post("/join/:inviteCode", joinViaInviteCode);     // join room via invitationCode


export default router;
