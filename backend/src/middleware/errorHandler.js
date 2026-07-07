const AppError = require('../utils/AppError');
const logger = require('../utils/logger');

/**
 * Transform Mongoose CastError (invalid ObjectId) to a user-friendly error.
 */
const handleCastError = (err) =>
  new AppError(`Invalid ${err.path}: ${err.value}.`, 400);

/**
 * Transform Mongoose duplicate key error (code 11000) to a user-friendly error.
 */
const handleDuplicateKeyError = (err) => {
  const field = Object.keys(err.keyValue || {})[0] || 'field';
  const value = err.keyValue ? err.keyValue[field] : 'value';
  return new AppError(`Duplicate value for '${field}': "${value}". Please use a different value.`, 409);
};

/**
 * Transform Mongoose validation errors to a user-friendly error.
 */
const handleValidationError = (err) => {
  const messages = Object.values(err.errors).map((e) => e.message);
  return new AppError(`Validation failed: ${messages.join('. ')}`, 400);
};

/**
 * Transform JWT errors.
 */
const handleJWTError = () => new AppError('Invalid token. Please log in again.', 401);
const handleJWTExpiredError = () => new AppError('Token expired. Please log in again.', 401);

/**
 * Send detailed error info in development.
 */
const sendErrorDev = (err, res) => {
  res.status(err.statusCode).json({
    status: err.status,
    error: err,
    message: err.message,
    stack: err.stack,
  });
};

/**
 * Send minimal error info in production.
 */
const sendErrorProd = (err, res) => {
  if (err.isOperational) {
    // Trusted, expected errors — safe to expose to client
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
    });
  } else {
    // Programming or unknown errors — don't leak details
    logger.error('UNHANDLED ERROR:', err);
    res.status(500).json({
      status: 'error',
      message: 'Something went wrong. Please try again later.',
    });
  }
};

/**
 * Central error handling middleware.
 * Must be registered AFTER all routes.
 */
const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  if (process.env.NODE_ENV === 'development') {
    logger.error(`[${req.method}] ${req.originalUrl} — ${err.message}`, { stack: err.stack });
    sendErrorDev(err, res);
  } else {
    let error = Object.assign(Object.create(Object.getPrototypeOf(err)), err);

    if (error.name === 'CastError') error = handleCastError(error);
    if (error.code === 11000) error = handleDuplicateKeyError(error);
    if (error.name === 'ValidationError') error = handleValidationError(error);
    if (error.name === 'JsonWebTokenError') error = handleJWTError();
    if (error.name === 'TokenExpiredError') error = handleJWTExpiredError();

    sendErrorProd(error, res);
  }
};

module.exports = errorHandler;
