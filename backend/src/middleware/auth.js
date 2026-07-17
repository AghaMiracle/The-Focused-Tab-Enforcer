const jwt = require('jsonwebtoken');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const Institution = require('../models/Institution');
const Admin = require('../models/Admin');

/**
 * Verify JWT and attach the decoded user to req.user.
 * Supports both institution and admin tokens.
 */
const protect = asyncHandler(async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return next(new AppError('Access denied. No token provided.', 401));
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new AppError('Token expired. Please log in again.', 401));
    }
    return next(new AppError('Invalid token.', 401));
  }

  // Fetch the actual user based on token type
  if (decoded.type === 'institution') {
    const institution = await Institution.findById(decoded.id).select('+isActive');
    if (!institution || !institution.isActive) {
      return next(new AppError('Institution not found or deactivated.', 401));
    }
    req.user = institution;
    req.userType = 'institution';
    req.institutionId = institution._id;
  } else if (decoded.type === 'admin') {
    const admin = await Admin.findById(decoded.id);
    if (!admin || !admin.isActive) {
      return next(new AppError('Admin not found or deactivated.', 401));
    }
    req.user = admin;
    req.userType = 'admin';
    req.institutionId = admin.institutionId;
  } else {
    return next(new AppError('Invalid token type.', 401));
  }

  next();
});

/**
 * Restrict to institution-type tokens only.
 */
const institutionOnly = (req, res, next) => {
  if (req.userType !== 'institution') {
    return next(new AppError('This action requires institution credentials.', 403));
  }
  next();
};

/**
 * Restrict to admin-type tokens only.
 */
const adminOnly = (req, res, next) => {
  if (req.userType !== 'admin') {
    return next(new AppError('This action requires admin credentials.', 403));
  }
  next();
};

/**
 * Restrict to specific admin roles.
 * Institution-type tokens (which have no role) are allowed through automatically,
 * since they own all the data. Admin tokens are checked against the allowed roles.
 * @param  {...string} roles - Allowed admin roles
 */
const restrictTo = (...roles) => (req, res, next) => {
  // Institution accounts (token type = 'institution') bypass role checks
  if (req.userType === 'institution') return next();

  if (!roles.includes(req.user.role)) {
    return next(
      new AppError(`Role '${req.user.role}' is not authorized for this action.`, 403)
    );
  }
  next();
};

/**
 * Resolve institution context from the exam ID in the request body.
 * Used for extension routes where the exam ID is the link to the institution.
 * No API key required — the exam ID implicitly identifies the institution.
 */
const resolveInstitutionFromExam = asyncHandler(async (req, res, next) => {
  // For verify — examId is in body
  // For heartbeat/log — sessionToken contains examId (decoded in controller)
  // Let the request through; controllers handle institution resolution.
  next();
});

module.exports = { protect, institutionOnly, adminOnly, restrictTo, resolveInstitutionFromExam };
