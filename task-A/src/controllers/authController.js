import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import User from "../models/User.js";

dotenv.config();

/**
 * Generates a JSON Web Token (JWT) for authenticated users.
 * Token is valid for 7 days and contains user ID and username.
 *
 * @private
 * @param {Object} user - User document from MongoDB
 * @param {string} user._id - User's MongoDB ObjectId
 * @param {string} user.username - User's username
 * @returns {string} Signed JWT token
 *
 * @example
 * const token = generateToken(user);
 * // Returns: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 */

const generateToken = (user) => {
  return jwt.sign(
    { userId: user._id, username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: "7d" } // Token valid for 7 days
  );
};

/**
 * Registers a new user account.
 * Validates input, checks for duplicates, hashes password, and generates JWT token.
 * Automatically creates fullName from firstName and lastName.
 *
 * @route POST /auth/register
 * @access Public
 *
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body
 * @param {string} req.body.username - Unique username (required)
 * @param {string} req.body.email - Unique email address (required)
 * @param {string} req.body.password - Plain text password (required, will be hashed)
 * @param {string} req.body. phone - Unique phone number (required)
 * @param {string} [req.body.firstName] - User's first name
 * @param {string} [req.body.lastName] - User's last name
 * @param {Object} res - Express response object
 *
 * @returns {Promise<void>} Sends JSON response with token and user data
 *
 * @throws {400} If required fields are missing
 * @throws {400} If username, email, or phone already exists
 * @throws {500} If server error occurs
 *
 * @example
 * // Request
 * POST /auth/register
 * Content-Type: application/json
 *
 * {
 *   "username": "johndoe",
 *   "email": "john@example.com",
 *   "password": "SecurePass123!",
 *   "phone": "+1234567890",
 *   "firstName": "John",
 *   "lastName": "Doe"
 * }
 *
 * @example
 * // Success Response (201)
 * {
 *   "message": "User registered successfully",
 *   "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
 *   "user": {
 *     "id": "674d5e3f8a1b2c3d4e5f6789",
 *     "username": "johndoe",
 *     "email": "john@example.com",
 *     "phone": "+1234567890",
 *     "fullName": "John Doe"
 *   }
 * }
 *
 * @example
 * // Error Response (400) - Missing Fields
 * {
 *   "message": "Username, email, phone, and password are required"
 * }
 *
 * @example
 * // Error Response (400) - Duplicate Username
 * {
 *   "message": "Username, email, or phone number already exists"
 * }
 *
 * @example
 * // Error Response (400) - Duplicate Field (MongoDB)
 * {
 *   "message": "Duplicate value for field: email"
 * }
 *
 * @security Password is hashed using bcrypt with 10 salt rounds before storage.
 * Never store plain text passwords in the database.
 */

export const registerUser = async (req, res) => {
  try {
    const { username, email, password, phone, firstName, lastName } = req.body;

    // Validate required fields
    if (! username || !email || !password || !phone) {
      return res.status(400).json({
        message: "Username, email, phone, and password are required",
      });
    }

    // Check for existing username, email, or phone
    const existingUser = await User.findOne({
      $or: [{ username }, { email }, { phone }],
    });

    if (existingUser) {
      return res.status(400).json({
        message: "Username, email, or phone number already exists",
      });
    }

    // Hash password securely
    const hashedPassword = await bcrypt.hash(password, 10);

    // Build full name from first + last name
    const fullName = `${firstName || ""} ${lastName || ""}`. trim();

    // Create new user
    const newUser = new User({
      username,
      email,
      phone,
      password: hashedPassword,
      firstName,
      lastName,
      fullName,
    });

    await newUser. save();

    // Generate JWT token
    const token = generateToken(newUser);

    res.status(201).json({
      message: "User registered successfully",
      token,
      user: {
        id: newUser._id,
        username: newUser.username,
        email: newUser. email,
        phone: newUser.phone,
        fullName: newUser.fullName,
      },
    });
  } catch (error) {
    console. error("Register Error:", error);

    // Handle Mongo duplicate key errors
    if (error.code === 11000) {
      const field = Object.keys(error. keyValue)[0];
      return res.status(400).json({
        message: `Duplicate value for field: ${field}`,
      });
    }

    res.status(500).json({ message: "Server error" });
  }
};

/**
 * Authenticates a user and returns a JWT token.
 * Validates credentials, compares hashed password, and generates session token.
 *
 * @route POST /auth/login
 * @access Public
 *
 * @param {Object} req - Express request object
 * @param {Object} req. body - Request body
 * @param {string} req.body. username - User's username (required)
 * @param {string} req.body.password - User's plain text password (required)
 * @param {Object} res - Express response object
 *
 * @returns {Promise<void>} Sends JSON response with token and user data
 *
 * @throws {400} If username or password is missing
 * @throws {400} If credentials are invalid
 * @throws {500} If server error occurs
 *
 * @example
 * // Request
 * POST /auth/login
 * Content-Type: application/json
 *
 * {
 *   "username": "johndoe",
 *   "password": "SecurePass123!"
 * }
 *
 * @example
 * // Success Response (200)
 * {
 *   "message": "Login successful",
 *   "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
 *   "user": {
 *     "id": "674d5e3f8a1b2c3d4e5f6789",
 *     "username": "johndoe",
 *     "email": "john@example.com",
 *     "phone": "+1234567890",
 *     "fullName": "John Doe"
 *   }
 * }
 *
 * @example
 * // Error Response (400) - Missing Credentials
 * {
 *   "message": "Username and password are required"
 * }
 *
 * @example
 * // Error Response (400) - Invalid Credentials
 * {
 *   "message": "Invalid username or password"
 * }
 *
 * @security Uses bcrypt. compare() to verify password against stored hash.
 * Returns generic error message to prevent user enumeration attacks.
 *
 * @note Token should be stored securely on client side (e.g., httpOnly cookie or secure storage).
 * Include token in Authorization header for subsequent requests: "Bearer <token>"
 */


export const loginUser = async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validate inputs
    if (!username || !password) {
      return res
        . status(400)
        .json({ message: "Username and password are required" });
    }

    // Find user
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400). json({ message: "Invalid username or password" });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid username or password" });
    }

    // Create JWT token
    const token = generateToken(user);

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        phone: user.phone,
        fullName: user.fullName,
      },
    });
  } catch (error) {
    console. error("Login Error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};
