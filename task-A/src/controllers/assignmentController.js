import Assignment from "../models/Assignment.js";
import User from "../models/User.js";
import Room from "../models/Room.js";

/**
 * Creates a new assignment within a room.
 * Handles file attachments, validates room membership, and notifies assigned users.
 * If no specific users are assigned, all room members can submit.
 *
 * @route POST /http://localhost:3000/assignments
 * @access Private (requires authentication and room membership)
 * @middleware authMiddleware - Validates user authentication
 * @middleware canAccessRoom - Verifies user is a room member
 *
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body
 * @param {string} req.body.title - Assignment title
 * @param {string} req.body.description - Assignment description (supports Markdown)
 * @param {string} [req.body.type='assignment'] - Assignment type (assignment, task, quiz, etc.)
 * @param {string} req.body.deadline - Due date in ISO 8601 format (e.g., "2025-12-31T23:59:59Z")
 * @param {string} req.body.roomId - MongoDB ObjectId of the room
 * @param {string[]} [req.body.assignedTo=[]] - Array of user IDs who can submit (empty = all room members)
 * @param {Object} req.files - Uploaded files (from multer middleware)
 * @param {Array} [req.files.attachments] - Array of attachment files
 * @param {Object} req.user - Authenticated user (from authMiddleware)
 * @param {string} req.user.id - User's MongoDB ObjectId
 * @param {Object} req.room - Room object (from canAccessRoom middleware)
 * @param {Object} res - Express response object
 *
 * @returns {Promise<void>} Sends JSON response
 *
 * @throws {400} If title, description, or deadline is missing
 * @throws {401} If user is not authenticated
 * @throws {403} If user is not a room member
 * @throws {404} If room is not found
 * @throws {500} If server error occurs
 *
 * @example
 * // Request
 * POST http://localhost:3000/assignments
 *
 * Authorization: Bearer <token>
 * Content-Type: multipart/form-data
 *
 * Body (form-data):
 * {
 *   "title": "Homework 1",
 *   "description": "Complete exercises 1-10",
 *   "type": "assignment",
 *   "deadline": "2025-12-31T23:59:59Z",
 *   "roomId": "674d5e3f8a1b2c3d4e5f6789",
 *   "assignedTo": ["user123", "user456"],
 *   "attachments": [file1.pdf, file2.docx]
 * }
 *
 * @example
 * // Success Response (201)
 * {
 *   "success": true,
 *   "message": "Assignment created successfully",
 *   "data": {
 *     "_id": "674d5e3f8a1b2c3d4e5f6abc",
 *     "title": "Homework 1",
 *     "description": "Complete exercises 1-10",
 *     "type": "assignment",
 *     "deadline": "2025-12-31T23:59:59.000Z",
 *     "roomId": {
 *       "_id": "674d5e3f8a1b2c3d4e5f6789",
 *       "title": "Math 101",
 *       "description": "Introduction to Calculus"
 *     },
 *     "assignedTo": ["user123", "user456"],
 *     "attachments": [
 *       {
 *         "url": "/uploads/assignments/file-1733150000000-123456789.pdf",
 *         "filename": "worksheet.pdf",
 *         "mimetype": "application/pdf",
 *         "size": 245678
 *       }
 *     ],
 *     "createdBy": {
 *       "_id": "teacher123",
 *       "username": "Dr. Smith",
 *       "email": "smith@school.edu"
 *     },
 *     "createdAt": "2025-12-02T10:00:00.000Z",
 *     "updatedAt": "2025-12-02T10:00:00.000Z"
 *   }
 * }
 *
 * @example
 * // Error Response (400)
 * {
 *   "success": false,
 *   "message": "Title, description, and deadline are required"
 * }
 */
