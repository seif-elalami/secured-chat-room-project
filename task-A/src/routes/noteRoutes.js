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
  syncNotes,
  togglePin
} from "../controllers/noteController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { body, param, validationResult } from "express-validator";

const router = express.Router();

// Universal validation error handler
function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
}

// Apply auth middleware to all routes
router.use(authMiddleware);

// Sync notes
router.get('/sync', syncNotes);

// CRUD operations
router.post("/",
  [
    body("title").notEmpty().withMessage("Title is required"),
    // Validate more note fields as needed
    handleValidationErrors,
  ],
  createNote
);

router.get("/", getNotes);

router.get("/:noteId",
  [
    param("noteId").isMongoId().withMessage("Invalid note ID"),
    handleValidationErrors,
  ],
  getNoteById
);

router.put("/:noteId",
  [
    param("noteId").isMongoId().withMessage("Invalid note ID"),
    body("title").optional().notEmpty().withMessage("Title cannot be empty"),
    // Validate/sanitize more fields as needed
    handleValidationErrors,
  ],
  updateNote
);

router.delete("/:noteId",
  [
    param("noteId").isMongoId().withMessage("Invalid note ID"),
    handleValidationErrors,
  ],
  deleteNote
);

router.post("/:noteId/restore",
  [
    param("noteId").isMongoId().withMessage("Invalid note ID"),
    handleValidationErrors,
  ],
  restoreNote
);

router.post("/:noteId/favorite",
  [
    param("noteId").isMongoId().withMessage("Invalid note ID"),
    handleValidationErrors,
  ],
  toggleFavorite
);

router.post("/:noteId/archive",
  [
    param("noteId").isMongoId().withMessage("Invalid note ID"),
    handleValidationErrors,
  ],
  toggleArchive
);

router.post("/:noteId/pin",
  [
    param("noteId").isMongoId().withMessage("Invalid note ID"),
    handleValidationErrors,
  ],
  togglePin
);

// ========================================
// ✅ CHECKLIST ROUTES
// ========================================

router.post("/:noteId/checklist",
  [
    param("noteId").isMongoId().withMessage("Invalid note ID"),
    body("text").notEmpty().withMessage("Checklist item must have text"),
    // More fields as needed
    handleValidationErrors,
  ],
  addChecklistItem
);

router.put("/checklist/:itemId",
  [
    param("itemId").isMongoId().withMessage("Invalid checklist item ID"),
    // Validate updated fields as needed
    handleValidationErrors,
  ],
  updateChecklistItem
);

router.delete("/checklist/:itemId",
  [
    param("itemId").isMongoId().withMessage("Invalid checklist item ID"),
    handleValidationErrors,
  ],
  deleteChecklistItem
);

router.put("/:noteId/checklist/reorder",
  [
    param("noteId").isMongoId().withMessage("Invalid note ID"),
    // Optional: check the new order/structure being sent
    handleValidationErrors,
  ],
  reorderChecklistItems
);

export default router;
