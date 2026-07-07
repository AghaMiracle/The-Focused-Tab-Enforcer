const institutionService = require('../services/institutionService');
const asyncHandler = require('../utils/asyncHandler');

/**
 * GET /api/institution/profile
 */
const getProfile = asyncHandler(async (req, res) => {
  const institution = await institutionService.getProfile(req.institutionId);
  res.json({ status: 'success', data: { institution } });
});

/**
 * PUT /api/institution/profile
 */
const updateProfile = asyncHandler(async (req, res) => {
  const institution = await institutionService.updateProfile(req.institutionId, req.body);
  res.json({ status: 'success', data: { institution } });
});

/**
 * GET /api/institution/stats
 */
const getStats = asyncHandler(async (req, res) => {
  const stats = await institutionService.getDashboardStats(req.institutionId);
  res.json({ status: 'success', data: stats });
});

/**
 * POST /api/institution/regenerate-api-key
 */
const regenerateApiKey = asyncHandler(async (req, res) => {
  const apiKey = await institutionService.regenerateApiKey(req.institutionId);
  res.json({ status: 'success', data: { apiKey } });
});

module.exports = { getProfile, updateProfile, getStats, regenerateApiKey };
