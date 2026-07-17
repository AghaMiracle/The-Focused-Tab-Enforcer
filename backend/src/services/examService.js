const Exam = require('../models/Exam');
const ExamEnrollment = require('../models/ExamEnrollment');
const MonitoringSession = require('../models/MonitoringSession');
const Student = require('../models/Student');
const AppError = require('../utils/AppError');
const { generateSessionToken } = require('../utils/tokenUtils');

/**
 * Create a new exam.
 * Defaults status to 'scheduled' so students see it in the extension immediately.
 */
const createExam = async ({ institutionId, adminId, data }) => {
  const exam = await Exam.create({
    ...data,
    institutionId,
    createdBy: adminId,
    status: data.status || 'scheduled',
  });
  return exam;
};

/**
 * Get paginated list of exams for an institution.
 */
const getExams = async ({ institutionId, page = 1, limit = 20, status, startDate, endDate }) => {
  const filter = { institutionId };
  if (status) filter.status = status;
  if (startDate || endDate) {
    filter.scheduledDate = {};
    if (startDate) filter.scheduledDate.$gte = new Date(startDate);
    if (endDate) filter.scheduledDate.$lte = new Date(endDate);
  }

  const skip = (page - 1) * limit;
  const [exams, total] = await Promise.all([
    Exam.find(filter)
      .populate('createdBy', 'fullName email')
      .sort({ scheduledDate: -1 })
      .skip(skip)
      .limit(limit),
    Exam.countDocuments(filter),
  ]);

  // Attach enrollment count to each exam
  const examIds = exams.map((e) => e._id);
  const counts = await ExamEnrollment.aggregate([
    { $match: { examId: { $in: examIds } } },
    { $group: { _id: '$examId', count: { $sum: 1 } } },
  ]);
  const countMap = {};
  counts.forEach((c) => { countMap[c._id.toString()] = c.count; });

  const examData = exams.map((e) => ({
    ...e.toObject(),
    enrollmentCount: countMap[e._id.toString()] || 0,
  }));

  return {
    exams: examData,
    pagination: { total, page, limit, pages: Math.ceil(total / limit) },
  };
};

/**
 * Get exam by ID with enrollment count.
 */
const getExamById = async ({ examId, institutionId }) => {
  const exam = await Exam.findOne({ _id: examId, institutionId })
    .populate('createdBy', 'fullName email role');

  if (!exam) throw new AppError('Exam not found.', 404);

  const enrollmentCount = await ExamEnrollment.countDocuments({ examId: exam._id });
  const activeSessionCount = await MonitoringSession.countDocuments({
    examEnrollmentId: { $in: await ExamEnrollment.distinct('_id', { examId: exam._id }) },
    status: 'active',
  });

  return { ...exam.toObject(), enrollmentCount, activeSessionCount };
};

/**
 * Update exam (only draft or scheduled).
 */
const updateExam = async ({ examId, institutionId, data }) => {
  const exam = await Exam.findOne({ _id: examId, institutionId });
  if (!exam) throw new AppError('Exam not found.', 404);

  if (!['draft', 'scheduled'].includes(exam.status)) {
    throw new AppError(`Cannot edit an exam with status '${exam.status}'.`, 400);
  }

  Object.assign(exam, data);
  await exam.save();
  return exam;
};

/**
 * Soft delete exam.
 */
const deleteExam = async ({ examId, institutionId }) => {
  const exam = await Exam.findOne({ _id: examId, institutionId });
  if (!exam) throw new AppError('Exam not found.', 404);

  if (exam.status === 'active') {
    throw new AppError('Cannot delete an active exam. End it first.', 400);
  }

  exam.isDeleted = true;
  exam.deletedAt = new Date();
  await exam.save();
};

/**
 * Bulk enroll students in an exam.
 * Sends exam notification email to each newly enrolled student.
 * @param {string[]} studentIds - Array of student ObjectId strings
 */
