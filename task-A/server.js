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
import rateLimit from 'express-rate-limit';
import helmet from "helmet";

// --- Add required imports for CSRF ---
import cookieParser from 'cookie-parser';
import csrf from 'csurf';

dotenv.config();

const app = express();

//  Security:  CORS Policy
const allowedOrigins = [
  "http://localhost:4000",
];
app.use(cors({
  origin: allowedOrigins,
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));

app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- Enable cookies for CSRF ---
app.use(cookieParser());

// --- CSRF Protection setup (use cookies, readable by frontend) ---
const csrfProtection = csrf({ cookie: { httpOnly: false, sameSite: 'strict' } });

// --- Apply CSRF protection ONLY for state-changing methods ---
app.use((req, res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    csrfProtection(req, res, next);
  } else {
    next();
  }
});

// --- Issue CSRF token via endpoint so the frontend can fetch it ---
app.get('/csrf-token', csrfProtection, (req, res) => {
  res.cookie('XSRF-TOKEN', req.csrfToken());
  res.json({ csrfToken: req.csrfToken() });
});

//  Security: Rate Limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 mins
    max: 1000, // 1000 requests per 10 minute
  message: 'Too many requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    console.warn(`⚠️ Rate limit exceeded for IP: ${req.ip} on ${req.originalUrl}`);
    res.status(options.statusCode).send(options.message);
  },
});
app.use(apiLimiter);

// Stricter limit for /auth routes
const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 10,
  message: "Too many login/register attempts. Try again later."
});
app.use("/auth", authLimiter);

// Resolve paths for uploads folder
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// . MongoDB connection
connectDB()
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.error("❌ MongoDB Connection Error:", err));

//  Routes
app.use("/auth", authRoutes);
app.use("/users", userRoutes);
app.use("/media", mediaRoutes);
app.use("/messages", messageRoutes);
app.use("/rooms", roomRoutes);
// Serve uploaded files statically
app.use("/uploads", express.static(path.join(__dirname, "src", "uploads")));
app.use("/notes", noteRoutes);
app.use('/assignments', assignmentRoutes);
app.use('/api/attachments', attachmentRoutes);

//  Basic Root Route
app.get("/", (req, res) => {
  res.send("🚀 Server is running successfully!");
});

//   Error Handler
app.use((err, req, res, next) => {
  console.error("⚠️ Error:", err.stack);
  res.status(500).json({ message: "Internal Server Error" });
});

//  Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
