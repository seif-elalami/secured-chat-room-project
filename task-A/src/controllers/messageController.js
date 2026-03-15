import Message from "../models/Message.js";
import User from "../models/User.js";
import Room from "../models/Room.js";
import mongoose from "../models/mongoose.js";
import { messageTypes } from "../models/messageTypes.js";
import multer from "multer";



/**
 * Validates geographic coordinates.
 *
 * @private
 * @param {number} lat - Latitude value
 * @param {number} lng - Longitude value
 * @returns {boolean} True if coordinates are valid
 *
 * @example
 * isValidCoordinates(30.0444, 31.2357); // true
 * isValidCoordinates(100, 31.2357); // false (lat > 90)
 */
const isValidCoordinates = (lat, lng) => {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    lat >= -90 && lat <= 90 &&
    lng >= -180 && lng <= 180
  );
};

/**
 * Generates a Google Maps URL from coordinates.
 *
 * @private
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {string} Google Maps URL
 *
 * @example
 * generateGoogleMapsUrl(30. 0444, 31.2357);
 * // Returns: "https://www.google.com/maps?q=30.0444,31. 2357"
 */
const generateGoogleMapsUrl = (lat, lng) => {
  return `https://www.google.com/maps?q=${lat},${lng}`;
};

/**
 * Detects the map provider from a URL.
 *
 * @private
 * @param {string} url - Maps URL to analyze
 * @returns {string} Provider name ('google', 'apple', or 'other')
 *
 * @example
 * detectMapProvider('https://www.google.com/maps?q=30,31'); // 'google'
 * detectMapProvider('https://maps.apple.com/? q=30,31'); // 'apple'
 */

const detectMapProvider = (url) => {
  if (url.includes('google.com/maps') || url.includes('maps.google.com') || url.includes('goo.gl')) {
    return 'google';
  }
  if (url.includes('maps.apple.com') || url.includes('apple.com')) {
    return 'apple';
  }
  return 'other';
};

/**
 * Extracts latitude and longitude coordinates from a maps URL.
 * Supports Google Maps, Apple Maps, and various URL formats.
 *
 * @private
 * @param {string} url - Maps URL containing coordinates
 * @returns {Object|null} Coordinates object or null if extraction fails
 * @returns {number} return.latitude - Extracted latitude
 * @returns {number} return.longitude - Extracted longitude
 *
 * @example
 * extractCoordinatesFromUrl('https://www.google.com/maps?q=30. 0444,31.2357');
 * // Returns: { latitude: 30.0444, longitude: 31.2357 }
 */
const extractCoordinatesFromUrl = (url) => {
  try {
    const patterns = [
      /[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/,        // ?q=lat,lng
      /@(-?\d+\.?\d*),(-?\d+\.?\d*)/,             // @lat,lng
      /[?&](?:q|ll)=(-?\d+\.?\d*),(-?\d+\.?\d*)/, // ?ll=lat,lng (Apple Maps)
      /(-?\d+\.?\d*),(-?\d+\.?\d*)/               // Direct lat,lng
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        const lat = parseFloat(match[1]);
        const lng = parseFloat(match[2]);

        if (isValidCoordinates(lat, lng)) {
          return { latitude: lat, longitude: lng };
        }
      }
    }

    return null;
  } catch (err) {
    console.error("❌ Error parsing location URL:", err);
    return null;
  }
};

/**
 * Extracts human-readable address from a maps URL.
 *
 * @private
 * @param {string} url - Maps URL potentially containing address
 * @returns {string|null} Extracted address or null
 *
 * @example
 * extractAddressFromUrl('https://www.google.com/maps/place/Cairo/@30.0444,31.2357');
 * // Returns: "Cairo"
 */
const extractAddressFromUrl = (url) => {
  try {
    // Extract from /place/ path
    const placeMatch = url.match(/\/place\/([^/@?]+)/);
    if (placeMatch) {
      return decodeURIComponent(placeMatch[1].replace(/\+/g, ' '));
    }

    // Extract from ?q= query
    const queryMatch = url.match(/[?&]q=([^&@]+)/);
    if (queryMatch) {
      const query = decodeURIComponent(queryMatch[1].replace(/\+/g, ' '));
      // Only return if it's not just coordinates
      if (!/^-?\d+\.?\d*,-?\d+\.?\d*$/.test(query)) {
        return query;
      }
    }

    return null;
  } catch (err) {
    console.error("❌ Error extracting address from URL:", err);
    return null;
  }
};

/**
 * Normalizes a Google Maps URL to standard format.
 *
 * @private
 * @param {string} url - Maps URL to normalize
 * @returns {string} Normalized URL
 */
const normalizeGoogleMapsUrl = (url) => {
  // If already a valid Google Maps URL, return as is
  if (url.includes('google.com/maps')) {
    return url;
  }

  // If it's a short link, return as is (would need API to expand)
  if (url.includes('goo.gl') || url.includes('maps.app.goo.gl')) {
    return url;
  }

  // If it's Apple Maps or other, keep original
  return url;
};

