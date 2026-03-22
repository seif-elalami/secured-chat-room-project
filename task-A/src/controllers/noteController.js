import Note from "../models/Note.js";
import NoteChecklistItem from "../models/NoteChecklistItem.js";
import NoteAttachment from "../models/NoteAttachment.js";
import User from "../models/User.js";


/**
 * Creates a new note with optional checklist items.
 * Supports rich text content, color themes, tags, and favorites.
 * Checklist items are created atomically with the note.
 *
 * @route POST /notes
 * @access Private (requires authentication)
 * @middleware authMiddleware - Validates user authentication
 *
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body
 * @param {string} [req.body.title] - Note title (at least title or content required)
 * @param {string} [req.body.content_body] - Note content in Markdown format
 * @param {string} [req.body.color_theme='DEFAULT'] - Color theme (DEFAULT, RED, BLUE, GREEN, YELLOW, PURPLE, PINK, ORANGE, BROWN, GRAY, TEAL)
 * @param {boolean} [req.body.is_favorite=false] - Mark as favorite/starred
 * @param {boolean} [req.body.is_archived=false] - Archive status
 * @param {string[]|string} [req.body. tags] - Array of tags or comma-separated string
 * @param {Object[]} [req.body.checklist_items] - Array of checklist items
 * @param {string} req.body.checklist_items[].text - Item text
 * @param {boolean} [req.body.checklist_items[].is_completed=false] - Completion status
 * @param {number} [req.body.checklist_items[].sort_order] - Display order
 * @param {Object} req.user - Authenticated user (from authMiddleware)
 * @param {string} req.user.id - User's MongoDB ObjectId
 * @param {Object} res - Express response object
 *
 * @returns {Promise<void>} Sends JSON response with created note and checklist items
 *
 * @throws {400} If both title and content are missing
 * @throws {401} If user is not authenticated
 * @throws {500} If server error occurs
 *
 * @example
 * // Create simple text note
 * POST /notes
 * Authorization: Bearer <token>
 * Content-Type: application/json
 *
 * {
 *   "title": "My First Note",
 *   "content_body": "This is the note content",
 *   "color_theme": "BLUE",
 *   "is_favorite": true,
 *   "tags": ["personal", "ideas"]
 * }
 *
 * @example
 * // Create note with checklist
 * {
 *   "title": "Shopping List",
 *   "content_body": "Weekly groceries",
 *   "color_theme": "GREEN",
 *   "checklist_items": [
 *     { "text": "Milk", "is_completed": false, "sort_order": 0 },
 *     { "text": "Eggs", "is_completed": false, "sort_order": 1 },
 *     { "text": "Bread", "is_completed": true, "sort_order": 2 }
 *   ]
 * }
 *
 * @example
 * // Success Response (201)
 * {
 *   "success": true,
 *   "message": "Note created successfully",
 *   "data": {
 *     "note": {
 *       "_id": "674d5e3f8a1b2c3d4e5f6789",
 *       "author": {
 *         "_id": "user123",
 *         "username": "johndoe",
 *         "email": "john@example.com"
 *       },
 *       "title": "Shopping List",
 *       "content_body": "Weekly groceries",
 *       "color_theme": "GREEN",
 *       "is_favorite": false,
 *       "is_archived": false,
 *       "tags": [],
 *       "createdAt": "2025-12-02T15:30:00.000Z",
 *       "updatedAt": "2025-12-02T15:30:00.000Z"
 *     },
 *     "checklist_items": [
 *       {
 *         "_id": "item1",
 *         "note_id": "674d5e3f8a1b2c3d4e5f6789",
 *         "text": "Milk",
 *         "is_completed": false,
 *         "sort_order": 0
 *       },
 *       {
 *         "_id": "item2",
 *         "text": "Eggs",
 *         "is_completed": false,
 *         "sort_order": 1
 *       }
 *     ]
 *   }
 * }
 *
 * @example
 * // Error Response (400) - Missing Content
 * {
 *   "success": false,
 *   "message": "Either title or content is required."
 * }
 */
export const createNote = async (req, res) => {
  try {
    const {
      title,
      content_body,
      color_theme,
      is_favorite,
      is_archived,
      tags,
      checklist_items  // Array of { text, is_completed, sort_order }
    } = req.body;

    const userId = req.user?. userId || req.user?.id || req.user?._id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: userId not found."
      });
    }

    // Validate: At least title or content must exist
    if (!title && !content_body) {
      return res.status(400).json({
        success: false,
        message: "Either title or content is required."
      });
    }

    // ========================================
    // CREATE NOTE
    // ========================================
    const note = new Note({
      author: userId,
      title: title || '',
      content_body: content_body || '',
      color_theme: color_theme || 'DEFAULT',
      is_favorite: is_favorite || false,
      is_archived: is_archived || false,
      tags: tags ?  (Array.isArray(tags) ? tags : tags.split(','). map(t => t.trim())) : []
    });

    await note.save();

    // ========================================
    // CREATE CHECKLIST ITEMS (if provided)
    // ========================================
    let savedChecklistItems = [];

    if (checklist_items && Array.isArray(checklist_items) && checklist_items.length > 0) {
      const checklistDocs = checklist_items.map((item, index) => ({
        note_id: note._id,
        text: item.text,
        is_completed: item.is_completed || false,
        sort_order: item.sort_order !== undefined ? item.sort_order : index
      }));

      savedChecklistItems = await NoteChecklistItem.insertMany(checklistDocs);
    }

    // ========================================
    // POPULATE & RESPOND
    // ========================================
    await note.populate("author", "username email");

    console.log(`✅ Note created by ${req.user.username || userId}: "${note.display_title}"`);
    if (savedChecklistItems.length > 0) {
      console. log(`   └─ with ${savedChecklistItems.length} checklist items`);
    }

    res.status(201). json({
      success: true,
      message: "Note created successfully",
      data: {
        note: note,
        checklist_items: savedChecklistItems
      }
    });

  } catch (err) {
    console.error("❌ Error creating note:", err);
    res.status(500). json({
      success: false,
      message: "Server error",
      error: err.message
    });
  }
};

