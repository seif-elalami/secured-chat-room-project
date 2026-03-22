import User from "../models/User.js";

const escapeRegex = (string) => string.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');

/**
 * Retrieves the authenticated user's complete profile.
 * Excludes password field for security.
 * Returns all user data including settings, blocked users, and timestamps.
 *
 * @route GET /users/me
 * @access Private (requires authentication)
 * @middleware authMiddleware - Validates user authentication and sets req.userId
 *
 * @param {Object} req - Express request object
 * @param {string} req.userId - User's MongoDB ObjectId (from authMiddleware)
 * @param {Object} res - Express response object
 *
 * @returns {Promise<void>} Sends JSON response with user profile
 *
 * @throws {500} If server error occurs
 *
 * @example
 * // Request
 * GET /users/me
 * Authorization: Bearer <token>
 *
 * @example
 * // Success Response (200)
 * {
 *   "_id": "674d5e3f8a1b2c3d4e5f6user1",
 *   "username": "johndoe",
 *   "email": "john@example.com",
 *   "fullName": "John Doe",
 *   "firstName": "John",
 *   "lastName": "Doe",
 *   "phone": "+1234567890",
 *   "avatar": "/uploads/avatars/john. jpg",
 *   "bio": "Software developer",
 *   "blockedUsers": ["user2", "user3"],
 *   "blockedBy": [],
 *   "createdAt": "2025-11-01T10:00:00. 000Z",
 *   "updatedAt": "2025-12-02T15:30:00.000Z"
 * }
 *
 * @note Password field is excluded from response for security
 */
