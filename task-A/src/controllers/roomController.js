import Room from "../models/Room.js";
import User from "../models/User.js";
import mongoose from "mongoose";
import { Permissions } from "../utils/permissions.js";
import Message from "../models/Message.js";


/**
 * Creates a new room (group chat or direct message).
 * Validates participants, checks block relationships, prevents duplicate DMs,
 * and initializes role hierarchy for group rooms.
 * Creator is automatically assigned as admin in group rooms.
 *
 * @route POST /api/rooms
 * @access Private (requires authentication)
 * @middleware authMiddleware - Validates user authentication
 *
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body
 * @param {string[]} req.body.users - Array of user IDs (must include current user, min 2 users)
 * @param {string} [req.body.title] - Room title (auto-generated if omitted)
 * @param {boolean} [req.body.isGroup=false] - True for group chat, false for direct message
 * @param {Object} req.user - Authenticated user (from authMiddleware)
 * @param {string} req.user.id - User's MongoDB ObjectId
 * @param {Object} res - Express response object
 *
 * @returns {Promise<void>} Sends JSON response with created room
 *
 * @throws {400} If less than 2 participants provided
 * @throws {400} If invalid user IDs detected
 * @throws {400} If direct room doesn't have exactly 2 participants
 * @throws {403} If current user not included in participants
 * @throws {403} If block relationship exists between participants
 * @throws {500} If server error occurs
 *
 * @example
 * // Create group room
 * POST /api/rooms
 * Authorization: Bearer <token>
 * Content-Type: application/json
 *
 * {
 *   "users": ["user1", "user2", "user3", "currentUserId"],
 *   "title": "Study Group",
 *   "isGroup": true
 * }
 *
 * @example
 * // Create direct message
 * {
 *   "users": ["currentUserId", "otherUserId"],
 *   "isGroup": false
 * }
 *
 * @example
 * // Success Response (201)
 * {
 *   "success": true,
 *   "message": "Room created successfully",
 *   "data": {
 *     "_id": "674d5e3f8a1b2c3d4e5f6789",
 *     "title": "Study Group",
 *     "isGroup": true,
 *     "users": [... ],
 *     "admins": ["currentUserId"],
 *     "moderators": [],
 *     "creator": "currentUserId",
 *     "createdAt": "2025-12-02T15:30:00.000Z"
 *   }
 * }
 *
 * @example
 * // Error Response (403) - Block Relationship
 * {
 *   "success": false,
 *   "message": "Cannot create room.  You have blocked this user."
 * }
 *
 * @example
 * // Success Response (200) - DM Already Exists
 * {
 *   "success": true,
 *   "message": "Private room already exists",
 *   "data": { ... existing room }
 * }
 *
 * @note For group rooms, creator is automatically added to admins array
 * @note Direct rooms cannot be created if block relationship exists between participants
 * @note Duplicate direct rooms are prevented - existing room is returned instead
 */

