import Room from "../models/Room.js";
import User from "../models/User.js";
import { Permissions } from "../utils/permissions.js";

/**
 * Promotes a room member to moderator role.
 * Moderators can manage messages and members but cannot change core settings.
 * Only admins and room creator can promote to moderator.
 *
 * @route PUT /rooms/:roomId/members/:userId/promote-moderator
 * @access Private (requires admin or creator role)
 * @middleware authMiddleware - Validates user authentication
 * @middleware canAccessRoom - Verifies user is a room member
 *
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.roomId - MongoDB ObjectId of the room
 * @param {string} req.params. userId - MongoDB ObjectId of user to promote
 * @param {Object} req.user - Authenticated user (from authMiddleware)
 * @param {string} req.user.id - Current user's MongoDB ObjectId
 * @param {Object} res - Express response object
 *
 * @returns {Promise<void>} Sends JSON response with updated room data
 *
 * @throws {400} If user is not a room member
 * @throws {400} If user is already a moderator
 * @throws {403} If current user lacks permission to promote
 * @throws {404} If room is not found
 * @throws {500} If server error occurs
 *
 * @example
 * // Request
 * PUT /rooms/674d5e3f8a1b2c3d4e5f6789/members/user123/promote-moderator
 * Authorization: Bearer <token>
 *
 * @example
 * // Success Response (200)
 * {
 *   "success": true,
 *   "message": "User promoted to moderator successfully",
 *   "data": {
 *     "room": {
 *       "_id": "674d5e3f8a1b2c3d4e5f6789",
 *       "title": "Math Study Group",
 *       "moderators": ["user123", "user456"],
 *       "admins": ["admin1"]
 *     },
 *     "promotedUser": "user123",
 *     "newRole": "moderator"
 *   }
 * }
 *
 * @example
 * // Error Response (403) - No Permission
 * {
 *   "success": false,
 *   "message": "You cannot promote members to moderator"
 * }
 *
 * @example
 * // Error Response (400) - Already Moderator
 * {
 *   "success": false,
 *   "message": "User is already a moderator"
 * }
 */

