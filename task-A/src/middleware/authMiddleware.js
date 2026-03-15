import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import User from "../models/User.js";

dotenv.config();

export const authMiddleware = async (req, res, next) => {
  try {
    console.log("🔐 Auth Middleware - Starting authentication...");

    const authHeader = req.headers.authorization;
    console.log("🔐 Authorization header:", authHeader);

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.log("❌ No Bearer token found in authorization header");
      return res.status(401).json({
        success: false,
        message: "Authorization header missing or invalid",
      });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Token is missing",
      });
    }

    // ✅ Verify and decode the JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("✅ Decoded token payload:", decoded);

    // ✅ Detect correct user ID field in token payload
    const userId =
      decoded.userId || decoded.id || decoded._id || decoded.sub;

    if (!userId) {
      console.log("❌ Token payload missing user identifier");
      return res.status(401).json({
        success: false,
        message: "Invalid token: no user ID found",
      });
    }

    // ✅ Ensure the user still exists
    const user = await User.findById(userId);
    if (!user) {
      console.log("❌ User not found in database for token");
      return res.status(401).json({
        success: false,
        message: "User not found. Token is invalid.",
      });
    }

    // ✅ Attach user info to request
    req.user = {
      userId: user._id.toString(),
      id: user._id.toString(),
      _id: user._id,
      username: user.username,
      email: user.email,
       role: user.role || 'student'
    };


    req.userId = user._id.toString();

    console.log("✅ Auth successful — req.user & req.userId set:", req.userId);
    next();
  } catch (error) {
    console.error("❌ Auth Middleware Error:", error.message);

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Invalid token format",
      });
    }

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token has expired. Please log in again.",
      });
    }

    res.status(401).json({
      success: false,
      message: "Authentication failed",
    });
  }
};



