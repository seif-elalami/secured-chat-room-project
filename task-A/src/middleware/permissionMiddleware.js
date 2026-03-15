// src/middleware/permissionMiddleware.js
import Room from '../models/Room.js';

// Generic permission middleware
export const requirePermission = (permission) => {
  return async (req, res, next) => {
    try {
      const { roomId } = req.params;
      const userId = req.user.id;

      console.log(`🔐 Checking permission: ${permission} for user ${userId} in room ${roomId}`);

      const room = await Room.findById(roomId);
      if (!room) {
        return res.status(404).json({
          success: false,
          message: "Room not found"
        });
      }

      const userRole = room.getUserRole(userId);
      const userHasPermission = room.hasPermission(userId, permission);

      if (!userHasPermission) {
        console.log(`❌ Permission denied: User ${userId} (${userRole}) cannot ${permission}`);
        return res.status(403).json({
          success: false,
          message: `Insufficient permissions. Required: ${permission}`,
          userRole: userRole
        });
      }

      req.room = room;
      console.log(`✅ Permission granted: User ${userId} (${userRole}) can ${permission}`);
      next();
    } catch (error) {
      console.error('❌ Permission middleware error:', error);
      res.status(500).json({
        success: false,
        message: "Error checking permissions",
        error: error.message
      });
    }
  };
};

// Specific middleware for common permissions
export const requireAdmin = requirePermission('change_group_info');
export const requireModerator = requirePermission('remove_members');
export const requireCreator = requirePermission('demote_admin');

// Middleware to check if user can send messages
export const requireMessageSendPermission = async (req, res, next) => {
  try {
    const { roomId } = req.body.roomId || req.params.roomId;
    const userId = req.user.id;

    if (!roomId) {
      return res.status(400).json({
        success: false,
        message: "Room ID is required"
      });
    }

    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found"
      });
    }

    if (!room.canSendMessages(userId)) {
      const userRole = room.getUserRole(userId);
      return res.status(403).json({
        success: false,
        message: `Cannot send messages. Current policy: ${room.settings.messagingPolicy}`,
        userRole: userRole,
        messagingPolicy: room.settings.messagingPolicy
      });
    }

    req.room = room;
    next();
  } catch (error) {
    console.error('❌ Message send permission error:', error);
    res.status(500).json({
      success: false,
      message: "Error checking message permissions",
      error: error.message
    });
  }
};




