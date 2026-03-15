/**
 * @fileoverview Attachment Controller
 * Handles file attachments for notes including images, videos, voice notes, and documents.
 * Supports file upload, retrieval, deletion, and statistics.
 *
 * @module controllers/attachmentController
 */

import NoteAttachment from "../models/NoteAttachment.js";
import Note from "../models/Note.js";

/**
 * Uploads a file attachment to a note.
 * Automatically detects file type from MIME type (image, video, audio, document).
 * Updates note's timestamp for cross-device synchronization.
 *
 * @route POST /attachments/:noteId/upload
 * @access Private (requires authentication and note ownership)
 * @middleware authMiddleware - Validates user authentication
 * @middleware upload.single('file') - Handles file upload via multer
 *
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.noteId - MongoDB ObjectId of the note
 * @param {Object} req.file - Uploaded file (from multer middleware)
 * @param {string} req.file.filename - Generated filename on server
 * @param {string} req.file.originalname - Original filename from user's device
 * @param {string} req.file.mimetype - File MIME type (e.g., 'image/jpeg', 'application/pdf')
 * @param {number} req.file.size - File size in bytes
 * @param {Object} req.body - Request body
 * @param {string} [req.body.local_path] - Mobile device local file path (for offline caching)
 * @param {string} [req.body.media_duration] - Duration in seconds (for audio/video files)
 * @param {Object} req.user - Authenticated user (from authMiddleware)
 * @param {string} req.user.id - User's MongoDB ObjectId
 * @param {Object} res - Express response object
 *
 * @returns {Promise<void>} Sends JSON response with attachment details
 *
 * @throws {400} If no file is uploaded
 * @throws {401} If user is not authenticated
 * @throws {404} If note is not found or user doesn't own it
 * @throws {500} If server error occurs
 *
 * @example
 * // Request
 * POST /attachments/674d5e3f8a1b2c3d4e5f6789/upload
 * Authorization: Bearer <token>
 * Content-Type: multipart/form-data
 *
 * Body (form-data):
 * {
 *   "file": [beach.jpg],
 *   "local_path": "file://storage/photos/beach.jpg"  // Optional
 * }
 *
 * @example
 * // Success Response (201)
 * {
 *   "success": true,
 *   "message": "Attachment uploaded successfully",
 *   "data": {
 *     "_id": "674d5e3f8a1b2c3d4e5f6att1",
 *     "note_id": "674d5e3f8a1b2c3d4e5f6789",
 *     "file_type": "IMAGE",
 *     "remote_url": "/uploads/notes/img-1733150123456-987654321.jpg",
 *     "local_path": "file://storage/photos/beach.jpg",
 *     "mime_type": "image/jpeg",
 *     "file_size": 245678,
 *     "filename": "beach.jpg",
 *     "media_duration": null,
 *     "upload_status": "COMPLETED",
 *     "created_at": "2025-12-02T15:30:00.000Z"
 *   }
 * }
 *
 * @example
 * // Error Response (400) - No File
 * {
 *   "success": false,
 *   "message": "No file uploaded"
 * }
 *
 * @example
 * // Error Response (404) - Note Not Found
 * {
 *   "success": false,
 *   "message": "Note not found"
 * }
 */
// ========================================
// 📎 UPLOAD ATTACHMENT
// ========================================
export const uploadAttachment = async (req, res) => {
  try {
    const { noteId } = req.params;
    const userId = req. user?.userId || req.user?. id || req.user?._id;

    // Verify note ownership
    const note = await Note. findOne({
      _id: noteId,
      author: userId,
      deleted_at: null
    });

    if (!note) {
      return res.status(404).json({
        success: false,
        message: "Note not found"
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded"
      });
    }

    // Determine file type from mimetype
    let file_type = 'DOCUMENT';
    if (req.file. mimetype.startsWith('image/')) {
      file_type = 'IMAGE';
    } else if (req.file.mimetype.startsWith('video/')) {
      file_type = 'VIDEO';
    } else if (req.file.mimetype.startsWith('audio/')) {
      file_type = 'VOICE_NOTE';
    }

    // Create attachment
    const attachment = new NoteAttachment({
      note_id: noteId,
      file_type: file_type,
      remote_url: `/uploads/notes/${req.file. filename}`,
      local_path: req.body.local_path || null,
      mime_type: req.file.mimetype,
      file_size: req. file.size,
      filename: req.file.originalname,
      media_duration: req.body.media_duration ?  parseInt(req.body.media_duration) : null,
      upload_status: 'COMPLETED'
    });

    await attachment. save();

    // Update note's updated_at for sync
    note.updatedAt = new Date();
    await note.save();

    console.log(`📎 Attachment uploaded to note "${note. display_title}": ${attachment. filename}`);

    res.status(201).json({
      success: true,
      message: "Attachment uploaded successfully",
      data: attachment
    });

  } catch (err) {
    console.error("❌ Error uploading attachment:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message
    });
  }
};

