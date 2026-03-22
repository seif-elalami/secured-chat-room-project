import Room from "../models/Room.js";
import Assignment from "../models/Assignment.js";

// ========================================
// CHECK IF USER CAN CREATE ASSIGNMENT IN ROOM
// ========================================
export const canCreateAssignment = async (req, res, next) => {
  try {
    const { roomId } = req.body;
    const userId = req. user?.userId || req.user?. id || req.user?._id;

    console.log(`🎓 [ASSIGNMENT] Checking if user can create assignment in room ${roomId}`);

    if (!roomId) {
      return res.status(400).json({
        success: false,
        message: "Room ID is required"
      });
    }

    const room = await Room.findById(roomId);
    if (! room) {
      return res. status(404).json({
        success: false,
        message: "Room not found"
      });
    }

    const userRole = room.getUserRole(userId);
    console.log(`🎓 User role in room: ${userRole}`);

    // ✅ Only creator, admin, moderator can create assignments
    if (! ['creator', 'admin', 'moderator'].includes(userRole)) {
      console.log(`❌ User doesn't have permission to create assignments`);
      return res.status(403).json({
        success: false,
        message: "Only room admins and moderators can create assignments",
        userRole: userRole
      });
    }

    console.log(`✅ User can create assignments in this room`);
    req.room = room;  // Attach room to request
    next();
  } catch (err) {
    console. error("❌ Error checking assignment creation permission:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message
    });
  }
};

// ========================================
// CHECK IF USER CAN GRADE ASSIGNMENT
// ========================================
export const canGradeAssignment = async (req, res, next) => {
  try {
    const { assignmentId } = req.params;
    const userId = req.user?.userId || req.user?.id || req.user?._id;

    console. log(`🎓 [ASSIGNMENT] Checking if user can grade assignment ${assignmentId}`);

    const assignment = await Assignment.findById(assignmentId);
    if (! assignment) {
      return res. status(404).json({
        success: false,
        message: "Assignment not found"
      });
    }

    const room = await Room.findById(assignment.roomId);
    if (! room) {
      return res. status(404).json({
        success: false,
        message: "Room not found"
      });
    }

    const userRole = room.getUserRole(userId);
    console.log(`🎓 User role in room: ${userRole}`);

    // ✅ Only creator, admin, moderator can grade
    if (!['creator', 'admin', 'moderator'].includes(userRole)) {
      console.log(`❌ User doesn't have permission to grade`);
      return res.status(403).json({
        success: false,
        message: "Only room admins and moderators can grade assignments",
        userRole: userRole
      });
    }

    // ✅ Moderators can only grade their own created assignments
    if (userRole === 'moderator' && assignment.createdBy.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Moderators can only grade assignments they created"
      });
    }

    console.log(`✅ User can grade assignments in this room`);
    req.room = room;
    req.assignment = assignment;
    next();
  } catch (err) {
    console.error("❌ Error checking grading permission:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message
    });
  }
};

// ========================================
// CHECK IF USER CAN DELETE ASSIGNMENT
// ========================================
export const canDeleteAssignment = async (req, res, next) => {
  try {
    const { assignmentId } = req.params;
    const userId = req.user?. userId || req.user?.id || req.user?._id;

    console.log(`🎓 [ASSIGNMENT] Checking if user can delete assignment ${assignmentId}`);

    const assignment = await Assignment.findById(assignmentId);
    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: "Assignment not found"
      });
    }

    const room = await Room. findById(assignment.roomId);
    if (!room) {
      return res.status(404). json({
        success: false,
        message: "Room not found"
      });
    }

    const userRole = room.getUserRole(userId);
    console. log(`🎓 User role in room: ${userRole}`);

    // ✅ Only creator, admin, moderator can delete
    // OR the person who created the assignment
    const isCreator = assignment.createdBy.toString() === userId. toString();
    const canDelete = ['creator', 'admin', 'moderator'].includes(userRole) || isCreator;

    if (!canDelete) {
      console.log(`❌ User doesn't have permission to delete`);
      return res.status(403). json({
        success: false,
        message: "Only room admins, moderators, or assignment creator can delete assignments",
        userRole: userRole
      });
    }

    console.log(`✅ User can delete this assignment`);
    req.room = room;
    req.assignment = assignment;
    next();
  } catch (err) {
    console.error("❌ Error checking deletion permission:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message
    });
  }
};

// ========================================
// CHECK IF USER CAN SUBMIT ASSIGNMENT
// ========================================
export const canSubmitAssignment = async (req, res, next) => {
  try {
    const { assignmentId } = req.params;
    const userId = req. user?.userId || req.user?. id || req.user?._id;

    console.log(`🎓 [ASSIGNMENT] Checking if user can submit assignment ${assignmentId}`);

    const assignment = await Assignment.findById(assignmentId);
    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: "Assignment not found"
      });
    }

    const room = await Room.findById(assignment.roomId);
    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found"
      });
    }

    // ✅ Check if user is room member
    if (!room.isMember(userId)) {
      console. log(`❌ User is not a room member`);
      return res. status(403).json({
        success: false,
        message: "You must be a room member to submit assignments"
      });
    }

    // ✅ If assignedTo is specified, check if user is in the list
    if (assignment.assignedTo && assignment.assignedTo. length > 0) {
      const isAssigned = assignment.assignedTo.some(
        id => id.toString() === userId.toString()
      );

      if (!isAssigned) {
        console.log(`❌ User is not assigned to this assignment`);
        return res.status(403).json({
          success: false,
          message: "You are not assigned to this assignment"
        });
      }
    }

    console.log(`✅ User can submit this assignment`);
    req.room = room;
    req.assignment = assignment;
    next();
  } catch (err) {
    console.error("❌ Error checking submission permission:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message
    });
  }
};