/**
 * Retrieves all notes for the authenticated user with filtering options.
 * Supports filtering by archived, favorite, trashed status, tags, color, and full-text search.
 * Notes are sorted by favorite status, pin status, and creation date.
 *
 * @route GET /notes
 * @access Private (requires authentication)
 * @middleware authMiddleware - Validates user authentication
 *
 * @param {Object} req - Express request object
 * @param {Object} req.query - Query parameters
 * @param {string} [req.query.archived] - Filter by archived status ('true'/'false')
 * @param {string} [req. query.favorite] - Filter by favorite status ('true'/'false')
 * @param {string} [req.query.trashed] - Show deleted notes ('true' to show trash)
 * @param {string} [req.query.search] - Full-text search query
 * @param {string} [req.query.tags] - Comma-separated tags to filter by
 * @param {string} [req.query.color_theme] - Filter by color theme
 * @param {Object} req.user - Authenticated user (from authMiddleware)
 * @param {Object} res - Express response object
 *
 * @returns {Promise<void>} Sends JSON response with notes array
 *
 * @throws {401} If user is not authenticated
 * @throws {500} If server error occurs
 *
 * @example
 * // Get all active notes
 * GET /notes
 * Authorization: Bearer <token>
 *
 * @example
 * // Get only favorite notes
 * GET /notes?favorite=true
 *
 * @example
 * // Get archived notes
 * GET /notes?archived=true
 *
 * @example
 * // Get trashed notes
 * GET /notes?trashed=true
 *
 * @example
 * // Search notes
 * GET /notes?search=meeting
 *
 * @example
 * // Filter by tags
 * GET /notes?tags=work,important
 *
 * @example
 * // Filter by color
 * GET /notes? color_theme=BLUE
 *
 * @example
 * // Success Response (200)
 * {
 *   "success": true,
 *   "count": 3,
 *   "data": [
 *     {
 *       "_id": "note1",
 *       "title": "Meeting Notes",
 *       "content_body": "Discussed project timeline",
 *       "color_theme": "BLUE",
 *       "is_favorite": true,
 *       "is_archived": false,
 *       "tags": ["work", "meetings"],
 *       "createdAt": "2025-12-02T10:00:00.000Z"
 *     }
 *   ]
 * }
 */


export const getNotes = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id || req.user?._id;
    const {
      archived,
      favorite,
      trashed,
      search,
      tags,
      color_theme
    } = req.query;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: userId not found."
      });
    }

    // ========================================
    // BUILD QUERY
    // ========================================
    const query = {
      author: userId
    };

    // Trashed vs Active notes
    if (trashed === 'true') {
      query.deleted_at = { $ne: null };
    } else {
      query.deleted_at = null;
    }

    // Filter by archived
    if (archived !== undefined && trashed !== 'true') {
      query. is_archived = archived === 'true';
    }

    // Filter by favorite
    if (favorite !== undefined && trashed !== 'true') {
      query.is_favorite = favorite === 'true';
    }

    // Filter by color theme
    if (color_theme) {
      query.color_theme = color_theme. toUpperCase();
    }

    // Filter by tags
    if (tags) {
      const tagArray = tags.split(','). map(t => t.trim());
      query.tags = { $in: tagArray };
    }

    // Full-text search
    if (search) {
      query.$text = { $search: search };
    }

    // ========================================
    // EXECUTE QUERY
    // ========================================
    const notes = await Note. find(query)
      .populate("author", "username email")
      .sort({
        is_favorite: -1,
        isPinned: -1,
        createdAt: -1
      });

    console.log(`✅ Retrieved ${notes.length} notes for user ${userId}`);

    res.status(200).json({
      success: true,
      count: notes.length,
      data: notes
    });

  } catch (err) {
    console.error("❌ Error getting notes:", err);
    res. status(500).json({
      success: false,
      message: "Server error",
      error: err.message
    });
  }
};



