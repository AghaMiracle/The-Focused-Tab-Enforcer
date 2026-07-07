const crypto = require('crypto');
const jwt = require('jsonwebtoken');

/**
 * Generate a secure random token for password reset.
 * @returns {{ rawToken: string, hashedToken: string }}
 */
const generateResetToken = () => {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
  return { rawToken, hashedToken };
};

/**
 * Hash a token for storage comparison.
 * @param {string} token
 * @returns {string}
 */
const hashToken = (token) =>
  crypto.createHash('sha256').update(token).digest('hex');

/**
 * Generate a session token for the monitoring session (extension auth).
 * This is a JWT with session-specific claims.
 * @param {Object} payload
 * @returns {string}
 */
const generateSessionToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: '12h', // Session tokens valid for up to 12 hours
  });
};

/**
 * Verify a session token.
 * @param {string} token
 * @returns {Object|null}
 */
const verifySessionToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return null;
  }
};

/**
 * Generate an API key for extension authentication.
 * @returns {string}
 */
const generateApiKey = () => {
  return `fte_${crypto.randomBytes(32).toString('hex')}`;
};

module.exports = {
  generateResetToken,
  hashToken,
  generateSessionToken,
  verifySessionToken,
  generateApiKey,
};
