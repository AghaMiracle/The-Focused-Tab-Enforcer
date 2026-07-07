const express = require('express');
const router = express.Router();
const controller = require('../controllers/reportController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/exams/:id/summary', controller.getExamSummary);
router.get('/exams/:id/violations', controller.getExamViolations);
router.get('/students/:id/history', controller.getStudentHistory);
router.get('/export/:examId', controller.exportExamData);

module.exports = router;
