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

/**
 * GET /api/institution/settings
 */
const getSettings = asyncHandler(async (req, res) => {
  const settings = await institutionService.getSettings(req.institutionId);
  res.json({ status: 'success', data: { settings } });
});

/**
 * PUT /api/institution/settings
 */
const updateSettings = asyncHandler(async (req, res) => {
  const settings = await institutionService.updateSettings(req.institutionId, req.body);
  res.json({ status: 'success', data: { settings } });
});

/**
 * GET /api/institution/trend
 */
const getViolationTrend = asyncHandler(async (req, res) => {
  const trend = await institutionService.getViolationTrend(req.institutionId, req.query.date);
  res.json({ status: 'success', data: { trend } });
});

module.exports = { getProfile, updateProfile, getStats, regenerateApiKey, getSettings, updateSettings, getViolationTrend };