/**
 * Sends a message to a room.
 * Supports multiple message types: text, image, location, and replies.
 * Validates room membership, checks messaging permissions, and handles block lists.
 *
 * Location can be sent via:
 * 1. URL method (locationUrl parameter) - Extracts coordinates automatically
 * 2. Manual coordinates (latitude/longitude parameters) - Generates Google Maps URL
 *
 * @route POST /messages/send
 * @access Private (requires authentication and room membership)
 * @middleware authMiddleware - Validates user authentication
 * @middleware upload.single('file') - Handles file upload for images (optional)
 *
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body
 * @param {string} req.body.roomId - MongoDB ObjectId of the room (required)
 * @param {string} [req.body.content] - Text message content
 * @param {string} [req.body.type] - Message type (text, image, location)
 * @param {string} [req.body.replyToMessageId] - ID of message being replied to
 * @param {string} [req.body.locationUrl] - Maps URL containing location (Google/Apple Maps)
 * @param {number} [req.body.latitude] - Manual latitude coordinate
 * @param {number} [req.body.longitude] - Manual longitude coordinate
 * @param {string} [req. body.address] - Human-readable address for location
 * @param {Object} [req.file] - Uploaded image file (from multer)
 * @param {Object} req.user - Authenticated user (from authMiddleware)
 * @param {string} req.user.id - User's MongoDB ObjectId
 * @param {Object} res - Express response object
 *
 * @returns {Promise<void>} Sends JSON response with created message
 *
 * @throws {400} If roomId is missing or invalid
 * @throws {400} If no content, file, or location provided
 * @throws {400} If coordinates are invalid
 * @throws {400} If replying to deleted/non-existent message
 * @throws {401} If user is not authenticated
 * @throws {403} If user is not a room member or blocked
 * @throws {403} If user doesn't have message sending permissions
 * @throws {404} If room or replied message not found
 * @throws {500} If server error occurs
 *
 * @example
 * // Send text message
 * POST /messages/send
 * Authorization: Bearer <token>
 * Content-Type: application/json
 *
 * {
 *   "roomId": "674d5e3f8a1b2c3d4e5f6789",
 *   "content": "Hello, world!",
 *   "type": "text"
 * }
 *
 * @example
 * // Send location via URL
 * {
 *   "roomId": "674d5e3f8a1b2c3d4e5f6789",
 *   "locationUrl": "https://www.google.com/maps?q=30.0444,31. 2357",
 *   "type": "location"
 * }
 *
 * @example
 * // Send location via coordinates
 * {
 *   "roomId": "674d5e3f8a1b2c3d4e5f6789",
 *   "latitude": 30.0444,
 *   "longitude": 31.2357,
 *   "address": "Cairo, Egypt",
 *   "type": "location"
 * }
 *
 * @example
 * // Reply to a message
 * {
 *   "roomId": "674d5e3f8a1b2c3d4e5f6789",
 *   "content": "I agree!",
 *   "replyToMessageId": "674d5e3f8a1b2c3d4e5f6msg1"
 * }
 *
 * @example
 * // Upload image
 * POST /messages/send
 * Content-Type: mmultipart/form-data
 *
 * Body (form-data):
 * {
 *   "roomId": "674d5e3f8a1b2c3d4e5f6789",
 *   "file": [image. jpg]
 * }
 *
 * @example
 * // Success Response (201)
 * {
 *   "success": true,
 *   "message": "Message sent successfully",
 *   "data": {
 *     "_id": "674d5e3f8a1b2c3d4e5f6msg1",
 *     "author": {
 *       "_id": "674d5e3f8a1b2c3d4e5f6user1",
 *       "username": "johndoe",
 *       "email": "john@example.com"
 *     },
 *     "content": "Hello, world!",
 *     "room": "674d5e3f8a1b2c3d4e5f6789",
 *     "type": "text",
 *     "createdAt": "2025-12-02T15:30:00.000Z",
 *     "isDeleted": false,
 *     "isPinned": false,
 *     "reactions": [],
 *     "statuses": []
 *   }
 * }
 *
 * @example
 * // Success Response - Location Message
 * {
 *   "success": true,
 *   "message": "Message sent successfully",
 *   "data": {
 *     "_id": "674d5e3f8a1b2c3d4e5f6msg2",
 *     "type": "location",
 *     "content": "Cairo, Egypt",
 *     "location": {
 *       "url": "https://www.google. com/maps?q=30. 0444,31.2357",
 *       "latitude": 30.0444,
 *       "longitude": 31.2357,
 *       "address": "Cairo, Egypt",
 *       "provider": "google"
 *     }
 *   }
 * }
 *
 * @example
 * // Error Response (403) - No Permission
 * {
 *   "success": false,
 *   "message": "Cannot send messages.  Current policy: admins_only",
 *   "userRole": "member",
 *   "messagingPolicy": "admins_only",
 *   "requiredRole": "admin"
 * }
 */