/**
 * Retrieves a single note by ID with all related data.
 * Includes checklist items and attachments in the response.
 * Only returns notes owned by the authenticated user.
 *
 * @route GET /notes/:noteId
 * @access Private (requires authentication and note ownership)
 * @middleware authMiddleware - Validates user authentication
 *
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.noteId - MongoDB ObjectId of the note
 * @param {Object} req.user - Authenticated user (from authMiddleware)
 * @param {Object} res - Express response object
 *
 * @returns {Promise<void>} Sends JSON response with note details
 *
 * @throws {401} If user is not authenticated
 * @throws {404} If note is not found or doesn't belong to user
 * @throws {500} If server error occurs
 *
 * @example
 * // Request
 * GET /notes/674d5e3f8a1b2c3d4e5f6789
 * Authorization: Bearer <token>
 *
 * @example
 * // Success Response (200)
 * {
 *   "success": true,
 *   "data": {
 *     "id": "674d5e3f8a1b2c3d4e5f6789",
 *     "user_id": "user123",
 *     "title": "Shopping List",
 *     "content_body": "Weekly groceries",
 *     "color_theme": "GREEN",
 *     "is_favorite": false,
 *     "is_archived": false,
 *     "is_locked": false,
 *     "created_at": "2025-12-02T10:00:00.000Z",
 *     "updated_at": "2025-12-02T15:30:00.000Z",
 *     "deleted_at": null,
 *     "checklist_items": [
 *       {
 *         "id": "item1",
 *         "note_id": "674d5e3f8a1b2c3d4e5f6789",
 *         "text": "Milk",
 *         "is_completed": false,
 *         "sort_order": 0,
 *         "created_at": "2025-12-02T10:00:00.000Z",
 *         "updated_at": "2025-12-02T10:00:00.000Z"
 *       }
 *     ],
 *     "attachments": [
 *       {
 *         "id": "att1",
 *         "note_id": "674d5e3f8a1b2c3d4e5f6789",
 *         "file_type": "IMAGE",
 *         "remote_url": "/uploads/notes/image.jpg",
 *         "filename": "photo.jpg",
 *         "file_size": 245678
 *       }
 *     ]
 *   }
 * }
 */

export const getNoteById = async (req, res) => {
  try {
    const { noteId } = req.params;
    const userId = req.user?.userId || req.user?.id || req. user?._id;

    const note = await Note.findOne({
      _id: noteId,
      author: userId
    }).populate("author", "username email");

    if (!note) {
      return res.status(404).json({
        success: false,
        message: "Note not found"
      });
    }

    // Fetch checklist items
    const checklist_items = await NoteChecklistItem.findByNote(noteId);

    // 🆕 Fetch attachments
    const attachments = await NoteAttachment.findByNote(noteId);

    // Build response
    const response = {
      id: note._id,
      user_id: note.author._id,
      title: note.title,
      content_body: note.content_body,
      color_theme: note.color_theme,
      is_favorite: note.is_favorite,
      is_archived: note.is_archived,
      is_locked: note.is_locked,
      created_at: note.createdAt,
      updated_at: note.updatedAt,
      deleted_at: note.deleted_at,
      checklist_items: checklist_items.map(item => ({
        id: item._id,
        note_id: item.note_id,
        text: item.text,
        is_completed: item.is_completed,
        sort_order: item.sort_order,
        created_at: item. createdAt,
        updated_at: item.updatedAt
      })),
      // 🆕 Include attachments
      attachments: attachments.map(att => ({
        id: att._id,
        note_id: att.note_id,
        file_type: att.file_type,
        remote_url: att.remote_url,
        local_path: att.local_path,
        mime_type: att.mime_type,
        file_size: att.file_size,
        filename: att.filename,
        media_duration: att.media_duration,
        thumbnail_url: att.thumbnail_url,
        created_at: att. created_at
      }))
    };

    res.status(200).json({
      success: true,
      data: response
    });

  } catch (err) {
    console.error("❌ Error getting note:", err);
    res. status(500).json({
      success: false,
      message: "Server error",
      error: err.message
    });
  }
};
/**
 * Updates an existing note's properties.
 * Can update title, content, color, tags, and status flags.
 * Only the note owner can update their notes.
 *
 * @route PUT /notes/:noteId
 * @access Private (requires authentication and note ownership)
 * @middleware authMiddleware - Validates user authentication
 *
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.noteId - MongoDB ObjectId of the note
 * @param {Object} req. body - Request body
 * @param {string} [req.body.title] - Updated title
 * @param {string} [req.body.content_body] - Updated content
 * @param {string} [req.body.color_theme] - Updated color theme
 * @param {string[]|string} [req.body. tags] - Updated tags array or comma-separated string
 * @param {boolean} [req.body.is_favorite] - Updated favorite status
 * @param {boolean} [req.body.is_archived] - Updated archived status
 * @param {boolean} [req.body.is_locked] - Updated lock status
 * @param {Object} req.user - Authenticated user (from authMiddleware)
 * @param {Object} res - Express response object
 *
 * @returns {Promise<void>} Sends JSON response with updated note
 *
 * @throws {401} If user is not authenticated
 * @throws {404} If note is not found or doesn't belong to user
 * @throws {500} If server error occurs
 *
 * @example
 * // Request
 * PUT /notes/674d5e3f8a1b2c3d4e5f6789
 * Authorization: Bearer <token>
 * Content-Type: application/json
 *
 * {
 *   "title": "Updated Shopping List",
 *   "color_theme": "RED",
 *   "tags": ["urgent", "shopping"],
 *   "is_favorite": true
 * }
 *
 * @example
 * // Success Response (200)
 * {
 *   "success": true,
 *   "message": "Note updated successfully",
 *   "data": {
 *     "_id": "674d5e3f8a1b2c3d4e5f6789",
 *     "title": "Updated Shopping List",
 *     "color_theme": "RED",
 *     "tags": ["urgent", "shopping"],
 *     "is_favorite": true,
 *     "updatedAt": "2025-12-02T15:35:00.000Z"
 *   }
 * }
 */

