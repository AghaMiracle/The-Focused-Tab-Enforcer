const Exam = require('../models/Exam');
const ExamEnrollment = require('../models/ExamEnrollment');
const MonitoringSession = require('../models/MonitoringSession');
const ViolationEvent = require('../models/ViolationEvent');
const Student = require('../models/Student');
const AppError = require('../utils/AppError');

/**
 * Exam summary: totals, violations breakdown, averages.
 */
const getExamSummary = async ({ examId, institutionId }) => {
  const exam = await Exam.findOne({ _id: examId, institutionId });
  if (!exam) throw new AppError('Exam not found.', 404);

  const enrollments = await ExamEnrollment.find({ examId: exam._id });
  const enrollmentIds = enrollments.map((e) => e._id);

  const statusCounts = enrollments.reduce((acc, e) => {
    acc[e.enrollmentStatus] = (acc[e.enrollmentStatus] || 0) + 1;
    return acc;
  }, {});

  const violations = await ViolationEvent.find({
    examEnrollmentId: { $in: enrollmentIds },
  });

  const violationsByType = violations.reduce((acc, v) => {
    acc[v.eventType] = (acc[v.eventType] || 0) + 1;
    return acc;
  }, {});

  const violationsBySeverity = violations.reduce((acc, v) => {
    acc[v.severity] = (acc[v.severity] || 0) + 1;
    return acc;
  }, {});

  // Average violations per student who participated
  const participated = enrollments.filter((e) =>
    ['in_progress', 'completed', 'disqualified'].includes(e.enrollmentStatus)
  ).length;

  return {
    exam: {
      id: exam._id,
      examId: exam.examId,
      title: exam.title,
      scheduledDate: exam.scheduledDate,
      durationMinutes: exam.durationMinutes,
      status: exam.status,
    },
    enrollment: {
      total: enrollments.length,
      ...statusCounts,
    },
    violations: {
      total: violations.length,
      byType: violationsByType,
      bySeverity: violationsBySeverity,
      averagePerStudent: participated > 0 ? (violations.length / participated).toFixed(2) : 0,
    },
  };
};

/**
 * Get violations list for an exam, with filters.
 */
const getExamViolations = async ({ examId, institutionId, eventType, severity, studentId, page = 1, limit = 50 }) => {
  const exam = await Exam.findOne({ _id: examId, institutionId });
  if (!exam) throw new AppError('Exam not found.', 404);

  const enrollmentFilter = { examId: exam._id };
  if (studentId) enrollmentFilter.studentId = studentId;

  const enrollments = await ExamEnrollment.find(enrollmentFilter);
  const enrollmentIds = enrollments.map((e) => e._id);

  const filter = { examEnrollmentId: { $in: enrollmentIds } };
  if (eventType) filter.eventType = eventType;
  if (severity) filter.severity = severity;

  const skip = (page - 1) * limit;
  const [violations, total] = await Promise.all([
    ViolationEvent.find(filter)
      .populate({
        path: 'examEnrollmentId',
        populate: { path: 'studentId', select: 'fullName email registrationNumber' },
      })
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit),
    ViolationEvent.countDocuments(filter),
  ]);

  return { violations, pagination: { total, page, limit, pages: Math.ceil(total / limit) } };
};

/**
 * Get a student's complete monitoring history.
 */
const getStudentHistory = async ({ studentId, institutionId }) => {
  const student = await Student.findOne({ _id: studentId, institutionId });
  if (!student) throw new AppError('Student not found.', 404);

  const enrollments = await ExamEnrollment.find({ studentId: student._id })
    .populate('examId', 'title examId scheduledDate durationMinutes status')
    .sort({ createdAt: -1 });

  const history = [];
  for (const enrollment of enrollments) {
    const session = await MonitoringSession.findOne({ examEnrollmentId: enrollment._id })
      .sort({ createdAt: -1 });

    const violationCount = session
      ? await ViolationEvent.countDocuments({ monitoringSessionId: session._id })
      : 0;

    history.push({
      enrollment: enrollment.toObject(),
      session: session ? session.toObject() : null,
      violationCount,
    });
  }

  return { student, history };
};

/**
 * Export exam data as CSV or JSON.
 */
const exportExamData = async ({ examId, institutionId, format = 'json' }) => {
  const exam = await Exam.findOne({ _id: examId, institutionId });
  if (!exam) throw new AppError('Exam not found.', 404);

  const enrollments = await ExamEnrollment.find({ examId: exam._id })
    .populate('studentId', 'fullName email registrationNumber department level');

  const enrollmentIds = enrollments.map((e) => e._id);

  const sessions = await MonitoringSession.find({
    examEnrollmentId: { $in: enrollmentIds },
  });

  const violations = await ViolationEvent.find({
    examEnrollmentId: { $in: enrollmentIds },
  }).sort({ timestamp: 1 });

  const sessionMap = {};
  sessions.forEach((s) => { sessionMap[s.examEnrollmentId.toString()] = s; });

  const rows = enrollments.map((enrollment) => {
    const student = enrollment.studentId;
    const session = sessionMap[enrollment._id.toString()];
    const studentViolations = violations.filter(
      (v) => v.examEnrollmentId.toString() === enrollment._id.toString()
    );

    return {
      studentName: student?.fullName || '',
      studentEmail: student?.email || '',
      registrationNumber: student?.registrationNumber || '',
      department: student?.department || '',
      level: student?.level || '',
      enrollmentStatus: enrollment.enrollmentStatus,
      verificationStatus: enrollment.verificationStatus,
      startedAt: enrollment.startedAt || '',
      submittedAt: enrollment.submittedAt || '',
      sessionDurationMinutes: session && session.startedAt && session.endedAt
        ? Math.round((new Date(session.endedAt) - new Date(session.startedAt)) / 60000)
        : '',
      totalViolations: session?.totalViolations || 0,
      tabSwitches: session?.violationSummary?.tabSwitches || 0,
      windowBlurs: session?.violationSummary?.windowBlurs || 0,
      faceAbsences: session?.violationSummary?.faceAbsences || 0,
      multipleFaces: session?.violationSummary?.multipleFaces || 0,
      attentionAway: session?.violationSummary?.attentionAway || 0,
    };
  });

  if (format === 'csv') {
    const { parse } = require('json2csv');
    const csvData = parse(rows);
    return { data: csvData, contentType: 'text/csv', filename: `exam-${exam.examId}-report.csv` };
  }

  return {
    data: JSON.stringify({ exam: exam.toObject(), students: rows }, null, 2),
    contentType: 'application/json',
    filename: `exam-${exam.examId}-report.json`,
  };
};

module.exports = {
  getExamSummary,
  getExamViolations,
  getStudentHistory,
  exportExamData,
};
