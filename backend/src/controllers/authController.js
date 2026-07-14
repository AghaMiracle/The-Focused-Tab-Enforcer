const authService = require('../services/authService');
const asyncHandler = require('../utils/asyncHandler');

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

/**
 * POST /api/auth/institution/register
 */
const registerInstitution = asyncHandler(async (req, res) => {
  const { name, email, password, address, contactPhone, website } = req.body;
  const result = await authService.registerInstitution({ name, email, password, address, contactPhone, website });

  res.cookie('refreshToken', result.refreshToken, REFRESH_COOKIE_OPTIONS);

  res.status(201).json({
    status: 'success',
    message: 'Institution registered successfully.',
    data: {
      institution: result.institution,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      apiKey: result.apiKey,
    },
  });
});

/**
 * POST /api/auth/institution/login
 */
const loginInstitution = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const result = await authService.loginInstitution({ email, password });

  res.cookie('refreshToken', result.refreshToken, REFRESH_COOKIE_OPTIONS);

  res.json({
    status: 'success',
    message: 'Logged in successfully.',
    data: {
      institution: result.institution,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    },
  });
});

/**
 * POST /api/auth/admin/login
 */
const loginAdmin = asyncHandler(async (req, res) => {
  const { email, password, institutionId } = req.body;
  const result = await authService.loginAdmin({ email, password, institutionId });

  res.cookie('refreshToken', result.refreshToken, REFRESH_COOKIE_OPTIONS);

  res.json({
    status: 'success',
    message: 'Logged in successfully.',
    data: {
      admin: result.admin,
      accessToken: result.accessToken,
    },
  });
});

/**
 * POST /api/auth/refresh
 */
const refreshToken = asyncHandler(async (req, res) => {
  const token = req.cookies?.refreshToken || req.body.refreshToken;
  const result = await authService.refreshToken(token);

  res.cookie('refreshToken', result.refreshToken, REFRESH_COOKIE_OPTIONS);

  res.json({
    status: 'success',
    data: {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      userType: result.userType,
    },
  });
});

/**
 * POST /api/auth/logout
 */
const logout = asyncHandler(async (req, res) => {
  const token = req.cookies?.refreshToken || req.body.refreshToken;
  await authService.logout({
    userId: req.user._id,
    userType: req.userType,
    token,
  });

  res.clearCookie('refreshToken');
  res.json({ status: 'success', message: 'Logged out successfully.' });
});

/**
 * POST /api/auth/forgot-password
 */
const forgotPassword = asyncHandler(async (req, res) => {
  const { email, userType } = req.body;
  await authService.forgotPassword({ email, userType });
  res.json({
    status: 'success',
    message: 'If that email exists in our system, a password reset link has been sent.',
  });
});

/**
 * POST /api/auth/reset-password
 */
const resetPassword = asyncHandler(async (req, res) => {
  const { token, newPassword, userType } = req.body;
  await authService.resetPassword({ token, newPassword, userType });
  res.json({ status: 'success', message: 'Password reset successfully. Please log in.' });
});

module.exports = {
  registerInstitution,
  loginInstitution,
  loginAdmin,
  refreshToken,
  logout,
  forgotPassword,
  resetPassword,
};