export const updateNote = async (req, res) => {
  try {
    const { noteId } = req.params;
    const {
      title,
      content_body,
      color_theme,
      tags,
      is_favorite,
      is_archived,
      is_locked
    } = req. body;

    const userId = req. user?.userId || req.user?. id || req.user?._id;

    // Find note
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

    // ========================================
    // UPDATE FIELDS
    // ========================================
    if (title !== undefined) note.title = title;
    if (content_body !== undefined) note.content_body = content_body;
    if (color_theme !== undefined) note.color_theme = color_theme;
    if (is_favorite !== undefined) note.is_favorite = is_favorite;
    if (is_archived !== undefined) note.is_archived = is_archived;
    if (is_locked !== undefined) note.is_locked = is_locked;

    if (tags !== undefined) {
      note.tags = Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim());
    }

    await note.save();
    await note.populate("author", "username email");

    console.log(`✅ Note updated: "${note.display_title}"`);

    res.status(200).json({
      success: true,
      message: "Note updated successfully",
      data: note
    });

  } catch (err) {
    console.error("❌ Error updating note:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err. message
    });
  }
};

/**
 * Soft deletes a note by marking it as deleted.
 * Note is moved to trash and will be permanently deleted after 30 days via TTL.
 * Only the note owner can delete their notes.
 *
 * @route DELETE /notes/:noteId
 * @access Private (requires authentication and note ownership)
 * @middleware authMiddleware - Validates user authentication
 *
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.noteId - MongoDB ObjectId of the note
 * @param {Object} req.user - Authenticated user (from authMiddleware)
 * @param {Object} res - Express response object
 *
 * @returns {Promise<void>} Sends JSON response confirming deletion
 *
 * @throws {401} If user is not authenticated
 * @throws {404} If note is not found or doesn't belong to user
 * @throws {500} If server error occurs
 *
 * @example
 * // Request
 * DELETE /api/notes/674d5e3f8a1b2c3d4e5f6789
 * Authorization: Bearer <token>
 *
 * @example
 * // Success Response (200)
 * {
 *   "success": true,
 *   "message": "Note moved to trash.  Will be permanently deleted in 30 days."
 * }
 *
 * @note This is a soft delete.  Note is marked with deleted_at timestamp
 * and will be permanently removed after 30 days via TTL index.
 */


export const deleteNote = async (req, res) => {
  try {
    const { noteId } = req.params;
    const userId = req.user?.userId || req.user?.id || req.user?._id;

    const note = await Note.findOne({
      _id: noteId,
      author: userId,
      deleted_at: null
    });

    if (!note) {
      return res.status(404). json({
        success: false,
        message: "Note not found"
      });
    }

    // ========================================
    // SOFT DELETE
    // ========================================
    await note.softDelete();

    console.log(`🗑️ Note soft deleted: "${note.display_title}"`);
    console.log(`   Will be permanently deleted after 30 days`);

    res.status(200).json({
      success: true,
      message: "Note moved to trash.  Will be permanently deleted in 30 days."
    });

  } catch (err) {
    console.error("❌ Error deleting note:", err);
    res.status(500). json({
      success: false,
      message: "Server error",
      error: err.message
    });
  }
};

/**
 * Toggles the favorite/starred status of a note.
 * If favorited, removes from favorites.  If not favorited, adds to favorites.
 * Favorite notes appear first in the notes list.
 *
 * @route PUT /notes/:noteId/favorite
 * @access Private (requires authentication and note ownership)
 * @middleware authMiddleware - Validates user authentication
 *
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.noteId - MongoDB ObjectId of the note
 * @param {Object} req.user - Authenticated user (from authMiddleware)
 * @param {Object} res - Express response object
 *
 * @returns {Promise<void>} Sends JSON response with updated favorite status
 *
 * @throws {401} If user is not authenticated
 * @throws {404} If note is not found or doesn't belong to user
 * @throws {500} If server error occurs
 *
 * @example
 * // Request
 * PUT /notes/674d5e3f8a1b2c3d4e5f6789/favorite
 * Authorization: Bearer <token>
 *
 * @example
 * // Success Response (200) - Added to Favorites
 * {
 *   "success": true,
 *   "message": "Note added to favorites",
 *   "is_favorite": true
 * }
 *
 * @example
 * // Success Response (200) - Removed from Favorites
 * {
 *   "success": true,
 *   "message": "Note removed from favorites",
 *   "is_favorite": false
 * }
 */


export const restoreNote = async (req, res) => {
  try {
    const { noteId } = req.params;
    const userId = req.user?.userId || req. user?.id || req.user?._id;

    const note = await Note.findOne({
      _id: noteId,
      author: userId,
      deleted_at: { $ne: null }
    });

    if (!note) {
      return res.status(404).json({
        success: false,
        message: "Deleted note not found"
      });
    }

    await note.restore();

    console. log(`♻️ Note restored: "${note.display_title}"`);

    res.status(200).json({
      success: true,
      message: "Note restored successfully",
      data: note
    });

  } catch (err) {
    console.error("❌ Error restoring note:", err);
    res.status(500). json({
      success: false,
      message: "Server error",
      error: err.message
    });
  }
};