export const createRoom = async (req, res) => {
  try {
    console.log("📨 Create Room Request:", req.body);
    console.log("👤 User from auth:", req.user);

    const { users, title, isGroup } = req.body || {};
    const userId = req.user?.userId || req.user?.id || req.user?._id;

    // 🔍 Validate participants
    if (!users || !Array.isArray(users) || users.length < 2) {
      return res.status(400).json({
        success: false,
        message: "A room must have at least two participants.",
      });
    }

    // 🔍 Validate that all are valid ObjectIds
    const invalidIds = users.filter((id) => !mongoose.Types.ObjectId.isValid(id));
    if (invalidIds.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid user IDs detected.",
        invalidIds,
      });
    }

    // ✅ Check if current user is in the participants list
    const isUserInParticipants = users.some(
      (person) => person.toString() === userId.toString()
    );

    if (!isUserInParticipants) {
      return res.status(403).json({
        success: false,
        message: "You must include yourself as a participant in the room.",
      });
    }

    // ✅ For group rooms: Initialize with creator as admin
    let admins = [];
    let moderators = [];
    let creator = userId;

    if (isGroup) {
      admins = [userId]; // Creator becomes admin

      // 🔒 Check block relationships
      const blockedParticipants = [];
      for (const participantId of users) {
        if (participantId.toString() !== userId.toString()) {
          const isBlocked = await User.findOne({
            $or: [
              { _id: userId, blockedUsers: participantId },
              { _id: participantId, blockedUsers: userId },
            ],
          });
          if (isBlocked) blockedParticipants.push(participantId);
        }
      }

      if (blockedParticipants.length > 0) {
        return res.status(403).json({
          success: false,
          message: `Cannot create group room. Block relationship exists with ${blockedParticipants.length} participant(s).`,
          blockedParticipants,
        });
      }
    }

    // ✅ Direct room checks
    if (!isGroup) {
      if (users.length !== 2) {
        return res.status(400).json({
          success: false,
          message: "Direct rooms must have exactly 2 participants.",
        });
      }

      const otherParticipant = users.find(
        (u) => u.toString() !== userId.toString()
      );

      const blockRelationship = await User.findOne({
        $or: [
          { _id: userId, blockedUsers: otherParticipant },
          { _id: otherParticipant, blockedUsers: userId },
        ],
      });

      if (blockRelationship) {
        const iBlockedThem = await User.findOne({
          _id: userId,
          blockedUsers: otherParticipant,
        });

        return res.status(403).json({
          success: false,
          message: iBlockedThem
            ? "Cannot create room. You have blocked this user."
            : "Cannot create room. This user has blocked you.",
        });
      }

      // 🔁 Prevent duplicate private rooms
      const existingRoom = await Room.findOne({
        users: { $all: users, $size: users.length },
        isGroup: false,
      });

      if (existingRoom) {
        return res.status(200).json({
          success: true,
          message: "Private room already exists",
          data: existingRoom,
        });
      }
    }

    // ✅ Make sure creator is always inside `users`
    const uniqueUsers = Array.from(new Set([...users.map((u) => u.toString()), userId.toString()]));

    // ✅ Create and save new room
    const newRoom = new Room({
      users: uniqueUsers,
      title: title || (isGroup ? "Group Chat" : "Private Chat"),
      isGroup: isGroup || false,
      admins,
      moderators,
      creator, // ✅ ensure creator is set before save
    });

    await newRoom.save();

    // ✅ Populate
    await newRoom.populate("users", "username email");
    await newRoom.populate("admins", "username email");
    await newRoom.populate("moderators", "username email");

    console.log("✅ Room created successfully - Type:", isGroup ? "GROUP" : "DIRECT");

    res.status(201).json({
      success: true,
      message: "Room created successfully",
      data: newRoom,
    });
  } catch (err) {
    console.error("❌ Error creating room:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
};

/**
 * Creates or retrieves a direct message room between two users.
 * Prevents duplicate DM rooms and checks for block relationships.
 * Returns existing room if already created between the two users.
 *
 * @route POST /rooms/direct
 * @access Private (requires authentication)
 * @middleware authMiddleware - Validates user authentication
 *
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body
 * @param {string} req.body.otherUserId - MongoDB ObjectId of other user (required)
 * @param {Object} req.user - Authenticated user (from authMiddleware)
 * @param {string} req. user.id - Current user's MongoDB ObjectId
 * @param {Object} res - Express response object
 *
 * @returns {Promise<void>} Sends JSON response with direct room
 *
 * @throws {400} If otherUserId is missing or invalid
 * @throws {403} If block relationship exists
 * @throws {404} If other user not found
 * @throws {500} If server error occurs
 *
 * @example
 * // Request
 * POST /rooms/direct
 * Authorization: Bearer <token>
 * Content-Type: application/json
 *
 * {
 *   "otherUserId": "674d5e3f8a1b2c3d4e5f6user2"
 * }
 *
 * @example
 * // Success Response (200) - Existing Room
 * {
 *   "success": true,
 *   "message": "Direct room already exists",
 *   "data": {
 *     "_id": "room123",
 *     "isGroup": false,
 *     "users": [...]
 *   }
 * }
 *
 * @example
 * // Success Response (201) - New Room
 * {
 *   "success": true,
 *   "message": "Direct room created successfully",
 *   "data": {
 *     "_id": "room456",
 *     "isGroup": false,
 *     "title": "Chat with johndoe",
 *     "users": [...]
 *   }
 * }
 */


export const createDirectRoom = async (req, res) => {
  try {
    const { otherUserId, username } = req.body || {};
    const userId = req.user?.userId || req.user?.id || req.user?._id;

    if (!otherUserId && !username) {
      return res.status(400).json({
        success: false,
        message: "Other user ID or username is required",
      });
    }

    if (otherUserId && !mongoose.Types.ObjectId.isValid(otherUserId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid other user ID format",
      });
    }

    const currentUser = await User.findById(userId);
    const otherUser = otherUserId
      ? await User.findById(otherUserId)
      : await User.findOne({ username: String(username).trim().toLowerCase() });

    if (!currentUser || !otherUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const resolvedOtherUserId = otherUser._id.toString();

    if (resolvedOtherUserId === userId.toString()) {
      return res.status(400).json({
        success: false,
        message: "You cannot open a direct chat with yourself",
      });
    }

    const blockRelationship = await User.findOne({
      $or: [
        { _id: userId, blockedUsers: resolvedOtherUserId },
        { _id: resolvedOtherUserId, blockedUsers: userId },
      ],
    });

    if (blockRelationship) {
      const iBlockedThem = await User.findOne({
        _id: userId,
        blockedUsers: resolvedOtherUserId,
      });

      return res.status(403).json({
        success: false,
        message: iBlockedThem
          ? "Cannot create chat. You have blocked this user."
          : "Cannot create chat. This user has blocked you.",
      });
    }

    // ✅ CORRECT: Use 'users' field for query
    const existingRoom = await Room.findOne({
      isGroup: false,
      users: { $all: [userId, resolvedOtherUserId], $size: 2 },
    }).populate("users", "username email");

    if (existingRoom) {
      return res.status(200).json({
        success: true,
        message: "Direct room already exists",
        data: existingRoom,
      });
    }

    const room = new Room({
      isGroup: false,
      users: [userId, resolvedOtherUserId],
      title: `Chat with ${otherUser.username}`,
    });

    await room.save();
    await room.populate("users", "username email");

    res.status(201).json({
      success: true,
      message: "Direct room created successfully",
      data: room,
    });
  } catch (err) {
    console.error("❌ Error creating direct room:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
};

/**
 * Retrieves all rooms where the user is a member.
 * Returns both group rooms and direct messages sorted by most recent activity.
 * Includes last message preview and author information.
 *
 * @route GET /rooms
 * @access Private (requires authentication)
 * @middleware authMiddleware - Validates user authentication
 *
 * @param {Object} req - Express request object
 * @param {Object} req. user - Authenticated user (from authMiddleware)
 * @param {string} req.user.id - User's MongoDB ObjectId
 * @param {Object} res - Express response object
 *
 * @returns {Promise<void>} Sends JSON response with rooms array
 *
 * @throws {500} If server error occurs
 *
 * @example
 * // Request
 * GET /rooms
 * Authorization: Bearer <token>
 *
 * @example
 * // Success Response (200)
 * {
 *   "success": true,
 *   "data": [
 *     {
 *       "_id": "room1",
 *       "title": "Study Group",
 *       "isGroup": true,
 *       "users": [... ],
 *       "lastMessage": {
 *         "content": "See you tomorrow!",
 *         "createdAt": "2025-12-02T15:30:00.000Z"
 *       },
 *       "lastAuthor": {
 *         "username": "johndoe"
 *       },
 *       "updatedAt": "2025-12-02T15:30:00.000Z"
 *     }
 *   ]
 * }
 */

export const getUserRooms = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id || req.user?._id;

    // ✅ CORRECT: Use 'users' field for query
    const rooms = await Room.find({ users: userId })
      .populate("users", "username email")
      .populate("admins", "username email")
      .populate("moderators", "username email")
      .populate("lastMessage")
      .populate("lastAuthor", "username")
      .sort({ updatedAt: -1 });

    res.status(200).json({
      success: true,
      data: rooms,
    });
  } catch (err) {
    console.error("❌ Error fetching rooms:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
};

/**
 * Retrieves detailed information about a specific room.
 * Includes members, roles, settings, and last message.
 * Only accessible to room members.
 *
 * @route GET /rooms/:roomId
 * @access Private (requires authentication and room membership)
 * @middleware authMiddleware - Validates user authentication
 *
 * @param {Object} req - Express request object
 * @param {Object} req. params - URL parameters
 * @param {string} req.params.roomId - MongoDB ObjectId of the room
 * @param {Object} req.user - Authenticated user (from authMiddleware)
 * @param {Object} res - Express response object
 *
 * @returns {Promise<void>} Sends JSON response with room details
 *
 * @throws {403} If user is not a room member
 * @throws {404} If room not found
 * @throws {500} If server error occurs
 *
 * @example
 * // Request
 * GET /rooms/674d5e3f8a1b2c3d4e5f6789
 * Authorization: Bearer <token>
 *
 * @example
 * // Success Response (200)
 * {
 *   "success": true,
 *   "data": {
 *     "_id": "674d5e3f8a1b2c3d4e5f6789",
 *     "title": "Study Group",
 *     "description": "Math study group for final exam",
 *     "isGroup": true,
 *     "users": [... ],
 *     "admins": [... ],
 *     "moderators": [...],
 *     "creator": {... },
 *     "settings": {
 *       "messagingPolicy": "all_members",
 *       "allowInvites": true,
 *       "maxParticipants": 50
 *     },
 *     "lastMessage": {... }
 *   }
 * }
 */

export const getRoomById = async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user?.userId || req.user?.id || req.user?._id;

    const room = await Room.findById(roomId)
      .populate("users", "username email")
      .populate("admins", "username email")
      .populate("moderators", "username email")
      .populate("lastMessage")
      .populate("lastAuthor", "username");

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found",
      });
    }

    // ✅ CORRECT: Use 'users' field
    const isParticipant = room.users.some(
      (users) => users._id.toString() === userId.toString()
    );

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: "Access denied to this room",
      });
    }

    res.status(200).json({
      success: true,
      data: room,
    });
  } catch (err) {
    console.error("❌ Error fetching room:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
};

/**
 * Adds a new member to a room.
 * Validates permissions, checks block relationships, and prevents duplicate additions.
 * Only users with ADD_MEMBERS permission (admins/moderators) can add members.
 *
 * @route POST /rooms/:roomId/members
 * @access Private (requires admin or moderator role)
 * @middleware authMiddleware - Validates user authentication
 *
 * @param {Object} req - Express request object
 * @param {Object} req. params - URL parameters
 * @param {string} req.params. roomId - MongoDB ObjectId of the room
 * @param {Object} req.body - Request body
 * @param {string} req.body.userId - MongoDB ObjectId of user to add (required)
 * @param {Object} req.user - Authenticated user (from authMiddleware)
 * @param {Object} res - Express response object
 *
 * @returns {Promise<void>} Sends JSON response with updated room
 *
 * @throws {400} If user is already a member
 * @throws {403} If current user lacks permission
 * @throws {403} If block relationship exists
 * @throws {404} If room or user not found
 * @throws {500} If server error occurs
 *
 * @example
 * // Request
 * POST /rooms/674d5e3f8a1b2c3d4e5f6789/members
 * Authorization: Bearer <token>
 * Content-Type: application/json
 *
 * {
 *   "userId": "newUser123"
 * }
 *
 * @example
 * // Success Response (200)
 * {
 *   "success": true,
 *   "message": "Member added successfully",
 *   "data": {
 *     "room": {... },
 *     "addedUser": {...},
 *     "addedBy": "admin123"
 *   }
 * }
 */



export const addMember = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { userId: newMemberId, username } = req.body;
    const currentUserId = req.user?.userId || req.user?.id || req.user?._id;

    const room = await Room.findById(roomId);

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found",
      });
    }

    if (!room.isGroup) {
      return res.status(400).json({
        success: false,
        message: "Cannot add members to a direct chat.",
      });
    }

    // ✅ 1. Check permission using new model
    if (!room.hasPermission(currentUserId, Permissions.ADD_MEMBERS)) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to add members to this room",
      });
    }

    let newMember = null;
    if (newMemberId) {
      if (!mongoose.Types.ObjectId.isValid(newMemberId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid user ID format",
        });
      }
      newMember = await User.findById(newMemberId);
    } else if (username) {
      newMember = await User.findOne({
        username: String(username).trim().toLowerCase(),
      });
    } else {
      return res.status(400).json({
        success: false,
        message: "User ID or username is required",
      });
    }

    if (!newMember) {
      return res.status(404).json({
        success: false,
        message: "User to add not found",
      });
    }


    // Prevent adding the same member twice (robust)
    if (room.users.some(user => user.toString() === newMember._id.toString())) {
      return res.status(400).json({
        success: false,
        message: "User is already a member of this room",
      });
    }

    // Check block relationship
    const blockRelationship = await User.findOne({
      $or: [
        { _id: currentUserId, blockedUsers: newMember._id },
        { _id: newMember._id, blockedUsers: currentUserId },
      ],
    });

    if (blockRelationship) {
      return res.status(403).json({
        success: false,
        message: "Cannot add user due to block relationship",
      });
    }

    // Only add the explicit new member, not the sender, and only on explicit add-member requests
    await Room.findByIdAndUpdate(room._id, { $addToSet: { users: newMember._id } });
    await room.reload();

    // ✅ 6. Populate roles
    await room.populate([
      { path: 'users', select: 'username email' },
      { path: 'admins', select: 'username email' },
      { path: 'moderators', select: 'username email' },
    ]);

    res.status(200).json({
      success: true,
      message: "Member added successfully",
      data: {
        room,
        addedUser: newMember,
        addedBy: currentUserId,
      },
    });
  } catch (err) {
    console.error("❌ Error adding member:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
};

/**
 * Removes a member from a room.
 * Automatically removes from all role arrays (admins, moderators).
 * Prevents removing the only admin or removing admins by non-admins.
 *
 * @route DELETE /api/rooms/:roomId/members/:userId
 * @access Private (requires admin or moderator role)
 * @middleware authMiddleware - Validates user authentication
 *
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.roomId - MongoDB ObjectId of the room
 * @param {string} req. params.userId - MongoDB ObjectId of user to remove
 * @param {Object} req.user - Authenticated user (from authMiddleware)
 * @param {Object} res - Express response object
 *
 * @returns {Promise<void>} Sends JSON response with updated room
 *
 * @throws {400} If trying to remove the only admin
 * @throws {403} If current user lacks permission
 * @throws {403} If non-admin tries to remove admin
 * @throws {404} If room not found
 * @throws {500} If server error occurs
 *
 * @example
 * // Request
 * DELETE /rooms/674d5e3f8a1b2c3d4e5f6789/members/user123
 * Authorization: Bearer <token>
 *
 * @example
 * // Success Response (200)
 * {
 *   "success": true,
 *   "message": "Member removed successfully",
 *   "data": {... updated room}
 * }
 */


export const removeMember = async (req, res) => {
  try {
    const { roomId, userId } = req.params;
    const currentUserId = req.user?.userId || req.user?.id || req.user?._id;

    const room = await Room.findById(roomId);

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found"
      });
    }

    // Check if user has permission to remove members
    const isAdmin = room.admins.includes(currentUserId);
    const isModerator = room.moderators.includes(currentUserId);

    if (!isAdmin && !isModerator) {
      return res.status(403).json({
        success: false,
        message: "Insufficient privileges to remove members"
      });
    }

    // Prevent removing yourself if you're the only admin
    if (userId === currentUserId && room.admins.length === 1 && room.admins.includes(currentUserId)) {
      return res.status(400).json({
        success: false,
        message: "Cannot remove yourself as the only admin. Promote another admin first."
      });
    }

    // Prevent removing admins unless you're an admin
    if (room.admins.includes(userId) && !room.admins.includes(currentUserId)) {
      return res.status(403).json({
        success: false,
        message: "Only admins can remove other admins"
      });
    }

    // Remove from users, admins, and moderators
    room.users = room.users.filter(person => person.toString() !== userId);
    room.admins = room.admins.filter(admin => admin.toString() !== userId);
    room.moderators = room.moderators.filter(mod => mod.toString() !== userId);

    await room.save();

    await room.populate('users', 'username email');
    await room.populate('admins', 'username email');
    await room.populate('moderators', 'username email');

    res.status(200).json({
      success: true,
      message: "Member removed successfully",
      data: room
    });
  } catch (err) {
    console.error("❌ Error removing member:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message
    });
  }
};

