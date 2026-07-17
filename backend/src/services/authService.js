const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const Institution = require('../models/Institution');
const Admin = require('../models/Admin');
const AppError = require('../utils/AppError');
const { generateResetToken, hashToken } = require('../utils/tokenUtils');
const { sendWelcomeEmail, sendPasswordResetEmail } = require('../utils/emailService');
const logger = require('../utils/logger');

/**
 * Register a new institution.
 */
const registerInstitution = async ({ name, email, password, address, contactPhone, website }) => {
  const existing = await Institution.findOne({ email });
  if (existing) throw new AppError('An institution with this email already exists.', 409);

  const institution = await Institution.create({
    name,
    email,
    password,
    address,
    contactPhone,
    website,
  });

  // Fire-and-forget welcome email
  sendWelcomeEmail(institution).catch(() => {});

  const accessToken = institution.generateAuthToken();
  const refreshToken = institution.generateRefreshToken();

  // Store hashed refresh token
  institution.refreshTokens = [hashToken(refreshToken)];
  await institution.save({ validateBeforeSave: false });

  return { institution, accessToken, refreshToken };
};

/**
 * Institution login.
 */
const loginInstitution = async ({ email, password }) => {
  const institution = await Institution.findOne({ email }).select('+password +refreshTokens');
  if (!institution || !(await institution.comparePassword(password))) {
    throw new AppError('Invalid email or password.', 401);
  }

  if (!institution.isActive) {
    throw new AppError('This institution account has been deactivated.', 403);
  }

  const accessToken = institution.generateAuthToken();
  const refreshToken = institution.generateRefreshToken();

  // Keep only last 5 refresh tokens (sliding window)
  const hashed = hashToken(refreshToken);
  institution.refreshTokens = [...(institution.refreshTokens || []).slice(-4), hashed];
  await institution.save({ validateBeforeSave: false });

  return { institution, accessToken, refreshToken };
};

/**
 * Admin login.
 */
const loginAdmin = async ({ email, password, institutionId }) => {
  const query = institutionId ? { email, institutionId } : { email };
  const admin = await Admin.findOne(query).select('+password +refreshTokens');
  if (!admin || !(await admin.comparePassword(password))) {
    throw new AppError('Invalid email or password.', 401);
  }

  if (!admin.isActive) {
    throw new AppError('This admin account has been deactivated.', 403);
  }

  admin.lastLogin = new Date();
  const accessToken = admin.generateAuthToken();
  const refreshToken = admin.generateRefreshToken();

  const hashed = hashToken(refreshToken);
  admin.refreshTokens = [...(admin.refreshTokens || []).slice(-4), hashed];
  await admin.save({ validateBeforeSave: false });

  return { admin, accessToken, refreshToken };
};

/**
 * Refresh access token using a valid refresh token.
 */
const refreshToken = async (token) => {
  if (!token) throw new AppError('Refresh token is required.', 401);

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
  } catch {
    throw new AppError('Invalid or expired refresh token.', 401);
  }

  const hashed = hashToken(token);

  if (decoded.type === 'institution') {
    const institution = await Institution.findById(decoded.id).select('+refreshTokens');
    if (!institution || !institution.refreshTokens.includes(hashed)) {
      throw new AppError('Refresh token not recognized. Please log in again.', 401);
    }

    const newAccessToken = institution.generateAuthToken();
    const newRefreshToken = institution.generateRefreshToken();
    const newHashed = hashToken(newRefreshToken);

    // Rotate: remove old, add new
    institution.refreshTokens = [
      ...institution.refreshTokens.filter((t) => t !== hashed),
      newHashed,
    ];
    await institution.save({ validateBeforeSave: false });

    return { accessToken: newAccessToken, refreshToken: newRefreshToken, userType: 'institution' };
  }

  if (decoded.type === 'admin') {
    const admin = await Admin.findById(decoded.id).select('+refreshTokens');
    if (!admin || !admin.refreshTokens.includes(hashed)) {
      throw new AppError('Refresh token not recognized. Please log in again.', 401);
    }

    const newAccessToken = admin.generateAuthToken();
    const newRefreshToken = admin.generateRefreshToken();
    const newHashed = hashToken(newRefreshToken);

    admin.refreshTokens = [
      ...admin.refreshTokens.filter((t) => t !== hashed),
      newHashed,
    ];
    await admin.save({ validateBeforeSave: false });

    return { accessToken: newAccessToken, refreshToken: newRefreshToken, userType: 'admin' };
  }

  throw new AppError('Invalid token type.', 401);
};

/**
 * Invalidate refresh token on logout.
 */
const logout = async ({ userId, userType, token }) => {
  if (!token) return;
  const hashed = hashToken(token);

  if (userType === 'institution') {
    await Institution.findByIdAndUpdate(userId, {
      $pull: { refreshTokens: hashed },
    });
  } else if (userType === 'admin') {
    await Admin.findByIdAndUpdate(userId, {
      $pull: { refreshTokens: hashed },
    });
  }
};

/**
 * Initiate password reset — generates token and sends email.
 */
const forgotPassword = async ({ email, userType = 'institution' }) => {
  let user;
  if (userType === 'institution') {
    user = await Institution.findOne({ email });
  } else {
    user = await Admin.findOne({ email });
  }

  // Always return success to prevent email enumeration
  if (!user) return;

  const { rawToken, hashedToken } = generateResetToken();
  user.passwordResetToken = hashedToken;
  user.passwordResetExpires = Date.now() + 60 * 60 * 1000; // 1 hour
  await user.save({ validateBeforeSave: false });

  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${rawToken}&type=${userType}`;
  await sendPasswordResetEmail({ email: user.email, resetUrl });

  logger.info(`Password reset email sent to ${email}`);
};

/**
 * Reset password with the provided token.
 */
const resetPassword = async ({ token, newPassword, userType = 'institution' }) => {
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

  let user;
  if (userType === 'institution') {
    user = await Institution.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    }).select('+passwordResetToken +passwordResetExpires');
  } else {
    user = await Admin.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    }).select('+passwordResetToken +passwordResetExpires');
  }

  if (!user) throw new AppError('Invalid or expired reset token.', 400);

  user.password = newPassword;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  user.refreshTokens = []; // Invalidate all sessions
  await user.save();

  return user;
};

module.exports = {
  registerInstitution,
  loginInstitution,
  loginAdmin,
  refreshToken,
  logout,
  forgotPassword,
  resetPassword,
};
