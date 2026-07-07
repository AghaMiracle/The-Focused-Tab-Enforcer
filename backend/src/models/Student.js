const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema(
  {
    institutionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Institution',
      required: [true, 'Institution ID is required'],
      index: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    registrationNumber: {
      type: String,
      required: [true, 'Registration number is required'],
      trim: true,
      uppercase: true,
    },
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    department: {
      type: String,
      trim: true,
      default: null,
    },
    level: {
      type: String,
      trim: true,
      default: null,
    },
    faceDescriptor: {
      type: [Number],
      default: null,
      validate: {
        validator: function (arr) {
          return arr === null || arr.length === 0 || arr.length === 128;
        },
        message: 'Face descriptor must be a 128-element array',
      },
    },
    faceImageUrl: {
      type: String,
      default: null,
    },
    isEnrolled: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Email must be unique within an institution
studentSchema.index({ institutionId: 1, email: 1 }, { unique: true });
studentSchema.index({ institutionId: 1, registrationNumber: 1 }, { unique: true });
studentSchema.index({ institutionId: 1, fullName: 'text', email: 'text', registrationNumber: 'text' });

module.exports = mongoose.model('Student', studentSchema);
