import express from "express";
import { registerUser, loginUser } from "../controllers/authController.js";
import { check, validationResult } from "express-validator";

const router = express.Router();

// Validation for registration
const registerValidator = [
  check("username")
    .notEmpty().withMessage("Username is required")
    .isAlphanumeric().withMessage("Username must be alphanumeric"),
  check("email")
    .isEmail().withMessage("Valid email required"),
  check("password")
    .isLength({ min: 8 }).withMessage("Password must be at least 8 characters"),
  check("phone")
    .isMobilePhone().withMessage("Valid phone number required"),
  // Add more checks as needed (e.g. firstName/lastName)
];

// Validation for login
const loginValidator = [
  check("username")
    .notEmpty().withMessage("Username required"),
  check("password")
    .notEmpty().withMessage("Password required"),
];

// Middleware to handle validation errors
function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // Log to backend terminal
    console.warn(`[Validation] ${req.method} ${req.originalUrl} failed:`, errors.array());
    return res.status(400).json({ errors: errors.array() });
  }
  next();
}

router.post("/register", registerValidator, handleValidationErrors, registerUser);
router.post("/login", loginValidator, handleValidationErrors, loginUser);

export default router;
