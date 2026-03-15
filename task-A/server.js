import express from "express";
import bodyParser from 'body-parser';
import dotenv from "dotenv";
import cors from "cors";
import { connectDB } from "./src/models/mongoose.js";
import authRoutes from "./src/routes/auth.js";
import userRoutes from "./src/routes/users.js";
import mediaRoutes from "./src/routes/mediaRoutes.js";
import path from "path";
import { fileURLToPath } from "url";
import messageRoutes from "./src/routes/messageRoutes.js";
import roomRoutes from "./src/routes/roomRoutes.js";
import noteRoutes from "./src/routes/noteRoutes.js";
import assignmentRoutes from './src/routes/assignmentRoutes.js';
import attachmentRoutes from './src/routes/attachmentRoutes.js';

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Resolve paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// MongoDB connection
connectDB()
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.error("❌ MongoDB Connection Error:", err));

// Routes
app.use("/auth", authRoutes);
app.use("/users", userRoutes);
app.use("/media", mediaRoutes);
app.use("/messages", messageRoutes);
app.use("/rooms", roomRoutes);
// Serve uploaded files statically
app.use("/uploads", express.static(path.join(__dirname, "src", "uploads")));

app.use("/notes", noteRoutes);
// Root route
app.get("/", (req, res) => {
  res.send("🚀 Server is running successfully!");
});

// Add assignment routes
app.use('/assignments', assignmentRoutes);

app.use('/api/attachments', attachmentRoutes);

// Error handler
app.use((err, req, res, next) => {
  console.error("⚠️ Error:", err.stack);
  res.status(500).json({ message: "Internal Server Error" });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
