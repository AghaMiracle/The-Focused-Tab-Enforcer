const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const controller = require('../controllers/examController');
const { protect, restrictTo, institutionOnly } = require('../middleware/auth');
const validate = require('../middleware/validate');

router.use(protect);

const examValidation = [
  body('title').trim().notEmpty().withMessage('Exam title is required').isLength({ max: 200 }),
  body('scheduledDate').isISO8601().withMessage('Valid scheduled date is required'),
  body('durationMinutes')
    .isInt({ min: 1, max: 600 })
    .withMessage('Duration must be between 1 and 600 minutes'),
  body('description').optional().trim().isLength({ max: 1000 }),
  body('allowedDomains').optional().isArray(),
  body('violationThresholds').optional().isObject(),
  body('violationThresholds.tabSwitchSeconds').optional().isInt({ min: 1 }),
  body('violationThresholds.faceAbsenceFrames').optional().isInt({ min: 1 }),
  body('violationThresholds.multipleFaceTolerance').optional().isInt({ min: 0 }),
  body('violationThresholds.attentionAwaySeconds').optional().isInt({ min: 1 }),
];

router.post('/', examValidation, validate, controller.createExam);
router.get('/', controller.getExams);
router.get('/:id', controller.getExam);

router.put(
  '/:id',
  [
    body('title').optional().trim().notEmpty().isLength({ max: 200 }),
    body('scheduledDate').optional().isISO8601(),
    body('durationMinutes').optional().isInt({ min: 1, max: 600 }),
    body('description').optional().trim().isLength({ max: 1000 }),
    body('allowedDomains').optional().isArray(),
    body('status')
      .optional()
      .isIn(['draft', 'scheduled'])
      .withMessage('Can only manually set status to draft or scheduled'),
    body('violationThresholds').optional().isObject(),
  ],
  validate,
  controller.updateExam
);

router.delete('/:id', restrictTo('super_admin', 'admin'), controller.deleteExam);

router.post(
  '/:id/enroll',
  [body('studentIds').isArray({ min: 1 }).withMessage('studentIds must be a non-empty array')],
  validate,
  controller.enrollStudents
);

router.get('/:id/students', controller.getEnrolledStudents);

router.post('/:id/start', restrictTo('super_admin', 'admin'), controller.startExam);
router.post('/:id/end', restrictTo('super_admin', 'admin'), controller.endExam);

module.exports = router;
