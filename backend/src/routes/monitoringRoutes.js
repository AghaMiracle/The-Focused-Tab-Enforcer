const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const controller = require('../controllers/monitoringController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');

// Public extension endpoints (token-based, no JWT auth)

// Step 1: Authenticate student and list their available exams
router.post(
  '/authenticate',
  [
    body('examId').trim().notEmpty().withMessage('examId is required'),
    body('email').trim().isEmail().withMessage('Valid email is required'),
    body('registrationNumber').trim().notEmpty().withMessage('registrationNumber is required'),
  ],
  validate,
  controller.authenticateStudent
);

// Step 2: Pick an exam and start the monitoring session
router.post(
  '/start-exam',
  [
    body('studentAuthToken').notEmpty().withMessage('studentAuthToken is required'),
    body('examId').notEmpty().withMessage('examId is required'),
  ],
  validate,
  controller.startExamSession
);

router.post(
  '/start',
  [body('sessionToken').notEmpty().withMessage('sessionToken is required')],
  validate,
  controller.startSession
);

router.post(
  '/:id/heartbeat',
  [
    body('sessionToken').notEmpty().withMessage('sessionToken is required'),
    body('currentStatus').optional().isIn(['active', 'paused']),
    body('faceDetected').optional().isBoolean(),
    body('violationCount').optional().isInt({ min: 0 }),
  ],
  validate,
  controller.heartbeat
);

router.post(
  '/:id/violation',
  [
    body('sessionToken').notEmpty().withMessage('sessionToken is required'),
    body('eventType')
      .isIn(['tab_switch', 'window_blur', 'app_switch', 'face_absence', 'multiple_faces', 'attention_away'])
      .withMessage('Invalid event type'),
    body('severity').isIn(['low', 'medium', 'high']).withMessage('Invalid severity'),
    body('timestamp').isISO8601().withMessage('Valid ISO timestamp is required'),
    body('duration').optional().isNumeric(),
    body('metadata').optional().isObject(),
  ],
  validate,
  controller.reportViolation
);

router.post(
  '/:id/snapshot',
  [
    body('sessionToken').notEmpty().withMessage('sessionToken is required'),
    body('snapshot').notEmpty().withMessage('snapshot is required'),
  ],
  validate,
  controller.uploadSnapshot
);

router.post(
  '/:id/end',
  [
    body('sessionToken').notEmpty().withMessage('sessionToken is required'),
    body('endReason').optional().isIn(['completed', 'terminated', 'student_left']),
  ],
  validate,
  controller.endSession
);

// Admin-protected routes
router.get('/live', protect, controller.getLiveSessions);
router.get('/:id/report', protect, controller.getSessionReport);
router.get('/:id/timeline', protect, controller.getSessionTimeline);

module.exports = router;
