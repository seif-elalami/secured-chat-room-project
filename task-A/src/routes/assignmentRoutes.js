import express from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import {
  canCreateAssignment,
  canSubmitAssignment,
  canGradeAssignment,
  canDeleteAssignment
} from '../middleware/assignmentMiddleware.js';
import { upload } from '../middleware/uploadMiddleware.js';
import {
  createAssignment,
  getAssignments,
  getAssignmentById,
  submitAssignment,
  gradeSubmission,
  deleteAssignment
} from '../controllers/assignmentController.js';

const router = express.Router();

// ========================================
// ASSIGNMENT ROUTES (ROOM ROLE-BASED)
// ========================================

// Create assignment (room admin/moderator/creator only)
router.post('/',
  authMiddleware,
  upload.fields([{ name: 'attachments', maxCount: 10 }]),
  canCreateAssignment,  // ✅ Checks room role
  createAssignment
);

// Get all assignments (any authenticated user in their rooms)
router.get('/', authMiddleware, getAssignments);

// Get single assignment (room members only)
router.get('/:assignmentId', authMiddleware, getAssignmentById);

// Submit assignment (room members only)
router.post('/:assignmentId/submit',
  authMiddleware,
  upload.fields([{ name: 'files', maxCount: 10 }]),
  canSubmitAssignment,  // ✅ Checks room membership
  submitAssignment
);

// Grade submission (room admin/moderator/creator only)
router.put('/:assignmentId/grade/:studentId',
  authMiddleware,
  canGradeAssignment,  // ✅ Checks room role
  gradeSubmission
);

// Delete assignment (room admin/moderator/creator only)
router.delete('/:assignmentId',
  authMiddleware,
  canDeleteAssignment,  // ✅ Checks room role
  deleteAssignment
);

export default router;