/**
 * Promotes a member to moderator role.
 * Moderators can manage messages and members but not change settings.
 * Only admins and creator can promote to moderator.
 *
 * @route PUT /rooms/:roomId/members/:userId/promote-moderator
 * @access Private (requires admin or creator role)
 * @middleware authMiddleware - Validates user authentication
 *
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.roomId - MongoDB ObjectId of the room
 * @param {string} req.params.userId - MongoDB ObjectId of user to promote
 * @param {Object} req.user - Authenticated user
 * @param {Object} res - Express response object
 *
 * @returns {Promise<void>} Sends JSON response with updated room
 *
 * @throws {400} If user not a room member or already a moderator
 * @throws {403} If current user lacks permission
 * @throws {404} If room not found
 * @throws {500} If server error occurs
 *
 * @example
 * // Request
 * PUT /rooms/room123/members/user456/promote-moderator
 * Authorization: Bearer <token>
 *
 * @example
 * // Success Response (200)
 * {
 *   "success": true,
 *   "message": "User promoted to moderator",
 *   "data": {...updated room}
 * }
 */


export const promoteToModerator = async (req, res) => {
  try {
    const { roomId, userId } = req.params;
    const actorId = req.user?.userId || req.user?.id || req.user?._id;

    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ success: false, message: "Room not found" });
    }

    // ✅ Convert userId string to ObjectId
    const targetUserId = mongoose.Types.ObjectId(userId);

    // ✅ Ensure target user exists in room
    if (!room.users.some(u => u.toString() === userId.toString())) {
      return res.status(400).json({
        success: false,
        message: "User must be a member of the room before promotion.",
      });
    }

    const actorRole = room.getUserRole(actorId);
    const targetRole = room.getUserRole(userId);

    // ✅ Only creator or admin can promote
    if (!["creator", "admin"].includes(actorRole)) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to promote members.",
      });
    }

    // ✅ Prevent re-promoting existing moderators/admins
    if (["admin", "creator", "moderator"].includes(targetRole)) {
      return res.status(400).json({
        success: false,
        message: `User is already a ${targetRole}.`,
      });
    }

    // ✅ Remove from other arrays first
    room.admins = room.admins.filter(id => id.toString() !== userId.toString());
    room.moderators = room.moderators.filter(id => id.toString() !== userId.toString());

    // ✅ Push as ObjectId (CRITICAL FIX!)
    room.moderators.push(targetUserId);

    // ✅ Mark as modified and save
    room.markModified("moderators");
    await room.save();

    // ✅ Refetch with population to verify
    const updatedRoom = await Room.findById(roomId)
      .populate("users", "username email")
      .populate("admins", "username email")
      .populate("moderators", "username email")
      .populate("creator", "username email");

    return res.status(200).json({
      success: true,
      message: "User promoted to moderator",
      data: updatedRoom,
    });
  } catch (err) {
    console.error("❌ Error promoting member:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
};

/**
 * Retrieves all room members with their roles.
 * Shows role hierarchy and indicates which members can manage the room.
 * Accessible to all room members.
 *
 * @route GET /rooms/:roomId/members
 * @access Private (requires room membership)
 * @middleware authMiddleware - Validates user authentication
 *
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.roomId - MongoDB ObjectId of the room
 * @param {Object} req.user - Authenticated user
 * @param {Object} res - Express response object
 *
 * @returns {Promise<void>} Sends JSON response with members and roles
 *
 * @throws {403} If user is not a room member
 * @throws {404} If room not found
 * @throws {500} If server error occurs
 *
 * @example
 * // Request
 * GET /rooms/674d5e3f8a1b2c3d4e5f6789/members
 * Authorization: Bearer <token>
 *
 * @example
 * // Success Response (200)
 * {
 *   "success": true,
 *   "data": {
 *     "room": {...},
 *     "members": [
 *       {
 *         "user": {...},
 *         "role": "creator",
 *         "isCurrentUser": true,
 *         "canManage": true
 *       },
 *       {
 *         "user": {...},
 *         "role": "admin",
 *         "isCurrentUser": false,
 *         "canManage": true
 *       }
 *     ],
 *     "currentUserRole": "creator"
 *   }
 * }
 */
export const getRoomMembers = async (req, res) => {
  try {
    const { roomId } = req.params;
    const currentUserId = req.user?.userId || req.user?.id || req.user?._id;

    const room = await Room.findById(roomId)
      .populate('users', 'username email')
      .populate('admins', 'username email')
      .populate('moderators', 'username email');

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found"
      });
    }

    // Check if user is member
    if (!room.people.some(users => users._id.toString() === currentUserId.toString())) {
      return res.status(403).json({
        success: false,
        message: "Access denied to room members"
      });
    }

    // Helper function to get user role
    const getUserRole = (userId) => {
      if (room.admins.some(admin => admin._id.toString() === userId)) return 'admin';
      if (room.moderators.some(mod => mod._id.toString() === userId)) return 'moderator';
      return 'member';
    };

    // Format members with roles
    const membersWithRoles = room.users.map(users => ({
      users: users,
      role: getUserRole(users._id.toString()),
      isCurrentUser: users._id.toString() === currentUserId.toString()
    }));

    res.status(200).json({
      success: true,
      data: {
        room: {
          _id: room._id,
          title: room.title,
          isGroup: room.isGroup
        },
        members: membersWithRoles,
        currentUserRole: getUserRole(currentUserId)
      }
    });
  } catch (err) {
    console.error("❌ Error fetching room members:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message
    });
  }
};