export const sendMessage = async (req, res) => {
  try {
    console.log("=== DEBUG START ===");
    console.log("req.body:", req.body);
    console.log("req.file:", req.file);
    console.log("=== DEBUG END ===");

    const {
      roomId,
      content,
      type,
      replyToMessageId,
      // ✅ NEW METHOD: Simple URL
      locationUrl,
      // ✅ OLD METHOD: Manual coordinates (backward compatible)
      latitude,
      longitude,
      address
    } = req.body || {};

    const userId = req.user?.userId || req.user?.id || req.user?._id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: userId not found.",
      });
    }

    if (!roomId) {
      return res.status(400).json({
        success: false,
        message: "Room ID is required.",
      });
    }


    const room = await Room.findById(roomId).populate(
      "users",
      "_id username blockedUsers"
    );

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found.",
      });
    }


    if (!room.canSendMessages(userId)) {
      const userRole = room.getUserRole(userId);
      return res.status(403).json({
        success: false,
        message: `Cannot send messages. Current policy: ${room.settings.messagingPolicy}`,
        userRole: userRole,
        messagingPolicy: room.settings.messagingPolicy,
        requiredRole: room.settings.messagingPolicy === 'admins_only' ? 'admin' : 'member'
      });
    }

    const isParticipant = room.users.some(
      (user) => user._id.toString() === userId.toString()
    );

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: "You are not a member of this room.",
      });
    }

    // ========== REPLY LOGIC ==========
    let replyToData = null;

    if (replyToMessageId) {
      console.log(`📎 Processing reply to message: ${replyToMessageId}`);

      const originalMessage = await Message.findById(replyToMessageId)
        .populate('author', 'username email');

      if (!originalMessage) {
        return res.status(404).json({
          success: false,
          message: "Original message not found",
          replyToMessageId
        });
      }

      if (originalMessage.room.toString() !== roomId.toString()) {
        return res.status(400).json({
          success: false,
          message: "Cannot reply to a message from a different room"
        });
      }

      if (originalMessage.isDeleted) {
        return res.status(400).json({
          success: false,
          message: "Cannot reply to a deleted message"
        });
      }

      replyToData = {
        type: originalMessage.type,
        content: originalMessage.type === 'text'
          ? originalMessage.content
          : originalMessage.type === 'location'
          ? '📍 Location'
          : `[${originalMessage.type.toUpperCase()}]`,
        author: originalMessage.author._id
      };

      console.log(`✅ Reply data created for message ${replyToMessageId}`);
    }

    // ========== MESSAGE TYPE & CONTENT LOGIC ==========
    let messageContent = null;
    let messageType = type || messageTypes.text;
    let locationData = null;

    // ✅ METHOD 1: LOCATION VIA URL (New Simple Method)
    if (locationUrl) {
      console.log("📍 Processing location from URL:", locationUrl);

      // Detect provider (google/apple/other)
      const provider = detectMapProvider(locationUrl);

      // Extract coordinates from URL
      const coords = extractCoordinatesFromUrl(locationUrl);

      if (!coords) {
        return res.status(400).json({
          success: false,
          message: "Could not extract valid coordinates from location URL.",
          hint: "Make sure your URL contains latitude and longitude.",
          examples: [
            "https://www.google.com/maps?q=30.0444,31.2357",
            "https://maps.apple.com/?q=30.0444,31.2357",
            "https://www.google.com/maps/place/Cairo/@30.0444,31.2357"
          ]
        });
      }

      const { latitude: lat, longitude: lng } = coords;

      // Validate extracted coordinates
      if (!isValidCoordinates(lat, lng)) {
        return res.status(400).json({
          success: false,
          message: "Extracted coordinates are invalid.",
          extracted: { latitude: lat, longitude: lng }
        });
      }

      // Extract address from URL (if present)
      const extractedAddress = extractAddressFromUrl(locationUrl);

      // ✅ FIXED: Store location with ORIGINAL URL as primary field
      locationData = {
        url: locationUrl,                      // ✅ PRIMARY: Original URL from user
        latitude: lat,                         // For validation/indexing
        longitude: lng,                        // For validation/indexing
        address: extractedAddress || null,     // ✅ FIXED: Use extracted address
        provider: provider                     // google/apple/other
      };

      messageType = messageTypes.location;
      messageContent = extractedAddress || `Location: ${lat}, ${lng}`;

      console.log(`✅ Location extracted from ${provider} Maps:`);
      console.log(`   Original URL: ${locationUrl}`);
      console.log(`   Coordinates: ${lat}, ${lng}`);
      console.log(`   Address: ${extractedAddress || 'Not found'}`);
    }
    // ✅ METHOD 2: LOCATION VIA MANUAL COORDINATES (Old Method - Backward Compatible)
    else if (type === messageTypes.location || (latitude && longitude)) {
      console.log("📍 Processing location from manual coordinates");

      const lat = parseFloat(latitude);
      const lng = parseFloat(longitude);

      // Validate coordinates
      if (!isValidCoordinates(lat, lng)) {
        return res.status(400).json({
          success: false,
          message: "Invalid coordinates. Latitude must be between -90 and 90, Longitude between -180 and 180.",
          provided: { latitude: lat, longitude: lng }
        });
      }

      // Generate Google Maps URL
      const googleMapsUrl = generateGoogleMapsUrl(lat, lng);

      // ✅ Store location with generated URL
      locationData = {
        url: googleMapsUrl,              // Store generated URL as primary
        latitude: lat,
        longitude: lng,
        address: address || null,        // Use provided address
        provider: 'google'
      };

      messageType = messageTypes.location;
      messageContent = address || `Location: ${lat}, ${lng}`;

      console.log(`✅ Location created from manual coordinates:`);
      console.log(`   Coordinates: ${lat}, ${lng}`);
      console.log(`   Generated URL: ${googleMapsUrl}`);
    }
    // FILE UPLOAD LOGIC
    else if (req.file) {
      messageType = messageTypes.image;
      messageContent = `/uploads/messages/${req.file.filename}`;
      console.log(`📁 File uploaded: ${req.file.filename}`);
    }
    // TEXT MESSAGE LOGIC
    else if (content) {
      messageContent = content;
      if (/\.(jpg|jpeg|png|gif|webp)$/i.test(content)) {
        messageType = messageTypes.image;
      }
    }
    else {
      return res.status(400).json({
        success: false,
        message: "Message content, file, location URL, or coordinates are required.",
      });
    }

    // Block check for DMs
    if (!room.isGroup) {
      const otherUser = room.users.find(
        (u) => u._id.toString() !== userId.toString()
      );
      if (otherUser) {
        const [sender, receiver] = await Promise.all([
          User.findById(userId).select("blockedUsers"),
          User.findById(otherUser._id).select("blockedUsers"),
        ]);

        const isBlocked =
          sender.blockedUsers.includes(otherUser._id) ||
          receiver.blockedUsers.includes(userId);

        if (isBlocked) {
          return res.status(403).json({
            success: false,
            message:
              "Message cannot be sent because one user has blocked the other.",
          });
        }
      }
    }

    // Create message with all data
    const messageData = {
      author: userId,
      content: messageContent,
      room: roomId,
      type: messageType,
    };

    // Add location data if present
    if (locationData) {
      messageData.location = locationData;
    }

    // Add reply fields if replying
    if (replyToMessageId && replyToData) {
      messageData.replyTo = replyToMessageId;
      messageData.replyToContent = replyToData;
    }

    const message = new Message(messageData);
    await message.save();

    // Populate reply data in response
    await message.populate("author", "username email");
    await message.populate("replyTo", "content type author createdAt location");
    await message.populate("replyToContent.author", "username email");

    // Update room last message
    room.lastMessage = message._id;
    room.lastAuthor = userId;
    await room.save();

    console.log(`✅ ${messageType} message sent successfully`);
    console.log(`🔐 Message sent by ${room.getUserRole(userId)} under policy: ${room.settings.messagingPolicy}`);
    if (replyToMessageId) {
      console.log(`📎 Reply created to message: ${replyToMessageId}`);
    }
    if (locationData) {
      console.log(`📍 Location shared: ${locationData.url}`);  // ✅ FIXED: Log original URL
    }

    res.status(201).json({
      success: true,
      message: "Message sent successfully",
      data: message,
    });
  } catch (err) {
    console.error("❌ Error sending message:", err);

    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "File too large. Maximum size is 5MB.",
      });
    }

    if (err.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        error: err.message,
      });
    }

    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
};

