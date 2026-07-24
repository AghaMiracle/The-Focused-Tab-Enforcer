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
 * Step 1: Authenticate student and return their available exams.
 * The student does NOT need to be pre-enrolled — any active or scheduled
 * exam from their institution is available for selection.
 */
const authenticateStudent = async ({ examId, email, registrationNumber }) => {
  if (!examId || !email || !registrationNumber) {
    throw new AppError('Exam ID, email, and registration number are required.', 400);
  }

  const student = await Student.findOne({ examId: examId.toUpperCase() });
  if (!student) {
    throw new AppError('Invalid credentials. Check your Exam ID.', 404);
  }

  if (student.email !== email.toLowerCase().trim()) {
    throw new AppError('Invalid credentials. Email does not match.', 403);
  }
  if (student.registrationNumber !== registrationNumber.toUpperCase().trim()) {
    throw new AppError('Invalid credentials. Registration number does not match.', 403);
  }

  // Fetch available exams (not completed or cancelled) for the student's institution
  const availableExams = await Exam.find({
    institutionId: student.institutionId,
    status: { $in: ['draft', 'scheduled', 'active'] },
  })
    .select('_id examId title description scheduledDate durationMinutes status')
    .sort({ status: 1, scheduledDate: 1 })
    .lean();

  // Student auth token — valid for 12 hours so students don't have to
  // re-login during long exam sessions.
  const jwt = require('jsonwebtoken');
  const studentAuthToken = jwt.sign(
    {
      studentId: student._id,
      institutionId: student.institutionId,
      type: 'student-auth',
    },
    process.env.JWT_SECRET,
    { expiresIn: '12h' }
  );

  return {
    studentAuthToken,
    studentName: student.fullName,
    studentEmail: student.email,
    availableExams,
  };
};

/**
 * Step 2: Start an exam session for a specific exam.
 * The student uses their studentAuthToken to pick an exam.
 * Auto-creates an enrollment if one doesn't exist.
 */
