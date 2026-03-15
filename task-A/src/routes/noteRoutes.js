import express from "express";
import {
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
  syncNotes
} from "../controllers/noteController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

// ========================================
// 📝 NOTE ROUTES
// ========================================

// Apply auth middleware to all routes
router.use(authMiddleware);

// Sync notes (must be before /:noteId to avoid conflict)
router.get('/sync', syncNotes);

// CRUD operations
router.post("/", createNote);
router.get("/", getNotes);
router.get("/:noteId", getNoteById);
router.put("/:noteId", updateNote);
router. delete("/:noteId", deleteNote);
router.post("/:noteId/restore", restoreNote);

// Toggle operations
router.post("/:noteId/favorite", toggleFavorite);
router.post("/:noteId/archive", toggleArchive);

// ========================================
// ✅ CHECKLIST ROUTES
// ========================================

// Add checklist item to note
router.post("/:noteId/checklist", addChecklistItem);

// Update checklist item
router.put("/checklist/:itemId", updateChecklistItem);

// Delete checklist item
router.delete("/checklist/:itemId", deleteChecklistItem);

// Reorder checklist items
router.put("/:noteId/checklist/reorder", reorderChecklistItems);

export default router;
