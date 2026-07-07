const mongoose = require('mongoose');

const violationSummarySchema = new mongoose.Schema(
  {
    tabSwitches: { type: Number, default: 0 },
    windowBlurs: { type: Number, default: 0 },
    faceAbsences: { type: Number, default: 0 },
    multipleFaces: { type: Number, default: 0 },
    attentionAway: { type: Number, default: 0 },
  },
  { _id: false }
);

const monitoringSessionSchema = new mongoose.Schema(
  {
    examEnrollmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ExamEnrollment',
      required: [true, 'Enrollment ID is required'],
      index: true,
    },
    sessionToken: {
      type: String,
      required: [true, 'Session token is required'],
      unique: true,
      index: true,
    },
    startedAt: { type: Date, default: null },
    endedAt: { type: Date, default: null },
    lastHeartbeatAt: { type: Date, default: null },
    status: {
      type: String,
      enum: ['active', 'paused', 'completed', 'terminated'],
      default: 'active',
    },
    endReason: {
      type: String,
      enum: ['completed', 'terminated', 'student_left', 'timeout', 'admin_terminated', null],
      default: null,
    },
    totalViolations: { type: Number, default: 0 },
    violationSummary: {
      type: violationSummarySchema,
      default: () => ({}),
    },
  },
  {
    timestamps: true,
  }
);

monitoringSessionSchema.index({ examEnrollmentId: 1, status: 1 });

module.exports = mongoose.model('MonitoringSession', monitoringSessionSchema);
