const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const violationThresholdsSchema = new mongoose.Schema(
  {
    tabSwitchSeconds: { type: Number, default: 3 },
    faceAbsenceFrames: { type: Number, default: 30 },
    multipleFaceTolerance: { type: Number, default: 2 },
    attentionAwaySeconds: { type: Number, default: 5 },
  },
  { _id: false }
);

const examSchema = new mongoose.Schema(
  {
    institutionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Institution',
      required: [true, 'Institution ID is required'],
      index: true,
    },
    examId: {
      type: String,
      unique: true,
      default: () => `EXAM-${new Date().getFullYear()}-${uuidv4().slice(0, 6).toUpperCase()}`,
    },
    title: {
      type: String,
      required: [true, 'Exam title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
      default: '',
    },
    scheduledDate: {
      type: Date,
      required: [true, 'Scheduled date is required'],
    },
    durationMinutes: {
      type: Number,
      required: [true, 'Duration is required'],
      min: [1, 'Duration must be at least 1 minute'],
      max: [600, 'Duration cannot exceed 600 minutes'],
    },
    allowedDomains: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: ['draft', 'scheduled', 'active', 'completed', 'cancelled'],
      default: 'draft',
      index: true,
    },
    violationThresholds: {
      type: violationThresholdsSchema,
      default: () => ({}),
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      required: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    activatedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

examSchema.index({ institutionId: 1, status: 1 });
examSchema.index({ institutionId: 1, scheduledDate: 1 });
examSchema.index({ scheduledDate: 1 });

// Exclude soft-deleted by default
examSchema.pre(/^find/, function (next) {
  if (!this.getQuery().isDeleted) {
    this.where({ isDeleted: { $ne: true } });
  }
  next();
});

module.exports = mongoose.model('Exam', examSchema);
