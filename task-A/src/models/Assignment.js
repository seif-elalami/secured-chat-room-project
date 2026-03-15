import mongoose from "mongoose";

const { Schema } = mongoose;

const AssignmentSchema = new Schema(

  {
    // ========================================
    // BASIC INFO
    // ========================================
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200
    },

    description: {
      type: String,
      required: true,
      maxlength: 5000
    },

    type: {
      type: String,
      enum: ['assignment', 'quiz', 'project', 'homework'],
      default: 'assignment'
    },

    // ========================================
    // CREATOR (INSTRUCTOR)
    // ========================================
    createdBy: {
      type: Schema.ObjectId,
      ref: "users",
      required: true,
      index: true
    },

    // ========================================
    // ASSIGNMENT ATTACHMENTS
    // ========================================
    attachments: [
      {
        url: { type: String, required: true },
        filename: { type: String, required: true },
        mimetype: { type: String, required: true },
        size: { type: Number, required: true },
        uploadedAt: { type: Date, default: Date.now }
      }
    ],

    // ========================================
    // DEADLINE
    // ========================================
    deadline: {
      type: Date,
      required: true,
      index: true
    },

    // ========================================
    // ASSIGNED STUDENTS
    // ========================================
    assignedTo: [
      {
        type: Schema. ObjectId,
        ref: "users",
        index: true
      }
    ],

    // ========================================
    // SUBMISSIONS
    // ========================================
    submissions: [
      {
        studentId: {
          type: Schema.ObjectId,
          ref: "users",
          required: true
        },

        submittedAt: {
          type: Date,
          default: Date.now
        },

        files: [
          {
            url: { type: String, required: true },
            filename: { type: String, required: true },
            mimetype: { type: String, required: true },
            size: { type: Number, required: true }
          }
        ],

        description: {
          type: String,
          maxlength: 1000
        },

        grade: {
          type: Number,
          min: 0,
          max: 100
        },

        feedback: {
          type: String,
          maxlength: 2000
        },

        status: {
          type: String,
          enum: ['submitted', 'graded', 'late'],
          default: 'submitted'
        }
      }
    ],

    // ========================================
    // CLASSROOM/ROOM
    // ========================================
    roomId: {
      type: Schema.ObjectId,
      ref: "rooms",
      index: true
    },

    // ========================================
    // STATUS
    // ========================================
    isActive: {
      type: Boolean,
      default: true
    },

    isDeleted: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true  // Adds createdAt and updatedAt
  }
);

// ========================================
// INDEXES FOR PERFORMANCE
// ========================================
AssignmentSchema.index({ createdBy: 1, createdAt: -1 });
AssignmentSchema.index({ roomId: 1, deadline: 1 });
AssignmentSchema.index({ assignedTo: 1, deadline: 1 });
AssignmentSchema.index({ 'submissions.studentId': 1 });

// ========================================
// VIRTUAL: SUBMISSION COUNT
// ========================================
AssignmentSchema.virtual('submissionCount').get(function() {
  return this.submissions.length;
});

// ========================================
// VIRTUAL: PENDING COUNT
// ========================================
AssignmentSchema.virtual('pendingCount').get(function() {
  return this.assignedTo.length - this.submissions.length;
});

// ========================================
// VIRTUAL: IS OVERDUE
// ========================================
AssignmentSchema.virtual('isOverdue').get(function() {
  return new Date() > this.deadline;
});

// ========================================
// METHOD: CHECK IF STUDENT SUBMITTED
// ========================================
AssignmentSchema. methods.hasStudentSubmitted = function(studentId) {
  return this.submissions.some(
    sub => sub.studentId.toString() === studentId.toString()
  );
};

// ========================================
// METHOD: GET STUDENT SUBMISSION
// ========================================
AssignmentSchema.methods.getStudentSubmission = function(studentId) {
  return this.submissions.find(
    sub => sub.studentId.toString() === studentId. toString()
  );
};

const Assignment = mongoose.model("assignments", AssignmentSchema);
export default Assignment;