export const promoteToModerator = async (req, res) => {
  try {
    const { roomId, userId } = req.params;
    const currentUserId = req.user.id;

    const room = await Room.findById(roomId);
    if (!room) return res.status(404). json({ success: false, message: "Room not found" });

    // Permission check
    if (!room.hasPermission(currentUserId, Permissions.PROMOTE_TO_MODERATOR)) {
      return res.status(403).json({ success: false, message: "You cannot promote members to moderator" });
    }

    if (! room.users.includes(userId)) {
      return res.status(400).json({ success: false, message: "User is not a member of this room" });
    }

    if (room.moderators.includes(userId)) {
      return res.status(400).json({ success: false, message: "User is already a moderator" });
    }

    room.moderators.push(userId);
    await room.save();
    await room.populate(["moderators", "users"]);

    res. status(200).json({
      success: true,
      message: "User promoted to moderator successfully",
      data: { room, promotedUser: userId, newRole: "moderator" },
    });
  } catch (err) {
    console.error("❌ Error promoting user to moderator:", err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

/**
 * Demotes a moderator back to regular member role.
 * Removes moderator privileges while keeping room membership.
 * Only admins and room creator can demote moderators.
 *
 * @route PUT /rooms/:roomId/members/:userId/demote-moderator
 * @access Private (requires admin or creator role)
 * @middleware authMiddleware - Validates user authentication
 * @middleware canAccessRoom - Verifies user is a room member
 *
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.roomId - MongoDB ObjectId of the room
 * @param {string} req.params.userId - MongoDB ObjectId of moderator to demote
 * @param {Object} req.user - Authenticated user (from authMiddleware)
 * @param {string} req.user.id - Current user's MongoDB ObjectId
 * @param {Object} res - Express response object
 *
 * @returns {Promise<void>} Sends JSON response with updated room data
 *
 * @throws {403} If current user lacks permission to demote
 * @throws {404} If room is not found
 * @throws {500} If server error occurs
 *
 * @example
 * // Request
 * PUT /rooms/674d5e3f8a1b2c3d4e5f6789/members/user123/demote-moderator
 * Authorization: Bearer <token>
 *
 * @example
 * // Success Response (200)
 * {
 *   "success": true,
 *   "message": "Moderator demoted to member successfully",
 *   "data": {
 *     "room": {
 *       "_id": "674d5e3f8a1b2c3d4e5f6789",
 *       "moderators": ["user456"]
 *     },
 *     "demotedUser": "user123",
 *     "newRole": "member"
 *   }
 * }
 *
 * @example
 * // Error Response (403) - No Permission
 * {
 *   "success": false,
 *   "message": "You cannot demote moderators"
 * }
 */

export const demoteModerator = async (req, res) => {
  try {
    const { roomId, userId } = req.params;
    const currentUserId = req. user.id;

    const room = await Room.findById(roomId);
    if (!room) return res.status(404).json({ success: false, message: "Room not found" });

    if (!room.hasPermission(currentUserId, Permissions.DEMOTE_MODERATOR)) {
      return res.status(403). json({ success: false, message: "You cannot demote moderators" });
    }

    room. moderators = room.moderators. filter(mod => mod.toString() !== userId);
    await room. save();
    await room.populate(["moderators", "users"]);

    res.status(200).json({
      success: true,
      message: "Moderator demoted to member successfully",
      data: { room, demotedUser: userId, newRole: "member" },
    });
  } catch (err) {
    console.error("❌ Error demoting moderator:", err);
    res.status(500). json({ success: false, message: "Server error", error: err. message });
  }
};

/**
 * Promotes a room member to admin role.
 * Admins have full control except transferring ownership.
 * Automatically removes from moderators list if previously a moderator.
 * Only room creator can promote to admin.
 *
 * @route PUT /rooms/:roomId/members/:userId/promote-admin
 * @access Private (requires creator role)
 * @middleware authMiddleware - Validates user authentication
 * @middleware canAccessRoom - Verifies user is a room member
 *
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.roomId - MongoDB ObjectId of the room
 * @param {string} req.params.userId - MongoDB ObjectId of user to promote
 * @param {Object} req.user - Authenticated user (from authMiddleware)
 * @param {string} req.user. id - Current user's MongoDB ObjectId (must be creator)
 * @param {Object} res - Express response object
 *
 * @returns {Promise<void>} Sends JSON response with updated room data
 *
 * @throws {400} If user is not a room member
 * @throws {400} If user is already an admin
 * @throws {403} If current user is not the room creator
 * @throws {404} If room is not found
 * @throws {500} If server error occurs
 *
 * @example
 * // Request
 * PUT /rooms/674d5e3f8a1b2c3d4e5f6789/members/user123/promote-admin
 * Authorization: Bearer <token>
 *
 * @example
 * // Success Response (200)
 * {
 *   "success": true,
 *   "message": "User promoted to admin successfully",
 *   "data": {
 *     "room": {
 *       "_id": "674d5e3f8a1b2c3d4e5f6789",
 *       "admins": ["user123", "admin1"],
 *       "moderators": []
 *     },
 *     "promotedUser": "user123",
 *     "newRole": "admin"
 *   }
 * }
 *
 * @example
 * // Error Response (403) - Not Creator
 * {
 *   "success": false,
 *   "message": "You cannot promote users to admin"
 * }
 *
 * @note If user was a moderator, they are automatically removed from moderators list
 * when promoted to admin (higher role takes precedence).
 */

export const promoteToAdmin = async (req, res) => {
  try {
    const { roomId, userId } = req.params;
    const currentUserId = req.user.id;

    const room = await Room.findById(roomId);
    if (!room) return res. status(404).json({ success: false, message: "Room not found" });

    if (!room.hasPermission(currentUserId, Permissions.PROMOTE_TO_ADMIN)) {
      return res.status(403). json({ success: false, message: "You cannot promote users to admin" });
    }

    if (! room.users.includes(userId)) {
      return res.status(400).json({ success: false, message: "User is not a member of this room" });
    }

    if (room.admins.includes(userId)) {
      return res.status(400).json({ success: false, message: "User is already an admin" });
    }

    room.admins.push(userId);
    room.moderators = room.moderators.filter(mod => mod.toString() !== userId);
    await room.save();
    await room. populate(["admins", "moderators", "users"]);

    res. status(200).json({
      success: true,
      message: "User promoted to admin successfully",
      data: { room, promotedUser: userId, newRole: "admin" },
    });
  } catch (err) {
    console.error("❌ Error promoting user to admin:", err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

/**
 * Demotes an admin back to regular member role.
 * Removes all admin privileges while keeping room membership.
 * Only room creator can demote admins.
 * Creator cannot demote themselves.
 *
 * @route PUT /rooms/:roomId/members/:userId/demote-admin
 * @access Private (requires creator role)
 * @middleware authMiddleware - Validates user authentication
 * @middleware canAccessRoom - Verifies user is a room member
 *
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.roomId - MongoDB ObjectId of the room
 * @param {string} req. params.userId - MongoDB ObjectId of admin to demote
 * @param {Object} req.user - Authenticated user (from authMiddleware)
 * @param {string} req.user.id - Current user's MongoDB ObjectId (must be creator)
 * @param {Object} res - Express response object
 *
 * @returns {Promise<void>} Sends JSON response with updated room data
 *
 * @throws {400} If user is not an admin
 * @throws {400} If creator tries to demote themselves
 * @throws {403} If current user is not the room creator
 * @throws {404} If room is not found
 * @throws {500} If server error occurs
 *
 * @example
 * // Request
 * PUT /rooms/674d5e3f8a1b2c3d4e5f6789/members/admin123/demote-admin
 * Authorization: Bearer <token>
 *
 * @example
 * // Success Response (200)
 * {
 *   "success": true,
 *   "message": "Admin demoted to member successfully",
 *   "data": {
 *     "room": {
 *       "_id": "674d5e3f8a1b2c3d4e5f6789",
 *       "admins": ["admin1"]
 *     },
 *     "demotedUser": "admin123",
 *     "newRole": "member"
 *   }
 * }
 *
 * @example
 * // Error Response (400) - Self Demotion
 * {
 *   "success": false,
 *   "message": "Creator cannot demote themselves"
 * }
 *
 * @example
 * // Error Response (403) - Not Creator
 * {
 *   "success": false,
 *   "message": "Only creator can demote admins"
 * }
 */


export const demoteAdmin = async (req, res) => {
  try {
    const { roomId, userId } = req.params;
    const currentUserId = req.user.id;

    const room = await Room.findById(roomId);
    if (!room) return res.status(404).json({ success: false, message: "Room not found" });

    if (! room.hasPermission(currentUserId, Permissions.DEMOTE_ADMIN)) {
      return res.status(403).json({ success: false, message: "Only creator can demote admins" });
    }

    if (userId === currentUserId) {
      return res.status(400).json({ success: false, message: "Creator cannot demote themselves" });
    }

    if (!room.admins.includes(userId)) {
      return res. status(400).json({ success: false, message: "User is not an admin" });
    }

    room.admins = room. admins.filter(admin => admin.toString() !== userId);
    await room.save();
    await room.populate(["admins", "users"]);

    res.status(200).json({
      success: true,
      message: "Admin demoted to member successfully",
      data: { room, demotedUser: userId, newRole: "member" },
    });
  } catch (err) {
    console.error("❌ Error demoting admin:", err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

/**
 * Updates room/group settings.
 * Settings control messaging policy, member permissions, and room behavior.
 * Only admins and creator can modify settings.
 *
 * @route PUT /rooms/:roomId/settings
 * @access Private (requires admin or creator role)
 * @middleware authMiddleware - Validates user authentication
 * @middleware canAccessRoom - Verifies user is a room member
 *
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.roomId - MongoDB ObjectId of the room
 * @param {Object} req.body - Request body
 * @param {Object} req.body.settings - Settings object to update
 * @param {string} [req.body.settings.messagingPolicy] - Who can send messages (all_members, admins_only)
 * @param {boolean} [req.body.settings. allowMemberInvites] - Can members invite others
 * @param {boolean} [req.body.settings.allowFileSharing] - Enable file uploads
 * @param {Object} req.user - Authenticated user (from authMiddleware)
 * @param {string} req.user. id - Current user's MongoDB ObjectId
 * @param {Object} res - Express response object
 *
 * @returns {Promise<void>} Sends JSON response with updated settings
 *
 * @throws {403} If user lacks permission to change settings
 * @throws {404} If room is not found
 * @throws {500} If server error occurs
 *
 * @example
 * // Request
 * PUT /rooms/674d5e3f8a1b2c3d4e5f6789/settings
 * Authorization: Bearer <token>
 * Content-Type: application/json
 *
 * {
 *   "settings": {
 *     "messagingPolicy": "admins_only",
 *     "allowMemberInvites": false,
 *     "allowFileSharing": true
 *   }
 * }
 *
 * @example
 * // Success Response (200)
 * {
 *   "success": true,
 *   "message": "Group settings updated successfully",
 *   "data": {
 *     "room": {
 *       "_id": "674d5e3f8a1b2c3d4e5f6789",
 *       "title": "Math Study Group",
 *       "settings": {
 *         "messagingPolicy": "admins_only",
 *         "allowMemberInvites": false,
 *         "allowFileSharing": true
 *       }
 *     },
 *     "updatedSettings": {
 *       "messagingPolicy": "admins_only",
 *       "allowMemberInvites": false,
 *       "allowFileSharing": true
 *     }
 *   }
 * }
 *
 * @example
 * // Error Response (403) - No Permission
 * {
 *   "success": false,
 *   "message": "You cannot change group settings"
 * }
 */

export const updateGroupSettings = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { settings } = req.body;
    const currentUserId = req. user.id;

    const room = await Room.findById(roomId);
    if (!room) return res.status(404).json({ success: false, message: "Room not found" });

    if (!room.hasPermission(currentUserId, Permissions. CHANGE_GROUP_INFO)) {
      return res.status(403).json({ success: false, message: "You cannot change group settings" });
    }

    Object.assign(room.settings, settings);
    await room.save();

    res.status(200). json({
      success: true,
      message: "Group settings updated successfully",
      data: { room, updatedSettings: room.settings },
    });
  } catch (err) {
    console.error("❌ Error updating group settings:", err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

/**
 * Retrieves all room members with their roles and management information.
 * Returns detailed member list with role hierarchy, permissions, and user details.
 * Includes current user's permissions for UI rendering.
 *
 * @route GET /rooms/:roomId/members-with-roles
 * @access Private (requires room membership)
 * @middleware authMiddleware - Validates user authentication
 * @middleware canAccessRoom - Verifies user is a room member
 *
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.roomId - MongoDB ObjectId of the room
 * @param {Object} req.user - Authenticated user (from authMiddleware)
 * @param {string} req.user.id - Current user's MongoDB ObjectId
 * @param {Object} res - Express response object
 *
 * @returns {Promise<void>} Sends JSON response with members and their roles
 *
 * @throws {403} If user is not a room member
 * @throws {404} If room is not found
 * @throws {500} If server error occurs
 *
 * @example
 * // Request
 * GET /rooms/674d5e3f8a1b2c3d4e5f6789/members-with-roles
 * Authorization: Bearer <token>
 *
 * @example
 * // Success Response (200)
 * {
 *   "success": true,
 *   "data": {
 *     "room": {
 *       "_id": "674d5e3f8a1b2c3d4e5f6789",
 *       "title": "Math Study Group",
 *       "creator": {
 *         "_id": "creator123",
 *         "username": "johndoe",
 *         "email": "john@example.com"
 *       },
 *       "settings": {
 *         "messagingPolicy": "all_members"
 *       }
 *     },
 *     "members": [
 *       {
 *         "user": {
 *           "_id": "creator123",
 *           "username": "johndoe",
 *           "email": "john@example.com",
 *           "avatar": "/uploads/avatars/john.jpg"
 *         },
 *         "role": "creator",
 *         "isCurrentUser": true,
 *         "canManage": true
 *       },
 *       {
 *         "user": {
 *           "_id": "admin1",
 *           "username": "janedoe",
 *           "email": "jane@example.com"
 *         },
 *         "role": "admin",
 *         "isCurrentUser": false,
 *         "canManage": true
 *       },
 *       {
 *         "user": {
 *           "_id": "mod1",
 *           "username": "bobsmith"
 *         },
 *         "role": "moderator",
 *         "isCurrentUser": false,
 *         "canManage": true
 *       },
 *       {
 *         "user": {
 *           "_id": "member1",
 *           "username": "alice"
 *         },
 *         "role": "member",
 *         "isCurrentUser": false,
 *         "canManage": false
 *       }
 *     ],
 *     "currentUserRole": "creator",
 *     "permissions": {
 *       "canManageMembers": true,
 *       "canChangeSettings": true
 *     }
 *   }
 * }
 *
 * @note Response includes role hierarchy: creator > admin > moderator > member
 * This data is useful for rendering admin panels and permission-based UI elements.
 */

export const getRoomMembersWithRoles = async (req, res) => {
  try {
    const { roomId } = req.params;
    const currentUserId = req.user.id;

    const room = await Room.findById(roomId)
      .populate("users", "username email avatar")
      .populate("admins", "username email avatar")
      .populate("moderators", "username email avatar")
      .populate("creator", "username email avatar");

    if (!room) return res.status(404).json({ success: false, message: "Room not found" });

    if (! room.users.some(user => user._id.toString() === currentUserId. toString())) {
      return res.status(403).json({ success: false, message: "Access denied to room members" });
    }

    const membersWithRoles = room.getMembersWithRoles();
    const populatedMembers = membersWithRoles.map(member => {
      const user = room.users.find(u => u._id.toString() === member. userId.toString());
      return {
        user,
        role: member.role,
        isCurrentUser: member. userId.toString() === currentUserId.toString(),
        canManage: ["moderator", "admin", "creator"].includes(member.role),
      };
    });

    res. status(200).json({
      success: true,
      data: {
        room: {
          _id: room._id,
          title: room.title,
          creator: room.creator,
          settings: room.settings,
        },
        members: populatedMembers,
        currentUserRole: room.getUserRole(currentUserId),
        permissions: {
          canManageMembers: room.canManageMembers(currentUserId),
          canChangeSettings: room.hasPermission(currentUserId, Permissions.CHANGE_GROUP_INFO),
        },
      },
    });
  } catch (err) {
    console.error("❌ Error fetching members with roles:", err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};
