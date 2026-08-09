import express from 'express';
import path from 'path';
import fs from 'fs';
import store from '../utils/store.js';
import { upload, uploadMemory } from '../middleware/upload.js';
import { isS3Configured, uploadToS3, getUploadUrl } from '../services/uploadService.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Single file upload (image/video/document)
router.post('/single', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    let url = `/uploads/${req.userId}/${req.file.filename}`;

    // If S3 is configured, upload there too
    if (isS3Configured()) {
      const key = `${req.userId}/${Date.now()}-${req.file.originalname}`;
      const fileBuffer = await fs.promises.readFile(req.file.path);
      const s3Url = await uploadToS3(key, fileBuffer, req.file.mimetype);
      url = s3Url;
    }

    const fileRecord = {
      id: store._id(),
      owner: req.userId,
      originalName: req.file.originalname,
      filename: req.file.filename,
      mimetype: req.file.mimetype,
      size: req.file.size,
      url,
      path: req.file.path,
      createdAt: new Date().toISOString(),
    };

    res.status(201).json({ file: fileRecord });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Multiple files upload
router.post('/multiple', upload.array('files', 10), async (req, res) => {
  try {
    if (!req.files?.length) return res.status(400).json({ error: 'No files uploaded' });

    const files = await Promise.all(req.files.map(async (file) => {
      let url = `/uploads/${req.userId}/${file.filename}`;
      if (isS3Configured()) {
        const key = `${req.userId}/${Date.now()}-${file.originalname}`;
        const fileBuffer = await fs.promises.readFile(file.path);
        const s3Url = await uploadToS3(key, fileBuffer, file.mimetype);
        url = s3Url;
      }
      return {
        id: store._id(),
        owner: req.userId,
        originalName: file.originalname,
        filename: file.filename,
        mimetype: file.mimetype,
        size: file.size,
        url,
        path: file.path,
        createdAt: new Date().toISOString(),
      };
    }));

    res.status(201).json({ files });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Memory upload for direct S3 (no local disk)
router.post('/s3-direct', uploadMemory.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    if (!isS3Configured()) return res.status(503).json({ error: 'S3 not configured' });

    const key = `${req.userId}/${Date.now()}-${req.file.originalname}`;
    const s3Url = await uploadToS3(key, req.file.buffer, req.file.mimetype);

    res.status(201).json({
      file: {
        id: store._id(),
        owner: req.userId,
        originalName: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        url: s3Url,
        key,
        createdAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve local uploads with authentication check
export function serveUploads(app) {
  const uploadDir = process.env.UPLOAD_DIR || './uploads';
  app.use('/uploads', authenticate, (req, res, next) => {
    // Only allow users to access their own uploads
    const reqPath = req.path;
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });
    // Path format: /uploads/{userId}/{filename}
    const pathParts = reqPath.split('/').filter(Boolean);
    if (pathParts[0] !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    next();
  }, express.static(uploadDir));
}

export default router;
