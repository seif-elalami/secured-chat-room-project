import { Media } from "../models/MediaModel.js";
import Message from "../models/Message.js";
import Room from "../models/Room.js";
import fs from "fs";
import path from "path";

/**
 * Uploads a media file to a room.
 * Validates room membership before allowing upload.
 * Saves file metadata to Media collection and returns accessible URL.
 *
 * @route POST /media/upload
 * @access Private (requires authentication and room membership)
 * @middleware authMiddleware - Validates user authentication
 * @middleware upload.single('file') - Handles file upload via multer
 *
 * @param {Object} req - Express request object
 * @param {Object} req.file - Uploaded file (from multer middleware)
 * @param {string} req.file.filename - Generated filename on server
 * @param {Object} req.body - Request body
 * @param {string} req.body.roomId - MongoDB ObjectId of the target room (required)
 * @param {Object} req.user - Authenticated user (from authMiddleware)
 * @param {string} req.user.id - User's MongoDB ObjectId
 * @param {Object} res - Express response object
 *
 * @returns {Promise<void>} Sends JSON response with uploaded media details
 *
 * @throws {400} If no file is uploaded or roomId is missing
 * @throws {401} If user is not authenticated
 * @throws {403} If user is not a member of the room
 * @throws {404} If room is not found
 * @throws {500} If server error occurs
 *
 * @example
 * // Request
 * POST /media/upload
 * Authorization: Bearer <token>
 * Content-Type: multipart/form-data
 *
 * Body (form-data):
 * {
 *   "file": [image.jpg],
 *   "roomId": "674d5e3f8a1b2c3d4e5f6789"
 * }
 *
 * @example
 * // Success Response (201)
 * {
 *   "success": true,
 *   "message": "File uploaded successfully",
 *   "data": {
 *     "_id": "674d5e3f8a1b2c3d4e5f6med1",
 *     "sender": "674d5e3f8a1b2c3d4e5f6user1",
 *     "room": "674d5e3f8a1b2c3d4e5f6789",
 *     "fileUrl": "http://localhost:3000/uploads/image-1733150000000-123456789.jpg",
 *     "createdAt": "2025-12-02T15:30:00.000Z"
 *   }
 * }
 *
 * @example
 * // Error Response (400) - No File
 * {
 *   "message": "No file uploaded"
 * }
 *
 * @example
 * // Error Response (403) - Not Room Member
 * {
 *   "message": "You are not a member of this room"
 * }
 */

