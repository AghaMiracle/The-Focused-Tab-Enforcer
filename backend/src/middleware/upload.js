const multer = require('multer');
const path = require('path');
const AppError = require('../utils/AppError');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, process.env.UPLOAD_DIR || 'uploads');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

/**
 * Only accept CSV files.
 */
const csvFileFilter = (req, file, cb) => {
  const allowed = ['.csv', 'text/csv', 'application/vnd.ms-excel', 'application/csv'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext === '.csv' || allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError('Only CSV files are allowed.', 400), false);
  }
};

/**
 * Only accept image files.
 */
const imageFileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError('Only JPEG, PNG, or WebP images are allowed.', 400), false);
  }
};

const maxFileSize = parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024; // 5MB default

/**
 * Multer instance for CSV uploads (e.g., student bulk import).
 */
const uploadCsv = multer({
  storage,
  fileFilter: csvFileFilter,
  limits: { fileSize: maxFileSize },
});

/**
 * Multer instance for image uploads (e.g., face images).
 */
const uploadImage = multer({
  storage,
  fileFilter: imageFileFilter,
  limits: { fileSize: maxFileSize },
});

module.exports = { uploadCsv, uploadImage };