/**
 * Toggles the favorite/starred status of a note.
 * If favorited, removes from favorites.  If not favorited, adds to favorites.
 * Favorite notes appear first in the notes list.
 *
 * @route PUT /notes/:noteId/favorite
 * @access Private (requires authentication and note ownership)
 * @middleware authMiddleware - Validates user authentication
 *
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.noteId - MongoDB ObjectId of the note
 * @param {Object} req.user - Authenticated user (from authMiddleware)
 * @param {Object} res - Express response object
 *
 * @returns {Promise<void>} Sends JSON response with updated favorite status
 *
 * @throws {401} If user is not authenticated
 * @throws {404} If note is not found or doesn't belong to user
 * @throws {500} If server error occurs
 *
 * @example
 * // Request
 * PUT /api/notes/674d5e3f8a1b2c3d4e5f6789/favorite
 * Authorization: Bearer <token>
 *
 * @example
 * // Success Response (200) - Added to Favorites
 * {
 *   "success": true,
 *   "message": "Note added to favorites",
 *   "is_favorite": true
 * }
 *
 * @example
 * // Success Response (200) - Removed from Favorites
 * {
 *   "success": true,
 *   "message": "Note removed from favorites",
 *   "is_favorite": false
 * }
 */

export const toggleFavorite = async (req, res) => {
  try {
    const { noteId } = req.params;
    const userId = req.user?.userId || req.user?.id || req. user?._id;

    const note = await Note.findOne({
      _id: noteId,
      author: userId,
      deleted_at: null
    });

    if (!note) {
      return res.status(404). json({
        success: false,
        message: "Note not found"
      });
    }

    await note.toggleFavorite();

    console.log(`⭐ Note ${note.is_favorite ? 'favorited' : 'unfavorited'}: "${note.display_title}"`);

    res.status(200).json({
      success: true,
      message: `Note ${note.is_favorite ?  'added to favorites' : 'removed from favorites'}`,
      is_favorite: note.is_favorite
    });

  } catch (err) {
    console.error("❌ Error toggling favorite:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message
    });
  }
};

/**
 * Toggles the archived status of a note.
 * Archived notes are hidden from the main notes list but not deleted.
 * Can be used for decluttering without losing notes.
 *
 * @route PUT /notes/:noteId/archive
 * @access Private (requires authentication and note ownership)
 * @middleware authMiddleware - Validates user authentication
 *
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.noteId - MongoDB ObjectId of the note
 * @param {Object} req.user - Authenticated user (from authMiddleware)
 * @param {Object} res - Express response object
 *
 * @returns {Promise<void>} Sends JSON response with updated archive status
 *
 * @throws {401} If user is not authenticated
 * @throws {404} If note is not found or doesn't belong to user
 * @throws {500} If server error occurs
 *
 * @example
 * // Request
 * PUT /notes/674d5e3f8a1b2c3d4e5f6789/archive
 * Authorization: Bearer <token>
 *
 * @example
 * // Success Response (200) - Archived
 * {
 *   "success": true,
 *   "message": "Note archived",
 *   "is_archived": true
 * }
 *
 * @example
 * // Success Response (200) - Unarchived
 * {
 *   "success": true,
 *   "message": "Note unarchived",
 *   "is_archived": false
 * }
 */

export const toggleArchive = async (req, res) => {
  try {
    const { noteId } = req.params;
    const userId = req.user?.userId || req.user?.id || req.user?._id;

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

    await note.toggleArchive();

    console.log(`📦 Note ${note.is_archived ? 'archived' : 'unarchived'}: "${note. display_title}"`);

    res.status(200).json({
      success: true,
      message: `Note ${note.is_archived ? 'archived' : 'unarchived'}`,
      is_archived: note.is_archived
    });

  } catch (err) {
    console.error("❌ Error toggling archive:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message
    });
  }
};

/**
 * Adds a new checklist item to a note.
 * Automatically assigns sort_order if not provided.
 * Updates note's timestamp to trigger sync.
 *
 * @route POST /notes/:noteId/checklist
 * @access Private (requires authentication and note ownership)
 * @middleware authMiddleware - Validates user authentication
 *
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.noteId - MongoDB ObjectId of the note
 * @param {Object} req.body - Request body
 * @param {string} req.body.text - Item text (required)
 * @param {boolean} [req.body.is_completed=false] - Completion status
 * @param {number} [req.body.sort_order] - Display order (auto-assigned if omitted)
 * @param {Object} req.user - Authenticated user (from authMiddleware)
 * @param {Object} res - Express response object
 *
 * @returns {Promise<void>} Sends JSON response with created checklist item
 *
 * @throws {400} If text is missing
 * @throws {401} If user is not authenticated
 * @throws {404} If note is not found or doesn't belong to user
 * @throws {500} If server error occurs
 *
 * @example
 * // Request
 * POST /api/notes/674d5e3f8a1b2c3d4e5f6789/checklist
 * Authorization: Bearer <token>
 * Content-Type: application/json
 *
 * {
 *   "text": "Buy milk",
 *   "is_completed": false
 * }
 *
 * @example
 * // Success Response (201)
 * {
 *   "success": true,
 *   "message": "Checklist item added",
 *   "data": {
 *     "_id": "item123",
 *     "note_id": "674d5e3f8a1b2c3d4e5f6789",
 *     "text": "Buy milk",
 *     "is_completed": false,
 *     "sort_order": 0,
 *     "createdAt": "2025-12-02T15:30:00.000Z"
 *   }
 * }
 */