export const uploadMedia = async (req, res) => {
  try {
    if (! req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const { roomId } = req.body;
    const userId = req.user?. userId || req.user?.id || req.user?._id;

    if (!roomId) {
      return res.status(400). json({ message: "roomId is required" });
    }


    const room = await Room. findById(roomId);
    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }

    const isParticipant = room.users. some(
      (u) => u.toString() === userId.toString()
    );
    if (! isParticipant) {
      return res.status(403). json({ message: "You are not a member of this room" });
    }

    const fileUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
    const newMedia = await Media.create({
      sender: userId,
      room: roomId,
      fileUrl,
    });

    res.status(201). json({
      success: true,
      message: "File uploaded successfully",
      data: newMedia,
    });
  } catch (err) {
    console.error("❌ Upload error:", err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

/**
 * Retrieves media gallery for direct messages between two users.
 * Returns paginated list of media files exchanged in private conversations.
 * Sorted by most recent first.
 *
 * @route GET /media/gallery/:otherUserId
 * @access Private (requires authentication)
 * @middleware authMiddleware - Validates user authentication
 *
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.otherUserId - MongoDB ObjectId of the other user in conversation
 * @param {Object} req.query - Query parameters
 * @param {number} [req.query.page=1] - Page number for pagination
 * @param {number} [req. query.limit=10] - Number of media items per page
 * @param {Object} req.user - Authenticated user (from authMiddleware)
 * @param {string} req.user. id - User's MongoDB ObjectId
 * @param {Object} res - Express response object
 *
 * @returns {Promise<void>} Sends JSON response with paginated media array
 *
 * @throws {401} If user is not authenticated
 * @throws {500} If server error occurs
 *
 * @example
 * // Request - Get first page
 * GET /media/gallery/674d5e3f8a1b2c3d4e5f6user2?page=1&limit=10
 * Authorization: Bearer <token>
 *
 * @example
 * // Success Response (200)
 * {
 *   "success": true,
 *   "data": [
 *     {
 *       "_id": "674d5e3f8a1b2c3d4e5f6med1",
 *       "sender": "674d5e3f8a1b2c3d4e5f6user1",
 *       "receiver": "674d5e3f8a1b2c3d4e5f6user2",
 *       "fileUrl": "http://localhost:3000/uploads/photo1. jpg",
 *       "createdAt": "2025-12-02T15:30:00.000Z"
 *     },
 *     {
 *       "_id": "674d5e3f8a1b2c3d4e5f6med2",
 *       "sender": "674d5e3f8a1b2c3d4e5f6user2",
 *       "receiver": "674d5e3f8a1b2c3d4e5f6user1",
 *       "fileUrl": "http://localhost:3000/uploads/photo2.jpg",
 *       "createdAt": "2025-12-01T10:00:00.000Z"
 *     }
 *   ],
 *   "pagination": {
 *     "totalPages": 3,
 *     "currentPage": 1
 *   }
 * }
 */

export const getGallery = async (req, res) => {
  try {
    const { otherUserId } = req.params;
    const userId = req.user?. userId || req.user?.id || req.user?._id;
    const page = parseInt(req. query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const total = await Media.countDocuments({
      $or: [
        { sender: userId, receiver: otherUserId },
        { sender: otherUserId, receiver: userId },
      ],
    });

    const mediaMessages = await Media.find({
      $or: [
        { sender: userId, receiver: otherUserId },
        { sender: otherUserId, receiver: userId },
      ],
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200). json({
      success: true,
      data: mediaMessages,
      pagination: {
        totalPages: Math.ceil(total / limit),
        currentPage: page,
      },
    });
  } catch (err) {
    console.error("❌ Gallery error:", err);
    res.status(500). json({ success: false, message: "Server error", error: err. message });
  }
};

/**
 * Retrieves all images uploaded to a specific room.
 * Returns paginated list with sender information.
 * Verifies user is a room member before returning images.
 * Sorted by most recent first.
 *
 * @route GET /media/room/:roomId/images
 * @access Private (requires authentication and room membership)
 * @middleware authMiddleware - Validates user authentication
 *
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req. params.roomId - MongoDB ObjectId of the room
 * @param {Object} req.query - Query parameters
 * @param {number} [req.query. page=1] - Page number for pagination
 * @param {number} [req.query.limit=20] - Number of images per page
 * @param {Object} req.user - Authenticated user (from authMiddleware)
 * @param {string} req.user.id - User's MongoDB ObjectId
 * @param {Object} res - Express response object
 *
 * @returns {Promise<void>} Sends JSON response with paginated images array
 *
 * @throws {401} If user is not authenticated
 * @throws {403} If user is not a member of the room
 * @throws {500} If server error occurs
 *
 * @example
 * // Request
 * GET /media/room/674d5e3f8a1b2c3d4e5f6789/images?page=1&limit=20
 * Authorization: Bearer <token>
 *
 * @example
 * // Success Response (200)
 * {
 *   "success": true,
 *   "images": [
 *     {
 *       "id": "674d5e3f8a1b2c3d4e5f6med1",
 *       "url": "http://localhost:3000/uploads/image1.jpg",
 *       "sender": {
 *         "_id": "674d5e3f8a1b2c3d4e5f6user1",
 *         "username": "johndoe",
 *         "email": "john@example.com"
 *       },
 *       "createdAt": "2025-12-02T15:30:00.000Z"
 *     }
 *   ],
 *   "pagination": {
 *     "page": 1,
 *     "limit": 20,
 *     "total": 45,
 *     "pages": 3
 *   }
 * }
 *
 * @example
 * // Error Response (403) - Not Room Member
 * {
 *   "success": false,
 *   "message": "Access denied: you are not a member of this room."
 * }
 */

export const getRoomImages = async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user?.userId || req.user?.id || req.user?._id;

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query. limit) || 20;
    const skip = (page - 1) * limit;

    console.log(`📸 Fetching images for room ${roomId}, page ${page}, limit ${limit}`);

    // Verify user belongs to the room
    const room = await Room.findOne({ _id: roomId, users: userId });
    if (!room) {
      return res.status(403).json({
        success: false,
        message: "Access denied: you are not a member of this room.",
      });
    }

    // Fetch all uploaded media (images) from Media collection for this room
    const total = await Media.countDocuments({ room: roomId });
    const images = await Media.find({ room: roomId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("sender", "username email");

    console.log(`✅ Found ${images.length} images in room ${roomId}`);

    res.status(200).json({
      success: true,
      images: images. map((img) => ({
        id: img._id,
        url: img.fileUrl,
        sender: img.sender,
        createdAt: img.createdAt,
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("❌ Error fetching room images:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching room images",
      error: error.message,
    });
  }
};

/**
 * Deletes a media file from a room.
 * Only the original sender can delete their uploaded media.
 * Removes both database record and physical file from server.
 * Verifies user still has room access before allowing deletion.
 *
 * @route DELETE /media/:mediaId
 * @access Private (requires authentication and sender authorization)
 * @middleware authMiddleware - Validates user authentication
 *
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.mediaId - MongoDB ObjectId of the media to delete
 * @param {Object} req.user - Authenticated user (from authMiddleware)
 * @param {string} req.user.id - User's MongoDB ObjectId
 * @param {Object} res - Express response object
 *
 * @returns {Promise<void>} Sends JSON response confirming deletion
 *
 * @throws {401} If user is not authenticated
 * @throws {403} If user is not the sender or no longer has room access
 * @throws {404} If media is not found
 * @throws {500} If server error occurs
 *
 * @example
 * // Request
 * DELETE /media/674d5e3f8a1b2c3d4e5f6med1
 * Authorization: Bearer <token>
 *
 * @example
 * // Success Response (200)
 * {
 *   "success": true,
 *   "message": "Image deleted successfully"
 * }
 *
 * @example
 * // Error Response (403) - Not Sender
 * {
 *   "success": false,
 *   "message": "You are not allowed to delete this image"
 * }
 *
 * @example
 * // Error Response (403) - No Room Access
 * {
 *   "success": false,
 *   "message": "You no longer have access to this room"
 * }
 *
 * @example
 * // Error Response (404) - Media Not Found
 * {
 *   "success": false,
 *   "message": "Media not found"
 * }
 *
 * @note Physical file deletion is asynchronous.   If file deletion fails,
 * a warning is logged but the database record is still removed.
 */

export const deleteMedia = async (req, res) => {
  try {
    const { mediaId } = req.params;
    const userId = req.user?.userId || req.user?.id || req.user?._id;


    const media = await Media.findById(mediaId);
    if (!media) {
      return res.status(404).json({
        success: false,
        message: "Media not found",
      });
    }


    if (media.sender. toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to delete this image",
      });
    }


    const room = await Room.findById(media.room);
    if (!room || !room.users.includes(userId)) {
      return res.status(403).json({
        success: false,
        message: "You no longer have access to this room",
      });
    }


    if (media.fileUrl) {
      const filePath = path.join(
        process.cwd(),
        "uploads",
        path.basename(media.fileUrl)
      );
      fs.unlink(filePath, (err) => {
        if (err) console.warn("⚠️ Could not delete file:", err. message);
      });
    }


    await Media.findByIdAndDelete(mediaId);

    res.status(200).json({
      success: true,
      message: "Image deleted successfully",
    });
  } catch (error) {
    console.error("❌ Error deleting media:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error. message,
    });
  }
};
