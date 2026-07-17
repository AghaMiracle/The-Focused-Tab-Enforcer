const Exam = require('../models/Exam');
const Student = require('../models/Student');
const ExamEnrollment = require('../models/ExamEnrollment');
const MonitoringSession = require('../models/MonitoringSession');
const ViolationEvent = require('../models/ViolationEvent');
const RealtimeAlert = require('../models/RealtimeAlert');
const Admin = require('../models/Admin');
const AppError = require('../utils/AppError');
const { generateSessionToken } = require('../utils/tokenUtils');
const { sendHighSeverityAlertEmail } = require('../utils/emailService');
const logger = require('../utils/logger');

let _io = null;

/**
 * Inject Socket.io instance for real-time events.
 */
const setSocketIo = (io) => { _io = io; };

/**
 * Verify student identity before starting an exam session.
 * Called by the browser extension.
 * Uses the student's permanent examId (e.g. UOLXA7B2K9) to identify them.
 * The exam must be active OR scheduled for the student to join.
 */
const verifyStudent = async ({ examId, email, registrationNumber }) => {
  // 1. Find the student by their permanent exam ID
  const student = await Student.findOne({
    examId: examId.toUpperCase(),
  });

  if (!student) {
    throw new AppError('Student not found. Check your Exam ID.', 404);
  }

  // 2. Find the student's enrollment in an active or scheduled exam
  const enrollment = await ExamEnrollment.findOne({
    studentId: student._id,
    enrollmentStatus: { $in: ['enrolled', 'in_progress'] },
  }).populate('examId');

  if (!enrollment || !enrollment.examId) {
    throw new AppError('You are not enrolled in any upcoming exam.', 403);
  }

  const exam = enrollment.examId;

  // Allow active or scheduled exams
  if (!['active', 'scheduled'].includes(exam.status)) {
    throw new AppError(`Exam "${exam.title}" is not currently available (status: ${exam.status}).`, 403);
  }

  // 3. Verify email and registration number match
  if (student.email !== email.toLowerCase() || student.registrationNumber !== registrationNumber.toUpperCase()) {
    throw new AppError('Email or registration number does not match.', 403);
  }

  if (enrollment.enrollmentStatus === 'disqualified') {
    throw new AppError('You have been disqualified from this exam.', 403);
  }

  if (['completed', 'absent'].includes(enrollment.enrollmentStatus)) {
    throw new AppError(`Your exam status is '${enrollment.enrollmentStatus}'.`, 403);
  }

  // 4. Check for existing active session (resume support)
  const existingSession = await MonitoringSession.findOne({
    examEnrollmentId: enrollment._id,
    status: 'active',
  });

  if (existingSession) {
    return {
      sessionToken: existingSession.sessionToken,
      sessionId: existingSession._id,
      isResuming: true,
      examDetails: {
        title: exam.title,
        examId: exam.examId,
        durationMinutes: exam.durationMinutes,
        allowedDomains: exam.allowedDomains,
      },
      monitoringConfig: exam.violationThresholds,
      studentName: student.fullName,
    };
  }

  // 5. Generate session token
  const sessionToken = generateSessionToken({
    enrollmentId: enrollment._id,
    studentId: student._id,
    examId: exam._id,
    institutionId: exam.institutionId,
    type: 'session',
  });

  // 6. Update verification status
  enrollment.verificationStatus = 'verified';
  enrollment.verificationDetails = {
    faceMatched: false,
    confidenceScore: 0,
    verifiedAt: new Date(),
  };
  await enrollment.save();

  // 7. Auto-create monitoring session (so extension can start sending heartbeats/violations immediately)
  const newSession = await MonitoringSession.create({
    examEnrollmentId: enrollment._id,
    sessionToken,
    startedAt: new Date(),
    status: 'active',
    lastHeartbeatAt: new Date(),
  });

  // Mark enrollment as in_progress
  enrollment.enrollmentStatus = 'in_progress';
  enrollment.startedAt = new Date();
  await enrollment.save();

  // Emit socket event so admins see the session appear live
  if (_io) {
    _io.of('/admin-dashboard').to(`institution:${exam.institutionId}`).emit('server:session-started', {
      sessionId: newSession._id,
      enrollmentId: enrollment._id,
      studentName: student.fullName,
      examTitle: exam.title,
      examId: exam.examId,
      timestamp: new Date(),
    });
  }

  return {
    sessionToken,
    sessionId: newSession._id,
    enrollmentId: enrollment._id,
    isResuming: false,
    examDetails: {
      title: exam.title,
      examId: exam.examId,
      durationMinutes: exam.durationMinutes,
      allowedDomains: exam.allowedDomains,
    },
    monitoringConfig: exam.violationThresholds,
    studentName: student.fullName,
  };
};

/**
 * Start a monitoring session after verification.
 */