export const createAssignment = async (req, res) => {
  try {
    const { title, description, type, deadline, roomId, assignedTo } = req.body;
    const userId = req.user?. userId || req.user?.id || req.user?._id;


    const room = req.room;

    if (!title || !description || !deadline) {
      return res.status(400).json({
        success: false,
        message: "Title, description, and deadline are required"
      });
    }

    // Handle attachments
    let attachments = [];
    if (req.files?. attachments) {
      attachments = req.files.attachments.map(file => ({
        url: `/uploads/assignments/${file.filename}`,
        filename: file.originalname,
        mimetype: file.mimetype,
        size: file.size
      }));
    }


    const assignment = new Assignment({
      title,
      description,
      type: type || 'assignment',
      deadline: new Date(deadline),
      roomId,
      assignedTo: assignedTo || [],
      attachments,
      createdBy: userId
    });

    await assignment.save();
    await assignment.populate('createdBy', 'username email');
    await assignment.populate('roomId', 'title description');

    const user = await User.findById(userId);
    const userRole = room.getUserRole(userId);

    console.log(`✅ Assignment created by ${user.username} (${userRole}) in room "${room.title}": "${title}"`);

    res.status(201).json({
      success: true,
      message: "Assignment created successfully",
      data: assignment
    });
  } catch (err) {
    console.error("❌ Error creating assignment:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message
    });
  }
};





/**
 * Retrieves assignments for the authenticated user with optional filtering.
 * Returns assignments from rooms where the user is a member.
 * Can filter by specific room and assignment status (overdue/upcoming).
 *
 * @route GET /api/assignments
 * @access Private (requires authentication)
 * @middleware authMiddleware - Validates user authentication
 *
 * @param {Object} req - Express request object
 * @param {Object} req.user - Authenticated user (from authMiddleware)
 * @param {string} req.user.id - User's MongoDB ObjectId
 * @param {Object} req.query - Query parameters
 * @param {string} [req.query.roomId] - Filter by specific room ID (if omitted, returns from all user's rooms)
 * @param {string} [req.query. status] - Filter by status ('overdue' or 'upcoming')
 * @param {Object} res - Express response object
 *
 * @returns {Promise<void>} Sends JSON response with assignments array
 *
 * @throws {401} If user is not authenticated
 * @throws {403} If user is not a member of the specified room
 * @throws {404} If specified room is not found
 * @throws {500} If server error occurs
 *
 * @example
 * // Get all assignments from all user's rooms
 * GET /assignments
 * Authorization: Bearer <token>
 *
 * @example
 * // Get assignments from a specific room
 * GET /assignments?roomId=674d5e3f8a1b2c3d4e5f6789
 * Authorization: Bearer <token>
 *
 * @example
 * // Get overdue assignments from all rooms
 * GET /assignments?status=overdue
 * Authorization: Bearer <token>
 *
 * @example
 * // Get upcoming assignments from specific room
 * GET /assignments?roomId=674d5e3f8a1b2c3d4e5f6789&status=upcoming
 * Authorization: Bearer <token>
 *
 * @example
 * // Success Response (200)
 * {
 *   "success": true,
 *   "count": 3,
 *   "data": [
 *     {
 *       "_id": "674d5e3f8a1b2c3d4e5f6abc",
 *       "title": "Homework 1",
 *       "description": "Complete exercises 1-10",
 *       "type": "assignment",
 *       "deadline": "2025-12-15T23:59:59.000Z",
 *       "roomId": {
 *         "_id": "674d5e3f8a1b2c3d4e5f6789",
 *         "title": "Math 101",
 *         "description": "Introduction to Calculus"
 *       },
 *       "createdBy": {
 *         "_id": "teacher123",
 *         "username": "Dr. Smith",
 *         "email": "smith@school.edu"
 *       },
 *       "assignedTo": [
 *         {
 *           "_id": "student123",
 *           "username": "John Doe",
 *           "email": "john@school.edu"
 *         }
 *       ],
 *       "submissions": [],
 *       "createdAt": "2025-12-01T10:00:00.000Z",
 *       "updatedAt": "2025-12-01T10:00:00.000Z"
 *     }
 *   ]
 * }
 *
 * @example
 * // Error Response (403)
 * {
 *   "success": false,
 *   "message": "You are not a member of this room"
 * }
 */