const startExamSession = async ({ studentAuthToken, examId }) => {
  const jwt = require('jsonwebtoken');
  let decoded;
  try {
    decoded = jwt.verify(studentAuthToken, process.env.JWT_SECRET);
  } catch {
    throw new AppError('Session expired. Please log in again.', 401);
  }
  if (decoded.type !== 'student-auth') {
    throw new AppError('Invalid token type.', 401);
  }

  const student = await Student.findById(decoded.studentId);
  if (!student) throw new AppError('Student not found.', 404);

  const exam = await Exam.findOne({ _id: examId, institutionId: decoded.institutionId });
  if (!exam) throw new AppError('Exam not found.', 404);

  if (!['draft', 'scheduled', 'active'].includes(exam.status)) {
    throw new AppError(`Exam "${exam.title}" is not available (status: ${exam.status}).`, 403);
  }

  // Auto-enroll if not already enrolled
  let enrollment = await ExamEnrollment.findOne({ examId: exam._id, studentId: student._id });
  if (!enrollment) {
    enrollment = await ExamEnrollment.create({
      examId: exam._id,
      studentId: student._id,
    });
  }

  if (enrollment.enrollmentStatus === 'disqualified') {
    throw new AppError('You have been disqualified from this exam.', 403);
  }
  if (['completed', 'absent'].includes(enrollment.enrollmentStatus)) {
    throw new AppError(`Your exam status is '${enrollment.enrollmentStatus}'.`, 403);
  }

  // Resume support: return existing active session if one exists
  const existingSession = await MonitoringSession.findOne({
    examEnrollmentId: enrollment._id,
    status: 'active',
  });
  if (existingSession) {
    return {
      sessionToken: existingSession.sessionToken,
      sessionId: existingSession._id,
      enrollmentId: enrollment._id,
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

  // Generate session token
  const sessionToken = generateSessionToken({
    enrollmentId: enrollment._id,
    studentId: student._id,
    examId: exam._id,
    institutionId: exam.institutionId,
    type: 'session',
  });

  // Mark enrollment as in_progress + verified
  enrollment.verificationStatus = 'verified';
  enrollment.verificationDetails = {
    faceMatched: false,
    confidenceScore: 0,
    verifiedAt: new Date(),
  };
  enrollment.enrollmentStatus = 'in_progress';
  enrollment.startedAt = new Date();
  await enrollment.save();

  // Create monitoring session
  const session = await MonitoringSession.create({
    examEnrollmentId: enrollment._id,
    sessionToken,
    startedAt: new Date(),
    status: 'active',
    lastHeartbeatAt: new Date(),
  });

  // Emit socket event
  if (_io) {
    _io.of('/admin-dashboard').to(`institution:${exam.institutionId}`).emit('server:session-started', {
      sessionId: session._id,
      enrollmentId: enrollment._id,
      studentName: student.fullName,
      examTitle: exam.title,
      examId: exam.examId,
      timestamp: new Date(),
    });
  }

  return {
    sessionToken,
    sessionId: session._id,
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
 * Returns the current server-side status so the extension can react to
 * admin-terminated / completed states without a special error path.
 */
const processHeartbeat = async ({ sessionId, sessionToken, currentStatus, faceDetected, violationCount }) => {
  const session = await MonitoringSession.findById(sessionId);
  if (!session) throw new AppError('Session not found.', 404);

  if (session.sessionToken !== sessionToken) {
    throw new AppError('Session token mismatch.', 401);
  }

  // If the admin (or a cron job) already ended/terminated the session,
  // don't error — return the current status so the extension can gracefully
  // end monitoring on its side.
  if (['terminated', 'completed'].includes(session.status)) {
    return {
      status: session.status,
      endedAt: session.endedAt,
      endReason: session.endReason,
      lastHeartbeatAt: session.lastHeartbeatAt,
    };
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
    app_switch: 'windowBlurs', // app-switch is a stronger form of window blur
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
 * Get all active monitoring sessions for an institution.
 * Includes sessions on both `scheduled` and `active` exams — a session is
 * "live" whenever a student is actively being monitored, regardless of the
 * exam's admin-facing status.
 */
const getLiveSessions = async ({ institutionId }) => {
  // All non-terminal exams for this institution
  const examIds = await Exam.distinct('_id', {
    institutionId,
    status: { $in: ['draft', 'scheduled', 'active'] },
  });

  // Find monitoring sessions that are currently active for these exams
  const enrollmentIds = await ExamEnrollment.distinct('_id', {
    examId: { $in: examIds },
  });

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

/**
 * Forward a webcam snapshot from the extension to admin dashboards
 * via Socket.io. Snapshots are ephemeral (not persisted to DB).
 */
const forwardSnapshot = async ({ sessionId, sessionToken, snapshot, capturedAt }) => {
  const session = await MonitoringSession.findById(sessionId)
    .populate({
      path: 'examEnrollmentId',
      populate: [
        { path: 'examId', select: 'title examId institutionId' },
        { path: 'studentId', select: 'fullName email' },
      ],
    });

  if (!session) throw new AppError('Session not found.', 404);
  if (session.sessionToken !== sessionToken) throw new AppError('Token mismatch.', 401);
  if (session.status !== 'active') return { forwarded: false };

  const enrollment = session.examEnrollmentId;
  const exam = enrollment?.examId;
  const student = enrollment?.studentId;
  if (!exam || !student) return { forwarded: false };

  if (_io) {
    _io.of('/admin-dashboard').to(`institution:${exam.institutionId}`).emit('server:session-snapshot', {
      sessionId: session._id,
      studentName: student.fullName,
      examTitle: exam.title,
      snapshot,
      capturedAt: capturedAt || Date.now(),
    });
  }

  return { forwarded: true };
};

module.exports = {
  setSocketIo,
  authenticateStudent,
  startExamSession,
  startSession,
  processHeartbeat,
  recordViolation,
  endSession,
  forwardSnapshot,
  getSessionReport,
  getLiveSessions,
  getSessionTimeline,
};
