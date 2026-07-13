const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const institutionSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Institution name is required'],
      trim: true,
      maxlength: [200, 'Name cannot exceed 200 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false,
    },
    logoUrl: {
      type: String,
      default: null,
    },
    address: {
      type: String,
      trim: true,
      default: null,
    },
    contactPhone: {
      type: String,
      trim: true,
      default: null,
    },
    website: {
      type: String,
      trim: true,
      default: null,
    },
    subscriptionTier: {
      type: String,
      enum: ['free', 'pro', 'enterprise'],
      default: 'free',
    },
    apiKey: {
      type: String,
      unique: true,
      sparse: true,
      select: false,
    },
    passwordResetToken: {
      type: String,
      select: false,
    },
    passwordResetExpires: {
      type: Date,
      select: false,
    },
    refreshTokens: {
      type: [String],
      select: false,
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    settings: {
      monitoringDefaults: {
        tabSwitchLimit: { type: Number, default: 3 },
        faceAbsenceFrames: { type: Number, default: 30 },
        multipleFaceTolerance: { type: Number, default: 0 },
        windowBlurSeconds: { type: Number, default: 10 },
        requireWebcam: { type: Boolean, default: true },
        screenshotOnViolation: { type: Boolean, default: false },
      },
      notifications: {
        emailOnViolation: { type: Boolean, default: true },
        emailOnSessionEnd: { type: Boolean, default: false },
        inAppAlerts: { type: Boolean, default: true },
        weeklyReport: { type: Boolean, default: true },
        notifyEmail: { type: String, default: null },
      },
      retention: {
        sessionDataDays: { type: Number, default: 90 },
        violationFrames: { type: Number, default: 30 },
        autoDelete: { type: Boolean, default: false },
      },
    },
  },
  {
    timestamps: true,
  }
);

// Hash password before saving
institutionSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;
  this.password = await bcrypt.hash(this.password, saltRounds);
  next();
});

// Compare password
institutionSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Generate access token
institutionSchema.methods.generateAuthToken = function () {
  return jwt.sign(
    { id: this._id, type: 'institution', email: this.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );
};

// Generate refresh token
institutionSchema.methods.generateRefreshToken = function () {
  return jwt.sign(
    { id: this._id, type: 'institution' },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );
};

// Remove sensitive fields from JSON output
institutionSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.passwordResetToken;
  delete obj.passwordResetExpires;
  delete obj.refreshTokens;
  delete obj.apiKey;
  return obj;
};

module.exports = mongoose.model('Institution', institutionSchema);
