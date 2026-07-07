const reportService = require('../services/reportService');
const asyncHandler = require('../utils/asyncHandler');

/**
 * GET /api/reports/exams/:id/summary
 */
const getExamSummary = asyncHandler(async (req, res) => {
  const summary = await reportService.getExamSummary({
    examId: req.params.id,
    institutionId: req.institutionId,
  });
  res.json({ status: 'success', data: summary });
});

/**
 * GET /api/reports/exams/:id/violations
 */
const getExamViolations = asyncHandler(async (req, res) => {
  const { eventType, severity, studentId, page, limit } = req.query;
  const result = await reportService.getExamViolations({
    examId: req.params.id,
    institutionId: req.institutionId,
    eventType,
    severity,
    studentId,
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 50,
  });
  res.json({ status: 'success', data: result });
});

/**
 * GET /api/reports/students/:id/history
 */
const getStudentHistory = asyncHandler(async (req, res) => {
  const result = await reportService.getStudentHistory({
    studentId: req.params.id,
    institutionId: req.institutionId,
  });
  res.json({ status: 'success', data: result });
});

/**
 * GET /api/reports/export/:examId
 */
const exportExamData = asyncHandler(async (req, res) => {
  const format = req.query.format || 'json';
  const result = await reportService.exportExamData({
    examId: req.params.examId,
    institutionId: req.institutionId,
    format,
  });

  res.setHeader('Content-Type', result.contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
  res.send(result.data);
});

module.exports = { getExamSummary, getExamViolations, getStudentHistory, exportExamData };
