const mongoose = require('mongoose');

const systemLogSchema = new mongoose.Schema(
  {
    level: {
      type: String,
      enum: ['info', 'warn', 'error'],
      required: true,
    },
    source: {
      type: String,
      enum: ['extension', 'backend', 'cron', 'system'],
      default: 'backend',
    },
    message: {
      type: String,
      required: true,
      maxlength: [2000, 'Message cannot exceed 2000 characters'],
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      // TTL index: auto-delete after 90 days
      expires: 60 * 60 * 24 * 90,
    },
  },
  {
    timestamps: false,
  }
);

systemLogSchema.index({ level: 1, timestamp: -1 });
systemLogSchema.index({ source: 1, timestamp: -1 });

module.exports = mongoose.model('SystemLog', systemLogSchema);