export const getAssignments = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id || req.user?._id;
    const { roomId, status } = req.query;

    // Build query
    const query = { isDeleted: false };

    // ✅ Filter by room
    if (roomId) {
      // Verify user is room member
      const room = await Room.findById(roomId);
      if (!room) {
        return res.status(404).json({
          success: false,
          message: "Room not found"
        });
      }

      if (!room.isMember(userId)) {
        return res.status(403).json({
          success: false,
          message: "You are not a member of this room"
        });
      }

      query.roomId = roomId;
    } else {

      const userRooms = await Room.find({ users: userId }). select('_id');
      const roomIds = userRooms.map(r => r._id);
      query.roomId = { $in: roomIds };
    }


    if (status === 'overdue') {
      query.deadline = { $lt: new Date() };
    } else if (status === 'upcoming') {
      query.deadline = { $gte: new Date() };
    }

    const assignments = await Assignment.find(query)
      .populate('createdBy', 'username email')
      .populate('roomId', 'title description')
      .populate('assignedTo', 'username email')
      .sort({ deadline: 1 });

    console.log(`✅ Retrieved ${assignments.length} assignments for user`);

    res.status(200).json({
      success: true,
      count: assignments.length,
      data: assignments
    });
  } catch (err) {
    console.error("❌ Error getting assignments:", err);
    res. status(500).json({
      success: false,
      message: "Server error",
      error: err.message
    });
  }
};


export const getAssignmentById = async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const userId = req.user?.userId || req.user?.id || req.user?._id;

    const assignment = await Assignment.findOne({
      _id: assignmentId,
      isDeleted: false
    })
      .populate('createdBy', 'username email')
      .populate('roomId', 'title description users')
      .populate('assignedTo', 'username email')
      .populate('submissions. studentId', 'username email');

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: "Assignment not found"
      });
    }

    //  Check if user is room member
    const room = await Room.findById(assignment.roomId._id);
    if (!room. isMember(userId)) {
      return res.status(403). json({
        success: false,
        message: "You must be a member of this room to view this assignment"
      });
    }

    res.status(200).json({
      success: true,
      data: assignment
    });
  } catch (err) {
    console.error("❌ Error getting assignment:", err);
    res. status(500).json({
      success: false,
      message: "Server error",
      error: err.message
    });
  }
};

/**
 * Submits a student's work for an assignment.
 * Handles file uploads, checks for duplicate submissions, and marks as late if past deadline.
 * Prevents multiple submissions from the same student.
 *
 * @route POST /assignments/:assignmentId/submit
 * @access Private (requires authentication and room membership)
 * @middleware authMiddleware - Validates user authentication
 * @middleware canAccessRoom - Verifies user is a room member
 * @middleware canAccessAssignment - Validates assignment exists and user can submit
 *
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body
 * @param {string} [req.body.description=''] - Optional submission notes or comments
 * @param {Object} req.files - Uploaded files (from multer middleware)
 * @param {Array} [req.files.files] - Array of submission files (PDFs, documents, images, etc.)
 * @param {Object} req.user - Authenticated user (from authMiddleware)
 * @param {string} req.user.id - User's MongoDB ObjectId
 * @param {Object} req.assignment - Assignment object (from canAccessAssignment middleware)
 * @param {Object} req.room - Room object (from canAccessRoom middleware)
 * @param {Object} res - Express response object
 *
 * @returns {Promise<void>} Sends JSON response with submission details
 *
 * @throws {400} If student has already submitted this assignment
 * @throws {401} If user is not authenticated
 * @throws {403} If user is not allowed to submit (not assigned or not room member)
 * @throws {404} If assignment is not found
 * @throws {500} If server error occurs
 *
 * @example
 * // Request
 * POST /assignments/674d5e3f8a1b2c3d4e5f6abc/submit
 * Authorization: Bearer <token>
 * Content-Type: multipart/form-data
 *
 * Body (form-data):
 * {
 *   "description": "Here is my completed homework",
 *   "files": [homework.pdf, screenshots.zip]
 * }
 *
 * @example
 * // Success Response (200) - On Time
 * {
 *   "success": true,
 *   "message": "Assignment submitted successfully",
 *   "data": {
 *     "studentId": "674d5e3f8a1b2c3d4e5f6789",
 *     "submittedAt": "2025-12-02T15:30:00.000Z",
 *     "files": [
 *       {
 *         "url": "/uploads/submissions/file-1733150123456-987654321.pdf",
 *         "filename": "homework.pdf",
 *         "mimetype": "application/pdf",
 *         "size": 245678
 *       }
 *     ],
 *     "description": "Here is my completed homework",
 *     "status": "submitted"
 *   }
 * }
 *
 * @example
 * // Success Response (200) - Late Submission
 * {
 *   "success": true,
 *   "message": "Assignment submitted (late)",
 *   "data": {
 *     "studentId": "674d5e3f8a1b2c3d4e5f6789",
 *     "submittedAt": "2025-12-16T10:00:00.000Z",
 *     "files": [],
 *     "description": "Sorry for the late submission",
 *     "status": "late"
 *   }
 * }
 *
 * @example
 * // Error Response (400) - Already Submitted
 * {
 *   "success": false,
 *   "message": "You have already submitted this assignment"
 * }
 *
 * @example
 * // Error Response (403) - Not Assigned
 * {
 *   "success": false,
 *   "message": "You are not assigned to this assignment"
 * }
 */

