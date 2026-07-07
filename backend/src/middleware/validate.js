const { validationResult } = require('express-validator');
const AppError = require('../utils/AppError');

/**
 * Run express-validator checks and return 422 if any fail.
 * Attach after an array of check() calls in the route definition.
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const messages = errors.array().map((e) => `${e.path || e.param}: ${e.msg}`).join('; ');
    return next(new AppError(messages, 422));
  }
  next();
};

module.exports = validate;
