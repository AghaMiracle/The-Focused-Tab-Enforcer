const crypto = require('crypto');
const csv = require('csvtojson');
const fs = require('fs');
const Student = require('../models/Student');
const ExamEnrollment = require('../models/ExamEnrollment');
const MonitoringSession = require('../models/MonitoringSession');
const ViolationEvent = require('../models/ViolationEvent');
const RealtimeAlert = require('../models/RealtimeAlert');
const Institution = require('../models/Institution');
const AppError = require('../utils/AppError');
const { sendStudentCredentialsEmail } = require('../utils/emailService');

/**
 * Generate an institution prefix from its name (up to 4 chars).
 * e.g. "University of Lagos" → "UNIL", "MIT" → "MIT"
 */
const getInstitutionPrefix = (name) => {
  if (!name) return 'INST';
  const words = name.trim().split(/\s+/);
  if (words.length === 1) {
    return words[0].substring(0, 4).toUpperCase();
  }
  // Take first letter of each word, up to 4
  return words.map((w) => w[0]).join('').substring(0, 4).toUpperCase();
};

/**
 * Generate a unique exam ID: PREFIX + alphanumeric chars (total 10 chars).
 */
const generateExamId = async (institutionName) => {
  const prefix = getInstitutionPrefix(institutionName);
  const remainingLength = 10 - prefix.length;

  // Keep trying until we get a unique one
  for (let attempt = 0; attempt < 10; attempt++) {
    const randomPart = crypto
      .randomBytes(remainingLength)
      .toString('base64url')
      .replace(/[^A-Za-z0-9]/g, '')
      .substring(0, remainingLength)
      .toUpperCase();
    const examId = `${prefix}${randomPart}`;
    const exists = await Student.findOne({ examId });
    if (!exists) return examId;
  }
  // Fallback: include timestamp component
  const ts = Date.now().toString(36).toUpperCase().slice(-remainingLength);
  return `${prefix}${ts}`.substring(0, 10);
};

/**
 * Add a single student and send credentials email.
 * Generates a unique exam ID prefixed with the institution short name.
 */
const addStudent = async ({ institutionId, data }) => {
  const institution = await Institution.findById(institutionId).select('name');
  const institutionName = institution?.name || 'Your Institution';

  // Generate unique exam ID for this student
  const examId = await generateExamId(institutionName);

  const student = await Student.create({ ...data, institutionId, examId });

  // Send credentials email (fire-and-forget)
  sendStudentCredentialsEmail({
    studentEmail: student.email,
    studentName: student.fullName,
    registrationNumber: student.registrationNumber,
    examId: student.examId,
    institutionName,
  }).catch(() => {});

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

  const institution = await Institution.findById(institutionId).select('name');
  const institutionName = institution?.name || 'Your Institution';

  const results = { created: 0, skipped: 0, errors: [] };

  for (const [i, row] of rows.entries()) {
    const { fullName, email, registrationNumber, department, level } = row;

    if (!fullName || !email || !registrationNumber) {
      results.errors.push(`Row ${i + 2}: Missing required fields (fullName, email, registrationNumber).`);
      results.skipped++;
      continue;
    }

    try {
      const examId = await generateExamId(institutionName);
      const student = await Student.create({
        institutionId,
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        registrationNumber: registrationNumber.trim().toUpperCase(),
        department: department ? department.trim() : undefined,
        level: level ? level.trim() : undefined,
        examId,
      });
      results.created++;

      // Send credentials email (fire-and-forget)
      sendStudentCredentialsEmail({
        studentEmail: student.email,
        studentName: student.fullName,
        registrationNumber: student.registrationNumber,
        examId: student.examId,
        institutionName,
      }).catch(() => {});
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
  const filter = { institutionId };

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
 * Hard-delete a student and all related data (enrollments, sessions, violations, alerts).
 */
const deleteStudent = async ({ studentId, institutionId }) => {
  const student = await Student.findOne({ _id: studentId, institutionId });
  if (!student) throw new AppError('Student not found.', 404);

  // Find all enrollments for this student
  const enrollmentIds = await ExamEnrollment.distinct('_id', { studentId: student._id });

  // Find all monitoring sessions for these enrollments
  const sessionIds = await MonitoringSession.distinct('_id', {
    examEnrollmentId: { $in: enrollmentIds },
  });

  // Delete violation events tied to these sessions/enrollments
  await ViolationEvent.deleteMany({
    $or: [
      { monitoringSessionId: { $in: sessionIds } },
      { examEnrollmentId: { $in: enrollmentIds } },
    ],
  });

  // Delete monitoring sessions
  await MonitoringSession.deleteMany({ examEnrollmentId: { $in: enrollmentIds } });

  // Delete realtime alerts tied to these enrollments
  await RealtimeAlert.deleteMany({ enrollmentId: { $in: enrollmentIds } });

  // Delete exam enrollments
  await ExamEnrollment.deleteMany({ studentId: student._id });

  // Delete the student document itself
  await Student.deleteOne({ _id: student._id });
};

module.exports = {
  addStudent,
  bulkImportStudents,
  getStudents,
  getStudentById,
  updateStudent,
  deleteStudent,
};
