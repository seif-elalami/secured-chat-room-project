import mongoose from "./mongoose.js";

const { Schema } = mongoose;

const NoteSchema = new Schema(
  {
    // ========================================
    // OWNERSHIP
    // ========================================
    author: {
      type: Schema. ObjectId,
      ref: "users",
      required: true,
      index: true
    },

    // ========================================
    // CONTENT
    // ========================================
    title: {
      type: String,
      trim: true,
      maxlength: 200,
      default: ''  // ✅ Optional - can be empty
    },

    content_body: {
      type: String,
      maxlength: 50000,  // 50k characters for markdown
      default: ''
    },

    // ========================================
    // VISUAL & ORGANIZATION
    // ========================================
    color_theme: {
      type: String,
      enum: ['DEFAULT', 'RED', 'ORANGE', 'YELLOW', 'GREEN', 'TEAL', 'BLUE', 'PURPLE', 'GRAY'],
      default: 'DEFAULT',
      index: true
    },

    is_favorite: {
      type: Boolean,
      default: false,
      index: true
    },

    is_archived: {
      type: Boolean,
      default: false,
      index: true
    },

    is_locked: {
      type: Boolean,
      default: false
    },

    // ========================================
    // LEGACY FIELDS (Keep for backward compatibility)
    // ========================================
    isPinned: {
      type: Boolean,
      default: false,
      index: true
    },

    tags: [
      {
        type: String,
        trim: true
      }
    ],

    // ========================================
    // SOFT DELETE
    // ========================================
    deleted_at: {
      type: Date,
      default: null,
    }
  },
  {
    timestamps: true  // Adds createdAt and updatedAt automatically
  }
);

// ========================================
// INDEXES FOR PERFORMANCE
// ========================================

// Main queries
NoteSchema.index({ author: 1, createdAt: -1 });
NoteSchema.index({ author: 1, is_favorite: -1, createdAt: -1 });
NoteSchema.index({ author: 1, is_archived: 1, createdAt: -1 });
NoteSchema.index({ author: 1, deleted_at: 1 });

// Full-text search on title and content
NoteSchema.index({ title: "text", content_body: "text" });

// ========================================
// TTL INDEX - Auto-delete after 30 days
// ========================================
NoteSchema.index(
  { deleted_at: 1 },
  {
    expireAfterSeconds: 30 * 24 * 60 * 60,  // 30 days
    partialFilterExpression: { deleted_at: { $ne: null } }
  }
);

// ========================================
// VIRTUAL PROPERTIES
// ========================================

// Display title (use first words of content if title is empty)
NoteSchema. virtual('display_title').get(function() {
  if (this.title && this.title.trim().length > 0) {
    return this.title;
  }

  // Extract first 30 characters from content
  if (this.content_body && this.content_body.trim().length > 0) {
    const firstLine = this.content_body.trim().split('\n')[0];
    return firstLine.substring(0, 30) + (firstLine.length > 30 ? '...' : '');
  }

  return 'Untitled Note';
});

// Check if note is in trash
NoteSchema.virtual('is_trashed').get(function() {
  return this.deleted_at !== null;
});

// ========================================
// METHODS
// ========================================

// Soft delete
NoteSchema.methods.softDelete = async function() {
  this.deleted_at = new Date();
  return await this.save();
};

// Restore from trash
NoteSchema.methods.restore = async function() {
  this.deleted_at = null;
  return await this.save();
};

// Toggle favorite
NoteSchema.methods.toggleFavorite = async function() {
  this.is_favorite = !this. is_favorite;
  return await this.save();
};

// Toggle archive
NoteSchema.methods.toggleArchive = async function() {
  this.is_archived = ! this.is_archived;
  return await this.save();
};

// ========================================
// STATIC METHODS
// ========================================

// Get active notes (not deleted)
NoteSchema.statics.findActive = function(userId, options = {}) {
  const query = {
    author: userId,
    deleted_at: null
  };

  if (options.is_favorite !== undefined) {
    query.is_favorite = options.is_favorite;
  }

  if (options.is_archived !== undefined) {
    query.is_archived = options.is_archived;
  }

  if (options.color_theme) {
    query.color_theme = options.color_theme;
  }

  return this.find(query)
    .sort({ is_favorite: -1, isPinned: -1, createdAt: -1 });
};

// Get trashed notes
NoteSchema.statics.findTrashed = function(userId) {
  return this.find({
    author: userId,
    deleted_at: { $ne: null }
  }). sort({ deleted_at: -1 });
};

// ========================================
// HOOKS
// ========================================

// Pre-save: Ensure content exists
NoteSchema.pre('save', function(next) {
  // If both title and content are empty, set a default message
  if (! this.title && !this.content_body) {
    this.content_body = 'New Note';
  }
  next();
});

const Note = mongoose.model("notes", NoteSchema);
export default Note;