/**
 * Retrieves all messages for a specific room.
 * Returns messages sorted chronologically (oldest first).
 * Includes message content, author info, replies, and location data.
 *
 * @route GET /messages/:roomId
 * @access Private (requires authentication and room membership)
 * @middleware authMiddleware - Validates user authentication
 *
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.roomId - MongoDB ObjectId of the room
 * @param {Object} req.user - Authenticated user (from authMiddleware)
 * @param {string} req.user. userId - User's MongoDB ObjectId
 * @param {Object} res - Express response object
 *
 * @returns {Promise<void>} Sends JSON response with messages array
 *
 * @throws {400} If user authentication is missing
 * @throws {403} If user is not a room member
 * @throws {404} If room is not found
 * @throws {500} If server error occurs
 *
 * @example
 * // Request
 * GET /api/messages/674d5e3f8a1b2c3d4e5f6789
 * Authorization: Bearer <token>
 *
 * @example
 * // Success Response (200)
 * {
 *   "success": true,
 *   "data": [
 *     {
 *       "_id": "msg1",
 *       "author": { "_id": "user1", "username": "john" },
 *       "content": "Hello! ",
 *       "type": "text",
 *       "createdAt": "2025-12-02T10:00:00.000Z",
 *       "replyTo": null,
 *       "location": null
 *     },
 *     {
 *       "_id": "msg2",
 *       "author": { "_id": "user2", "username": "jane" },
 *       "content": "Location: 30.0444, 31. 2357",
 *       "type": "location",
 *       "location": {
 *         "url": "https://www.google. com/maps?q=30. 0444,31.2357",
 *         "latitude": 30.0444,
 *         "longitude": 31.2357
 *       },
 *       "createdAt": "2025-12-02T10:05:00.000Z"
 *     }
 *   ]
 * }
 */

export const getMessages = async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(400).json({ message: "User authentication required" });
    }

    // Verify user has access to this room
    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }

    const isParticipant = room.users.some(
      (person) => person.toString() === userId
    );

    if (!isParticipant) {
      return res.status(403).json({ message: "Access denied to this room" });
    }

    const messages = await Message.find({ room: roomId })
      .populate("author", "username email")
      .populate("replyTo", "content type author createdAt isDeleted location")  // ✅ Added location
      .populate("replyToContent.author", "username email")
      .sort({ createdAt: 1 });

    res.status(200).json({
      success: true,
      data: messages,
    });
  } catch (err) {
    console.error("Error fetching messages:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
};

/**
 * Retrieves paginated media gallery for a room.
 * Returns only image messages, sorted by most recent first.
 * Excludes deleted messages.
 *
 * @route GET /messages/:roomId/media
 * @access Private (requires authentication and room membership)
 * @middleware authMiddleware - Validates user authentication
 *
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.roomId - MongoDB ObjectId of the room
 * @param {Object} req.query - Query parameters
 * @param {number} [req.query.page=1] - Page number for pagination
 * @param {number} [req.query.limit=20] - Number of images per page
 * @param {Object} req.user - Authenticated user (from authMiddleware)
 * @param {Object} res - Express response object
 *
 * @returns {Promise<void>} Sends JSON response with paginated media
 *
 * @throws {403} If user is not a room member
 * @throws {500} If server error occurs
 *
 * @example
 * // Request
 * GET /messages/674d5e3f8a1b2c3d4e5f6789/media? page=1&limit=20
 * Authorization: Bearer <token>
 *
 * @example
 * // Success Response (200)
 * {
 *   "success": true,
 *   "data": [
 *     {
 *       "_id": "msg1",
 *       "content": "/uploads/messages/image1.jpg",
 *       "type": "image",
 *       "author": { "username": "john" },
 *       "createdAt": "2025-12-02T15:30:00.000Z"
 *     }
 *   ],
 *   "pagination": {
 *     "total": 45,
 *     "page": 1,
 *     "pages": 3
 *   }
 * }
 */
export const getRoomMedia = async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user?.userId || req.user?.id || req.user?._id;

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Verify user is in room
    const room = await Room.findOne({
      _id: roomId,
      users: userId,
    });

    if (!room) {
      return res.status(403).json({
        success: false,
        message: "Access denied: you are not a member of this room.",
      });
    }

    // Get only image messages
    const mediaMessages = await Message.find({
      room: roomId,
      type: messageTypes.image,
      isDeleted: false,
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("author", "username email")
      .populate("file");

    // Count total for pagination
    const total = await Message.countDocuments({
      room: roomId,
      type: messageTypes.image,
      isDeleted: false,
    });

    return res.status(200).json({
      success: true,
      data: mediaMessages,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("❌ Error fetching room media:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};


/**
 * Soft deletes a message.
 * Only the message author, moderators, admins, or room creator can delete messages.
 * Marks message as deleted and replaces content with "[Message deleted]".
 *
 * @route DELETE /messages/:messageId
 * @access Private (requires authentication and authorization)
 * @middleware authMiddleware - Validates user authentication
 *
 * @param {Object} req - Express request object
 * @param {Object} req. params - URL parameters
 * @param {string} req.params. messageId - MongoDB ObjectId of the message
 * @param {Object} req.user - Authenticated user
 * @param {Object} res - Express response object
 *
 * @returns {Promise<void>} Sends JSON response confirming deletion
 *
 * @throws {400} If message is already deleted
 * @throws {403} If user doesn't have permission to delete
 * @throws {404} If message or room is not found
 * @throws {500} If server error occurs
 *
 * @example
 * // Request
 * DELETE /messages/674d5e3f8a1b2c3d4e5f6msg1
 * Authorization: Bearer <token>
 *
 * @example
 * // Success Response (200)
 * {
 *   "success": true,
 *   "message": "Message deleted successfully",
 *   "data": {
 *     "messageId": "674d5e3f8a1b2c3d4e5f6msg1",
 *     "deletedBy": "moderator",
 *     "wasOwnMessage": false
 *   }
 * }
 */

export const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user?.userId || req.user?.id || req.user?._id;

    const message = await Message.findById(messageId).populate('room');

    if (!message) {
      return res.status(404).json({
        success: false,
        message: "Message not found"
      });
    }

    if (message.isDeleted) {
      return res.status(400).json({
        success: false,
        message: "Message already deleted"
      });
    }

    const room = await Room.findById(message.room);
    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found"
      });
    }

    const userRole = room.getUserRole(userId);
    const isAuthor = message.author.toString() === userId.toString();

    const canDelete = isAuthor || ['moderator', 'admin', 'creator'].includes(userRole);

    if (!canDelete) {
      return res.status(403).json({
        success: false,
        message: "You don't have permission to delete this message"
      });
    }

    // Soft delete
    message.isDeleted = true;
    message.content = "[Message deleted]";
    await message.save();

    console.log(`🗑️ Message deleted by ${userRole}: ${isAuthor ? 'own message' : 'moderation'}`);

    res.status(200).json({
      success: true,
      message: "Message deleted successfully",
      data: {
        messageId: message._id,
        deletedBy: userRole,
        wasOwnMessage: isAuthor
      }
    });

  } catch (err) {
    console.error("❌ Error deleting message:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message
    });
  }
};