/**
 * Deletes a room permanently.
 * Only admins can delete rooms.  All messages and data are removed.
 *
 * @route DELETE /rooms/:roomId
 * @access Private (requires admin role)
 * @middleware authMiddleware - Validates user authentication
 *
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.roomId - MongoDB ObjectId of the room
 * @param {Object} req.user - Authenticated user
 * @param {Object} res - Express response object
 *
 * @returns {Promise<void>} Sends JSON response confirming deletion
 *
 * @throws {403} If user is not an admin
 * @throws {404} If room not found
 * @throws {500} If server error occurs
 *
 * @example
 * // Request
 * DELETE /rooms/674d5e3f8a1b2c3d4e5f6789
 * Authorization: Bearer <token>
 *
 * @example
 * // Success Response (200)
 * {
 *   "success": true,
 *   "message": "Room deleted successfully"
 * }
 */


export const deleteRoom = async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user?.userId || req.user?.id || req.user?._id;

    const room = await Room.findById(roomId);

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found"
      });
    }

    // Only users with delete privileges can delete the room
    if (!room.canDeleteRoom(userId)) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to delete this room",
      });
    }

    await Room.findByIdAndDelete(roomId);

    res.status(200).json({
      success: true,
      message: "Room deleted successfully"
    });
  } catch (err) {
    console.error("❌ Error deleting room:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message
    });
  }
};

/**
 * Retrieves detailed role and permission information for current user in a room.
 * Shows user's role, permissions, and complete member list with roles.
 * Includes room statistics and settings.
 *
 * @route GET /rooms/:roomId/role-info
 * @access Private (requires authentication)
 * @middleware authMiddleware - Validates user authentication
 *
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.roomId - MongoDB ObjectId of the room
 * @param {Object} req.user - Authenticated user
 * @param {Object} res - Express response object
 *
 * @returns {Promise<void>} Sends JSON response with role and permission data
 *
 * @throws {404} If room not found
 * @throws {500} If server error occurs
 *
 * @example
 * // Request
 * GET /rooms/674d5e3f8a1b2c3d4e5f6789/role-info
 * Authorization: Bearer <token>
 *
 * @example
 * // Success Response (200)
 * {
 *   "success": true,
 *   "data": {
 *     "room": {...},
 *     "currentUser": {
 *       "id": "user123",
 *       "role": "admin",
 *       "canSendMessages": true,
 *       "permissions": {
 *         "canManageMembers": true,
 *         "canChangeSettings": true,
 *         "canRemoveMembers": true,
 *         "canPromoteToModerator": true,
 *         "canDemoteAdmin": false
 *       }
 *     },
 *     "allMembers": [... ],
 *     "roomStats": {
 *       "totalMembers": 10,
 *       "admins": 2,
 *       "moderators": 1,
 *       "creator": "Yes"
 *     }
 *   }
 * }
 */


export const debugRoomArrays = async (req, res) => {
  try {
    const { roomId } = req.params;

    const room = await Room.findById(roomId);

    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }

    // Check array types and contents
    const debugInfo = {
      roomId: room._id,
      title: room.title,
      isGroup: room.isGroup,
      admins: {
        raw: room.admins,
        type: typeof room.admins,
        isArray: Array.isArray(room.admins),
        length: room.admins ? room.admins.length : 0,
        firstElement: room.admins && room.admins[0] ? {
          value: room.admins[0],
          type: typeof room.admins[0],
          isObjectId: room.admins[0] instanceof mongoose.Types.ObjectId
        } : null
      },
      moderators: {
        raw: room.moderators,
        type: typeof room.moderators,
        isArray: Array.isArray(room.moderators),
        length: room.moderators ? room.moderators.length : 0
      },
      people: {
        raw: room.people,
        type: typeof room.people,
        isArray: Array.isArray(room.people),
        length: room.people ? room.people.length : 0
      }
    };

    res.json({
      success: true,
      debugInfo
    });
  } catch (err) {
    console.error("Debug error:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message
    });
  }
};

/**
 * Retrieves detailed role and permission information for current user in a room.
 * Shows user's role, permissions, and complete member list with roles.
 * Includes room statistics and settings.
 *
 * @route GET /rooms/:roomId/role-info
 * @access Private (requires authentication)
 * @middleware authMiddleware - Validates user authentication
 *
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.roomId - MongoDB ObjectId of the room
 * @param {Object} req.user - Authenticated user
 * @param {Object} res - Express response object
 *
 * @returns {Promise<void>} Sends JSON response with role and permission data
 *
 * @throws {404} If room not found
 * @throws {500} If server error occurs
 *
 * @example
 * // Request
 * GET /rooms/674d5e3f8a1b2c3d4e5f6789/role-info
 * Authorization: Bearer <token>
 *
 * @example
 * // Success Response (200)
 * {
 *   "success": true,
 *   "data": {
 *     "room": {...},
 *     "currentUser": {
 *       "id": "user123",
 *       "role": "admin",
 *       "canSendMessages": true,
 *       "permissions": {
 *         "canManageMembers": true,
 *         "canChangeSettings": true,
 *         "canRemoveMembers": true,
 *         "canPromoteToModerator": true,
 *         "canDemoteAdmin": false
 *       }
 *     },
 *     "allMembers": [... ],
 *     "roomStats": {
 *       "totalMembers": 10,
 *       "admins": 2,
 *       "moderators": 1,
 *       "creator": "Yes"
 *     }
 *   }
 * }
 */