const startSession = async ({ sessionToken }) => {
  const jwt = require('jsonwebtoken');
  let decoded;
  try {
    decoded = jwt.verify(sessionToken, process.env.JWT_SECRET);
  } catch {
    throw new AppError('Invalid or expired session token.', 401);
  }

  const enrollment = await ExamEnrollment.findById(decoded.enrollmentId);
  if (!enrollment) throw new AppError('Enrollment not found.', 404);

  // Prevent duplicate sessions
  const existing = await MonitoringSession.findOne({
    examEnrollmentId: enrollment._id,
    status: { $in: ['active', 'paused'] },
  });
  if (existing) return existing;

  const session = await MonitoringSession.create({
    examEnrollmentId: enrollment._id,
    sessionToken,
    startedAt: new Date(),
    status: 'active',
    lastHeartbeatAt: new Date(),
  });

  enrollment.enrollmentStatus = 'in_progress';
  enrollment.startedAt = new Date();
  await enrollment.save();

  // Emit socket event
  if (_io) {
    const exam = await Exam.findById(decoded.examId);
    const student = await Student.findById(decoded.studentId);
    _io.of('/admin-dashboard').to(`institution:${decoded.institutionId}`).emit('server:session-started', {
      sessionId: session._id,
      enrollmentId: enrollment._id,
      studentName: student?.fullName,
      examTitle: exam?.title,
      examId: exam?.examId,
      timestamp: new Date(),
    });
  }

  return session;
};

/**
 * Process a heartbeat from the extension.
 */
const processHeartbeat = async ({ sessionId, sessionToken, currentStatus, faceDetected, violationCount }) => {
  const session = await MonitoringSession.findById(sessionId);
  if (!session) throw new AppError('Session not found.', 404);

  if (session.sessionToken !== sessionToken) {
    throw new AppError('Session token mismatch.', 401);
  }

  if (!['active', 'paused'].includes(session.status)) {
    throw new AppError(`Session is not active (status: ${session.status}).`, 400);
  }

  session.lastHeartbeatAt = new Date();
  if (currentStatus === 'paused') session.status = 'paused';
  else session.status = 'active';

  await session.save();

  return { status: session.status, lastHeartbeatAt: session.lastHeartbeatAt };
};

/**
 * Record a violation event from the extension.
 */
const recordViolation = async ({ sessionId, sessionToken, eventType, severity, timestamp, duration, metadata }) => {
  const session = await MonitoringSession.findById(sessionId)
    .populate({
      path: 'examEnrollmentId',
      populate: { path: 'examId studentId' },
    });

  if (!session) throw new AppError('Session not found.', 404);
  if (session.sessionToken !== sessionToken) throw new AppError('Token mismatch.', 401);
  if (session.status !== 'active') throw new AppError('Session is not active.', 400);

  const enrollment = session.examEnrollmentId;
  const exam = enrollment.examId;
  const student = enrollment.studentId;

  // Create violation record
  const violation = await ViolationEvent.create({
    monitoringSessionId: session._id,
    examEnrollmentId: enrollment._id,
    eventType,
    severity,
    timestamp: timestamp ? new Date(timestamp) : new Date(),
    duration: duration || 0,
    metadata: metadata || {},
  });

  // Update session counters
  session.totalViolations += 1;
  const typeMap = {
    tab_switch: 'tabSwitches',
    window_blur: 'windowBlurs',
    face_absence: 'faceAbsences',
    multiple_faces: 'multipleFaces',
    attention_away: 'attentionAway',
  };
  const field = typeMap[eventType];
  if (field) session.violationSummary[field] = (session.violationSummary[field] || 0) + 1;
  await session.save();

  // Check thresholds and create alert if exceeded
  const thresholds = exam?.violationThresholds || {};
  let thresholdExceeded = false;

  if (eventType === 'tab_switch' && thresholds.tabSwitchSeconds && duration >= thresholds.tabSwitchSeconds) {
    thresholdExceeded = true;
  }
  if (eventType === 'face_absence' && thresholds.faceAbsenceFrames && duration >= thresholds.faceAbsenceFrames) {
    thresholdExceeded = true;
  }
  if (eventType === 'multiple_faces' && thresholds.multipleFaceTolerance) {
    thresholdExceeded = metadata?.faceCount > thresholds.multipleFaceTolerance;
  }
  if (eventType === 'attention_away' && thresholds.attentionAwaySeconds && duration >= thresholds.attentionAwaySeconds) {
    thresholdExceeded = true;
  }

  const alertSeverity = severity === 'high' || thresholdExceeded ? 'high' : severity;
  const message = `${student?.fullName || 'Unknown student'} — ${eventType.replace(/_/g, ' ')} detected`;

  const alert = await RealtimeAlert.create({
    institutionId: exam.institutionId,
    examId: exam._id,
    enrollmentId: enrollment._id,
    alertType: eventType,
    message,
    severity: alertSeverity,
  });

  // Emit socket event
  if (_io) {
    _io.of('/admin-dashboard').to(`institution:${exam.institutionId}`).emit('server:violation-alert', {
      alertId: alert._id,
      enrollmentId: enrollment._id,
      sessionId: session._id,
      studentName: student?.fullName,
      examName: exam?.title,
      violationType: eventType,
      severity: alertSeverity,
      timestamp: violation.timestamp,
      message,
      thresholdExceeded,
    });
  }

  // Send email for high-severity violations
  if (alertSeverity === 'high') {
    const admins = await Admin.find({
      institutionId: exam.institutionId,
      role: { $in: ['super_admin', 'admin'] },
      isActive: true,
    }).select('email fullName').limit(5);

    for (const admin of admins) {
      sendHighSeverityAlertEmail({
        adminEmail: admin.email,
        adminName: admin.fullName,
        studentName: student?.fullName || 'Unknown',
        examTitle: exam?.title || 'Unknown Exam',
        violationType: eventType,
        severity: alertSeverity,
        timestamp: violation.timestamp,
        message,
      }).catch(() => {});
    }
  }

  return { violation, alert };
};

