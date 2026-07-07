const studentService = require('../services/studentService');
const asyncHandler = require('../utils/asyncHandler');

/**
 * POST /api/students
 */
const addStudent = asyncHandler(async (req, res) => {
  const student = await studentService.addStudent({
    institutionId: req.institutionId,
    data: req.body,
  });
  res.status(201).json({ status: 'success', data: { student } });
});

/**
 * POST /api/students/bulk
 */
const bulkImportStudents = asyncHandler(async (req, res) => {
  const filePath = req.file?.path;
  const results = await studentService.bulkImportStudents({
    institutionId: req.institutionId,
    filePath,
  });
  res.status(207).json({
    status: 'success',
    message: `Import complete: ${results.created} created, ${results.skipped} skipped.`,
    data: results,
  });
});

/**
 * GET /api/students
 */
const getStudents = asyncHandler(async (req, res) => {
  const { search, page, limit } = req.query;
  const result = await studentService.getStudents({
    institutionId: req.institutionId,
    search,
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20,
  });
  res.json({ status: 'success', data: result });
});

/**
 * GET /api/students/:id
 */
const getStudent = asyncHandler(async (req, res) => {
  const result = await studentService.getStudentById({
    studentId: req.params.id,
    institutionId: req.institutionId,
  });
  res.json({ status: 'success', data: result });
});

/**
 * PUT /api/students/:id
 */
const updateStudent = asyncHandler(async (req, res) => {
  const student = await studentService.updateStudent({
    studentId: req.params.id,
    institutionId: req.institutionId,
    data: req.body,
  });
  res.json({ status: 'success', data: { student } });
});

/**
 * DELETE /api/students/:id
 */
const deleteStudent = asyncHandler(async (req, res) => {
  await studentService.deleteStudent({
    studentId: req.params.id,
    institutionId: req.institutionId,
  });
  res.json({ status: 'success', message: 'Student removed successfully.' });
});

module.exports = { addStudent, bulkImportStudents, getStudents, getStudent, updateStudent, deleteStudent };