/**
 * Uploads a voice note attachment to a note.
 * Requires media_duration parameter for audio playback progress bars.
 * Saves audio file to dedicated voice uploads directory.
 *
 * @route POST /api/attachments/:noteId/voice
 * @access Private (requires authentication and note ownership)
 * @middleware authMiddleware - Validates user authentication
 * @middleware upload.single('voiceNote') - Handles audio file upload
 *
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.noteId - MongoDB ObjectId of the note
 * @param {Object} req.file - Uploaded audio file (from multer middleware)
 * @param {Object} req.body - Request body
 * @param {number} req.body.media_duration - Duration of audio in seconds (required)
 * @param {string} [req.body.local_path] - Mobile device local file path
 * @param {Object} req.user - Authenticated user (from authMiddleware)
 * @param {Object} res - Express response object
 *
 * @returns {Promise<void>} Sends JSON response with voice note details
 *
 * @throws {400} If no audio file uploaded or media_duration is missing
 * @throws {401} If user is not authenticated
 * @throws {404} If note is not found or user doesn't own it
 * @throws {500} If server error occurs
 *
 * @example
 * // Request
 * POST /api/attachments/674d5e3f8a1b2c3d4e5f6789/voice
 * Authorization: Bearer <token>
 * Content-Type: multipart/form-data
 *
 * Body (form-data):
 * {
 *   "voiceNote": [recording. m4a],
 *   "media_duration": 45,
 *   "local_path": "file://storage/audio/recording.m4a"
 * }
 *
 * @example
 * // Success Response (201)
 * {
 *   "success": true,
 *   "message": "Voice note uploaded successfully",
 *   "data": {
 *     "_id": "674d5e3f8a1b2c3d4e5f6att2",
 *     "note_id": "674d5e3f8a1b2c3d4e5f6789",
 *     "file_type": "VOICE_NOTE",
 *     "remote_url": "/uploads/voice/voice-1733150200000-111222333.m4a",
 *     "mime_type": "audio/mp4",
 *     "file_size": 125000,
 *     "filename": "recording.m4a",
 *     "media_duration": 45,
 *     "upload_status": "COMPLETED",
 *     "created_at": "2025-12-02T15:35:00.000Z"
 *   }
 * }
 *
 * @example
 * // Error Response (400) - Missing Duration
 * {
 *   "success": false,
 *   "message": "media_duration is required for voice notes"
 * }
 */

export const uploadVoiceNote = async (req, res) => {
  try {
    const { noteId } = req. params;
    const { media_duration } = req.body;
    const userId = req.user?.userId || req.user?.id || req. user?._id;

    // Verify note ownership
    const note = await Note.findOne({
      _id: noteId,
      author: userId,
      deleted_at: null
    });

    if (!note) {
      return res.status(404).json({
        success: false,
        message: "Note not found"
      });
    }

    if (!req.file) {
      return res.status(400). json({
        success: false,
        message: "No audio file uploaded"
      });
    }

    if (! media_duration) {
      return res.status(400).json({
        success: false,
        message: "media_duration is required for voice notes"
      });
    }

    // Create voice note attachment
    const voiceNote = new NoteAttachment({
      note_id: noteId,
      file_type: 'VOICE_NOTE',
      remote_url: `/uploads/voice/${req.file.filename}`,
      local_path: req.body.local_path || null,
      mime_type: req.file.mimetype,
      file_size: req.file.size,
      filename: req.file.originalname,
      media_duration: parseInt(media_duration),
      upload_status: 'COMPLETED'
    });

    await voiceNote.save();

    // Update note's updated_at for sync
    note.updatedAt = new Date();
    await note.save();

    console.log(`🎙️ Voice note uploaded (${voiceNote.duration_formatted}): ${voiceNote.filename}`);

    res.status(201).json({
      success: true,
      message: "Voice note uploaded successfully",
      data: voiceNote
    });

  } catch (err) {
    console.error("❌ Error uploading voice note:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message
    });
  }
};

