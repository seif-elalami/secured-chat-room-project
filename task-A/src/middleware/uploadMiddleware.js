import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import. meta.url);
const __dirname = path.dirname(__filename);

// ========================================
// CREATE UPLOAD DIRECTORIES
// ========================================
const uploadDirs = [
  path.join(__dirname, '../../uploads/notes'),
  path.join(__dirname, '../../uploads/covers'),
  path.join(__dirname, '../../uploads/voice'),
  path.join(__dirname, '../../uploads/thumbnails'),
  path.join(__dirname, '../../uploads/assignments'),
  path.join(__dirname, '../../uploads/submissions')
];

uploadDirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`✅ Created directory: ${dir}`);
  }
});

// ========================================
// STORAGE CONFIGURATION
// ========================================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let uploadPath = 'uploads/notes';  // Default

    // Determine path based on fieldname or route
    if (file.fieldname === 'voiceNote') {
      uploadPath = 'uploads/voice';
    } else if (file.fieldname === 'coverImage') {
      uploadPath = 'uploads/covers';
    } else if (file.fieldname === 'thumbnail') {
      uploadPath = 'uploads/thumbnails';
    } else if (req.baseUrl.includes('/assignments')) {
      uploadPath = file.fieldname === 'files' ? 'uploads/submissions' : 'uploads/assignments';
    }

    cb(null, uploadPath);
  },

  filename: (req, file, cb) => {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file. originalname);

    let prefix = 'file';
    if (file.fieldname === 'voiceNote') prefix = 'voice';
    else if (file.fieldname === 'coverImage') prefix = 'cover';
    else if (file.fieldname === 'thumbnail') prefix = 'thumb';
    else if (file.mimetype.startsWith('image/')) prefix = 'img';
    else if (file. mimetype.startsWith('video/')) prefix = 'video';
    else if (file.mimetype === 'application/pdf') prefix = 'doc';

    cb(null, `${prefix}-${uniqueSuffix}${ext}`);
  }
});

// ========================================
// FILE FILTER
// ========================================
const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    // Images
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    // Videos
    'video/mp4',
    'video/mpeg',
    'video/quicktime',
    'video/webm',
    // Audio
    'audio/mpeg',
    'audio/mp4',
    'audio/wav',
    'audio/webm',
    'audio/ogg',
    // Documents
    'application/pdf',
    'application/msword',
    'application/vnd. openxmlformats-officedocument.wordprocessingml. document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain'
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type not allowed: ${file.mimetype}`), false);
  }
};

// ========================================
// MULTER INSTANCE
// ========================================
export const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024  // 50MB max file size
  },
  fileFilter: fileFilter
});
