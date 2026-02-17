import path from 'node:path';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';

import { ensureDealUploadsDir, ensurePropertyUploadsDir } from '../config/uploads.js';

const allowedMime = new Set(['image/jpeg', 'image/png']);

export function propertyImagesUploadMiddleware({ maxFiles = 10 } = {}) {
  const storage = multer.diskStorage({
    destination: (req, _file, cb) => {
      const propertyId = req.params?.id || req.body?.propertyId || 'tmp';
      const dir = ensurePropertyUploadsDir(propertyId);
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase();
      const safeExt = ext === '.jpg' || ext === '.jpeg' || ext === '.png' ? ext : '';
      cb(null, `${uuidv4()}${safeExt}`);
    },
  });

  const upload = multer({
    storage,
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB
      files: maxFiles,
    },
    fileFilter: (_req, file, cb) => {
      if (!allowedMime.has(file.mimetype)) {
        return cb(new Error('Only JPG and PNG images are allowed'));
      }
      cb(null, true);
    },
  });

  return upload.array('images', maxFiles);
}

export const propertyImagesUpload = propertyImagesUploadMiddleware({ maxFiles: 10 });

const allowedDealDocMime = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

export function dealDocumentsUploadMiddleware({ maxFiles = 5 } = {}) {
  const storage = multer.diskStorage({
    destination: (req, _file, cb) => {
      const dealId = req.params?.id || req.body?.dealId || 'tmp';
      const dir = ensureDealUploadsDir(dealId);
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase();
      const safeExt = ext && ext.length <= 10 ? ext : '';
      cb(null, `${uuidv4()}${safeExt}`);
    },
  });

  const upload = multer({
    storage,
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB
      files: maxFiles,
    },
    fileFilter: (_req, file, cb) => {
      if (!allowedDealDocMime.has(file.mimetype)) {
        return cb(new Error('Only PDF, JPG, PNG, or DOCX files are allowed'));
      }
      cb(null, true);
    },
  });

  return upload.array('documents', maxFiles);
}

export const dealDocumentsUpload = dealDocumentsUploadMiddleware({ maxFiles: 5 });