/**
 * Toggles pin status of a message.
 * Only moderators, admins, and room creator can pin messages.
 * Pinned messages appear at the top of the chat.
 *
 * @route PUT /messages/:messageId/pin
 * @access Private (requires moderator role or higher)
 * @middleware authMiddleware - Validates user authentication
 *
 * @param {Object} req - Express request object
 * @param {Object} req. params - URL parameters
 * @param {string} req.params. messageId - MongoDB ObjectId of the message
 * @param {Object} req.user - Authenticated user
 * @param {Object} res - Express response object
 *
 * @returns {Promise<void>} Sends JSON response with updated message
 *
 * @throws {400} If message is deleted
 * @throws {403} If user is not moderator/admin
 * @throws {404} If message or room is not found
 * @throws {500} If server error occurs
 *
 * @example
 * // Request
 * PUT /messages/674d5e3f8a1b2c3d4e5f6msg1/pin
 * Authorization: Bearer <token>
 *
 * @example
 * // Success Response (200) - Pinned
 * {
 *   "success": true,
 *   "message": "Message pinned successfully",
 *   "data": {
 *     "_id": "674d5e3f8a1b2c3d4e5f6msg1",
 *     "isPinned": true,
 *     "pinnedBy": { "_id": "user1", "username": "john" },
 *     "pinnedAt": "2025-12-02T15:30:00.000Z"
 *   }
 * }
 */

export const pinMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user?.userId || req.user?.id || req.user?._id;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({
        success: false,
        message: "Message not found"
      });
    }

    if (message.isDeleted) {
      return res.status(400).json({
        success: false,
        message: "Cannot pin a deleted message"
      });
    }

    const room = await Room.findById(message.room);
    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found"
      });
    }

    const userRole = room.getUserRole(userId);
    if (!['moderator', 'admin', 'creator'].includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: "Only moderators and admins can pin messages"
      });
    }

    // Toggle pin status
    message.isPinned = !message.isPinned;
    message.pinnedBy = message.isPinned ? userId : null;
    message.pinnedAt = message.isPinned ? new Date() : null;

    await message.save();
    await message.populate('pinnedBy', 'username email');
    await message.populate('author', 'username email');

    console.log(`📌 Message ${message.isPinned ? 'pinned' : 'unpinned'} by ${userRole}`);

    res.status(200).json({
      success: true,
      message: message.isPinned ? "Message pinned successfully" : "Message unpinned successfully",
      data: message
    });

  } catch (err) {
    console.error("❌ Error pinning message:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message
    });
  }
};

/**
 * Retrieves all pinned messages in a room.
 * Returns messages sorted by pin date (most recent first).
 * Excludes deleted messages.
 *
 * @route GET /messages/:roomId/pinned
 * @access Private (requires authentication and room membership)
 * @middleware authMiddleware - Validates user authentication
 *
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.roomId - MongoDB ObjectId of the room
 * @param {Object} req. user - Authenticated user
 * @param {Object} res - Express response object
 *
 * @returns {Promise<void>} Sends JSON response with pinned messages
 *
 * @throws {403} If user is not a room member
 * @throws {404} If room is not found
 * @throws {500} If server error occurs
 *
 * @example
 * // Request
 * GET /messages/674d5e3f8a1b2c3d4e5f6789/pinned
 * Authorization: Bearer <token>
 *
 * @example
 * // Success Response (200)
 * {
 *   "success": true,
 *   "count": 2,
 *   "data": [
 *     {
 *       "_id": "msg1",
 *       "content": "Important announcement",
 *       "isPinned": true,
 *       "pinnedBy": { "username": "admin" },
 *       "pinnedAt": "2025-12-02T15:30:00.000Z"
 *     }
 *   ]
 * }
 */