const enrollStudents = async ({ examId, institutionId, studentIds }) => {
  const exam = await Exam.findOne({ _id: examId, institutionId });
  if (!exam) throw new AppError('Exam not found.', 404);

  if (!['draft', 'scheduled'].includes(exam.status)) {
    throw new AppError('Students can only be enrolled in draft or scheduled exams.', 400);
  }

  // Validate all student IDs belong to this institution
  const students = await Student.find({
    _id: { $in: studentIds },
    institutionId,
  }).select('_id fullName email registrationNumber');

  if (students.length !== studentIds.length) {
    throw new AppError('Some student IDs are invalid or do not belong to this institution.', 400);
  }

  const { sendExamEnrollmentEmail } = require('../utils/emailService');

  // Upsert enrollments (skip duplicates)
  const results = { enrolled: 0, alreadyEnrolled: 0, failed: 0 };
  for (const student of students) {
    try {
      const enrollment = await ExamEnrollment.findOneAndUpdate(
        { examId: exam._id, studentId: student._id },
        { examId: exam._id, studentId: student._id },
        { upsert: true, new: true, setDefaultsOnInsert: true, rawResult: true }
      );

      // Only send email for newly created enrollments (not duplicates)
      if (enrollment.lastErrorObject?.updatedExisting === false) {
        results.enrolled++;
        // Send exam enrollment email with Exam ID (fire-and-forget)
        sendExamEnrollmentEmail({
          studentEmail: student.email,
          studentName: student.fullName,
          registrationNumber: student.registrationNumber,
          examId: exam.examId,
          examTitle: exam.title,
          scheduledDate: exam.scheduledDate,
          durationMinutes: exam.durationMinutes,
        }).catch(() => {});
      } else {
        results.alreadyEnrolled++;
      }
    } catch (err) {
      if (err.code === 11000) results.alreadyEnrolled++;
      else results.failed++;
    }
  }

  return results;
};

/**
 * List enrolled students for an exam.
 */
const getEnrolledStudents = async ({ examId, institutionId }) => {
  const exam = await Exam.findOne({ _id: examId, institutionId });
  if (!exam) throw new AppError('Exam not found.', 404);

  const enrollments = await ExamEnrollment.find({ examId: exam._id })
    .populate('studentId', 'fullName email registrationNumber department level faceImageUrl isEnrolled')
    .sort({ createdAt: 1 });

  return enrollments;
};

/**
 * Activate an exam (status → active), generate session tokens for enrolled students.
 */
const startExam = async ({ examId, institutionId }) => {
  const exam = await Exam.findOne({ _id: examId, institutionId });
  if (!exam) throw new AppError('Exam not found.', 404);

  if (!['draft', 'scheduled'].includes(exam.status)) {
    throw new AppError(`Exam cannot be started from '${exam.status}' status.`, 400);
  }

  exam.status = 'active';
  exam.activatedAt = new Date();
  await exam.save();

  return exam;
};

/**
 * End an exam (status → completed).
 */
const endExam = async ({ examId, institutionId }) => {
  const exam = await Exam.findOne({ _id: examId, institutionId });
  if (!exam) throw new AppError('Exam not found.', 404);

  if (exam.status !== 'active') {
    throw new AppError(`Exam is not currently active (status: '${exam.status}').`, 400);
  }

  exam.status = 'completed';
  exam.completedAt = new Date();
  await exam.save();

  // Terminate all still-active monitoring sessions
  const enrollmentIds = await ExamEnrollment.distinct('_id', { examId: exam._id });
  await MonitoringSession.updateMany(
    { examEnrollmentId: { $in: enrollmentIds }, status: 'active' },
    { status: 'completed', endedAt: new Date(), endReason: 'completed' }
  );

  // Mark in-progress enrollments as completed
  await ExamEnrollment.updateMany(
    { examId: exam._id, enrollmentStatus: 'in_progress' },
    { enrollmentStatus: 'completed', submittedAt: new Date() }
  );

  return exam;
};

module.exports = {
  createExam,
  getExams,
  getExamById,
  updateExam,
  deleteExam,
  enrollStudents,
  getEnrolledStudents,
  startExam,
  endExam,
};