export const addChecklistItem = async (req, res) => {
  try {
    const { noteId } = req.params;
    const { text, is_completed, sort_order } = req.body;
    const userId = req.user?. userId || req.user?.id || req.user?._id;

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

    if (! text) {
      return res.status(400).json({
        success: false,
        message: "Text is required for checklist item"
      });
    }

    // Get current max sort_order if not provided
    let finalSortOrder = sort_order;
    if (finalSortOrder === undefined) {
      const existingItems = await NoteChecklistItem. findByNote(noteId);
      finalSortOrder = existingItems. length;
    }

    // Create checklist item
    const item = new NoteChecklistItem({
      note_id: noteId,
      text: text,
      is_completed: is_completed || false,
      sort_order: finalSortOrder
    });

    await item.save();

    // Update note's updated_at for sync
    note.updatedAt = new Date();
    await note. save();

    console.log(`✅ Checklist item added to note "${note.display_title}": "${text}"`);

    res.status(201).json({
      success: true,
      message: "Checklist item added",
      data: item
    });

  } catch (err) {
    console.error("❌ Error adding checklist item:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message
    });
  }
};

/**
 * Updates an existing checklist item.
 * Can update text, completion status, and sort order.
 * Updates note's timestamp to trigger sync.
 *
 * @route PUT /api/notes/checklist/:itemId
 * @access Private (requires authentication and note ownership)
 * @middleware authMiddleware - Validates user authentication
 *
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.itemId - MongoDB ObjectId of the checklist item
 * @param {Object} req.body - Request body
 * @param {string} [req.body.text] - Updated item text
 * @param {boolean} [req.body.is_completed] - Updated completion status
 * @param {number} [req.body.sort_order] - Updated display order
 * @param {Object} req.user - Authenticated user (from authMiddleware)
 * @param {Object} res - Express response object
 *
 * @returns {Promise<void>} Sends JSON response with updated checklist item
 *
 * @throws {401} If user is not authenticated
 * @throws {403} If user doesn't own the note
 * @throws {404} If checklist item is not found
 * @throws {500} If server error occurs
 *
 * @example
 * // Request
 * PUT /notes/checklist/item123
 * Authorization: Bearer <token>
 * Content-Type: application/json
 *
 * {
 *   "text": "Buy organic milk",
 *   "is_completed": true
 * }
 *
 * @example
 * // Success Response (200)
 * {
 *   "success": true,
 *   "message": "Checklist item updated",
 *   "data": {
 *     "_id": "item123",
 *     "text": "Buy organic milk",
 *     "is_completed": true,
 *     "updatedAt": "2025-12-02T15:35:00.000Z"
 *   }
 * }
 */
export const updateChecklistItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { text, is_completed, sort_order } = req. body;
    const userId = req.user?.userId || req.user?.id || req.user?._id;

    // Find item and verify ownership through note
    const item = await NoteChecklistItem.findById(itemId);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Checklist item not found"
      });
    }

    // Verify note ownership
    const note = await Note. findOne({
      _id: item.note_id,
      author: userId
    });

    if (!note) {
      return res.status(403).json({
        success: false,
        message: "Access denied"
      });
    }

    // Update fields
    if (text !== undefined) item.text = text;
    if (is_completed !== undefined) item.is_completed = is_completed;
    if (sort_order !== undefined) item.sort_order = sort_order;

    await item.save();

    // Update note's updated_at for sync
    note.updatedAt = new Date();
    await note.save();

    console.log(`✅ Checklist item updated: "${item.text}"`);

    res.status(200).json({
      success: true,
      message: "Checklist item updated",
      data: item
    });

  } catch (err) {
    console.error("❌ Error updating checklist item:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message
    });
  }
};

/**
 * Deletes a checklist item from a note.
 * Permanently removes the item (not soft delete).
 * Updates note's timestamp to trigger sync.
 *
 * @route DELETE /notes/checklist/:itemId
 * @access Private (requires authentication and note ownership)
 * @middleware authMiddleware - Validates user authentication
 *
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.itemId - MongoDB ObjectId of the checklist item
 * @param {Object} req. user - Authenticated user (from authMiddleware)
 * @param {Object} res - Express response object
 *
 * @returns {Promise<void>} Sends JSON response confirming deletion
 *
 * @throws {401} If user is not authenticated
 * @throws {403} If user doesn't own the note
 * @throws {404} If checklist item is not found
 * @throws {500} If server error occurs
 *
 * @example
 * // Request
 * DELETE /notes/checklist/item123
 * Authorization: Bearer <token>
 *
 * @example
 * // Success Response (200)
 * {
 *   "success": true,
 *   "message": "Checklist item deleted"
 * }
 */

