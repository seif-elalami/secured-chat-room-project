import Room from "../models/Room.js";

// ✅ Middleware to check if user is room admin
export const requireRoomAdmin = async (req, res, next) => {
  try {
    const { roomId } = req.params;
    const userId = req.user?.userId || req.user?.id || req.user?._id;

    console.log(`🔍 Checking admin privileges for user ${userId} in room ${roomId}`);

    const room = await Room.findById(roomId);

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found"
      });
    }

    // FIX: Add safety check for isAdmin method
    if (typeof room.isAdmin !== 'function' || !room.isAdmin(userId)) {
      return res.status(403).json({
        success: false,
        message: "Admin privileges required for this action"
      });
    }

    req.room = room;
    next();
  } catch (err) {
    console.error("Room admin middleware error:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message
    });
  }
};

// ✅ Middleware to check if user is room moderator or admin
export const requireRoomModerator = async (req, res, next) => {
  try {
    const { roomId } = req.params;
    const userId = req.user?.userId || req.user?.id || req.user?._id;

    console.log(`🔍 Checking moderator privileges for user ${userId} in room ${roomId}`);

    const room = await Room.findById(roomId);

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found"
      });
    }

    // FIX: Add safety check for isModerator method
    if (typeof room.isModerator !== 'function' || !room.isModerator(userId)) {
      return res.status(403).json({
        success: false,
        message: "Moderator privileges required for this action"
      });
    }

    req.room = room;
    next();
  } catch (err) {
    console.error("Room moderator middleware error:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message
    });
  }
};

// ✅ Middleware to check if user can manage members
export const requireMemberManagement = async (req, res, next) => {
  try {
    const { roomId } = req.params;
    const userId = req.user?.userId || req.user?.id || req.user?._id;

    console.log(`🔍 Checking member management privileges for user ${userId} in room ${roomId}`);

    const room = await Room.findById(roomId);

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found"
      });
    }

    // FIX: Add safety check for canManageMembers method
    if (typeof room.canManageMembers !== 'function' || !room.canManageMembers(userId)) {
      return res.status(403).json({
        success: false,
        message: "Insufficient privileges to manage room members"
      });
    }

    req.room = room;
    next();
  } catch (err) {
    console.error("Member management middleware error:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message
    });
  }
};

// ✅ Middleware to check if user is room member
export const requireRoomMember = async (req, res, next) => {
  try {
    const { roomId } = req.params;
    const userId = req.user?.userId || req.user?.id || req.user?._id;

    console.log(`🔍 Checking membership for user ${userId} in room ${roomId}`);

    const room = await Room.findById(roomId);

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found"
      });
    }

    // FIX: Direct check instead of relying on isMember method
    // Check if room.users exists and contains the userId
    if (!room.users || !Array.isArray(room.users)) {
      console.log(`❌ Room ${roomId} has invalid users array:`, room.users);
      return res.status(403).json({
        success: false,
        message: "Room membership data is invalid"
      });
    }

    // Convert both to string for comparison (MongoDB IDs vs strings)
    const userIdStr = userId.toString();
    const isMember = room.users.some(user => user.toString() === userIdStr);

    if (!isMember) {
      console.log(`❌ User ${userId} is not member of room ${roomId}`);
      console.log(`   Room users:`, room.users.map(u => u.toString()));
      return res.status(403).json({
        success: false,
        message: "You are not a member of this room"
      });
    }

    req.room = room;
    console.log(`✅ User ${userId} is member of room ${roomId}`);
    next();
  } catch (err) {
    console.error("Room member middleware error:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message
    });
  }
};
