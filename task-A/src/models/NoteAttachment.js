import mongoose from "./mongoose.js";

const { Schema } = mongoose;

const NoteAttachmentSchema = new Schema(
  {
    // ========================================
    // RELATIONSHIP
    // ========================================
    note_id: {
      type: Schema.ObjectId,
      ref: "notes",
      required: true,
      index: true
    },

    // ========================================
    // FILE CLASSIFICATION
    // ========================================
    file_type: {
      type: String,
      enum: ['IMAGE', 'VIDEO', 'VOICE_NOTE', 'DOCUMENT'],
      required: true,
      index: true
    },

    // ========================================
    // STORAGE LOCATIONS
    // ========================================
    remote_url: {
      type: String,
      default: null
      // Nullable for offline-first: user can attach file before upload completes
    },

    local_path: {
      type: String,
      default: null
      // Mobile only: file://storage/emulated/0/...
    },

    // ========================================
    // FILE METADATA
    // ========================================
    mime_type: {
      type: String,
      required: true
      // Examples: image/jpeg, video/mp4, audio/mpeg, application/pdf
    },

    file_size: {
      type: Number,
      default: null
      // Size in bytes
    },

    filename: {
      type: String,
      required: true
      // Original filename from user's device
    },

    // ========================================
    // MEDIA-SPECIFIC FIELDS
    // ========================================
    media_duration: {
      type: Number,
      default: null
      // Duration in seconds (for audio/video only)
      // Example: 125 = 2 minutes 5 seconds
    },

    thumbnail_url: {
      type: String,
      default: null
      // Small preview image URL (for video/image)
      // Example: /uploads/thumbnails/thumb_abc123.jpg
    },

    // ========================================
    // UPLOAD STATUS (for offline-first)
    // ========================================
    upload_status: {
      type: String,
      enum: ['PENDING', 'UPLOADING', 'COMPLETED', 'FAILED'],
      default: 'PENDING'
    },

    // ========================================
    // SOFT DELETE (inherit parent note's deletion)
    // ========================================
    deleted_at: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: {
      createdAt: 'created_at',  // Rename to match spec
      updatedAt: false           // Don't need updatedAt for attachments
    }
  }
);

// ========================================
// INDEXES FOR PERFORMANCE
// ========================================

// Get all attachments for a note
NoteAttachmentSchema.index({ note_id: 1, created_at: -1 });

// Get attachments by type
NoteAttachmentSchema. index({ note_id: 1, file_type: 1 });

// Find images/videos with thumbnails
NoteAttachmentSchema.index({ note_id: 1, file_type: 1, thumbnail_url: 1 });

// Cleanup queries
NoteAttachmentSchema. index({ deleted_at: 1 });

// ========================================
// VIRTUAL PROPERTIES
// ========================================

// Check if it's a media file (audio/video)
NoteAttachmentSchema.virtual('is_media').get(function() {
  return ['VIDEO', 'VOICE_NOTE'].includes(this.file_type);
});

// Check if it's an image
NoteAttachmentSchema.virtual('is_image').get(function() {
  return this.file_type === 'IMAGE';
});

// Get human-readable file size
NoteAttachmentSchema.virtual('file_size_readable').get(function() {
  if (! this.file_size) return null;

  const bytes = this.file_size;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
});

// Get formatted duration (MM:SS)
NoteAttachmentSchema.virtual('duration_formatted').get(function() {
  if (!this.media_duration) return null;

  const minutes = Math.floor(this. media_duration / 60);
  const seconds = this.media_duration % 60;
  return `${minutes}:${seconds. toString().padStart(2, '0')}`;
});

// ========================================
// METHODS
// ========================================

// Mark upload as complete
NoteAttachmentSchema.methods.markUploaded = async function(remoteUrl) {
  this. remote_url = remoteUrl;
  this.upload_status = 'COMPLETED';
  return await this.save();
};

// Mark upload as failed
NoteAttachmentSchema.methods.markFailed = async function() {
  this.upload_status = 'FAILED';
  return await this.save();
};

// Soft delete
NoteAttachmentSchema.methods.softDelete = async function() {
  this.deleted_at = new Date();
  return await this.save();
};

// ========================================
// STATIC METHODS
// ========================================

// Get all attachments for a note
NoteAttachmentSchema. statics.findByNote = function(noteId) {
  return this.find({
    note_id: noteId,
    deleted_at: null
  }). sort({ created_at: -1 });
};

// Get attachments by type
NoteAttachmentSchema.statics.findByType = function(noteId, fileType) {
  return this.find({
    note_id: noteId,
    file_type: fileType,
    deleted_at: null
  }).sort({ created_at: -1 });
};

// Get all images for a note
NoteAttachmentSchema.statics.findImages = function(noteId) {
  return this.findByType(noteId, 'IMAGE');
};

// Get all voice notes for a note
NoteAttachmentSchema.statics.findVoiceNotes = function(noteId) {
  return this.findByType(noteId, 'VOICE_NOTE');
};

// Get pending uploads
NoteAttachmentSchema. statics.findPendingUploads = function(noteId) {
  return this.find({
    note_id: noteId,
    upload_status: { $in: ['PENDING', 'UPLOADING'] }
  });
};

// Delete all attachments for a note
NoteAttachmentSchema.statics.deleteByNote = async function(noteId) {
  return await this.updateMany(
    { note_id: noteId },
    { deleted_at: new Date() }
  );
};

// Hard delete all attachments for a note (for cleanup)
NoteAttachmentSchema.statics.hardDeleteByNote = async function(noteId) {
  return await this.deleteMany({ note_id: noteId });
};

// ========================================
// HOOKS
// ========================================

// Before save: Auto-detect file type from mime_type if not set
NoteAttachmentSchema. pre('save', function(next) {
  if (!this.file_type && this.mime_type) {
    if (this.mime_type.startsWith('image/')) {
      this.file_type = 'IMAGE';
    } else if (this.mime_type.startsWith('video/')) {
      this.file_type = 'VIDEO';
    } else if (this.mime_type.startsWith('audio/')) {
      this. file_type = 'VOICE_NOTE';
    } else {
      this.file_type = 'DOCUMENT';
    }
  }
  next();
});

// ========================================
// TTL INDEX - Auto-delete after 30 days
// ========================================
NoteAttachmentSchema.index(
  { deleted_at: 1 },
  {
    expireAfterSeconds: 30 * 24 * 60 * 60,
    partialFilterExpression: { deleted_at: { $ne: null } }
  }
);

const NoteAttachment = mongoose.model("note_attachments", NoteAttachmentSchema);
export default NoteAttachment;
