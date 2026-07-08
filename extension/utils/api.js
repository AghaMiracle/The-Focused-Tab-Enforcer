/**
 * api.js
 * Backend communication module.
 * Handles all HTTP requests to the Focused Tab Enforcer API with
 * automatic retry, offline detection, and queue management.
 */

import { API_ENDPOINTS, DEFAULT_SERVER_URL } from './constants.js';
import { getSettings } from './storage.js';
import { retryWithBackoff } from './helpers.js';

// ─── Core Fetch Wrapper ──────────────────────────────────────────────────────

/**
 * Make an authenticated request to the backend.
 * @param {string} endpoint - API path (e.g. '/api/ext/verify')
 * @param {object} body - JSON body
 * @param {object} [options] - Override options
 * @returns {Promise<object>} Parsed JSON response
 */
export async function apiRequest(endpoint, body, options = {}) {
  const settings = await getSettings();
  const serverUrl = options.serverUrl || settings.serverUrl || DEFAULT_SERVER_URL;
  const institutionKey = options.institutionKey || settings.institutionKey;

  if (!institutionKey) {
    throw new Error('Extension API key not configured. Please open Settings.');
  }

  const url = `${serverUrl}${endpoint}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-extension-key': institutionKey,
      ...options.headers,
    },
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
 * POST /api/ext/verify
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
  const result = await apiRequest(API_ENDPOINTS.VERIFY, credentials);
  return result.data;
}

/**
 * Send a heartbeat to keep the session alive.
 * POST /api/ext/heartbeat
 *
 * @param {object} payload
 * @returns {Promise<object>}
 */
export async function sendHeartbeat(payload) {
  return retryWithBackoff(
    () => apiRequest(API_ENDPOINTS.HEARTBEAT, payload),
    2,
    1000
  );
}

/**
 * Log a violation event to the backend.
 * POST /api/ext/log
 *
 * @param {object} violation
 * @returns {Promise<object>}
 */
export async function logViolation(violation) {
  return apiRequest(API_ENDPOINTS.LOG, violation);
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
 * Test connection to the backend with the given API key.
 * @param {string} serverUrl
 * @param {string} institutionKey
 * @returns {Promise<{ok: boolean, message: string}>}
 */
export async function testConnection(serverUrl, institutionKey) {
  try {
    // We use a minimal verify call that will fail on credentials but
    // confirm the server and key are reachable
    await apiRequest(
      API_ENDPOINTS.VERIFY,
      { examId: '__ping__', email: 'ping@ping.com', registrationNumber: 'PING' },
      { serverUrl, institutionKey }
    );
    return { ok: true, message: 'Connection successful.' };
  } catch (err) {
    // 404 (exam not found) means the server and key are valid — good enough
    if (err.status === 404 || err.status === 403) {
      return { ok: true, message: 'Connection successful. API key is valid.' };
    }
    // 401 means bad API key
    if (err.status === 401) {
      return { ok: false, message: 'Invalid API key. Please check your settings.' };
    }
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