export const deleteChecklistItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    const userId = req.user?.userId || req.user?.id || req.user?._id;

    // Find item
    const item = await NoteChecklistItem.findById(itemId);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Checklist item not found"
      });
    }

    // Verify note ownership
    const note = await Note.findOne({
      _id: item.note_id,
      author: userId
    });

    if (!note) {
      return res.status(403). json({
        success: false,
        message: "Access denied"
      });
    }

    await NoteChecklistItem.deleteOne({ _id: itemId });

    // Update note's updated_at for sync
    note.updatedAt = new Date();
    await note. save();

    console.log(`🗑️ Checklist item deleted: "${item.text}"`);

    res.status(200).json({
      success: true,
      message: "Checklist item deleted"
    });

  } catch (err) {
    console.error("❌ Error deleting checklist item:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message
    });
  }
};

/**
 * Reorders checklist items in bulk.
 * Updates sort_order for multiple items atomically.
 * Useful for drag-and-drop reordering in UI.
 *
 * @route PUT /api/notes/:noteId/checklist/reorder
 * @access Private (requires authentication and note ownership)
 * @middleware authMiddleware - Validates user authentication
 *
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.noteId - MongoDB ObjectId of the note
 * @param {Object} req.body - Request body
 * @param {Object[]} req.body.items - Array of items with new order (required)
 * @param {string} req.body.items[].id - Item MongoDB ObjectId
 * @param {number} req.body.items[].sort_order - New sort order
 * @param {Object} req.user - Authenticated user (from authMiddleware)
 * @param {Object} res - Express response object
 *
 * @returns {Promise<void>} Sends JSON response confirming reorder
 *
 * @throws {400} If items array is missing or invalid
 * @throws {401} If user is not authenticated
 * @throws {404} If note is not found or doesn't belong to user
 * @throws {500} If server error occurs
 *
 * @example
 * // Request
 * PUT /api/notes/674d5e3f8a1b2c3d4e5f6789/checklist/reorder
 * Authorization: Bearer <token>
 * Content-Type: application/json
 *
 * {
 *   "items": [
 *     { "id": "item3", "sort_order": 0 },
 *     { "id": "item1", "sort_order": 1 },
 *     { "id": "item2", "sort_order": 2 }
 *   ]
 * }
 *
 * @example
 * // Success Response (200)
 * {
 *   "success": true,
 *   "message": "Checklist items reordered"
 * }
 */
export const reorderChecklistItems = async (req, res) => {
  try {
    const { noteId } = req.params;
    const { items } = req.body;  // Array of { id, sort_order }
    const userId = req.user?.userId || req.user?.id || req.user?._id;

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

    if (!items || ! Array.isArray(items)) {
      return res.status(400).json({
        success: false,
        message: "Items array is required"
      });
    }

    // Reorder items
    await NoteChecklistItem.reorder(noteId, items);

    // Update note's updated_at for sync
    note.updatedAt = new Date();
    await note. save();

    console.log(`🔄 Reordered ${items.length} checklist items for note "${note.display_title}"`);

    res.status(200).json({
      success: true,
      message: "Checklist items reordered"
    });

  } catch (err) {
    console.error("❌ Error reordering checklist items:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message
    });
  }
};

/**
 * Synchronizes notes across devices.
 * Returns all notes (and their checklist items/attachments) modified since last sync.
 * Includes both active and deleted notes for proper sync.
 * Deleted notes are returned separately with deletion timestamps.
 *
 * @route GET /notes/sync
 * @access Private (requires authentication)
 * @middleware authMiddleware - Validates user authentication
 *
 * @param {Object} req - Express request object
 * @param {Object} req.query - Query parameters
 * @param {string} [req.query.lastSync] - ISO 8601 timestamp of last sync (if omitted, returns all notes)
 * @param {Object} req.user - Authenticated user (from authMiddleware)
 * @param {Object} res - Express response object
 *
 * @returns {Promise<void>} Sends JSON response with sync data
 *
 * @throws {401} If user is not authenticated
 * @throws {500} If server error occurs
 *
 * @example
 * // Request - First Sync
 * GET /notes/sync
 * Authorization: Bearer <token>
 *
 * @example
 * // Request - Incremental Sync
 * GET /notes/sync?lastSync=2025-12-02T10:00:00.000Z
 * Authorization: Bearer <token>
 *
 * @example
 * // Success Response (200)
 * {
 *   "success": true,
 *   "serverTime": "2025-12-02T15:30:00.000Z",
 *   "lastSync": "2025-12-02T10:00:00. 000Z",
 *   "updated": [
 *     {
 *       "id": "note1",
 *       "user_id": "user123",
 *       "title": "Updated Note",
 *       "content_body": "Content.. .",
 *       "color_theme": "BLUE",
 *       "is_favorite": true,
 *       "is_archived": false,
 *       "is_locked": false,
 *       "created_at": "2025-12-01T10:00:00.000Z",
 *       "updated_at": "2025-12-02T15:00:00.000Z",
 *       "deleted_at": null,
 *       "checklist_items": [
 *         {
 *           "id": "item1",
 *           "text": "Task 1",
 *           "is_completed": false,
 *           "sort_order": 0
 *         }
 *       ],
 *       "attachments": [
 *         {
 *           "id": "att1",
 *           "file_type": "IMAGE",
 *           "remote_url": "/uploads/notes/img. jpg",
 *           "filename": "photo.jpg"
 *         }
 *       ]
 *     }
 *   ],
 *   "deleted": [
 *     {
 *       "id": "note2",
 *       "deleted_at": "2025-12-02T14:00:00.000Z"
 *     }
 *   ],
 *   "count": {
 *     "updated": 1,
 *     "deleted": 1,
 *     "total": 2
 *   }
 * }
 *
 * @note Client should save serverTime as the new lastSync value for next sync.
 * Deleted notes should be removed from local storage on client side.
 */