/**
 * End a monitoring session.
 */
const endSession = async ({ sessionId, sessionToken, endReason }) => {
  const session = await MonitoringSession.findById(sessionId);
  if (!session) throw new AppError('Session not found.', 404);
  if (session.sessionToken !== sessionToken) throw new AppError('Token mismatch.', 401);

  session.status = endReason === 'terminated' ? 'terminated' : 'completed';
  session.endedAt = new Date();
  session.endReason = endReason || 'completed';
  await session.save();

  const enrollment = await ExamEnrollment.findById(session.examEnrollmentId)
    .populate('examId studentId');

  if (enrollment) {
    enrollment.enrollmentStatus = endReason === 'terminated' ? 'disqualified' : 'completed';
    enrollment.submittedAt = new Date();
    await enrollment.save();

    if (_io) {
      const exam = enrollment.examId;
      const student = enrollment.studentId;
      _io.of('/admin-dashboard').to(`institution:${exam?.institutionId}`).emit('server:session-ended', {
        sessionId: session._id,
        enrollmentId: enrollment._id,
        studentName: student?.fullName,
        examTitle: exam?.title,
        endReason,
        totalViolations: session.totalViolations,
        timestamp: new Date(),
      });
    }
  }

  return session;
};

/**
 * Get full session report with violation timeline.
 */
const getSessionReport = async ({ sessionId, institutionId }) => {
  const session = await MonitoringSession.findById(sessionId)
    .populate({
      path: 'examEnrollmentId',
      populate: [
        { path: 'examId', select: 'title examId scheduledDate durationMinutes institutionId' },
        { path: 'studentId', select: 'fullName email registrationNumber department' },
      ],
    });

  if (!session) throw new AppError('Session not found.', 404);

  const exam = session.examEnrollmentId?.examId;
  if (exam?.institutionId?.toString() !== institutionId.toString()) {
    throw new AppError('Access denied.', 403);
  }

  const violations = await ViolationEvent.find({ monitoringSessionId: session._id })
    .sort({ timestamp: 1 });

  return { session, violations };
};

/**
 * Get all active sessions for an institution.
 */
const getLiveSessions = async ({ institutionId }) => {
  const Exam = require('../models/Exam');
  const activeExams = await Exam.find({ institutionId, status: 'active' });
  const examIds = activeExams.map((e) => e._id);

  const enrollments = await ExamEnrollment.find({
    examId: { $in: examIds },
    enrollmentStatus: 'in_progress',
  });
  const enrollmentIds = enrollments.map((e) => e._id);

  const sessions = await MonitoringSession.find({
    examEnrollmentId: { $in: enrollmentIds },
    status: 'active',
  }).populate({
    path: 'examEnrollmentId',
    populate: [
      { path: 'studentId', select: 'fullName email registrationNumber' },
      { path: 'examId', select: 'title examId' },
    ],
  });

  return sessions;
};

/**
 * Get violation timeline for a session.
 */
const getSessionTimeline = async ({ sessionId, institutionId }) => {
  const session = await MonitoringSession.findById(sessionId).populate({
    path: 'examEnrollmentId',
    populate: { path: 'examId', select: 'institutionId' },
  });

  if (!session) throw new AppError('Session not found.', 404);
  const exam = session.examEnrollmentId?.examId;
  if (exam?.institutionId?.toString() !== institutionId.toString()) {
    throw new AppError('Access denied.', 403);
  }

  const violations = await ViolationEvent.find({ monitoringSessionId: session._id })
    .sort({ timestamp: 1 })
    .select('eventType severity timestamp duration metadata');

  return violations;
};

module.exports = {
  setSocketIo,
  verifyStudent,
  startSession,
  processHeartbeat,
  recordViolation,
  endSession,
  getSessionReport,
  getLiveSessions,
  getSessionTimeline,
};
