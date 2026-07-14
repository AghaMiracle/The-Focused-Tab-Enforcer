/**
 * api.js
 * Backend communication module.
 * Handles all HTTP requests to the Focused Tab Enforcer API with
 * automatic retry, offline detection, and queue management.
 */

import { DEFAULT_SERVER_URL } from './constants.js';
import { getSettings } from './storage.js';
import { retryWithBackoff } from './helpers.js';

// ─── Core Fetch Wrapper ──────────────────────────────────────────────────────

/**
 * Make a request to the backend.
 * No API key required — students authenticate via exam credentials.
 * @param {string} endpoint - API path (e.g. '/api/sessions/verify')
 * @param {object} body - JSON body
 * @param {object} [options] - Override options
 * @returns {Promise<object>} Parsed JSON response
 */
export async function apiRequest(endpoint, body, options = {}) {
  const settings = await getSettings();
  const serverUrl = options.serverUrl || settings.serverUrl || DEFAULT_SERVER_URL;

  const url = `${serverUrl}${endpoint}`;

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: options.signal,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = data?.message || `HTTP ${response.status}: ${response.statusText}`;
    const error = new Error(message);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

// ─── API Methods ─────────────────────────────────────────────────────────────

/**
 * Verify student credentials and retrieve session token.
 * POST /api/sessions/verify
 *
 * @param {object} credentials
 * @param {string} credentials.examId
 * @param {string} credentials.email
 * @param {string} credentials.registrationNumber
 * @returns {Promise<{
 *   sessionToken: string,
 *   enrollmentId: string,
 *   isResuming: boolean,
 *   examDetails: object,
 *   monitoringConfig: object,
 *   studentName: string
 * }>}
 */
export async function verifyStudent(credentials) {
  const result = await apiRequest('/api/sessions/verify', credentials);
  return result.data;
}

/**
 * Send a heartbeat to keep the session alive.
 * POST /api/sessions/:id/heartbeat
 *
 * @param {object} payload
 * @returns {Promise<object>}
 */
export async function sendHeartbeat(payload) {
  const { sessionId, ...body } = payload;
  return retryWithBackoff(
    () => apiRequest(`/api/sessions/${sessionId}/heartbeat`, body),
    2,
    1000
  );
}

/**
 * Log a violation event to the backend.
 * POST /api/sessions/:id/violation
 *
 * @param {object} violation
 * @returns {Promise<object>}
 */
export async function logViolation(violation) {
  const { sessionId, ...body } = violation;
  return apiRequest(`/api/sessions/${sessionId}/violation`, body);
}

/**
 * Bulk send queued offline violations.
 * @param {Array} queue - Array of violation payloads
 * @returns {Promise<{sent: number, failed: number, errors: Array}>}
 */
export async function flushOfflineQueue(queue) {
  let sent = 0;
  let failed = 0;
  const errors = [];
  const failedIndices = [];

  for (let i = 0; i < queue.length; i++) {
    try {
      await logViolation(queue[i]);
      sent++;
    } catch (err) {
      failed++;
      failedIndices.push(i);
      errors.push({ index: i, error: err.message });
    }
  }

  return { sent, failed, errors, failedIndices };
}

/**
 * Test connection to the backend server.
 * @param {string} serverUrl
 * @returns {Promise<{ok: boolean, message: string}>}
 */
export async function testConnection(serverUrl) {
  try {
    const response = await fetch(`${serverUrl}/health`);
    if (response.ok) {
      return { ok: true, message: 'Server is reachable.' };
    }
    return { ok: false, message: `Server responded with ${response.status}.` };
  } catch (err) {
    return { ok: false, message: `Connection failed: ${err.message}` };
  }
}

// ─── Online Status Detection ─────────────────────────────────────────────────

/**
 * Check if the browser is currently online.
 * @returns {boolean}
 */
export function isOnline() {
  return navigator.onLine;
}