export const getPinnedMessages = async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user?.userId || req.user?.id || req.user?._id;

    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found"
      });
    }

    const isParticipant = room.users.some(u => u.toString() === userId.toString());
    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: "You are not a member of this room"
      });
    }

    const pinnedMessages = await Message.find({
      room: roomId,
      isPinned: true,
      isDeleted: false
    })
      .populate('author', 'username email')
      .populate('pinnedBy', 'username email')
      .sort({ pinnedAt: -1 });

    res.status(200).json({
      success: true,
      count: pinnedMessages.length,
      data: pinnedMessages
    });

  } catch (err) {
    console.error("❌ Error fetching pinned messages:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message
    });
  }
};
/**
 * Edits an existing text message.
 * Only the message author can edit their own messages.
 * Cannot edit deleted, media, or location messages.
 * Marks message with editedAt timestamp.
 *
 * @route PUT /api/messages/:messageId
 * @access Private (requires authentication and message ownership)
 * @middleware authMiddleware - Validates user authentication
 *
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.messageId - MongoDB ObjectId of the message
 * @param {Object} req.body - Request body
 * @param {string} req.body.content - New message content (required)
 * @param {Object} req.user - Authenticated user
 * @param {Object} res - Express response object
 *
 * @returns {Promise<void>} Sends JSON response with edited message
 *
 * @throws {400} If content is missing or empty
 * @throws {400} If message is deleted or is media/location type
 * @throws {403} If user is not the message author
 * @throws {404} If message is not found
 * @throws {500} If server error occurs
 *
 * @example
 * // Request
 * PUT /api/messages/674d5e3f8a1b2c3d4e5f6msg1
 * Authorization: Bearer <token>
 * Content-Type: application/json
 *
 * {
 *   "content": "Updated message text"
 * }
 *
 * @example
 * // Success Response (200)
 * {
 *   "success": true,
 *   "message": "Message edited successfully",
 *   "data": {
 *     "_id": "674d5e3f8a1b2c3d4e5f6msg1",
 *     "content": "Updated message text",
 *     "editedAt": "2025-12-02T15:35:00.000Z",
 *     "author": { "username": "john" }
 *   }
 * }
 */

export const editMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { content } = req.body;
    const userId = req.user?.userId || req.user?.id || req.user?._id;

    if (!content || content.trim() === '') {
      return res.status(400).json({
        success: false,
        message: "Message content is required"
      });
    }

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({
        success: false,
        message: "Message not found"
      });
    }

    if (message.isDeleted) {
      return res.status(400).json({
        success: false,
        message: "Cannot edit a deleted message"
      });
    }

    if (message.author.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "You can only edit your own messages"
      });
    }

    // ✅ UPDATED: Can't edit media or location messages
    if (message.type === messageTypes.image || message.type === messageTypes.location) {
      return res.status(400).json({
        success: false,
        message: "Cannot edit media or location messages"
      });
    }

    message.content = content;
    message.editedAt = new Date();
    await message.save();
    await message.populate('author', 'username email');

    console.log(`✏️ Message edited by user ${userId}`);

    res.status(200).json({
      success: true,
      message: "Message edited successfully",
      data: message
    });

  } catch (err) {
    console.error("❌ Error editing message:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message
    });
  }
};
/**
 * Toggles an emoji reaction on a message.
 * If user already reacted with this emoji, removes it.  Otherwise, adds it.
 * Only room members can react to messages.
 *
 * @route POST /api/messages/:messageId/react
 * @access Private (requires authentication and room membership)
 * @middleware authMiddleware - Validates user authentication
 *
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.messageId - MongoDB ObjectId of the message
 * @param {Object} req.body - Request body
 * @param {string} req.body.emoji - Emoji to react with (must be from allowed list)
 * @param {Object} req.user - Authenticated user
 * @param {Object} res - Express response object
 *
 * @returns {Promise<void>} Sends JSON response with updated reactions
 *
 * @throws {400} If emoji is invalid or not allowed
 * @throws {400} If message is deleted
 * @throws {403} If user is not a room member
 * @throws {404} If message is not found
 * @throws {500} If server error occurs
 *
 * @example
 * // Request
 * POST /api/messages/674d5e3f8a1b2c3d4e5f6msg1/react
 * Authorization: Bearer <token>
 * Content-Type: application/json
 *
 * {
 *   "emoji": "👍"
 * }
 *
 * @example
 * // Success Response (200) - Reaction Added
 * {
 *   "success": true,
 *   "message": "Reaction added",
 *   "action": "added",
 *   "data": [
 *     {
 *       "emoji": "👍",
 *       "userId": "674d5e3f8a1b2c3d4e5f6user1",
 *       "createdAt": "2025-12-02T15:30:00.000Z"
 *     }
 *   ]
 * }
 *
 * @example
 * // Success Response (200) - Reaction Removed
 * {
 *   "success": true,
 *   "message": "Reaction removed",
 *   "action": "removed",
 *   "data": []
 * }
 *
 * @note Allowed emojis: 👍 ❤️ 😂 😮 😢 🙏 🔥 🎉 💔 🥰 💯 💀 👀 🤯
 */




export const toggleReaction = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;
    const userId = req.user?.userId || req.user?.id || req.user?._id;

    const allowedEmojis = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '🎉', '💔', '🥰', '💯', '💀','👀','🤯' ];
    if (!emoji || !allowedEmojis.includes(emoji)) {
      return res.status(400).json({
        success: false,
        message: "Invalid emoji. Allowed: 👍 ❤️ 😂 😮 😢 🙏 🔥 🎉 💔 🥰 💯 💀 👀 🤯  "
      });
    }

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({
        success: false,
        message: "Message not found"
      });
    }

    if (message.isDeleted) {
      return res.status(400).json({
        success: false,
        message: "Cannot react to deleted message"
      });
    }

    const room = await Room.findById(message.room);
    if (!room.users.some(u => u.toString() === userId.toString())) {
      return res.status(403).json({
        success: false,
        message: "You must be a member of the room to react"
      });
    }

    const existingReaction = message.reactions.find(
      r => r.userId.toString() === userId.toString() && r.emoji === emoji
    );

    if (existingReaction) {
      message.reactions = message.reactions.filter(
        r => !(r.userId.toString() === userId.toString() && r.emoji === emoji)
      );
      await message.save();

      return res.status(200).json({
        success: true,
        message: "Reaction removed",
        action: "removed",
        data: message.reactions
      });
    } else {
      message.reactions.push({
        emoji,
        userId,
        createdAt: new Date()
      });
      await message.save();

      return res.status(200).json({
        success: true,
        message: "Reaction added",
        action: "added",
        data: message.reactions
      });
    }

  } catch (err) {
    console.error("❌ Error toggling reaction:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message
    });
  }
};
/**
 * Retrieves reaction summary for a message.
 * Groups reactions by emoji and shows which users reacted.
 *
 * @route GET /messages/:messageId/reactions
 * @access Public (any authenticated user can view)
 * @middleware authMiddleware - Validates user authentication
 *
 * @param {Object} req - Express request object
 * @param {Object} req. params - URL parameters
 * @param {string} req.params. messageId - MongoDB ObjectId of the message
 * @param {Object} res - Express response object
 *
 * @returns {Promise<void>} Sends JSON response with reaction summary
 *
 * @throws {404} If message is not found
 * @throws {500} If server error occurs
 *
 * @example
 * // Request
 * GET /messages/674d5e3f8a1b2c3d4e5f6msg1/reactions
 * Authorization: Bearer <token>
 *
 * @example
 * // Success Response (200)
 * {
 *   "success": true,
 *   "data": {
 *     "messageId": "674d5e3f8a1b2c3d4e5f6msg1",
 *     "totalReactions": 3,
 *     "reactions": [
 *       {
 *         "emoji": "👍",
 *         "count": 2,
 *         "users": [
 *           { "userId": "user1", "username": "john" },
 *           { "userId": "user2", "username": "jane" }
 *         ]
 *       },
 *       {
 *         "emoji": "❤️",
 *         "count": 1,
 *         "users": [
 *           { "userId": "user3", "username": "bob" }
 *         ]
 *       }
 *     ]
 *   }
 * }
 */

