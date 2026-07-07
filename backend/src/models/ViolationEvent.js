const mongoose = require('mongoose');

const metadataSchema = new mongoose.Schema(
  {
    tabUrl: { type: String, default: null },
    faceCount: { type: Number, default: null },
    confidenceScore: { type: Number, default: null },
  },
  { _id: false }
);

const violationEventSchema = new mongoose.Schema(
  {
    monitoringSessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MonitoringSession',
      required: [true, 'Monitoring session ID is required'],
      index: true,
    },
    examEnrollmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ExamEnrollment',
      required: [true, 'Enrollment ID is required'],
      index: true,
    },
    eventType: {
      type: String,
      enum: ['tab_switch', 'window_blur', 'face_absence', 'multiple_faces', 'attention_away'],
      required: [true, 'Event type is required'],
    },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high'],
      required: [true, 'Severity is required'],
    },
    timestamp: {
      type: Date,
      required: [true, 'Timestamp is required'],
      index: true,
    },
    duration: {
      type: Number,
      default: 0,
      comment: 'Seconds for tab/window blur, frame count for face events',
    },
    metadata: {
      type: metadataSchema,
      default: () => ({}),
    },
  },
  {
    timestamps: true,
  }
);

violationEventSchema.index({ monitoringSessionId: 1, timestamp: 1 });
violationEventSchema.index({ examEnrollmentId: 1, eventType: 1 });

module.exports = mongoose.model('ViolationEvent', violationEventSchema);
