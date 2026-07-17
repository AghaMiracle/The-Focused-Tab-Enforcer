const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const controller = require('../controllers/extensionController');

const extLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_EXTENSION) || 1000,
  message: { status: 'fail', message: 'Extension rate limit exceeded. Slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Extension routes are open (no API key required).
// The Exam ID in the request body links to the institution.
router.use(extLimiter);

router.post('/verify', controller.verify);
router.post('/config', controller.getConfig);
router.post('/heartbeat', controller.heartbeat);
router.post('/log', controller.log);

module.exports = router;
