const express = require('express');
const { body } = require('express-validator');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const controller = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');

const authLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_AUTH) || 100,
  message: { status: 'fail', message: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Institution register
router.post(
  '/institution/register',
  authLimiter,
  [
    body('name').trim().notEmpty().withMessage('Institution name is required').isLength({ max: 200 }),
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain uppercase, lowercase, and a number'),
    body('contactPhone').optional().trim(),
    body('website').optional().trim().isURL().withMessage('Invalid website URL'),
  ],
  validate,
  controller.registerInstitution
);

// Institution login
router.post(
  '/institution/login',
  authLimiter,
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  validate,
  controller.loginInstitution
);

// Admin login
router.post(
  '/admin/login',
  authLimiter,
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
    body('institutionId').optional().isMongoId().withMessage('Invalid institution ID'),
  ],
  validate,
  controller.loginAdmin
);

// Refresh token
router.post('/refresh', controller.refreshToken);

// Logout (requires auth)
router.post('/logout', protect, controller.logout);

// Forgot password
router.post(
  '/forgot-password',
  authLimiter,
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('userType').optional().isIn(['institution', 'admin']).withMessage('Invalid user type'),
  ],
  validate,
  controller.forgotPassword
);

// Reset password
router.post(
  '/reset-password',
  authLimiter,
  [
    body('token').notEmpty().withMessage('Reset token is required'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain uppercase, lowercase, and a number'),
    body('userType').optional().isIn(['institution', 'admin']),
  ],
  validate,
  controller.resetPassword
);

module.exports = router;
