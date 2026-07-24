/**
 * storage.js
 * Promise-based wrappers around chrome.storage.local.
 * Provides typed helpers for session data, offline queue, and settings.
 */

import { STORAGE_KEYS, DEFAULT_THRESHOLDS, DEFAULT_SERVER_URL } from './constants.js';

// ─── Generic chrome.storage wrappers ────────────────────────────────────────

/**
 * Get one or more keys from chrome.storage.local.
 * @param {string|string[]|null} keys - Key(s) to retrieve. Null returns all.
 * @returns {Promise<object>}
 */
export function storageGet(keys) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(keys, (result) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(result);
      }
    });
  });
}

/**
 * Set key-value pairs in chrome.storage.local.
 * @param {object} items
 * @returns {Promise<void>}
 */
export function storageSet(items) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(items, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve();
      }
    });
  });
}

/**
 * Remove keys from chrome.storage.local.
 * @param {string|string[]} keys
 * @returns {Promise<void>}
 */
export function storageRemove(keys) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.remove(keys, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve();
      }
    });
  });
}

// ─── Session Helpers ─────────────────────────────────────────────────────────

/**
 * Save the active exam session to storage.
 * @param {object} sessionData
 */
export async function saveSession(sessionData) {
  await storageSet({ [STORAGE_KEYS.ACTIVE_SESSION]: sessionData });
}

/**
 * Retrieve the active exam session from storage.
 * @returns {Promise<object|null>}
 */
export async function getSession() {
  const result = await storageGet(STORAGE_KEYS.ACTIVE_SESSION);
  return result[STORAGE_KEYS.ACTIVE_SESSION] || null;
}

/**
 * Clear the active exam session from storage.
 */
export async function clearSession() {
  await storageRemove(STORAGE_KEYS.ACTIVE_SESSION);
}

// ─── Settings Helpers ────────────────────────────────────────────────────────

/**
 * Get extension settings with defaults applied.
 * @returns {Promise<object>}
 */
export async function getSettings() {
  const result = await storageGet([
    STORAGE_KEYS.SERVER_URL,
    STORAGE_KEYS.DEBUG_MODE,
    STORAGE_KEYS.NOTIFICATIONS,
    STORAGE_KEYS.CAMERA_DEVICE_ID,
  ]);

  return {
    serverUrl: result[STORAGE_KEYS.SERVER_URL] || DEFAULT_SERVER_URL,
    debugMode: result[STORAGE_KEYS.DEBUG_MODE] || false,
    notifications: result[STORAGE_KEYS.NOTIFICATIONS] !== false, // default true
    cameraDeviceId: result[STORAGE_KEYS.CAMERA_DEVICE_ID] || null,
  };
}

/**
 * Save extension settings.
 * @param {object} settings
 */
export async function saveSettings(settings) {
  const items = {};
  if (settings.serverUrl !== undefined)
    items[STORAGE_KEYS.SERVER_URL] = settings.serverUrl;
  if (settings.debugMode !== undefined)
    items[STORAGE_KEYS.DEBUG_MODE] = settings.debugMode;
  if (settings.notifications !== undefined)
    items[STORAGE_KEYS.NOTIFICATIONS] = settings.notifications;
  if (settings.cameraDeviceId !== undefined)
    items[STORAGE_KEYS.CAMERA_DEVICE_ID] = settings.cameraDeviceId;
  await storageSet(items);
}

// ─── Offline Queue Helpers ───────────────────────────────────────────────────

/**
 * Get the current offline violation queue.
 * @returns {Promise<Array>}
 */
export async function getOfflineQueue() {
  const result = await storageGet(STORAGE_KEYS.OFFLINE_QUEUE);
  return result[STORAGE_KEYS.OFFLINE_QUEUE] || [];
}

/**
 * Add a violation to the offline queue.
 * @param {object} violation
 * @param {number} maxSize - Maximum queue size
 */
export async function enqueueViolation(violation, maxSize = 200) {
  const queue = await getOfflineQueue();
  if (queue.length >= maxSize) {
    // Drop oldest entry if queue is full
    queue.shift();
  }
  queue.push({ ...violation, _queuedAt: new Date().toISOString() });
  await storageSet({ [STORAGE_KEYS.OFFLINE_QUEUE]: queue });
}

/**
 * Clear the offline queue after successful sync.
 */
export async function clearOfflineQueue() {
  await storageRemove(STORAGE_KEYS.OFFLINE_QUEUE);
}

/**
 * Remove specific items from the offline queue by index.
 * @param {number[]} indices
 */
export async function removeFromQueue(indices) {
  const queue = await getOfflineQueue();
  const indexSet = new Set(indices);
  const remaining = queue.filter((_, i) => !indexSet.has(i));
  await storageSet({ [STORAGE_KEYS.OFFLINE_QUEUE]: remaining });
}


// ─── Auth State Helpers (session-scoped: cleared on browser close) ───────────
// Uses chrome.storage.session which lives only until the browser is closed.
// Falls back to chrome.storage.local if session storage is unavailable.

const AUTH_STATE_KEY = 'fte_auth_state';

function sessionStore() {
  return (chrome.storage && chrome.storage.session) || chrome.storage.local;
}

/**
 * Save student auth state (token + student info + available exams).
 * Persists until the browser is closed or the student logs out manually.
 * @param {{ studentAuthToken: string, studentName: string, studentEmail: string, availableExams: Array }} authState
 */
export function saveAuthState(authState) {
  return new Promise((resolve, reject) => {
    sessionStore().set({ [AUTH_STATE_KEY]: authState }, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve();
      }
    });
  });
}

/**
 * Get the saved student auth state, or null if none.
 * @returns {Promise<object|null>}
 */
export function getAuthState() {
  return new Promise((resolve, reject) => {
    sessionStore().get(AUTH_STATE_KEY, (result) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(result[AUTH_STATE_KEY] || null);
      }
    });
  });
}

/**
 * Clear the saved student auth state (manual logout).
 */
export function clearAuthState() {
  return new Promise((resolve, reject) => {
    sessionStore().remove(AUTH_STATE_KEY, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve();
      }
    });
  });
}