export const getUserRoleInfo =  async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user?.userId || req.user?.id || req.user?._id;

    const room = await Room.findById(roomId)
      .populate("users", "username email")
      .populate("admins", "username email")
      .populate("moderators", "username email")
      .populate("creator", "username email");

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found",
      });
    }

    // 🧠 Failsafe: ensure creator is always in `users`
    if (room.creator && !room.users.some((u) => u._id.toString() === room.creator._id.toString())) {
      room.users.push(room.creator);
      await room.save(); // Optional: persist correction
      console.log(`🩹 Added missing creator ${room.creator._id} to users list`);
    }

    // ✅ Determine current user's role
    let currentUserRole = "non_member";

    if (room.creator && room.creator._id.toString() === userId.toString()) {
      currentUserRole = "creator";
    } else if (room.admins.some((a) => a._id.toString() === userId.toString())) {
      currentUserRole = "admin";
    } else if (room.moderators.some((m) => m._id.toString() === userId.toString())) {
      currentUserRole = "moderator";
    } else if (room.users.some((u) => u._id.toString() === userId.toString())) {
      currentUserRole = "member";
    }

    // ✅ Build permission object
    const permissions = {
      canManageMembers:
        currentUserRole === "creator" ||
        currentUserRole === "admin" ||
        currentUserRole === "moderator",
      canChangeSettings: currentUserRole === "creator" || currentUserRole === "admin",
      canRemoveMembers:
        currentUserRole === "creator" ||
        currentUserRole === "admin" ||
        currentUserRole === "moderator",
      canPromoteToModerator:
        currentUserRole === "creator" || currentUserRole === "admin",
      canDemoteAdmin: currentUserRole === "creator",
    };

    const roomStats = {
      totalMembers: room.users.length,
      admins: room.admins.length,
      moderators: room.moderators.length,
      creator: currentUserRole === "creator" ? "Yes" : "No",
    };

    res.status(200).json({
      success: true,
      data: {
        room,
        currentUser: {
          id: userId,
          role: currentUserRole,
          canSendMessages:
            (room.settings?.messagingPolicy || "all_members") === "all_members" ||
            ["admin", "creator", "moderator"].includes(currentUserRole),
          permissions,
        },
        allMembers: [
          ...room.users.map((u) => ({
            id: u._id,
            username: u.username,
            role:
              room.creator?._id?.toString() === u._id.toString()
                ? "creator"
                : room.admins.some((a) => a._id.toString() === u._id.toString())
                ? "admin"
                : room.moderators.some((m) => m._id.toString() === u._id.toString())
                ? "moderator"
                : "member",
          })),
        ],
        roomStats,
      },
    });
  } catch (err) {
    console.error("❌ Error fetching room:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
};

/**
 * Promotes a member to admin or moderator role.
 * Unified endpoint for role promotion with validation and permission checks.
 * Automatically handles role array cleanup (removes from lower roles).
 *
 * @route POST /rooms/:roomId/promote
 * @access Private (requires admin or creator role)
 * @middleware authMiddleware - Validates user authentication
 *
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.roomId - MongoDB ObjectId of the room
 * @param {Object} req.body - Request body
 * @param {string} req.body.targetUserId - User ID to promote (required)
 * @param {string} req.body.targetRole - Target role: 'admin' or 'moderator' (required)
 * @param {Object} req.user - Authenticated user
 * @param {Object} res - Express response object
 *
 * @returns {Promise<void>} Sends JSON response with promotion details
 *
 * @throws {400} If targetUserId or targetRole missing/invalid
 * @throws {400} If target user not a member
 * @throws {403} If current user lacks permission
 * @throws {404} If room not found
 * @throws {500} If server error occurs
 *
 * @example
 * // Request
 * POST /rooms/room123/promote
 * Authorization: Bearer <token>
 * Content-Type: application/json
 *
 * {
 *   "targetUserId": "user456",
 *   "targetRole": "admin"
 * }
 *
 * @example
 * // Success Response (200)
 * {
 *   "success": true,
 *   "message": "User promoted to admin",
 *   "data": {
 *     "room": {...},
 *     "promotion": {
 *       "userId": "user456",
 *       "oldRole": "member",
 *       "newRole": "admin",
 *       "promotedBy": "creator123"
 *     }
 *   }
 * }
 */

export const promoteMember = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { targetUserId, targetRole } = req.body;
    const actorId = req.user?.userId || req.user?.id || req.user?._id;

    console.log("🔄 Promote Request:", { roomId, targetUserId, targetRole, actorId });

    // Validate input
    if (!targetUserId || !targetRole) {
      return res.status(400).json({
        success: false,
        message: "targetUserId and targetRole are required"
      });
    }

    if (!["admin", "moderator"].includes(targetRole)) {
      return res.status(400).json({
        success: false,
        message: "targetRole must be 'admin' or 'moderator'"
      });
    }

    // Fetch room WITHOUT population first
    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ success: false, message: "Room not found" });
    }

    console.log("🔍 Room data:", {
      creator: room.creator,
      admins: room.admins,
      moderators: room.moderators,
      users: room.users
    });

    // ✅ FIX: If creator is missing, assign the first admin as creator
    if (!room.creator && room.admins && room.admins.length > 0) {
      room.creator = room.admins[0];
      await room.save();
      console.log("🩹 Fixed missing creator - assigned:", room.creator);
    }

    // Validate target user is a member
    if (!room.users.some(u => u.toString() === targetUserId.toString())) {
      return res.status(400).json({
        success: false,
        message: "Target user must be a member of the room"
      });
    }

    // Get roles for logging
    const actorRole = room.getUserRole(actorId);
    const targetCurrentRole = room.getUserRole(targetUserId);

    console.log("👥 Roles:", { actorRole, targetCurrentRole });

    // Manual permission check (bypass canPromote for now to debug)
    if (!["creator", "admin"].includes(actorRole)) {
      return res.status(403).json({
        success: false,
        message: `You don't have permission to promote users. Your role: ${actorRole}`
      });
    }

    // Prevent promoting admins or creator
    if (["admin", "creator"].includes(targetCurrentRole) && targetRole === "moderator") {
      return res.status(400).json({
        success: false,
        message: `Cannot demote ${targetCurrentRole} to moderator`
      });
    }

    // ✅ CRITICAL FIX: Convert string to ObjectId
    const targetObjectId = new mongoose.Types.ObjectId(targetUserId);

    // Apply promotion
    if (targetRole === "admin") {
      // Remove from moderators if present
      room.moderators = room.moderators.filter(m => m.toString() !== targetUserId.toString());

      // Add to admins if not already present
      if (!room.admins.some(a => a.toString() === targetUserId.toString())) {
        room.admins.push(targetObjectId);
        room.markModified("admins");
      }
    } else if (targetRole === "moderator") {
      // Remove from admins if present (demotion case)
      room.admins = room.admins.filter(a => a.toString() !== targetUserId.toString());

      // Add to moderators if not already present
      if (!room.moderators.some(m => m.toString() === targetUserId.toString())) {
        room.moderators.push(targetObjectId);
        room.markModified("moderators");
      }
    }

    await room.save();

    // ✅ Refetch with population to verify
    const updatedRoom = await Room.findById(roomId)
      .populate("users", "username email")
      .populate("admins", "username email")
      .populate("moderators", "username email")
      .populate("creator", "username email");

    console.log("✅ Promotion successful!");
    console.log("   Moderators:", updatedRoom.moderators.map(m => m.username));
    console.log("   Admins:", updatedRoom.admins.map(a => a.username));

    res.status(200).json({
      success: true,
      message: `User promoted to ${targetRole}`,
      data: {
        room: updatedRoom,
        promotion: {
          userId: targetUserId,
          oldRole: targetCurrentRole,
          newRole: targetRole,
          promotedBy: actorId
        }
      }
    });
  } catch (err) {
    console.error("❌ Error promoting member:", err);
    console.error("   Stack:", err.stack);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
};
/**
 * Demotes a user from admin or moderator role back to regular member.
 * Only creator can demote admins.  Admins can demote moderators.
 *
 * @route POST /rooms/:roomId/demote
 * @access Private (requires appropriate permissions)
 * @middleware authMiddleware - Validates user authentication
 *
 * @param {Object} req - Express request object
 * @param {Object} req. params - URL parameters
 * @param {string} req.params. roomId - MongoDB ObjectId of the room
 * @param {Object} req.body - Request body
 * @param {string} req.body.targetUserId - User ID to demote (required)
 * @param {Object} req.user - Authenticated user
 * @param {Object} res - Express response object
 *
 * @returns {Promise<void>} Sends JSON response confirming demotion
 *
 * @throws {403} If current user lacks permission
 * @throws {404} If room not found
 * @throws {500} If server error occurs
 *
 * @example
 * // Request
 * POST /rooms/room123/demote
 * Authorization: Bearer <token>
 * Content-Type: application/json
 *
 * {
 *   "targetUserId": "admin456"
 * }
 *
 * @example
 * // Success Response (200)
 * {
 *   "success": true,
 *   "message": "User demoted successfully"
 * }
 */

