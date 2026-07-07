const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const controller = require('../controllers/institutionController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');

// All routes require authentication
router.use(protect);

router.get('/profile', controller.getProfile);

router.put(
  '/profile',
  [
    body('name').optional().trim().notEmpty().isLength({ max: 200 }),
    body('contactPhone').optional().trim(),
    body('website').optional().trim().isURL().withMessage('Invalid website URL'),
    body('address').optional().trim(),
    body('logoUrl').optional().trim().isURL().withMessage('Invalid logo URL'),
  ],
  validate,
  controller.updateProfile
);

router.get('/stats', controller.getStats);

router.post('/regenerate-api-key', controller.regenerateApiKey);

module.exports = router;