export const syncNotes = async (req, res) => {
  try {
    const userId = req.user?. userId || req.user?.id || req.user?._id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: userId not found."
      });
    }

    const lastSyncParam = req.query.lastSync;
    const lastSync = lastSyncParam
      ? new Date(lastSyncParam)
      : new Date(0);

    console.log(`🔄 [SYNC] User: ${userId}, Last sync: ${lastSync.toISOString()}`);

    // ========================================
    // QUERY: UPDATED/NEW NOTES
    // ========================================
    const updatedNotes = await Note.find({
      author: userId,
      updatedAt: { $gte: lastSync }
    })
      .populate("author", "username email")
      .sort({ updatedAt: -1 });

    console.log(`✅ [SYNC] Found ${updatedNotes.length} updated notes`);

    // ========================================
    // FOR EACH NOTE, GET CHECKLIST & ATTACHMENTS
    // ========================================
    const notesWithDetails = await Promise.all(
      updatedNotes.map(async (note) => {
        // ✅ Fetch checklist items
        const checklist_items = await NoteChecklistItem.findByNote(note._id);

        // ✅ Fetch attachments (ADD THIS LINE!)
        const attachments = await NoteAttachment.findByNote(note._id);

        return {
          id: note._id,
          user_id: note.author._id,
          title: note.title,
          content_body: note.content_body,
          color_theme: note.color_theme,
          is_favorite: note.is_favorite,
          is_archived: note.is_archived,
          is_locked: note.is_locked,
          created_at: note.createdAt,
          updated_at: note.updatedAt,
          deleted_at: note.deleted_at,
          checklist_items: checklist_items.map(item => ({
            id: item._id,
            note_id: item. note_id,
            text: item.text,
            is_completed: item.is_completed,
            sort_order: item. sort_order,
            created_at: item.createdAt,
            updated_at: item. updatedAt
          })),
          attachments: attachments. map(att => ({
            id: att._id,
            note_id: att.note_id,
            file_type: att.file_type,
            remote_url: att.remote_url,
            local_path: att.local_path,
            mime_type: att.mime_type,
            file_size: att.file_size,
            filename: att.filename,
            media_duration: att.media_duration,
            thumbnail_url: att.thumbnail_url,
            created_at: att.created_at
          }))
        };
      })
    );

    // ========================================
    // SEPARATE ACTIVE FROM DELETED
    // ========================================
    const activeNotes = notesWithDetails.filter(n => n.deleted_at === null);
    const deletedNotes = notesWithDetails.filter(n => n.deleted_at !== null);

    // ========================================
    // PREPARE RESPONSE
    // ========================================
    const serverTime = new Date();

    console.log(`✅ [SYNC] Sending ${activeNotes.length} active, ${deletedNotes.length} deleted`);

    res. status(200).json({
      success: true,
      serverTime: serverTime.toISOString(),
      lastSync: lastSync.toISOString(),
      updated: activeNotes,
      deleted: deletedNotes. map(n => ({
        id: n.id,
        deleted_at: n.deleted_at
      })),
      count: {
        updated: activeNotes.length,
        deleted: deletedNotes.length,
        total: notesWithDetails.length
      }
    });

    console.log(`✅ [SYNC] Sync completed successfully`);

  } catch (err) {
    console.error("❌ [SYNC] Error:", err);
    res.status(500).json({
      success: false,
      message: "Server error during sync",
      error: err.message
    });
  }
};

/**
 * Toggles a note between pinned and unpinned status.
 *
 * @route POST /notes/:noteId/pin
 */
export const togglePin = async (req, res) => {
  try {
    const { noteId } = req.params;
    const userId = req.user?.userId || req.user?.id || req.user?._id;

    const note = await Note.findOne({ _id: noteId, author: userId });

    if (!note) {
      return res.status(404).json({
        success: false,
        message: "Note not found."
      });
    }

    await note.togglePin();

    res.status(200).json({
      success: true,
      message: `Note ${note.isPinned ? "pinned" : "unpinned"} successfully`,
      data: note
    });
  } catch (err) {
    console.error("❌ Error toggling pin:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message
    });
  }
};

export default {
  createNote,
  getNotes,
  getNoteById,
  updateNote,
  deleteNote,
  restoreNote,
  toggleFavorite,
  toggleArchive,
  addChecklistItem,
  updateChecklistItem,
  deleteChecklistItem,
  reorderChecklistItems,
  syncNotes,
  togglePin
};