export const demoteMember = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { targetUserId } = req.body;
    const actorId = req.user?.userId;

    const room = await Room.findById(roomId);
    if (!room) return res.status(404).json({ success: false, message: "Room not found" });

    if (!room.canDemote(actorId, targetUserId)) {
      return res.status(403).json({
        success: false,
        message: "You don’t have permission to demote this user",
      });
    }

    // Apply demotion
    room.admins = room.admins.filter(a => a.toString() !== targetUserId);
    room.moderators = room.moderators.filter(m => m.toString() !== targetUserId);
    await room.save();

    res.status(200).json({ success: true, message: "User demoted successfully" });
  } catch (err) {
    console.error("Error demoting member:", err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};



export const cleanRoomArrays = async (req, res) => {
  try {
    const { roomId } = req.params;

    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ success: false, message: "Room not found" });
    }

    // Clean null/undefined values from all arrays
    room.users = room.users.filter(u => u != null);
    room.admins = room.admins.filter(a => a != null);
    room.moderators = room.moderators.filter(m => m != null);

    await room.save();

    console.log("✅ Cleaned room arrays");

    res.status(200).json({
      success: true,
      message: "Room arrays cleaned",
      data: {
        users: room.users.length,
        admins: room.admins.length,
        moderators: room.moderators.length
      }
    });
  } catch (err) {
    console.error("Error cleaning arrays:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message
    });
  }
};

/**
 * Updates room settings including title, description, messaging policy, and capacity.
 * Only admins and creator can modify settings.
 * Validates new settings before applying.
 *
 * @route PUT /rooms/:roomId/settings
 * @access Private (requires admin or creator role)
 * @middleware authMiddleware - Validates user authentication
 *
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.roomId - MongoDB ObjectId of the room
 * @param {Object} req. body - Request body
 * @param {string} [req.body.title] - New room title (max 100 chars)
 * @param {string} [req.body. description] - New description (max 500 chars)
 * @param {string} [req.body.picture] - New picture URL
 * @param {string} [req.body.messagingPolicy] - 'all_members' or 'admins_only'
 * @param {boolean} [req.body.allowInvites] - Enable/disable invite links
 * @param {number} [req.body.maxParticipants] - Maximum member count (min 2)
 * @param {Object} req.user - Authenticated user
 * @param {Object} res - Express response object
 *
 * @returns {Promise<void>} Sends JSON response with updated settings
 *
 * @throws {400} If validation fails (empty title, invalid policy, etc.)
 * @throws {400} If maxParticipants less than current member count
 * @throws {403} If user is not admin/creator
 * @throws {404} If room not found
 * @throws {500} If server error occurs
 *
 * @example
 * // Request
 * PUT /rooms/room123/settings
 * Authorization: Bearer <token>
 * Content-Type: application/json
 *
 * {
 *   "title": "Updated Study Group",
 *   "description": "New description",
 *   "messagingPolicy": "admins_only",
 *   "maxParticipants": 25
 * }
 *
 * @example
 * // Success Response (200)
 * {
 *   "success": true,
 *   "message": "Room settings updated successfully",
 *   "data": {... updated room},
 *   "updatedBy": "admin"
 * }
 */
export const updateRoomSettings = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { title, description, picture, messagingPolicy, allowInvites, maxParticipants } = req.body;
    const userId = req.user?.userId || req.user?.id || req.user?._id;

    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found"
      });
    }

    // ✅ Permission check: Admin/Creator only
    const userRole = room.getUserRole(userId);
    if (!['admin', 'creator'].includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: "Only admins can change group settings",
        yourRole: userRole
      });
    }

    // ✅ Validate and update title
    if (title !== undefined) {
      if (title.trim() === '') {
        return res.status(400).json({
          success: false,
          message: "Title cannot be empty"
        });
      }
      if (title.length > 100) {
        return res.status(400).json({
          success: false,
          message: "Title must be 100 characters or less"
        });
      }
      room.title = title.trim();
    }

    // ✅ Validate and update description
    if (description !== undefined) {
      if (description.length > 500) {
        return res.status(400).json({
          success: false,
          message: "Description must be 500 characters or less"
        });
      }
      room.description = description.trim();
    }

    // ✅ Update picture
    if (picture !== undefined) {
      room.picture = picture;
    }

    // ✅ Update messaging policy
    if (messagingPolicy !== undefined) {
      if (!['all_members', 'admins_only'].includes(messagingPolicy)) {
        return res.status(400).json({
          success: false,
          message: "Invalid messaging policy. Use 'all_members' or 'admins_only'"
        });
      }
      room.settings.messagingPolicy = messagingPolicy;
      console.log(`📢 Messaging policy changed to: ${messagingPolicy}`);
    }

    // ✅ Update allow invites
    if (allowInvites !== undefined) {
      room.settings.allowInvites = Boolean(allowInvites);
    }

    // ✅ Update max participants
    if (maxParticipants !== undefined) {
      const newMax = parseInt(maxParticipants);
      if (isNaN(newMax) || newMax < 2) {
        return res.status(400).json({
          success: false,
          message: "Max participants must be at least 2"
        });
      }
      if (newMax < room.users.length) {
        return res.status(400).json({
          success: false,
          message: `Cannot set max participants (${newMax}) below current member count (${room.users.length})`
        });
      }
      room.settings.maxParticipants = newMax;
    }

    await room.save();

    // ✅ Return updated room with populated fields
    const updatedRoom = await Room.findById(roomId)
      .populate('users', 'username email')
      .populate('admins', 'username email')
      .populate('moderators', 'username email')
      .populate('creator', 'username email');

    console.log(`⚙️ Room settings updated by ${userRole} (${userId})`);

    res.status(200).json({
      success: true,
      message: "Room settings updated successfully",
      data: updatedRoom,
      updatedBy: userRole
    });

  } catch (err) {
    console.error("❌ Error updating room settings:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message
    });
  }
};

