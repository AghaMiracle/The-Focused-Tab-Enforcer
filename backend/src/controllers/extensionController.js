const Joi = require('joi');
const monitoringService = require('../services/monitoringService');
const SystemLog = require('../models/SystemLog');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');

// Joi schemas for extension API validation
const verifySchema = Joi.object({
  examId: Joi.string().required(),
  email: Joi.string().email().required(),
  registrationNumber: Joi.string().required(),
});

const heartbeatSchema = Joi.object({
  sessionToken: Joi.string().required(),
  sessionId: Joi.string().required(),
  currentStatus: Joi.string().valid('active', 'paused').required(),
  faceDetected: Joi.boolean().default(false),
  violationCount: Joi.number().integer().min(0).default(0),
  tabUrl: Joi.string().uri().optional(),
});

const violationSchema = Joi.object({
  sessionToken: Joi.string().required(),
  sessionId: Joi.string().required(),
  eventType: Joi.string()
    .valid('tab_switch', 'window_blur', 'app_switch', 'face_absence', 'multiple_faces', 'attention_away')
    .required(),
  severity: Joi.string().valid('low', 'medium', 'high').required(),
  timestamp: Joi.date().iso().required(),
  duration: Joi.number().min(0).default(0),
  metadata: Joi.object({
    tabUrl: Joi.string().optional(),
    faceCount: Joi.number().optional(),
    confidenceScore: Joi.number().optional(),
  }).optional(),
});

const joiValidate = (schema, body) => {
  const { error, value } = schema.validate(body, { abortEarly: false, stripUnknown: true });
  if (error) {
    const msg = error.details.map((d) => d.message).join('; ');
    throw new AppError(msg, 422);
  }
  return value;
};

/**
 * POST /api/ext/verify
 * Legacy endpoint — routes to the current authenticate flow.
 * Returns a student auth token + the exams available for that student's
 * institution. The extension should follow up with /api/sessions/start-exam.
 */
const verify = asyncHandler(async (req, res) => {
  const payload = joiValidate(verifySchema, req.body);
  const result = await monitoringService.authenticateStudent(payload);
  res.json({ status: 'success', data: result });
});

/**
 * POST /api/ext/config
 * Get monitoring configuration for an active session.
 */
const getConfig = asyncHandler(async (req, res) => {
  const { sessionToken } = req.body;
  if (!sessionToken) throw new AppError('sessionToken is required.', 400);

  const jwt = require('jsonwebtoken');
  let decoded;
  try {
    decoded = jwt.verify(sessionToken, process.env.JWT_SECRET);
  } catch {
    throw new AppError('Invalid or expired session token.', 401);
  }

  const Exam = require('../models/Exam');
  const exam = await Exam.findById(decoded.examId).select('violationThresholds allowedDomains durationMinutes title examId');
  if (!exam) throw new AppError('Exam not found.', 404);

  res.json({
    status: 'success',
    data: {
      config: exam.violationThresholds,
      allowedDomains: exam.allowedDomains,
      durationMinutes: exam.durationMinutes,
      examTitle: exam.title,
      examId: exam.examId,
    },
  });
});

/**
 * POST /api/ext/heartbeat
 * Extension heartbeat.
 */
const heartbeat = asyncHandler(async (req, res) => {
  const payload = joiValidate(heartbeatSchema, req.body);
  const result = await monitoringService.processHeartbeat({
    sessionId: payload.sessionId,
    sessionToken: payload.sessionToken,
    currentStatus: payload.currentStatus,
    faceDetected: payload.faceDetected,
    violationCount: payload.violationCount,
  });
  res.json({ status: 'success', data: result });
});

/**
 * POST /api/ext/log
 * Receive and store violation/event log from extension.
 */
const log = asyncHandler(async (req, res) => {
  const payload = joiValidate(violationSchema, req.body);
  const result = await monitoringService.recordViolation({
    sessionId: payload.sessionId,
    sessionToken: payload.sessionToken,
    eventType: payload.eventType,
    severity: payload.severity,
    timestamp: payload.timestamp,
    duration: payload.duration,
    metadata: payload.metadata,
  });

  // Also write to SystemLog for audit trail
  await SystemLog.create({
    level: payload.severity === 'high' ? 'warn' : 'info',
    source: 'extension',
    message: `Violation: ${payload.eventType} — severity: ${payload.severity}`,
    metadata: { sessionId: payload.sessionId, ...payload.metadata },
  });

  res.status(201).json({ status: 'success', data: { violationId: result.violation._id } });
});

module.exports = { verify, getConfig, heartbeat, log };
