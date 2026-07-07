const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const controller = require('../controllers/studentController');
const { protect, restrictTo } = require('../middleware/auth');
const { uploadCsv } = require('../middleware/upload');
const validate = require('../middleware/validate');

router.use(protect);

const studentValidation = [
  body('fullName').trim().notEmpty().withMessage('Full name is required').isLength({ max: 100 }),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('registrationNumber').trim().notEmpty().withMessage('Registration number is required'),
  body('department').optional().trim(),
  body('level').optional().trim(),
];

router.post('/', studentValidation, validate, controller.addStudent);

router.post(
  '/bulk',
  restrictTo('super_admin', 'admin'),
  uploadCsv.single('file'),
  controller.bulkImportStudents
);

router.get('/', controller.getStudents);
router.get('/:id', controller.getStudent);

router.put(
  '/:id',
  [
    body('fullName').optional().trim().notEmpty().isLength({ max: 100 }),
    body('email').optional().isEmail().normalizeEmail(),
    body('department').optional().trim(),
    body('level').optional().trim(),
  ],
  validate,
  controller.updateStudent
);

router.delete('/:id', restrictTo('super_admin', 'admin'), controller.deleteStudent);

module.exports = router;