export const getMyProfile = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("-password");
    res.json(user);
  } catch (error) {
    console.error("Get My Profile Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * Retrieves public profile information for any user by their ID.
 * Returns limited user information (username, fullName, email, phone).
 * Accessible without authentication for public profiles.
 *
 * @route GET /users/:userId
 * @access Public
 *
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.userId - MongoDB ObjectId of the user to retrieve
 * @param {Object} res - Express response object
 *
 * @returns {Promise<void>} Sends JSON response with public user profile
 *
 * @throws {404} If user is not found
 * @throws {500} If server error occurs
 *
 * @example
 * // Request
 * GET /users/674d5e3f8a1b2c3d4e5f6user2
 *
 * @example
 * // Success Response (200)
 * {
 *   "_id": "674d5e3f8a1b2c3d4e5f6user2",
 *   "username": "janedoe",
 *   "fullName": "Jane Doe",
 *   "email": "jane@example.com",
 *   "phone": "+0987654321"
 * }
 *
 * @example
 * // Error Response (404)
 * {
 *   "message": "User not found"
 * }
 *
 * @note Only returns public fields (no password, blockedUsers, etc.)
 */

export const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select(
      "username fullName email phone"
    );
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (error) {
    console.error("Get User Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getUserByUsername = async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username }).select(
      "username fullName email phone"
    );
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (error) {
    console.error("Get User by Username Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * Search users by username prefix/substring (authenticated).
 * Excludes the current user. Returns public fields only.
 *
 * @route GET /users/search?q=&limit=
 */
export const searchUsersByUsername = async (req, res) => {
  try {
    const raw = (req.query.q || "").trim();
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 50);

    if (raw.length < 2) {
      return res.json({ users: [] });
    }

    const pattern = new RegExp(escapeRegex(raw), "i");
    const users = await User.find({
      _id: { $ne: req.userId },
      username: pattern,
    })
      .select("username fullName email phone")
      .limit(limit)
      .lean();

    res.json({ users });
  } catch (error) {
    console.error("Search users error:", error);
    res.status(500).json({ message: "Server error" });
  }
};


/**
 * Updates the authenticated user's profile information.
 * Allows updating any user fields except password (use separate password change endpoint).
 * Returns updated user profile excluding password.
 *
 * @route PUT /users/me
 * @access Private (requires authentication)
 * @middleware authMiddleware - Validates user authentication and sets req.userId
 *
 * @param {Object} req - Express request object
 * @param {string} req.userId - User's MongoDB ObjectId (from authMiddleware)
 * @param {Object} req.body - Update data
 * @param {string} [req.body.username] - New username
 * @param {string} [req.body.email] - New email address
 * @param {string} [req.body.fullName] - New full name
 * @param {string} [req.body.firstName] - New first name
 * @param {string} [req. body.lastName] - New last name
 * @param {string} [req.body.phone] - New phone number
 * @param {string} [req.body. avatar] - New avatar URL
 * @param {string} [req.body.bio] - New bio/description
 * @param {Object} res - Express response object
 *
 * @returns {Promise<void>} Sends JSON response with updated profile
 *
 * @throws {500} If server error occurs
 *
 * @example
 * // Request
 * PUT /users/me
 * Authorization: Bearer <token>
 * Content-Type: application/json
 *
 * {
 *   "fullName": "John Smith",
 *   "bio": "Full-stack developer",
 *   "phone": "+1234567890"
 * }
 *
 * @example
 * // Success Response (200)
 * {
 *   "_id": "674d5e3f8a1b2c3d4e5f6user1",
 *   "username": "johndoe",
 *   "email": "john@example.com",
 *   "fullName": "John Smith",
 *   "bio": "Full-stack developer",
 *   "phone": "+1234567890",
 *   "updatedAt": "2025-12-02T15:35:00.000Z"
 * }
 *
 * @note Password field is excluded from response
 * @note Use PATCH /users/me/password for password changes
 */

export const updateMyProfile = async (req, res) => {
  try {
    const updates = req.body;
    const updatedUser = await User.findByIdAndUpdate(req.userId, updates, {
      new: true,
    }).select("-password");
    res.json(updatedUser);
  } catch (error) {
    console.error("Update Profile Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * Permanently deletes the authenticated user's account.
 * Removes all user data from the database (irreversible operation).
 * User will be automatically logged out after deletion.
 *
 * @route DELETE /users/me
 * @access Private (requires authentication)
 * @middleware authMiddleware - Validates user authentication and sets req.userId
 *
 * @param {Object} req - Express request object
 * @param {string} req.userId - User's MongoDB ObjectId (from authMiddleware)
 * @param {Object} res - Express response object
 *
 * @returns {Promise<void>} Sends JSON response confirming deletion
 *
 * @throws {500} If server error occurs
 *
 * @example
 * // Request
 * DELETE /users/me
 * Authorization: Bearer <token>
 *
 * @example
 * // Success Response (200)
 * {
 *   "message": "Account deleted successfully"
 * }
 *
 * @warning This is a destructive operation that cannot be undone
 * @note Client should clear stored tokens and redirect to login after deletion
 * @note Consider implementing soft delete or account deactivation as alternative
 */
export const deleteMyAccount = async (req, res) => {
  try {
    await User.findByIdAndDelete(req.userId);
    res.json({ message: "Account deleted successfully" });
  } catch (error) {
    console.error("Delete User Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};
/**
 * Blocks a user, implementing a two-way blocking system.
 * Adds target user to current user's blockedUsers array.
 * Adds current user to target's blockedBy array.
 * Prevents blocked users from messaging or interacting.
 *
 * @route POST /users/block/:userIdToBlock
 * @access Private (requires authentication)
 * @middleware authMiddleware - Validates user authentication and sets req.userId
 *
 * @param {Object} req - Express request object
 * @param {string} req.userId - Current user's MongoDB ObjectId (from authMiddleware)
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.userIdToBlock - MongoDB ObjectId of user to block
 * @param {Object} res - Express response object
 *
 * @returns {Promise<void>} Sends JSON response confirming block
 *
 * @throws {400} If user attempts to block themselves
 * @throws {404} If current user or target user not found
 * @throws {500} If server error occurs
 *
 * @example
 * // Request
 * POST /users/block/674d5e3f8a1b2c3d4e5f6user2
 * Authorization: Bearer <token>
 *
 * @example
 * // Success Response (200)
 * {
 *   "message": "User blocked successfully (two-way)"
 * }
 *
 * @example
 * // Error Response (400) - Self Block
 * {
 *   "message": "You cannot block yourself"
 * }
 *
 * @example
 * // Error Response (404) - User Not Found
 * {
 *   "message": "User not found"
 * }
 *
 * @note Blocking is bidirectional: both users cannot interact with each other
 * @note Prevents duplicate entries if user already blocked
 * @note Blocked users cannot create rooms, send messages, or view each other's content
 */

export const blockUser = async (req, res) => {
  try {
    const { userIdToBlock } = req.params;
    const currentUser = await User.findById(req.userId);
    const targetUser = await User.findById(userIdToBlock);

    if (!currentUser || !targetUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // Prevent self-blocking
    if (req.userId === userIdToBlock) {
      return res.status(400).json({ message: "You cannot block yourself" });
    }

    // Add target to current user's blockedUsers
    if (!currentUser.blockedUsers.includes(userIdToBlock)) {
      currentUser.blockedUsers.push(userIdToBlock);
    }

    // Add current user to target's blockedBy
    if (!targetUser.blockedBy.includes(req.userId)) {
      targetUser.blockedBy.push(req.userId);
    }

    await currentUser.save();
    await targetUser.save();

    res.status(200).json({ message: "User blocked successfully (two-way)" });
  } catch (error) {
    console.error("❌ Block User Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};
/**
 * Unblocks a previously blocked user.
 * Removes target user from current user's blockedUsers array.
 * Removes current user from target's blockedBy array.
 * Restores ability to interact and message each other.
 *
 * @route POST /users/unblock/:userIdToUnblock
 * @access Private (requires authentication)
 * @middleware authMiddleware - Validates user authentication and sets req.userId
 *
 * @param {Object} req - Express request object
 * @param {string} req.userId - Current user's MongoDB ObjectId (from authMiddleware)
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.userIdToUnblock - MongoDB ObjectId of user to unblock
 * @param {Object} res - Express response object
 *
 * @returns {Promise<void>} Sends JSON response confirming unblock
 *
 * @throws {404} If current user or target user not found
 * @throws {500} If server error occurs
 *
 * @example
 * // Request
 * POST /users/unblock/674d5e3f8a1b2c3d4e5f6user2
 * Authorization: Bearer <token>
 *
 * @example
 * // Success Response (200)
 * {
 *   "message": "User unblocked successfully (two-way)"
 * }
 *
 * @example
 * // Error Response (404) - User Not Found
 * {
 *   "message": "User not found"
 * }
 *
 * @note Unblocking is also bidirectional: removes block from both sides
 * @note Safe to call even if user wasn't blocked (no error thrown)
 * @note After unblocking, users can interact normally again
 */

export const unblockUser = async (req, res) => {
  try {
    const { userIdToUnblock } = req.params;
    const currentUser = await User.findById(req.userId);
    const targetUser = await User.findById(userIdToUnblock);

    if (!currentUser || !targetUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // Remove from both sides
    currentUser.blockedUsers = currentUser.blockedUsers.filter(
      (id) => id.toString() !== userIdToUnblock
    );

    targetUser.blockedBy = targetUser.blockedBy.filter(
      (id) => id.toString() !== req.userId
    );

    await currentUser.save();
    await targetUser.save();

    res.status(200).json({ message: "User unblocked successfully (two-way)" });
  } catch (error) {
    console.error("❌ Unblock User Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * Retrieves paginated list of users blocked by the authenticated user.
 * Returns basic information about blocked users (username, fullName, email).
 * Supports pagination for managing large blocked user lists.
 *
 * @route GET /users/blocked
 * @access Private (requires authentication)
 * @middleware authMiddleware - Validates user authentication and sets req.userId
 *
 * @param {Object} req - Express request object
 * @param {string} req. userId - User's MongoDB ObjectId (from authMiddleware)
 * @param {Object} req.query - Query parameters
 * @param {number} [req.query.page=1] - Page number for pagination
 * @param {number} [req.query.limit=10] - Number of results per page
 * @param {Object} res - Express response object
 *
 * @returns {Promise<void>} Sends JSON response with blocked users list
 *
 * @throws {404} If user is not found
 * @throws {500} If server error occurs
 *
 * @example
 * // Request - First Page
 * GET /users/blocked?page=1&limit=10
 * Authorization: Bearer <token>
 *
 * @example
 * // Request - Second Page
 * GET /users/blocked?page=2&limit=10
 * Authorization: Bearer <token>
 *
 * @example
 * // Success Response (200)
 * {
 *   "blockedUsers": [
 *     {
 *       "_id": "674d5e3f8a1b2c3d4e5f6user2",
 *       "username": "janedoe",
 *       "fullName": "Jane Doe",
 *       "email": "jane@example.com"
 *     },
 *     {
 *       "_id": "674d5e3f8a1b2c3d4e5f6user3",
 *       "username": "bobsmith",
 *       "fullName": "Bob Smith",
 *       "email": "bob@example.com"
 *     }
 *   ],
 *   "pagination": {
 *     "totalBlocked": 15,
 *     "totalPages": 2,
 *     "currentPage": 1
 *   }
 * }
 *
 * @example
 * // Error Response (404)
 * {
 *   "message": "User not found"
 * }
 *
 * @note Only returns users blocked by the current user (not blockedBy)
 * @note Pagination helps manage large blocked lists efficiently
 */
export const getBlockedUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    console.log("🟢 Fetching blocked users for:", req.userId);

    const user = await User.findById(req.userId)
      .populate({
        path: "blockedUsers",
        select: "username fullName email",
        options: { skip, limit },
      });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const totalBlocked = user.blockedUsers.length;
    const totalPages = Math.ceil(totalBlocked / limit);

    res.status(200).json({
      blockedUsers: user.blockedUsers,
      pagination: {
        totalBlocked,
        totalPages,
        currentPage: page,
      },
    });
  } catch (error) {
    console.error("❌ Get Blocked Users Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};
