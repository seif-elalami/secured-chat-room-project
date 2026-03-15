import mongoose from "./mongoose.js";

const { Schema } = mongoose;

const NoteChecklistItemSchema = new Schema(
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
    // CONTENT
    // ========================================
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500
    },

    // ========================================
    // STATE
    // ========================================
    is_completed: {
      type: Boolean,
      default: false,
      index: true
    },

    // ========================================
    // ORDERING
    // ========================================
    sort_order: {
      type: Number,
      required: true,
      default: 0
    }
  },
  {
    timestamps: true  // Adds createdAt and updatedAt for sync
  }
);

// ========================================
// INDEXES FOR PERFORMANCE
// ========================================

// Get all items for a note, sorted by order
NoteChecklistItemSchema. index({ note_id: 1, sort_order: 1 });

// Find uncompleted items
NoteChecklistItemSchema.index({ note_id: 1, is_completed: 1 });

// Sync queries
NoteChecklistItemSchema. index({ note_id: 1, updatedAt: -1 });

// ========================================
// METHODS
// ========================================

// Toggle completion
NoteChecklistItemSchema.methods.toggleComplete = async function() {
  this.is_completed = !this. is_completed;
  return await this.save();
};

// ========================================
// STATIC METHODS
// ========================================

// Get all items for a note
NoteChecklistItemSchema.statics.findByNote = function(noteId) {
  return this.find({ note_id: noteId }). sort({ sort_order: 1 });
};

// Get uncompleted items for a note
NoteChecklistItemSchema.statics.findUncompleted = function(noteId) {
  return this.find({
    note_id: noteId,
    is_completed: false
  }).sort({ sort_order: 1 });
};

// Reorder items
NoteChecklistItemSchema.statics.reorder = async function(noteId, itemOrders) {
  // itemOrders: [{ id: 'item1', sort_order: 0 }, { id: 'item2', sort_order: 1 }]
  const bulkOps = itemOrders. map(item => ({
    updateOne: {
      filter: { _id: item.id, note_id: noteId },
      update: { $set: { sort_order: item.sort_order } }
    }
  }));

  return await this.bulkWrite(bulkOps);
};

// ========================================
// HOOKS
// ========================================

// Before deleting a note, delete its checklist items
NoteChecklistItemSchema.statics.deleteByNote = async function(noteId) {
  return await this.deleteMany({ note_id: noteId });
};

const NoteChecklistItem = mongoose. model("note_checklist_items", NoteChecklistItemSchema);
export default NoteChecklistItem;
