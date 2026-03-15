import mongoose from "./mongoose. js";

const { Schema } = mongoose;

const NotificationSchema = new Schema(
  {
    // ========================================
    // USER RELATIONSHIPS
    // ========================================
    recipient_user_id: {
      type: Schema.ObjectId,
      ref: "users",
      required: true,
      index: true  // Fast lookup: "get all notifications for user X"
    },

    actor_user_id: {
      type: Schema.ObjectId,
      ref: "users",
      default: null  // Null for system alerts
    },

    // ========================================
    // EVENT CLASSIFICATION
    // ========================================
    event_type: {
      type: String,
      enum: [
        'NEW_MESSAGE',
        'MENTION',
        'TASK_ASSIGNED',
        'TASK_DUE',
        'TASK_COMPLETED',
        'ASSIGNMENT_GRADED',
        'NOTE_SHARED',
        'SYSTEM_ALERT',
        'GROUP_INVITE',
        'ROOM_INVITE'
      ],
      required: true,
      index: true  // Filter by type
    },

    // ========================================
    // NOTIFICATION CONTENT
    // ========================================
    title: {
      type: String,
      required: true,
      maxlength: 100
    },

    body: {
      type: String,
      required: true,
      maxlength: 500
    },

    // ========================================
    // NAVIGATION
    // ========================================
    deep_link_uri: {
      type: String,
      required: true
      // Examples: "tapi://chat/123", "tapi://tasks/555", "tapi://notes/abc"
    },

    // ========================================
    // DYNAMIC DATA
    // ========================================
    metadata_payload: {
      type: Schema.Types.Mixed,  // Flexible JSON object
      default: {}
      // Can contain: task_id, chat_id, assignment_id, room_id, etc.
    },

    // ========================================
    // PRIORITY & STATUS
    // ========================================
    priority: {
      type: String,
      enum: ['HIGH', 'NORMAL', 'LOW'],
      default: 'HIGH'
    },

    is_read: {
      type: Boolean,
      default: false,
      index: true  // Fast query for unread notifications
    },

    read_at: {
      type: Date,
      default: null
    },

    delivery_status: {
      type: String,
      enum: ['PENDING', 'SENT_TO_GATEWAY', 'FAILED'],
      default: 'PENDING'
    },

    // ========================================
    // TTL (Time To Live) - 30 days
    // ========================================
    expires_at: {
      type: Date,
      required: true
      // Set to created_at + 30 days
    }
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: false }
  }
);

// ========================================
// INDEXES FOR PERFORMANCE
// ========================================

// Get user's notifications (most common query)
NotificationSchema.index({ recipient_user_id: 1, created_at: -1 });

// Get unread notifications
NotificationSchema.index({ recipient_user_id: 1, is_read: 1 });

// Get notifications by type
NotificationSchema.index({ recipient_user_id: 1, event_type: 1, created_at: -1 });

// Cleanup expired notifications
NotificationSchema.index({ expires_at: 1 });

// ========================================
// TTL INDEX - Auto-delete after expiration
// ========================================
NotificationSchema.index(
  { expires_at: 1 },
  { expireAfterSeconds: 0 }  // Delete immediately when expires_at < NOW
);

// ========================================
// VIRTUAL PROPERTIES
// ========================================

// Check if notification has expired
NotificationSchema.virtual('is_expired').get(function() {
  return this.expires_at < new Date();
});

// Check if notification is unread
NotificationSchema.virtual('is_unread').get(function() {
  return !this.is_read;
});

// ========================================
// INSTANCE METHODS
// ========================================

// Mark notification as read
NotificationSchema.methods.markAsRead = async function() {
  if (! this.is_read) {
    this.is_read = true;
    this.read_at = new Date();
    return await this.save();
  }
  return this;
};

// Mark as delivered
NotificationSchema.methods.markAsDelivered = async function() {
  this.delivery_status = 'SENT_TO_GATEWAY';
  return await this.save();
};

// Mark as failed
NotificationSchema.methods.markAsFailed = async function() {
  this.delivery_status = 'FAILED';
  return await this.save();
};

// ========================================
// STATIC METHODS
// ========================================

// Get unread count for user
NotificationSchema.statics.getUnreadCount = async function(userId) {
  return await this.countDocuments({
    recipient_user_id: userId,
    is_read: false,
    expires_at: { $gt: new Date() }  // Not expired
  });
};

// Mark all as read for user
NotificationSchema.statics.markAllAsRead = async function(userId) {
  const now = new Date();
  return await this.updateMany(
    { recipient_user_id: userId, is_read: false },
    { is_read: true, read_at: now }
  );
};

// Get notifications by type
NotificationSchema.statics.getByType = async function(userId, eventType, limit = 20) {
  return await this.find({
    recipient_user_id: userId,
    event_type: eventType,
    expires_at: { $gt: new Date() }
  })
  .populate('actor_user_id', 'username email avatar')
  .sort({ created_at: -1 })
  . limit(limit);
};

// Cleanup expired notifications manually (backup to TTL)
NotificationSchema.statics.cleanupExpired = async function() {
  const result = await this.deleteMany({
    expires_at: { $lt: new Date() }
  });
  return result.deletedCount;
};

const Notification = mongoose.model("notification_events", NotificationSchema);
export default Notification;
