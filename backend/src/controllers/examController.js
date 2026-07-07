const examService = require('../services/examService');
const asyncHandler = require('../utils/asyncHandler');

/**
 * POST /api/exams
 */
const createExam = asyncHandler(async (req, res) => {
  const exam = await examService.createExam({
    institutionId: req.institutionId,
    adminId: req.user._id,
    data: req.body,
  });
  res.status(201).json({ status: 'success', data: { exam } });
});

/**
 * GET /api/exams
 */
const getExams = asyncHandler(async (req, res) => {
  const { page, limit, status, startDate, endDate } = req.query;
  const result = await examService.getExams({
    institutionId: req.institutionId,
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20,
    status,
    startDate,
    endDate,
  });
  res.json({ status: 'success', data: result });
});

/**
 * GET /api/exams/:id
 */
const getExam = asyncHandler(async (req, res) => {
  const exam = await examService.getExamById({
    examId: req.params.id,
    institutionId: req.institutionId,
  });
  res.json({ status: 'success', data: { exam } });
});

/**
 * PUT /api/exams/:id
 */
const updateExam = asyncHandler(async (req, res) => {
  const exam = await examService.updateExam({
    examId: req.params.id,
    institutionId: req.institutionId,
    data: req.body,
  });
  res.json({ status: 'success', data: { exam } });
});

/**
 * DELETE /api/exams/:id
 */
const deleteExam = asyncHandler(async (req, res) => {
  await examService.deleteExam({ examId: req.params.id, institutionId: req.institutionId });
  res.json({ status: 'success', message: 'Exam deleted successfully.' });
});

/**
 * POST /api/exams/:id/enroll
 */
const enrollStudents = asyncHandler(async (req, res) => {
  const { studentIds } = req.body;
  const results = await examService.enrollStudents({
    examId: req.params.id,
    institutionId: req.institutionId,
    studentIds,
  });
  res.json({ status: 'success', data: results });
});

/**
 * GET /api/exams/:id/students
 */
const getEnrolledStudents = asyncHandler(async (req, res) => {
  const enrollments = await examService.getEnrolledStudents({
    examId: req.params.id,
    institutionId: req.institutionId,
  });
  res.json({ status: 'success', data: { enrollments } });
});

/**
 * POST /api/exams/:id/start
 */
const startExam = asyncHandler(async (req, res) => {
  const exam = await examService.startExam({ examId: req.params.id, institutionId: req.institutionId });
  res.json({ status: 'success', message: 'Exam started.', data: { exam } });
});

/**
 * POST /api/exams/:id/end
 */
const endExam = asyncHandler(async (req, res) => {
  const exam = await examService.endExam({ examId: req.params.id, institutionId: req.institutionId });
  res.json({ status: 'success', message: 'Exam ended.', data: { exam } });
});

module.exports = {
  createExam,
  getExams,
  getExam,
  updateExam,
  deleteExam,
  enrollStudents,
  getEnrolledStudents,
  startExam,
  endExam,
};