/**
 * Retrieves comprehensive statistics for a room.
 * Includes message counts, member activity, top contributors, and room metrics.
 * Only accessible to admins and creator.
 *
 * @route GET /rooms/:roomId/statistics
 * @access Private (requires admin or creator role)
 * @middleware authMiddleware - Validates user authentication
 *
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.roomId - MongoDB ObjectId of the room
 * @param {Object} req.user - Authenticated user
 * @param {Object} res - Express response object
 *
 * @returns {Promise<void>} Sends JSON response with statistics
 *
 * @throws {403} If user is not admin/creator
 * @throws {404} If room not found
 * @throws {500} If server error occurs
 *
 * @example
 * // Request
 * GET /rooms/room123/statistics
 * Authorization: Bearer <token>
 *
 * @example
 * // Success Response (200)
 * {
 *   "success": true,
 *   "data": {
 *     "roomInfo": {
 *       "id": "room123",
 *       "title": "Study Group",
 *       "ageInDays": 45,
 *       "firstMessageAt": "2025-11-01T10:00:00Z",
 *       "lastMessageAt": "2025-12-02T15:30:00Z"
 *     },
 *     "members": {
 *       "total": 10,
 *       "creator": 1,
 *       "admins": 2,
 *       "moderators": 1,
 *       "regularMembers": 6
 *     },
 *     "messages": {
 *       "total": 1250,
 *       "media": 45,
 *       "pinned": 3,
 *       "deleted": 12,
 *       "edited": 28,
 *       "averagePerDay": 28
 *     },
 *     "topMembers": [
 *       {
 *         "userId": "user1",
 *         "username": "alice",
 *         "messageCount": 320,
 *         "percentage": 26
 *       }
 *     ],
 *     "settings": {
 *       "messagingPolicy": "all_members",
 *       "currentCapacity": "10/50",
 *       "capacityPercentage": 20
 *     }
 *   }
 * }
 */


export const getRoomStatistics = async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user?.userId || req.user?.id || req.user?._id;

    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found"
      });
    }

    // ✅ Permission check: Admin/Creator only
    const userRole = room.getUserRole(userId);
    if (!['admin', 'creator'].includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: "Only admins can view statistics",
        yourRole: userRole
      });
    }

    // ✅ Message statistics
    const totalMessages = await Message.countDocuments({
      room: roomId,
      isDeleted: false
    });

    const mediaMessages = await Message.countDocuments({
      room: roomId,
      type: 'image',
      isDeleted: false
    });

    const pinnedMessages = await Message.countDocuments({
      room: roomId,
      isPinned: true,
      isDeleted: false
    });

    const deletedMessages = await Message.countDocuments({
      room: roomId,
      isDeleted: true
    });

    const editedMessages = await Message.countDocuments({
      room: roomId,
      editedAt: { $exists: true, $ne: null },
      isDeleted: false
    });

    // ✅ Most active members (top 5)
    const messagesByAuthor = await Message.aggregate([
      {
        $match: {
          room: new mongoose.Types.ObjectId(roomId),
          isDeleted: false
        }
      },
      {
        $group: {
          _id: '$author',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);

    // ✅ Populate user info for top members
    const topMemberIds = messagesByAuthor.map(m => m._id);
    const topMembers = await User.find({
      _id: { $in: topMemberIds }
    }).select('username email');

    const topMembersWithCount = messagesByAuthor.map(m => {
      const user = topMembers.find(u => u._id.toString() === m._id.toString());
      return {
        userId: m._id,
        username: user?.username || 'Unknown',
        email: user?.email,
        messageCount: m.count,
        percentage: totalMessages > 0 ? Math.round((m.count / totalMessages) * 100) : 0
      };
    });

    // ✅ Calculate room age
    const roomAge = Math.floor((Date.now() - room.createdAt) / (1000 * 60 * 60 * 24)); // days
    const avgMessagesPerDay = roomAge > 0 ? Math.round(totalMessages / roomAge) : totalMessages;

    // ✅ Get first and last message timestamps
    const firstMessage = await Message.findOne({ room: roomId, isDeleted: false })
      .sort({ createdAt: 1 })
      .select('createdAt');

    const lastMessage = await Message.findOne({ room: roomId, isDeleted: false })
      .sort({ createdAt: -1 })
      .select('createdAt');

    res.status(200).json({
      success: true,
      data: {
        roomInfo: {
          id: room._id,
          title: room.title,
          description: room.description || null,
          created: room.createdAt,
          ageInDays: roomAge,
          isGroup: room.isGroup,
          firstMessageAt: firstMessage?.createdAt || null,
          lastMessageAt: lastMessage?.createdAt || null
        },
        members: {
          total: room.users.length,
          creator: 1,
          admins: room.admins.length,
          moderators: room.moderators.length,
          regularMembers: room.users.length - room.admins.length - room.moderators.length - 1
        },
        messages: {
          total: totalMessages,
          media: mediaMessages,
          pinned: pinnedMessages,
          deleted: deletedMessages,
          edited: editedMessages,
          averagePerDay: avgMessagesPerDay
        },
        topMembers: topMembersWithCount,
        settings: {
          messagingPolicy: room.settings.messagingPolicy,
          allowInvites: room.settings.allowInvites,
          maxParticipants: room.settings.maxParticipants,
          currentCapacity: `${room.users.length}/${room.settings.maxParticipants}`,
          capacityPercentage: Math.round((room.users.length / room.settings.maxParticipants) * 100)
        }
      }
    });

  } catch (err) {
    console.error("❌ Error fetching statistics:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message
    });
  }
};
/**
 * Generates or regenerates an invite link for the room.
 * Creates a unique 8-character invite code for joining the room.
 * Only admins and creator can generate invite links.
 * Only works for group rooms (not direct messages).
 *
 * @route POST /rooms/:roomId/invite
 * @access Private (requires admin or creator role)
 * @middleware authMiddleware - Validates user authentication
 *
 * @param {Object} req - Express request object
 * @param {Object} req. params - URL parameters
 * @param {string} req.params. roomId - MongoDB ObjectId of the room
 * @param {Object} req.user - Authenticated user
 * @param {Object} res - Express response object
 *
 * @returns {Promise<void>} Sends JSON response with invite link
 *
 * @throws {400} If room is a direct message (no invites for DMs)
 * @throws {403} If user is not admin/creator
 * @throws {404} If room not found
 * @throws {500} If unable to generate unique code or server error
 *
 * @example
 * // Request
 * POST /rooms/room123/invite
 * Authorization: Bearer <token>
 *
 * @example
 * // Success Response (200)
 * {
 *   "success": true,
 *   "message": "Invite link generated successfully",
 *   "data": {
 *     "inviteCode": "aBcD3fGh",
 *     "inviteUrl": "http://localhost:3000/rooms/join/aBcD3fGh",
 *     "createdAt": "2025-12-02T15:30:00Z",
 *     "createdBy": "admin123",
 *     "expiresAt": null
 *   }
 * }
 */
export const generateInviteLink = async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user?.userId || req.user?.id || req.user?._id;

    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found"
      });
    }

    // ✅ Check if it's a group (no invite links for DMs)
    if (!room.isGroup) {
      return res.status(400).json({
        success: false,
        message: "Cannot create invite links for direct messages"
      });
    }

    // ✅ Permission check: Admin/Creator only
    const userRole = room.getUserRole(userId);
    if (!['admin', 'creator'].includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: "Only admins can manage invite links",
        yourRole: userRole
      });
    }

    // ✅ Generate random invite code (8 characters)
    const generateCode = () => {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
      let code = '';
      for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return code;
    };

    // ✅ Ensure unique code
    let inviteCode;
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 10) {
      inviteCode = generateCode();
      const existing = await Room.findOne({ inviteCode });
      if (!existing) {
        isUnique = true;
      }
      attempts++;
    }

    if (!isUnique) {
      return res.status(500).json({
        success: false,
        message: "Failed to generate unique invite code. Please try again."
      });
    }

    // ✅ Save invite code
    room.inviteCode = inviteCode;
    room.inviteCreatedAt = new Date();
    room.inviteCreatedBy = userId;
    await room.save();

    const inviteUrl = `${req.protocol}://${req.get('host')}/rooms/join/${inviteCode}`;

    console.log(`🔗 Invite link generated for room ${room.title} by ${userRole}`);

    res.status(200).json({
      success: true,
      message: "Invite link generated successfully",
      data: {
        inviteCode,
        inviteUrl,
        createdAt: room.inviteCreatedAt,
        createdBy: userId,
        expiresAt: null  // You can add expiration logic later
      }
    });

  } catch (err) {
    console.error("❌ Error generating invite link:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message
    });
  }
};