export const getReactions = async (req, res) => {
  try {
    const { messageId } = req.params;

    const message = await Message.findById(messageId)
      .populate('reactions.userId', 'username email');

    if (!message) {
      return res.status(404).json({
        success: false,
        message: "Message not found"
      });
    }

    const reactionSummary = {};
    message.reactions.forEach(reaction => {
      if (!reactionSummary[reaction.emoji]) {
        reactionSummary[reaction.emoji] = {
          emoji: reaction.emoji,
          count: 0,
          users: []
        };
      }
      reactionSummary[reaction.emoji].count++;
      reactionSummary[reaction.emoji].users.push({
        userId: reaction.userId._id,
        username: reaction.userId.username
      });
    });

    res.status(200).json({
      success: true,
      data: {
        messageId: message._id,
        totalReactions: message.reactions.length,
        reactions: Object.values(reactionSummary)
      }
    });

  } catch (err) {
    console.error("❌ Error getting reactions:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message
    });
  }
};

/**
 * Marks a message as read by the current user.
 * Records both delivery and seen timestamps.
 * Cannot mark own messages as read.
 *
 * @route POST /messages/:messageId/read
 * @access Private (requires authentication and room membership)
 * @middleware authMiddleware - Validates user authentication
 *
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.messageId - MongoDB ObjectId of the message
 * @param {Object} req.user - Authenticated user
 * @param {Object} res - Express response object
 *
 * @returns {Promise<void>} Sends JSON response confirming read status
 *
 * @throws {400} If message is deleted or is user's own message
 * @throws {403} If user is not a room member
 * @throws {404} If message is not found
 * @throws {500} If server error occurs
 *
 * @example
 * // Request
 * POST /messages/674d5e3f8a1b2c3d4e5f6msg1/read
 * Authorization: Bearer <token>
 *
 * @example
 * // Success Response (200)
 * {
 *   "success": true,
 *   "message": "Message marked as read",
 *   "data": {
 *     "messageId": "674d5e3f8a1b2c3d4e5f6msg1",
 *     "seenAt": "2025-12-02T15:30:00.000Z"
 *   }
 * }
 */

export const markAsRead = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user?.userId || req.user?.id || req.user?._id;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({
        success: false,
        message: "Message not found"
      });
    }

    if (message.isDeleted) {
      return res.status(400).json({
        success: false,
        message: "Cannot mark deleted message as read"
      });
    }

    if (message.author.toString() === userId.toString()) {
      return res.status(400).json({
        success: false,
        message: "Cannot mark your own message as read"
      });
    }

    const room = await Room.findById(message.room);
    if (!room || !room.users.some(u => u.toString() === userId.toString())) {
      return res.status(403).json({
        success: false,
        message: "Access denied - you are not a member of this room"
      });
    }

    let status = message.statuses.find(s => s.userId.toString() === userId.toString());

    if (!status) {
      message.statuses.push({
        userId,
        deliveredAt: new Date(),
        seenAt: new Date()
      });
    } else if (!status.seenAt) {
      if (!status.deliveredAt) {
        status.deliveredAt = new Date();
      }
      status.seenAt = new Date();
    } else {
      return res.status(200).json({
        success: true,
        message: "Message already marked as read",
        seenAt: status.seenAt
      });
    }

    await message.save();

    console.log(`✓✓ Message ${messageId} marked as read by ${userId}`);

    res.status(200).json({
      success: true,
      message: "Message marked as read",
      data: {
        messageId: message._id,
        seenAt: new Date()
      }
    });

  } catch (err) {
    console.error("❌ Error marking message as read:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message
    });
  }
};
/**
 * Marks multiple messages as read in batch.
 * Efficient for marking all messages in a conversation as read at once.
 * Skips user's own messages and already-read messages.
 *
 * @route POST //messages/read-multiple
 * @access Private (requires authentication)
 * @middleware authMiddleware - Validates user authentication
 *
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body
 * @param {string[]} req.body.messageIds - Array of message IDs to mark as read (required)
 * @param {Object} req.user - Authenticated user
 * @param {Object} res - Express response object
 *
 * @returns {Promise<void>} Sends JSON response with batch results
 *
 * @throws {400} If messageIds is missing or not an array
 * @throws {500} If server error occurs
 *
 * @example
 * // Request
 * POST /messages/read-multiple
 * Authorization: Bearer <token>
 * Content-Type: application/json
 *
 * {
 *   "messageIds": [
 *     "674d5e3f8a1b2c3d4e5f6msg1",
 *     "674d5e3f8a1b2c3d4e5f6msg2",
 *     "674d5e3f8a1b2c3d4e5f6msg3"
 *   ]
 * }
 *
 * @example
 * // Success Response (200)
 * {
 *   "success": true,
 *   "message": "Messages processed",
 *   "data": {
 *     "totalProcessed": 3,
 *     "markedAsRead": 2,
 *     "alreadyRead": 1,
 *     "failed": 0,
 *     "results": {
 *       "marked": ["msg1", "msg2"],
 *       "failed": [],
 *       "alreadyRead": ["msg3"]
 *     }
 *   }
 * }
 */
