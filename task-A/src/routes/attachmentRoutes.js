import express from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { upload } from '../middleware/uploadMiddleware.js';
import {
  uploadAttachment,
  uploadVoiceNote,
  getAttachments,
  deleteAttachment,
  getAttachmentStats
} from '../controllers/attachmentController.js';

const router = express.Router();

// Apply auth middleware
router.use(authMiddleware);

// ========================================
// ATTACHMENT ROUTES
// ========================================

// Upload general attachment to note
router.post(
  '/:noteId/upload',
  upload.single('file'),
  uploadAttachment
);

// Upload voice note (requires media_duration)
router. post(
  '/:noteId/voice',
  upload.single('voiceNote'),
  uploadVoiceNote
);

// Get all attachments for a note (optionally filter by type)
router.get('/:noteId', getAttachments);

// Get attachment statistics
router.get('/:noteId/stats', getAttachmentStats);

// Delete attachment
router.delete('/:attachmentId', deleteAttachment);

export default router;