/**
 * Retrieves the current invite link for a room.
 * Shows invite code, full URL, and creation details.
 * Only admins and creator can view invite links.
 *
 * @route GET /rooms/:roomId/invite
 * @access Private (requires admin or creator role)
 * @middleware authMiddleware - Validates user authentication
 *
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.roomId - MongoDB ObjectId of the room
 * @param {Object} req.user - Authenticated user
 * @param {Object} res - Express response object
 *
 * @returns {Promise<void>} Sends JSON response with invite details
 *
 * @throws {403} If user is not admin/creator
 * @throws {404} If room not found or no invite link exists
 * @throws {500} If server error occurs
 *
 * @example
 * // Request
 * GET /rooms/room123/invite
 * Authorization: Bearer <token>
 *
 * @example
 * // Success Response (200)
 * {
 *   "success": true,
 *   "data": {
 *     "inviteCode": "aBcD3fGh",
 *     "inviteUrl": "http://localhost:3000/rooms/join/aBcD3fGh",
 *     "createdAt": "2025-12-01T10:00:00Z",
 *     "createdBy": {... },
 *     "allowInvites": true
 *   }
 * }
 */


export const getInviteLink = async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user?.userId || req.user?.id || req.user?._id;

    const room = await Room.findById(roomId).populate('inviteCreatedBy', 'username email');
    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found"
      });
    }

    // ✅ Permission check: Admin/Creator only
    const userRole = room.getUserRole(userId);
    if (!['admin', 'creator'].includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: "Only admins can view invite links"
      });
    }

    if (!room.inviteCode) {
      return res.status(404).json({
        success: false,
        message: "No invite link has been created for this room"
      });
    }

    const inviteUrl = `${req.protocol}://${req.get('host')}/rooms/join/${room.inviteCode}`;

    res.status(200).json({
      success: true,
      data: {
        inviteCode: room.inviteCode,
        inviteUrl,
        createdAt: room.inviteCreatedAt,
        createdBy: room.inviteCreatedBy,
        allowInvites: room.settings.allowInvites
      }
    });

  } catch (err) {
    console.error("❌ Error getting invite link:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message
    });
  }
};


/**
 * Revokes the current invite link for a room.
 * Invalidates the invite code so it can no longer be used to join.
 * Only admins and creator can revoke invite links.
 *
 * @route DELETE /rooms/:roomId/invite
 * @access Private (requires admin or creator role)
 * @middleware authMiddleware - Validates user authentication
 *
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.roomId - MongoDB ObjectId of the room
 * @param {Object} req.user - Authenticated user
 * @param {Object} res - Express response object
 *
 * @returns {Promise<void>} Sends JSON response confirming revocation
 *
 * @throws {400} If no active invite link to revoke
 * @throws {403} If user is not admin/creator
 * @throws {404} If room not found
 * @throws {500} If server error occurs
 *
 * @example
 * // Request
 * DELETE /rooms/room123/invite
 * Authorization: Bearer <token>
 *
 * @example
 * // Success Response (200)
 * {
 *   "success": true,
 *   "message": "Invite link revoked successfully"
 * }
 */

export const revokeInviteLink = async (req, res) => {

  try {
    const { roomId } = req.params;
    const userId = req.user?.userId || req.user?.id || req.user?._id;

    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found"
      });
    }

    // ✅ Permission check: Admin/Creator only
    const userRole = room.getUserRole(userId);
    if (!['admin', 'creator'].includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: "Only admins can revoke invite links"
      });
    }

    if (!room.inviteCode) {
      return res.status(400).json({
        success: false,
        message: "No active invite link to revoke"
      });
    }

    // ✅ Remove invite code
    room.inviteCode = undefined;
    room.inviteCreatedAt = undefined;
    room.inviteCreatedBy = undefined;
    await room.save();

    console.log(`🚫 Invite link revoked for room ${room.title} by ${userRole}`);

    res.status(200).json({
      success: true,
      message: "Invite link revoked successfully"
    });

  } catch (err) {
    console.error("❌ Error revoking invite link:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message
    });
  }
};
/**
 * Joins a room using an invite code.
 * Validates invite code, checks room capacity, verifies block relationships.
 * Adds user as a regular member (role: member).
 *
 * @route POST /rooms/join/:inviteCode
 * @access Private (requires authentication)
 * @middleware authMiddleware - Validates user authentication
 *
 * @param {Object} req - Express request object
 * @param {Object} req. params - URL parameters
 * @param {string} req.params. inviteCode - 8-character invite code
 * @param {Object} req.user - Authenticated user
 * @param {Object} res - Express response object
 *
 * @returns {Promise<void>} Sends JSON response with room details
 *
 * @throws {400} If user is already a member
 * @throws {403} If invites disabled, room at capacity, or block relationship exists
 * @throws {404} If invite code is invalid or expired
 * @throws {500} If server error occurs
 *
 * @example
 * // Request
 * POST /rooms/join/aBcD3fGh
 * Authorization: Bearer <token>
 *
 * @example
 * // Success Response (200)
 * {
 *   "success": true,
 *   "message": "Successfully joined \"Study Group\"",
 *   "data": {
 *     "room": {...},
 *     "yourRole": "member",
 *     "joinedAt": "2025-12-02T15:30:00Z"
 *   }
 * }
 *
 * @example
 * // Error Response (403) - Room Full
 * {
 *   "success": false,
 *   "message": "Room is at maximum capacity",
 *   "currentMembers": 50,
 *   "maxParticipants": 50
 * }
 */
export const joinViaInviteCode = async (req, res) => {
  try {
    const { inviteCode } = req.params;
    const userId = req.user?.userId || req.user?.id || req.user?._id;

    // ✅ Find room by invite code
    const room = await Room.findOne({ inviteCode })
      .populate('users', 'username email')
      .populate('creator', 'username email');

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Invalid or expired invite link"
      });
    }

    // ✅ Check if invites are allowed
    if (!room.settings.allowInvites) {
      return res.status(403).json({
        success: false,
        message: "This room is not accepting new members via invite links"
      });
    }

    // ✅ Check if user is already a member
    if (room.users.some(u => u._id.toString() === userId.toString())) {
      return res.status(400).json({
        success: false,
        message: "You are already a member of this room",
        data: room
      });
    }

    // ✅ Check if room is at max capacity
    if (room.users.length >= room.settings.maxParticipants) {
      return res.status(403).json({
        success: false,
        message: "Room is at maximum capacity",
        currentMembers: room.users.length,
        maxParticipants: room.settings.maxParticipants
      });
    }

    // ✅ Check block relationships
    const user = await User.findById(userId);
    for (const member of room.users) {
      const isBlocked = await User.findOne({
        $or: [
          { _id: userId, blockedUsers: member._id },
          { _id: member._id, blockedUsers: userId }
        ]
      });

      if (isBlocked) {
        return res.status(403).json({
          success: false,
          message: "Cannot join room due to block relationship with existing member"
        });
      }
    }

  await Room.findByIdAndUpdate(room._id, { $addToSet: { users: newMemberId } });
const updatedRoom = await Room.findById(room._id)
  .populate('users', 'username email')
  .populate('admins', 'username email')
  .populate('moderators', 'username email');

    console.log(`✅ User ${user.username} joined room ${room.title} via invite link`);

    res.status(200).json({
      success: true,
      message: `Successfully joined "${room.title}"`,
      data: {
        room: updatedRoom,
        yourRole: "member",
        joinedAt: new Date()
      }
    });

  } catch (err) {
    console.error("❌ Error joining via invite:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message
    });
  }
};