/**
 * Retrieves all attachments for a specific note with optional type filtering.
 * Returns attachments sorted by creation date (newest first).
 *
 * @route GET /attachments/:noteId
 * @access Private (requires authentication and note ownership)
 * @middleware authMiddleware - Validates user authentication
 *
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.noteId - MongoDB ObjectId of the note
 * @param {Object} req.query - Query parameters
 * @param {string} [req.query.file_type] - Filter by type (IMAGE, VIDEO, VOICE_NOTE, DOCUMENT)
 * @param {Object} req.user - Authenticated user (from authMiddleware)
 * @param {string} req.user.id - User's MongoDB ObjectId
 * @param {Object} res - Express response object
 *
 * @returns {Promise<void>} Sends JSON response with attachments array
 *
 * @throws {401} If user is not authenticated
 * @throws {404} If note is not found or user doesn't own it
 * @throws {500} If server error occurs
 *
 * @example
 * // Get all attachments
 * GET /attachments/674d5e3f8a1b2c3d4e5f6789
 * Authorization: Bearer <token>
 *
 * @example
 * // Get only images
 * GET /attachments/674d5e3f8a1b2c3d4e5f6789?file_type=IMAGE
 * Authorization: Bearer <token>
 *
 * @example
 * // Success Response (200)
 * {
 *   "success": true,
 *   "count": 2,
 *   "data": [
 *     {
 *       "_id": "674d5e3f8a1b2c3d4e5f6att1",
 *       "note_id": "674d5e3f8a1b2c3d4e5f6789",
 *       "file_type": "IMAGE",
 *       "remote_url": "/uploads/notes/img-123. jpg",
 *       "filename": "beach.jpg",
 *       "file_size": 245678,
 *       "created_at": "2025-12-02T15:30:00.000Z"
 *     },
 *     {
 *       "_id": "674d5e3f8a1b2c3d4e5f6att2",
 *       "file_type": "VOICE_NOTE",
 *       "filename": "recording.m4a",
 *       "media_duration": 45
 *     }
 *   ]
 * }
 */

export const getAttachments = async (req, res) => {
  try {
    const { noteId } = req.params;
    const { file_type } = req.query;
    const userId = req.user?.userId || req.user?.id || req. user?._id;

    // Verify note ownership
    const note = await Note.findOne({
      _id: noteId,
      author: userId
    });

    if (!note) {
      return res.status(404).json({
        success: false,
        message: "Note not found"
      });
    }

    // Build query
    let attachments;
    if (file_type) {
      attachments = await NoteAttachment.findByType(noteId, file_type. toUpperCase());
    } else {
      attachments = await NoteAttachment.findByNote(noteId);
    }

    res.status(200).json({
      success: true,
      count: attachments.length,
      data: attachments
    });

  } catch (err) {
    console.error("❌ Error getting attachments:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message
    });
  }
};

/**
 * Soft deletes an attachment from a note.
 * Marks attachment as deleted but preserves data for 30 days (TTL).
 * Updates note's timestamp to trigger sync across devices.
 *
 * @route DELETE /attachments/:attachmentId
 * @access Private (requires authentication and note ownership)
 * @middleware authMiddleware - Validates user authentication
 *
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.attachmentId - MongoDB ObjectId of the attachment to delete
 * @param {Object} req.user - Authenticated user (from authMiddleware)
 * @param {string} req. user.id - User's MongoDB ObjectId
 * @param {Object} res - Express response object
 *
 * @returns {Promise<void>} Sends JSON response confirming deletion
 *
 * @throws {401} If user is not authenticated
 * @throws {403} If user doesn't own the note (access denied)
 * @throws {404} If attachment is not found
 * @throws {500} If server error occurs
 *
 * @example
 * // Request
 * DELETE /attachments/674d5e3f8a1b2c3d4e5f6att1
 * Authorization: Bearer <token>
 *
 * @example
 * // Success Response (200)
 * {
 *   "success": true,
 *   "message": "Attachment deleted successfully"
 * }
 *
 * @example
 * // Error Response (403) - Access Denied
 * {
 *   "success": false,
 *   "message": "Access denied"
 * }
 *
 * @note This is a soft delete.  Attachment is marked with deleted_at timestamp
 * and will be permanently removed after 30 days via TTL index.
 */