export const markMultipleAsRead = async (req, res) => {
  try {
    const { messageIds } = req.body;
    const userId = req.user?.userId || req.user?.id || req.user?._id;

    if (!Array.isArray(messageIds) || messageIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "messageIds array is required"
      });
    }

    const results = {
      marked: [],
      failed: [],
      alreadyRead: []
    };

    for (const messageId of messageIds) {
      try {
        const message = await Message.findById(messageId);

        if (!message || message.isDeleted) {
          results.failed.push(messageId);
          continue;
        }

        if (message.author.toString() === userId.toString()) {
          continue;
        }

        let status = message.statuses.find(s => s.userId.toString() === userId.toString());

        if (!status) {
          message.statuses.push({
            userId,
            deliveredAt: new Date(),
            seenAt: new Date()
          });
          await message.save();
          results.marked.push(messageId);
        } else if (!status.seenAt) {
          if (!status.deliveredAt) {
            status.deliveredAt = new Date();
          }
          status.seenAt = new Date();
          await message.save();
          results.marked.push(messageId);
        } else {
          results.alreadyRead.push(messageId);
        }
      } catch (err) {
        results.failed.push(messageId);
      }
    }

    console.log(`✓✓ Batch read: ${results.marked.length} messages marked as read by ${userId}`);

    res.status(200).json({
      success: true,
      message: "Messages processed",
      data: {
        totalProcessed: messageIds.length,
        markedAsRead: results.marked.length,
        alreadyRead: results.alreadyRead.length,
        failed: results.failed.length,
        results
      }
    });

  } catch (err) {
    console.error("❌ Error marking multiple messages:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message
    });
  }
};


/**
 * Retrieves read receipts for a message.
 * Shows which users have delivered and seen the message.
 * Only message author or room admins can view read receipts.
 *
 * @route GET /messages/:messageId/receipts
 * @access Private (requires message authorship or admin role)
 * @middleware authMiddleware - Validates user authentication
 *
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.messageId - MongoDB ObjectId of the message
 * @param {Object} req.user - Authenticated user
 * @param {Object} res - Express response object
 *
 * @returns {Promise<void>} Sends JSON response with read receipt data
 *
 * @throws {403} If user is not author or admin
 * @throws {404} If message is not found
 * @throws {500} If server error occurs
 *
 * @example
 * // Request
 * GET /messages/674d5e3f8a1b2c3d4e5f6msg1/receipts
 * Authorization: Bearer <token>
 *
 * @example
 * // Success Response (200)
 * {
 *   "success": true,
 *   "data": {
 *     "messageId": "674d5e3f8a1b2c3d4e5f6msg1",
 *     "author": "john",
 *     "totalRecipients": 5,
 *     "deliveredCount": 5,
 *     "seenCount": 3,
 *     "delivered": [
 *       { "userId": "user1", "username": "jane", "deliveredAt": "2025-12-02T15:30:00.000Z" }
 *     ],
 *     "seen": [
 *       { "userId": "user1", "username": "jane", "seenAt": "2025-12-02T15:31:00.000Z" }
 *     ],
 *     "percentageSeen": 60
 *   }
 * }
 */


export const getReadReceipts = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user?.userId || req.user?.id || req.user?._id;

    const message = await Message.findById(messageId)
      .populate('statuses.userId', 'username email')
      .populate('author', 'username');

    if (!message) {
      return res.status(404).json({
        success: false,
        message: "Message not found"
      });
    }

    const room = await Room.findById(message.room);
    const userRole = room.getUserRole(userId);
    const isAuthor = message.author._id.toString() === userId.toString();
    const isAdmin = ['admin', 'creator'].includes(userRole);

    if (!isAuthor && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Only the message author or admins can view read receipts"
      });
    }

    const delivered = message.statuses
      .filter(s => s.deliveredAt)
      .map(s => ({
        userId: s.userId._id,
        username: s.userId.username,
        deliveredAt: s.deliveredAt
      }));

    const seen = message.statuses
      .filter(s => s.seenAt)
      .map(s => ({
        userId: s.userId._id,
        username: s.userId.username,
        seenAt: s.seenAt
      }));

    const totalRecipients = room.users.length - 1;

    res.status(200).json({
      success: true,
      data: {
        messageId: message._id,
        author: message.author.username,
        totalRecipients,
        deliveredCount: delivered.length,
        seenCount: seen.length,
        delivered,
        seen,
        percentageSeen: totalRecipients > 0
          ? Math.round((seen.length / totalRecipients) * 100)
          : 0
      }
    });

  } catch (err) {
    console.error("❌ Error getting read receipts:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message
    });
  }
};

export const getUnreadCount = async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user?.userId || req.user?.id || req.user?._id;

    const room = await Room.findById(roomId);
    if (!room || !room.users.some(u => u.toString() === userId.toString())) {
      return res.status(403).json({
        success: false,
        message: "Access denied"
      });
    }

    const unreadCount = await Message.countDocuments({
      room: roomId,
      author: { $ne: userId },
      isDeleted: false,
      $or: [
        { 'statuses.userId': { $ne: userId } },
        {
          statuses: {
            $elemMatch: {
              userId: userId,
              seenAt: { $exists: false }
            }
          }
        }
      ]
    });

    const lastReadMessage = await Message.findOne({
      room: roomId,
      'statuses.userId': userId,
      'statuses.seenAt': { $exists: true }
    })
      .sort({ 'statuses.seenAt': -1 })
      .select('createdAt statuses');

    res.status(200).json({
      success: true,
      data: {
        roomId,
        unreadCount,
        lastReadAt: lastReadMessage?.statuses.find(s =>
          s.userId.toString() === userId.toString()
        )?.seenAt || null
      }
    });

  } catch (err) {
    console.error("❌ Error getting unread count:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message
    });
  }
};