export const submitAssignment = async (req, res) => {
  try {
    const { description } = req.body;
    const userId = req.user?.userId || req.user?.id || req. user?._id;

    // ✅ Assignment and room already validated in middleware
    const assignment = req.assignment;
    const room = req.room;

    // Check if already submitted
    if (assignment.hasStudentSubmitted(userId)) {
      return res.status(400). json({
        success: false,
        message: "You have already submitted this assignment"
      });
    }

    // Handle submission files
    let files = [];
    if (req. files?.files) {
      files = req. files.files.map(file => ({
        url: `/uploads/submissions/${file.filename}`,
        filename: file.originalname,
        mimetype: file.mimetype,
        size: file.size
      }));
    }

    // Check if late
    const isLate = new Date() > assignment.deadline;

    // Add submission
    const submission = {
      studentId: userId,
      submittedAt: new Date(),
      files,
      description: description || '',
      status: isLate ? 'late' : 'submitted'
    };

    assignment. submissions.push(submission);
    await assignment.save();

    const user = await User.findById(userId);
    console.log(`✅ ${user.username} submitted assignment "${assignment.title}" in room "${room.title}"`);

    res.status(200).json({
      success: true,
      message: isLate
        ? "Assignment submitted (late)"
        : "Assignment submitted successfully",
      data: submission
    });
  } catch (err) {
    console.error("❌ Error submitting assignment:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message
    });
  }
};

/**
 * Grades a student's assignment submission.
 * Updates the submission with a grade (0-100), optional feedback, and marks status as 'graded'.
 * Only teachers or assignment creators can grade submissions.
 *
 * @route PUT /assignments/:assignmentId/grade/:studentId
 * @access Private (requires authentication and grading permission)
 * @middleware authMiddleware - Validates user authentication
 * @middleware canAccessRoom - Verifies user is a room member
 * @middleware canGradeAssignment - Validates user has permission to grade (teacher/creator)
 *
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.assignmentId - MongoDB ObjectId of the assignment
 * @param {string} req.params.studentId - MongoDB ObjectId of the student whose submission to grade
 * @param {Object} req.body - Request body
 * @param {number} req.body.grade - Grade value (typically 0-100)
 * @param {string} [req. body.feedback=''] - Optional feedback text for the student
 * @param {Object} req.assignment - Assignment object (from canGradeAssignment middleware)
 * @param {Object} res - Express response object
 *
 * @returns {Promise<void>} Sends JSON response with graded submission
 *
 * @throws {401} If user is not authenticated
 * @throws {403} If user doesn't have permission to grade
 * @throws {404} If assignment or submission is not found
 * @throws {500} If server error occurs
 *
 * @example
 * // Request
 * PUT /assignments/674d5e3f8a1b2c3d4e5f6abc/grade/674d5e3f8a1b2c3d4e5f6789
 * Authorization: Bearer <token>
 * Content-Type: application/json
 *
 * {
 *   "grade": 85,
 *   "feedback": "Great work!  Well-structured solution with clear explanations."
 * }
 *
 * @example
 * // Success Response (200)
 * {
 *   "success": true,
 *   "message": "Submission graded successfully",
 *   "data": {
 *     "studentId": "674d5e3f8a1b2c3d4e5f6789",
 *     "submittedAt": "2025-12-01T10:00:00.000Z",
 *     "files": [
 *       {
 *         "url": "/uploads/submissions/homework. pdf",
 *         "filename": "homework.pdf",
 *         "mimetype": "application/pdf",
 *         "size": 245678
 *       }
 *     ],
 *     "description": "My submission",
 *     "grade": 85,
 *     "feedback": "Great work! Well-structured solution with clear explanations.",
 *     "status": "graded"
 *   }
 * }
 *
 * @example
 * // Error Response (404) - Submission Not Found
 * {
 *   "success": false,
 *   "message": "Submission not found"
 * }
 *
 * @example
 * // Error Response (403) - No Permission
 * {
 *   "success": false,
 *   "message": "You don't have permission to grade this assignment"
 * }
 */


