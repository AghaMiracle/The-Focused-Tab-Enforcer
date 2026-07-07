const Institution = require('../models/Institution');
const Exam = require('../models/Exam');
const ExamEnrollment = require('../models/ExamEnrollment');
const MonitoringSession = require('../models/MonitoringSession');
const ViolationEvent = require('../models/ViolationEvent');
const Student = require('../models/Student');
const AppError = require('../utils/AppError');
const { generateApiKey } = require('../utils/tokenUtils');

/**
 * Get institution profile.
 */
const getProfile = async (institutionId) => {
  const institution = await Institution.findById(institutionId);
  if (!institution) throw new AppError('Institution not found.', 404);
  return institution;
};

/**
 * Update institution profile.
 */
const updateProfile = async (institutionId, data) => {
  const allowedFields = ['name', 'address', 'contactPhone', 'website', 'logoUrl'];
  const update = {};
  allowedFields.forEach((f) => {
    if (data[f] !== undefined) update[f] = data[f];
  });

  const institution = await Institution.findByIdAndUpdate(institutionId, update, {
    new: true,
    runValidators: true,
  });

  if (!institution) throw new AppError('Institution not found.', 404);
  return institution;
};

/**
 * Get dashboard statistics for the institution.
 */
const getDashboardStats = async (institutionId) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [
    totalExams,
    activeExams,
    totalStudents,
    scheduledExams,
    completedExams,
  ] = await Promise.all([
    Exam.countDocuments({ institutionId }),
    Exam.countDocuments({ institutionId, status: 'active' }),
    Student.countDocuments({ institutionId, isActive: true }),
    Exam.countDocuments({ institutionId, status: 'scheduled' }),
    Exam.countDocuments({ institutionId, status: 'completed' }),
  ]);

  // Active monitoring sessions
  const activeExamDocs = await Exam.find({ institutionId, status: 'active' }).select('_id');
  const activeExamIds = activeExamDocs.map((e) => e._id);
  const enrollmentIds = await ExamEnrollment.distinct('_id', {
    examId: { $in: activeExamIds },
    enrollmentStatus: 'in_progress',
  });

  const activeSessions = await MonitoringSession.countDocuments({
    examEnrollmentId: { $in: enrollmentIds },
    status: 'active',
  });

  // Violations today
  const todayViolations = await ViolationEvent.countDocuments({
    timestamp: { $gte: today, $lt: tomorrow },
    examEnrollmentId: { $in: await ExamEnrollment.distinct('_id', { examId: { $in: activeExamIds } }) },
  });

  // Violation breakdown today
  const violationBreakdown = await ViolationEvent.aggregate([
    {
      $match: {
        timestamp: { $gte: today, $lt: tomorrow },
      },
    },
    { $group: { _id: '$eventType', count: { $sum: 1 } } },
  ]);

  const violationsByType = {};
  violationBreakdown.forEach((v) => { violationsByType[v._id] = v.count; });

  return {
    exams: {
      total: totalExams,
      active: activeExams,
      scheduled: scheduledExams,
      completed: completedExams,
    },
    students: { total: totalStudents },
    sessions: { active: activeSessions },
    violations: {
      today: todayViolations,
      byType: violationsByType,
    },
  };
};

/**
 * Regenerate institution API key.
 */
const regenerateApiKey = async (institutionId) => {
  const newKey = generateApiKey();
  await Institution.findByIdAndUpdate(institutionId, { apiKey: newKey });
  return newKey;
};

module.exports = { getProfile, updateProfile, getDashboardStats, regenerateApiKey };
