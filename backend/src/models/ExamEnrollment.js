const mongoose = require('mongoose');

const verificationDetailsSchema = new mongoose.Schema(
  {
    faceMatched: { type: Boolean, default: false },
    confidenceScore: { type: Number, default: 0 },
    verifiedAt: { type: Date, default: null },
  },
  { _id: false }
);

const examEnrollmentSchema = new mongoose.Schema(
  {
    examId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Exam',
      required: [true, 'Exam ID is required'],
      index: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: [true, 'Student ID is required'],
      index: true,
    },
    enrollmentStatus: {
      type: String,
      enum: ['enrolled', 'in_progress', 'completed', 'absent', 'disqualified'],
      default: 'enrolled',
    },
    verificationStatus: {
      type: String,
      enum: ['pending', 'verified', 'failed'],
      default: 'pending',
    },
    verificationDetails: {
      type: verificationDetailsSchema,
      default: () => ({}),
    },
    startedAt: { type: Date, default: null },
    submittedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  }
);

// A student can only be enrolled once per exam
examEnrollmentSchema.index({ examId: 1, studentId: 1 }, { unique: true });

module.exports = mongoose.model('ExamEnrollment', examEnrollmentSchema);
