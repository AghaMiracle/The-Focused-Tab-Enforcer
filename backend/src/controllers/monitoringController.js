const monitoringService = require('../services/monitoringService');
const asyncHandler = require('../utils/asyncHandler');

/**
 * POST /api/sessions/authenticate
 * Step 1 of student login: verify credentials, return available exams.
 */
const authenticateStudent = asyncHandler(async (req, res) => {
  const { examId, email, registrationNumber } = req.body;
  const result = await monitoringService.authenticateStudent({ examId, email, registrationNumber });
  res.json({ status: 'success', data: result });
});

/**
 * POST /api/sessions/start-exam
 * Step 2 of student login: choose an exam and start the session.
 */
const startExamSession = asyncHandler(async (req, res) => {
  const { studentAuthToken, examId } = req.body;
  const result = await monitoringService.startExamSession({ studentAuthToken, examId });
  res.json({ status: 'success', data: result });
});

/**
 * POST /api/sessions/start
 */
const startSession = asyncHandler(async (req, res) => {
  const { sessionToken } = req.body;
  const session = await monitoringService.startSession({ sessionToken });
  res.status(201).json({ status: 'success', data: { session } });
});

/**
 * POST /api/sessions/:id/heartbeat
 */
const heartbeat = asyncHandler(async (req, res) => {
  const { sessionToken, currentStatus, faceDetected, violationCount } = req.body;
  const result = await monitoringService.processHeartbeat({
    sessionId: req.params.id,
    sessionToken,
    currentStatus,
    faceDetected,
    violationCount,
  });
  res.json({ status: 'success', data: result });
});

/**
 * POST /api/sessions/:id/violation
 */
const reportViolation = asyncHandler(async (req, res) => {
  const { sessionToken, eventType, severity, timestamp, duration, metadata } = req.body;
  const result = await monitoringService.recordViolation({
    sessionId: req.params.id,
    sessionToken,
    eventType,
    severity,
    timestamp,
    duration,
    metadata,
  });
  res.status(201).json({ status: 'success', data: { violationId: result.violation._id } });
});

/**
 * POST /api/sessions/:id/snapshot
 * Receive a webcam snapshot from the extension and forward via Socket.io.
 */
const uploadSnapshot = asyncHandler(async (req, res) => {
  const { sessionToken, snapshot, capturedAt } = req.body;
  const result = await monitoringService.forwardSnapshot({
    sessionId: req.params.id,
    sessionToken,
    snapshot,
    capturedAt,
  });
  res.json({ status: 'success', data: result });
});

/**
 * POST /api/sessions/:id/end
 */
const endSession = asyncHandler(async (req, res) => {
  const { sessionToken, endReason } = req.body;
  const session = await monitoringService.endSession({
    sessionId: req.params.id,
    sessionToken,
    endReason,
  });
  res.json({ status: 'success', data: { session } });
});

/**
 * GET /api/sessions/:id/report
 */
const getSessionReport = asyncHandler(async (req, res) => {
  const result = await monitoringService.getSessionReport({
    sessionId: req.params.id,
    institutionId: req.institutionId,
  });
  res.json({ status: 'success', data: result });
});

/**
 * GET /api/sessions/live
 */
const getLiveSessions = asyncHandler(async (req, res) => {
  const sessions = await monitoringService.getLiveSessions({ institutionId: req.institutionId });
  res.json({ status: 'success', data: { sessions, count: sessions.length } });
});

/**
 * GET /api/sessions/:id/timeline
 */
const getSessionTimeline = asyncHandler(async (req, res) => {
  const timeline = await monitoringService.getSessionTimeline({
    sessionId: req.params.id,
    institutionId: req.institutionId,
  });
  res.json({ status: 'success', data: { timeline } });
});

module.exports = {
  authenticateStudent,
  startExamSession,
  startSession,
  heartbeat,
  reportViolation,
  uploadSnapshot,
  endSession,
  getSessionReport,
  getLiveSessions,
  getSessionTimeline,
};
