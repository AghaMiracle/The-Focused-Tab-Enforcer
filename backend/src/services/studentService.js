const csv = require('csvtojson');
const path = require('path');
const fs = require('fs');
const Student = require('../models/Student');
const ExamEnrollment = require('../models/ExamEnrollment');
const MonitoringSession = require('../models/MonitoringSession');
const ViolationEvent = require('../models/ViolationEvent');
const AppError = require('../utils/AppError');

/**
 * Add a single student.
 */
const addStudent = async ({ institutionId, data }) => {
  const student = await Student.create({ ...data, institutionId });
  return student;
};

/**
 * Bulk import students from an uploaded CSV file.
 * Expected columns: fullName, email, registrationNumber, department, level
 */
const bulkImportStudents = async ({ institutionId, filePath }) => {
  if (!filePath) throw new AppError('CSV file is required.', 400);

  let rows;
  try {
    rows = await csv().fromFile(filePath);
  } catch {
    throw new AppError('Failed to parse CSV file. Ensure it is valid UTF-8 CSV.', 400);
  } finally {
    // Clean up temp file
    try { fs.unlinkSync(filePath); } catch {}
  }

  if (!rows.length) throw new AppError('CSV file is empty.', 400);

  const results = { created: 0, skipped: 0, errors: [] };

  for (const [i, row] of rows.entries()) {
    const { fullName, email, registrationNumber, department, level } = row;

    if (!fullName || !email || !registrationNumber) {
      results.errors.push(`Row ${i + 2}: Missing required fields (fullName, email, registrationNumber).`);
      results.skipped++;
      continue;
    }

    try {
      await Student.create({
        institutionId,
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        registrationNumber: registrationNumber.trim().toUpperCase(),
        department: department ? department.trim() : undefined,
        level: level ? level.trim() : undefined,
      });
      results.created++;
    } catch (err) {
      if (err.code === 11000) {
        results.skipped++;
        results.errors.push(`Row ${i + 2}: Duplicate email or registration number — "${email}".`);
      } else {
        results.skipped++;
        results.errors.push(`Row ${i + 2}: ${err.message}`);
      }
    }
  }

  return results;
};

/**
 * Get paginated list of students with aggregated examsCompleted and violationCount.
 */
const getStudents = async ({ institutionId, search, page = 1, limit = 20 }) => {
  const filter = { institutionId, isActive: true };

  if (search) {
    filter.$or = [
      { fullName: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { registrationNumber: { $regex: search, $options: 'i' } },
    ];
  }

  const skip = (page - 1) * limit;
  const [rawStudents, total] = await Promise.all([
    Student.find(filter).sort({ fullName: 1 }).skip(skip).limit(limit),
    Student.countDocuments(filter),
  ]);

  // For each student, compute examsCompleted and violationCount
  const students = [];
  for (const s of rawStudents) {
    const completedCount = await ExamEnrollment.countDocuments({
      studentId: s._id,
      enrollmentStatus: { $in: ['completed', 'disqualified'] },
    });

    const enrollmentIds = await ExamEnrollment.distinct('_id', { studentId: s._id });
    const violationCount = await ViolationEvent.countDocuments({
      examEnrollmentId: { $in: enrollmentIds },
    });

    students.push({
      ...s.toObject(),
      examsCompleted: completedCount,
      violationCount,
    });
  }

  return {
    students,
    pagination: { total, page, limit, pages: Math.ceil(total / limit) },
  };
};

/**
 * Get a student by ID with their exam history.
 */
const getStudentById = async ({ studentId, institutionId }) => {
  const student = await Student.findOne({ _id: studentId, institutionId });
  if (!student) throw new AppError('Student not found.', 404);

  const enrollments = await ExamEnrollment.find({ studentId: student._id })
    .populate('examId', 'title examId scheduledDate durationMinutes status')
    .sort({ createdAt: -1 })
    .limit(20);

  return { student, examHistory: enrollments };
};

/**
 * Update a student's details.
 */
const updateStudent = async ({ studentId, institutionId, data }) => {
  const student = await Student.findOne({ _id: studentId, institutionId });
  if (!student) throw new AppError('Student not found.', 404);

  // Protect immutable fields
  const { institutionId: _, ...safeData } = data;
  Object.assign(student, safeData);
  await student.save();

  return student;
};

/**
 * Soft-delete a student (deactivate).
 */
const deleteStudent = async ({ studentId, institutionId }) => {
  const student = await Student.findOne({ _id: studentId, institutionId });
  if (!student) throw new AppError('Student not found.', 404);

  student.isActive = false;
  await student.save();
};

module.exports = {
  addStudent,
  bulkImportStudents,
  getStudents,
  getStudentById,
  updateStudent,
  deleteStudent,
};
