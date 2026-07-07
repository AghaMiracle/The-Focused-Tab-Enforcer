const mongoose = require('mongoose');

const realtimeAlertSchema = new mongoose.Schema(
  {
    institutionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Institution',
      required: true,
      index: true,
    },
    examId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Exam',
      required: true,
      index: true,
    },
    enrollmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ExamEnrollment',
      required: true,
    },
    alertType: {
      type: String,
      required: true,
      enum: [
        'tab_switch',
        'window_blur',
        'face_absence',
        'multiple_faces',
        'attention_away',
        'threshold_exceeded',
        'session_terminated',
      ],
    },
    message: {
      type: String,
      required: true,
      maxlength: [500, 'Message cannot exceed 500 characters'],
    },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium',
    },
    isRead: { type: Boolean, default: false },
    isAcknowledged: { type: Boolean, default: false },
    acknowledgedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      default: null,
    },
    acknowledgedAt: { type: Date, default: null },
    createdAt: {
      type: Date,
      default: Date.now,
      // TTL index: auto-delete after 30 days
      expires: 60 * 60 * 24 * 30,
    },
  },
  {
    timestamps: false,
  }
);

realtimeAlertSchema.index({ institutionId: 1, isRead: 1 });
realtimeAlertSchema.index({ examId: 1, createdAt: -1 });

module.exports = mongoose.model('RealtimeAlert', realtimeAlertSchema);