export const gradeSubmission = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { grade, feedback } = req.body;

    // ✅ Assignment already validated in middleware
    const assignment = req.assignment;

    // Find submission
    const submission = assignment.getStudentSubmission(studentId);

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: "Submission not found"
      });
    }

    // Update grade and feedback
    submission.grade = grade;
    submission.feedback = feedback || '';
    submission.status = 'graded';

    await assignment.save();

    console.log(`✅ Graded submission for assignment: "${assignment.title}"`);

    res.status(200).json({
      success: true,
      message: "Submission graded successfully",
      data: submission
    });
  } catch (err) {
    console.error("❌ Error grading submission:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err. message
    });
  }
};

/**
 * Soft deletes an assignment by marking it as deleted.
 * The assignment remains in the database but is hidden from queries.
 * Only the assignment creator or teachers can delete assignments.
 *
 * @route DELETE /assignments/:assignmentId
 * @access Private (requires authentication and delete permission)
 * @middleware authMiddleware - Validates user authentication
 * @middleware canAccessRoom - Verifies user is a room member
 * @middleware canModifyAssignment - Validates user has permission to delete (creator/teacher)
 *
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req. params.assignmentId - MongoDB ObjectId of the assignment to delete
 * @param {Object} req.assignment - Assignment object (from canModifyAssignment middleware)
 * @param {Object} res - Express response object
 *
 * @returns {Promise<void>} Sends JSON response confirming deletion
 *
 * @throws {401} If user is not authenticated
 * @throws {403} If user doesn't have permission to delete
 * @throws {404} If assignment is not found
 * @throws {500} If server error occurs
 *
 * @example
 * // Request
 * DELETE /api/assignments/674d5e3f8a1b2c3d4e5f6abc
 * Authorization: Bearer <token>
 *
 * @example
 * // Success Response (200)
 * {
 *   "success": true,
 *   "message": "Assignment deleted successfully"
 * }
 *
 * @example
 * // Error Response (403) - No Permission
 * {
 *   "success": false,
 *   "message": "You don't have permission to delete this assignment"
 * }
 *
 * @example
 * // Error Response (404) - Assignment Not Found
 * {
 *   "success": false,
 *   "message": "Assignment not found"
 * }
 *
 * @note This is a soft delete.  The assignment is marked as `isDeleted: true`
 * but remains in the database.  To permanently delete, a cleanup job is required.
 */

export const deleteAssignment = async (req, res) => {
  try {
    // ✅ Assignment already validated in middleware
    const assignment = req.assignment;

    // Soft delete
    assignment.isDeleted = true;
    await assignment. save();

    console.log(`🗑️ Assignment deleted: "${assignment.title}"`);

    res.status(200). json({
      success: true,
      message: "Assignment deleted successfully"
    });
  } catch (err) {
    console. error("❌ Error deleting assignment:", err);
    res. status(500).json({
      success: false,
      message: "Server error",
      error: err.message
    });
  }
};