export const deleteAttachment = async (req, res) => {
  try {
    const { attachmentId } = req.params;
    const userId = req. user?.userId || req.user?. id || req.user?._id;

    // Find attachment
    const attachment = await NoteAttachment.findById(attachmentId);

    if (!attachment) {
      return res.status(404).json({
        success: false,
        message: "Attachment not found"
      });
    }

    // Verify note ownership
    const note = await Note.findOne({
      _id: attachment.note_id,
      author: userId
    });

    if (!note) {
      return res.status(403).json({
        success: false,
        message: "Access denied"
      });
    }

    // Soft delete
    await attachment.softDelete();

    // Update note's updated_at for sync
    note.updatedAt = new Date();
    await note.save();

    console.log(`🗑️ Attachment deleted: ${attachment.filename}`);

    res.status(200).json({
      success: true,
      message: "Attachment deleted successfully"
    });

  } catch (err) {
    console.error("❌ Error deleting attachment:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message
    });
  }
};

/**
 * Retrieves statistics about a note's attachments.
 * Includes total count, breakdown by type, total storage size, and total media duration.
 *
 * @route GET /attachments/:noteId/stats
 * @access Private (requires authentication and note ownership)
 * @middleware authMiddleware - Validates user authentication
 *
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.noteId - MongoDB ObjectId of the note
 * @param {Object} req.user - Authenticated user (from authMiddleware)
 * @param {string} req.user.id - User's MongoDB ObjectId
 * @param {Object} res - Express response object
 *
 * @returns {Promise<void>} Sends JSON response with attachment statistics
 *
 * @throws {401} If user is not authenticated
 * @throws {404} If note is not found or user doesn't own it
 * @throws {500} If server error occurs
 *
 * @example
 * // Request
 * GET /attachments/674d5e3f8a1b2c3d4e5f6789/stats
 * Authorization: Bearer <token>
 *
 * @example
 * // Success Response (200)
 * {
 *   "success": true,
 *   "data": {
 *     "total": 5,
 *     "by_type": {
 *       "images": 2,
 *       "videos": 1,
 *       "voice_notes": 1,
 *       "documents": 1
 *     },
 *     "total_size": 3450678,
 *     "total_duration": 125
 *   }
 * }
 *
 * @note total_size is in bytes.  total_duration is in seconds (for audio/video only).
 */

export const getAttachmentStats = async (req, res) => {
  try {
    const { noteId } = req. params;
    const userId = req.user?.userId || req.user?.id || req.user?._id;

    // Verify note ownership
    const note = await Note.findOne({
      _id: noteId,
      author: userId
    });

    if (! note) {
      return res. status(404).json({
        success: false,
        message: "Note not found"
      });
    }

    const attachments = await NoteAttachment. findByNote(noteId);

    const stats = {
      total: attachments.length,
      by_type: {
        images: attachments.filter(a => a. file_type === 'IMAGE'). length,
        videos: attachments.filter(a => a.file_type === 'VIDEO').length,
        voice_notes: attachments.filter(a => a. file_type === 'VOICE_NOTE').length,
        documents: attachments.filter(a => a.file_type === 'DOCUMENT').length
      },
      total_size: attachments. reduce((sum, a) => sum + (a.file_size || 0), 0),
      total_duration: attachments
        .filter(a => a. media_duration)
        .reduce((sum, a) => sum + a.media_duration, 0)
    };

    res.status(200).json({
      success: true,
      data: stats
    });

  } catch (err) {
    console.error("❌ Error getting attachment stats:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message
    });
  }
};

export default {
  uploadAttachment,
  uploadVoiceNote,
  getAttachments,
  deleteAttachment,
  getAttachmentStats
};
