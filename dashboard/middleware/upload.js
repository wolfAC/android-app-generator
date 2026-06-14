'use strict';

const path = require('path');
const fs = require('fs-extra');
const multer = require('multer');

const UPLOADS_BASE = path.resolve(__dirname, '..', 'data', 'uploads');

const ALLOWED_MIME = ['image/png', 'image/jpeg', 'image/webp'];

function fileFilter(req, file, cb) {
  if (ALLOWED_MIME.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only PNG, JPG, and WebP images are allowed'), false);
  }
}

function storageForUser(userId) {
  return multer.diskStorage({
    destination: async (req, file, cb) => {
      const userDir = path.join(UPLOADS_BASE, userId);
      try {
        await fs.ensureDir(userDir);
        cb(null, userDir);
      } catch (err) {
        cb(err);
      }
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname) || '.png';
      cb(null, `${file.fieldname}-${Date.now()}${ext}`);
    },
  });
}

function iconUpload(req, res, next) {
  const userId = req.user && req.user.userId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const upload = multer({
    storage: storageForUser(userId),
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  }).single('icon');

  upload(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}

function splashUpload(req, res, next) {
  const userId = req.user && req.user.userId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const upload = multer({
    storage: storageForUser(userId),
    fileFilter,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  }).single('splash');

  upload(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}

module.exports = { iconUpload, splashUpload };
