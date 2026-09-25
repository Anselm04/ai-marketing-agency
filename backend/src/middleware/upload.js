import multer from 'multer';
import path from 'path';
import fs from 'fs';

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(UPLOAD_DIR, req.userId || 'anonymous');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    cb(null, name);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm', 'application/pdf', 'text/plain', 'text/markdown'];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error(`File type not allowed: ${file.mimetype}`), false);
};

const limits = {
  fileSize: Number(process.env.MEDIA_UPLOAD_MAX_BYTES) || 250 * 1024 * 1024,
  files: Number(process.env.MEDIA_UPLOAD_MAX_FILES) || 20,
  fields: 20,
  parts: 30,
  fieldSize: 1024 * 1024,
  fieldNestingDepth: 3,
  fieldArrayIndexLimit: 100,
};

export const upload = multer({ storage, fileFilter, limits });
export const uploadMemory = multer({ storage: multer.memoryStorage(), fileFilter, limits });
