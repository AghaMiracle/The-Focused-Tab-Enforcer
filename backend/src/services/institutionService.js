const Institution = require('../models/Institution');
const Exam = require('../models/Exam');
const ExamEnrollment = require('../models/ExamEnrollment');
const MonitoringSession = require('../models/MonitoringSession');
const ViolationEvent = require('../models/ViolationEvent');
const Student = require('../models/Student');
const AppError = require('../utils/AppError');

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
    Student.countDocuments({ institutionId }),
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
 * Get institution-level settings (monitoring defaults, notifications, retention).
 */
const getSettings = async (institutionId) => {
  const institution = await Institution.findById(institutionId).select('settings');
  if (!institution) throw new AppError('Institution not found.', 404);
  return institution.settings || {};
};

/**
 * Update institution-level settings.
 * Only the fields within `settings` are updated (partial merge).
 */
const updateSettings = async (institutionId, patch) => {
  // Use $set with dot-notation so only provided fields are overwritten
  const updateOps = {};
  const allowedSections = ['monitoringDefaults', 'notifications', 'retention'];
  for (const section of allowedSections) {
    if (patch[section] && typeof patch[section] === 'object') {
      for (const [key, value] of Object.entries(patch[section])) {
        updateOps[`settings.${section}.${key}`] = value;
      }
    }
  }

  if (Object.keys(updateOps).length === 0) {
    throw new AppError('No valid settings fields provided.', 400);
  }

  const institution = await Institution.findByIdAndUpdate(
    institutionId,
    { $set: updateOps },
    { new: true, runValidators: true }
  ).select('settings');

  if (!institution) throw new AppError('Institution not found.', 404);
  return institution.settings;
};

/**
 * Get hourly violation/session trend for today (or a specific date).
 * Returns an array of 24 hourly buckets for the requested day.
 */
const getViolationTrend = async (institutionId, dateStr) => {
  const date = dateStr ? new Date(dateStr) : new Date();
  date.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setDate(dayEnd.getDate() + 1);

  // Get all exam enrollment IDs for this institution (for session matching)
  const allExams = await Exam.find({ institutionId }).select('_id');
  const allExamIds = allExams.map((e) => e._id);
  const allEnrollmentIds = await ExamEnrollment.distinct('_id', { examId: { $in: allExamIds } });

  // Aggregate violations by hour
  const violationsByHour = await ViolationEvent.aggregate([
    {
      $match: {
        examEnrollmentId: { $in: allEnrollmentIds },
        timestamp: { $gte: date, $lt: dayEnd },
      },
    },
    {
      $group: {
        _id: { $hour: '$timestamp' },
        count: { $sum: 1 },
      },
    },
  ]);

  // Aggregate active sessions by hour (approximate: sessions started that hour)
  const sessionsByHour = await MonitoringSession.aggregate([
    {
      $match: {
        examEnrollmentId: { $in: allEnrollmentIds },
        startedAt: { $gte: date, $lt: dayEnd },
      },
    },
    {
      $group: {
        _id: { $hour: '$startedAt' },
        count: { $sum: 1 },
      },
    },
  ]);

  const violationMap = {};
  violationsByHour.forEach((v) => { violationMap[v._id] = v.count; });

  const sessionMap = {};
  sessionsByHour.forEach((s) => { sessionMap[s._id] = s.count; });

  // Build 24-slot array
  const trend = [];
  for (let h = 0; h < 24; h++) {
    const hh = h.toString().padStart(2, '0');
    trend.push({
      time: `${hh}:00`,
      violations: violationMap[h] || 0,
      sessions: sessionMap[h] || 0,
    });
  }

  return trend;
};

module.exports = { getProfile, updateProfile, getDashboardStats, getSettings, updateSettings, getViolationTrend };
