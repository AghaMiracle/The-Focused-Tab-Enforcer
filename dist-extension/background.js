/**
 * background.js — Service Worker (Manifest V3)
 *
 * Manages monitoring sessions, listens for tab/window events,
 * schedules heartbeats, logs violations, and communicates with
 * content scripts and popup.
 */

import {
  MSG, VIOLATION_TYPES, SEVERITY, DEFAULT_THRESHOLDS,
  EXT_STATE, STORAGE_KEYS,
} from './utils/constants.js';
import {
  getSession, saveSession, clearSession,
  enqueueViolation, getOfflineQueue, clearOfflineQueue,
  removeFromQueue, getSettings,
  clearAuthState,
} from './utils/storage.js';
import { logViolation, sendHeartbeat, flushOfflineQueue, isOnline } from './utils/api.js';
import { throttle, retryWithBackoff } from './utils/helpers.js';

// ─── In-memory session state (per SW lifecycle) ──────────────────────────────
let session = null;           // { sessionToken, sessionId, examTabId, examConfig, ... }
let violationTimers = {};     // Track pending grace-period timers
let lastViolationTime = {};   // Throttle same-type violations
let isOffline = false;

// Offscreen document handshake state
let offscreenReady = false;
let offscreenReadyResolvers = [];

function waitForOffscreenReady(timeoutMs = 6000) {
  if (offscreenReady) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const idx = offscreenReadyResolvers.indexOf(entry);
      if (idx !== -1) offscreenReadyResolvers.splice(idx, 1);
      reject(new Error('Offscreen document did not become ready in time.'));
    }, timeoutMs);
    const entry = () => { clearTimeout(timer); resolve(); };
    offscreenReadyResolvers.push(entry);
  });
}

function resolveOffscreenReady() {
  offscreenReady = true;
  const resolvers = offscreenReadyResolvers.slice();
  offscreenReadyResolvers = [];
  resolvers.forEach((fn) => fn());
}

// ─── Browser lifecycle: end stale sessions on browser (re)start ──────────────
//
// `chrome.storage.session` is cleared automatically when the browser closes.
// We stamp a "browserAlive" flag there when a session starts and check it on
// service-worker boot:
//   - Flag present  → SW was killed but browser is still running → restore.
//   - Flag missing  → Browser was closed since the session started
//                      → end the session server-side and clear all state.
const BROWSER_ALIVE_KEY = 'fte_browser_alive';

function markBrowserAlive() {
  return new Promise((resolve) => {
    const store = (chrome.storage && chrome.storage.session) || chrome.storage.local;
    store.set({ [BROWSER_ALIVE_KEY]: true }, () => resolve());
  });
}

function isBrowserAlive() {
  return new Promise((resolve) => {
    const store = (chrome.storage && chrome.storage.session) || chrome.storage.local;
    store.get(BROWSER_ALIVE_KEY, (result) => resolve(!!result[BROWSER_ALIVE_KEY]));
  });
}

/**
 * End an exam session on the backend without going through in-memory state.
 * Used to clean up sessions left behind when the browser was closed abruptly.
 */
async function endStaleSessionOnServer(stored) {
  try {
    const { serverUrl } = await getSettings();
    await fetch(`${serverUrl}/api/sessions/${stored.sessionId}/end`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionToken: stored.sessionToken,
        endReason: 'browser_closed',
      }),
    });
    log('Stale session ended on server:', stored.sessionId);
  } catch (err) {
    log('Failed to end stale session:', err?.message);
  }
}

// ─── Restore or clean up on service-worker boot ─────────────────────────────
async function bootstrap() {
  const stored = await getSession();
  const browserWasAlive = await isBrowserAlive();

  if (stored && stored.state === EXT_STATE.ACTIVE) {
    if (!browserWasAlive) {
      // Browser was closed since the session started — end it and wipe state.
      log('Browser was closed during an active exam; ending stale session.');
      await endStaleSessionOnServer(stored);
      await clearSession();
      await clearAuthState().catch(() => {});
      chrome.action.setBadgeText({ text: '' }).catch?.(() => {});
      return;
    }
    // Same browser session — SW was just recycled. Restore in-memory state.
    session = stored;
    log('Session restored from storage:', session.sessionId);
    chrome.alarms.create('heartbeat', { periodInMinutes: 0.5 });
    return;
  }

  // No leftover session — just mark browser alive so future SW starts
  // know we're in the same browser lifetime.
  await markBrowserAlive();
}
bootstrap();

// Fresh browser launch: onStartup fires exactly once per browser start.
// Guarantee any leftover session is cleaned up regardless of storage.session
// availability, then mark the browser alive for future SW restarts.
chrome.runtime.onStartup.addListener(async () => {
  log('Browser started — checking for stale exam sessions.');
  const stored = await getSession();
  if (stored && stored.state === EXT_STATE.ACTIVE) {
    await endStaleSessionOnServer(stored);
    await clearSession();
  }
  // Force-clear student auth on every fresh browser start so students
  // must re-authenticate for a new exam.
  await clearAuthState().catch(() => {});
  chrome.action.setBadgeText({ text: '' }).catch?.(() => {});
  await markBrowserAlive();
});

// ─── Logging helper ──────────────────────────────────────────────────────────
async function log(...args) {
  const settings = await getSettings().catch(() => ({ debugMode: false }));
  if (settings.debugMode) console.log('[FTE BG]', ...args);
}

// ─────────────────────────────────────────────────────────────────────────────
//  START MONITORING
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Normalize server-side thresholds (seconds) to the extension's
 * millisecond-based config so face detection and tab-switch logic
 * respect the admin's configured values.
 */
function normalizeExamConfig(raw) {
  if (!raw) return {};
  const out = {};
  if (raw.tabSwitchSeconds != null)   out.tabSwitchGraceMs  = raw.tabSwitchSeconds * 1000;
  if (raw.windowBlurSeconds != null)  out.windowBlurGraceMs = raw.windowBlurSeconds * 1000;
  if (raw.faceAbsenceFrames != null) {
    out.faceAbsenceFrames = raw.faceAbsenceFrames;
    out.faceAbsenceMs = raw.faceAbsenceFrames * 500;
  }
  if (raw.multipleFaceTolerance != null) out.multipleFaceTolerance = raw.multipleFaceTolerance;
  if (raw.attentionAwaySeconds != null)  out.attentionAwayMs = raw.attentionAwaySeconds * 1000;
  return out;
}

async function startMonitoring({ sessionToken, sessionId, examConfig, examDetails, studentName, tabId }) {
  const normalized = normalizeExamConfig(examConfig);

  session = {
    state: EXT_STATE.ACTIVE,
    sessionToken,
    sessionId,
    examTabId: tabId,
    examConfig: { ...DEFAULT_THRESHOLDS, ...normalized },
    examDetails,
    studentName,
    violationCount: 0,
    violationSummary: {},
    startedAt: Date.now(),
    faceDetected: false,
    isOffline: false,
  };

  await saveSession(session);
  await markBrowserAlive();

  // Register heartbeat alarm (every 30 seconds)
  chrome.alarms.create('heartbeat', { periodInMinutes: 0.5 });
  // Token rotation alarm (every 15 minutes)
  chrome.alarms.create('tokenRotate', { periodInMinutes: 15 });

  // Notify content script to initialize overlay (visible UI in exam tab)
  chrome.tabs.sendMessage(tabId, {
    type: MSG.INIT_OVERLAY,
    payload: { examDetails, studentName, examConfig: session.examConfig },
  }).catch(() => {});

  // Start webcam + face detection in the offscreen document
  // (extension-origin, so getUserMedia works regardless of exam page origin)
  await ensureOffscreenDocument();

  // Wait for the offscreen document to signal it's fully loaded before
  // sending START — prevents a race where the START message arrives
  // before the listener is registered.
  try {
    await waitForOffscreenReady(6000);
  } catch (err) {
    log('Offscreen ready wait failed:', err.message);
  }

  const userSettings = await getSettings();
  const startResp = await chrome.runtime.sendMessage({
    type: 'OFFSCREEN_START',
    payload: {
      ...session.examConfig,
      cameraDeviceId: userSettings.cameraDeviceId || null,
    },
  }).catch((err) => {
    log('Failed to send OFFSCREEN_START:', err?.message);
    return { ok: false, error: err?.message };
  });

  if (!startResp?.ok) {
    log('Offscreen START did not succeed:', startResp?.errorName, startResp?.error);
    const msg = startResp?.error
      || 'Camera monitoring failed to start. Check camera settings and permissions.';
    // Persist on the session so the popup shows the reason too.
    if (session) {
      session.cameraError = msg;
      session.cameraErrorName = startResp?.errorName || null;
      await saveSession(session).catch(() => {});
    }
    // Notify the content script so student sees why camera monitoring failed.
    if (session.examTabId) {
      chrome.tabs.sendMessage(session.examTabId, {
        type: 'FACE_ERROR',
        payload: { message: msg },
      }).catch(() => {});
    }
  }

  log('Monitoring started for session', sessionId);
  broadcastStatus();

  // Return the outcome so START_MONITORING callers know whether the camera
  // actually opened, and can react (open chrome://settings, etc.).
  return {
    cameraOk: !!startResp?.ok,
    cameraError: startResp?.ok ? null : (startResp?.error || 'Camera failed to start.'),
    cameraErrorName: startResp?.ok ? null : (startResp?.errorName || null),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  OFFSCREEN DOCUMENT LIFECYCLE
// ─────────────────────────────────────────────────────────────────────────────
const OFFSCREEN_DOCUMENT_PATH = 'offscreen.html';
let creatingOffscreen = null;

async function hasOffscreenDocument() {
  if (!chrome.runtime.getContexts) {
    // Fallback for older browsers
    return false;
  }
  const existing = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH)],
  });
  return existing.length > 0;
}

async function ensureOffscreenDocument() {
  if (!chrome.offscreen) {
    log('chrome.offscreen API not available. Update Chrome to 109+.');
    return;
  }

  if (await hasOffscreenDocument()) {
    // Document already exists; assume it's ready
    offscreenReady = true;
    return;
  }

  // Not ready yet — reset the flag and wait for the READY signal
  offscreenReady = false;

  if (creatingOffscreen) {
    await creatingOffscreen;
    return;
  }

  creatingOffscreen = chrome.offscreen.createDocument({
    url: OFFSCREEN_DOCUMENT_PATH,
    reasons: ['USER_MEDIA'],
    justification: 'Face detection during proctored exam sessions.',
  });

  try {
    await creatingOffscreen;
  } catch (err) {
    log('Failed to create offscreen document:', err?.message);
  } finally {
    creatingOffscreen = null;
  }
}

async function closeOffscreenDocument() {
  if (!chrome.offscreen) return;
  try {
    if (await hasOffscreenDocument()) {
      await chrome.offscreen.closeDocument();
    }
  } catch (_) {
    // Ignore
  } finally {
    offscreenReady = false;
    offscreenReadyResolvers = [];
  }
}

/**
 * Preload the offscreen document and its face-api models.
 *
 * Called by the popup right after the student logs in. This front-loads the
 * three slow steps (offscreen doc creation, face-api.min.js load, model
 * fetch) so that when the student clicks "Start Selected Exam", the only
 * remaining step is getUserMedia — the webcam LED lights up almost
 * instantly.
 *
 * Idempotent: if the offscreen doc already exists and models are cached,
 * this is effectively a no-op.
 */
async function preloadOffscreenModels() {
  if (!chrome.offscreen) {
    log('chrome.offscreen not available; skipping preload.');
    return { ok: false, error: 'offscreen_api_unavailable' };
  }

  try {
    await ensureOffscreenDocument();
    await waitForOffscreenReady(6000);
  } catch (err) {
    log('Preload: failed to create/ready offscreen doc:', err?.message);
    return { ok: false, error: err?.message };
  }

  const resp = await chrome.runtime.sendMessage({ type: 'OFFSCREEN_PRELOAD' })
    .catch((err) => ({ ok: false, error: err?.message }));

  if (!resp?.ok) {
    log('Preload: OFFSCREEN_PRELOAD did not succeed:', resp?.error);
  } else {
    log('Preload: face-api models are warm. Camera permission:', resp.cameraPermission);
  }
  return resp || { ok: false };
}

// ─────────────────────────────────────────────────────────────────────────────
//  STOP MONITORING
// ─────────────────────────────────────────────────────────────────────────────
async function stopMonitoring(reason = 'completed') {
  if (!session) return;

  // Cancel alarms
  chrome.alarms.clear('heartbeat');
  chrome.alarms.clear('tokenRotate');

  // Stop and close offscreen document (releases the webcam)
  try {
    await chrome.runtime.sendMessage({ type: 'OFFSCREEN_STOP' }).catch(() => {});
    await closeOffscreenDocument();
  } catch (_) {}

  // Clear grace timers
  Object.values(violationTimers).forEach(clearTimeout);
  violationTimers = {};

  // Send session end to backend (best-effort)
  try {
    const settings = await getSettings();
    const { serverUrl } = settings;
    const endReason = reason === 'terminated' ? 'terminated'
      : reason === 'tab_closed' ? 'student_left'
      : reason === 'browser_closed' ? 'browser_closed'
      : 'completed';
    await fetch(`${serverUrl}/api/sessions/${session.sessionId}/end`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionToken: session.sessionToken,
        endReason,
      }),
    });
  } catch (_) {}

  // Remove overlay from exam tab
  if (session.examTabId) {
    chrome.tabs.sendMessage(session.examTabId, {
      type: MSG.REMOVE_OVERLAY,
    }).catch(() => {});
  }

  await clearSession();
  session = null;

  broadcastStatus();
  log('Monitoring stopped:', reason);
}

// ─────────────────────────────────────────────────────────────────────────────
//  LOG VIOLATION
// ─────────────────────────────────────────────────────────────────────────────
async function recordViolation(type, severity, metadata = {}) {
  if (!session) return;

  const now = Date.now();
  const lastTime = lastViolationTime[type] || 0;

  // Throttle: max 1 violation per second per type
  if (now - lastTime < DEFAULT_THRESHOLDS.violationThrottleMs) {
    return;
  }
  lastViolationTime[type] = now;

  const violationPayload = {
    sessionToken: session.sessionToken,
    sessionId: session.sessionId,
    eventType: type,
    severity,
    timestamp: new Date().toISOString(),
    duration: metadata.duration || 0,
    metadata: {
      tabUrl: metadata.tabUrl,
      faceCount: metadata.faceCount,
      confidenceScore: metadata.confidenceScore,
    },
  };

  // Update local counters
  session.violationCount = (session.violationCount || 0) + 1;
  session.violationSummary[type] = (session.violationSummary[type] || 0) + 1;
  await saveSession(session);

  // Notify content script to show warning if high severity
  if (severity === SEVERITY.HIGH && session.examTabId) {
    chrome.tabs.sendMessage(session.examTabId, {
      type: MSG.SHOW_WARNING,
      payload: { violationType: type, severity },
    }).catch(() => {});
  }

  // Update badge
  chrome.action.setBadgeText({ text: String(session.violationCount) });
  chrome.action.setBadgeBackgroundColor({ color: severity === SEVERITY.HIGH ? '#ff4444' : '#ccff00' });

  // Send notification for high severity
  if (severity === SEVERITY.HIGH) {
    const settings = await getSettings();
    if (settings.notifications) {
      chrome.notifications.create(`violation_${Date.now()}`, {
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'Exam Violation Detected',
        message: `${type.replace(/_/g, ' ')} — ${severity} severity`,
      });
    }
  }

  // Send to backend or queue
  if (isOnline()) {
    try {
      await retryWithBackoff(() => logViolation(violationPayload), 2, 500);
      log('Violation logged:', type);
    } catch (err) {
      log('Violation failed to send, queuing:', err.message);
      await enqueueViolation(violationPayload);
    }
  } else {
    await enqueueViolation(violationPayload);
    log('Offline: violation queued');
    isOffline = true;
    broadcastStatus();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  SNAPSHOT FORWARDING
// ─────────────────────────────────────────────────────────────────────────────
async function forwardSnapshot({ snapshot, capturedAt }) {
  if (!session) return;
  try {
    const { serverUrl } = await getSettings();
    await fetch(`${serverUrl}/api/sessions/${session.sessionId}/snapshot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionToken: session.sessionToken,
        snapshot,
        capturedAt,
      }),
    });
  } catch (_) {
    // Snapshots are best-effort; ignore failures
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  HEARTBEAT
// ─────────────────────────────────────────────────────────────────────────────
async function handleHeartbeat() {
  if (!session) return;

  try {
    const result = await sendHeartbeat({
      sessionToken: session.sessionToken,
      sessionId: session.sessionId,
      currentStatus: 'active',
      faceDetected: session.faceDetected || false,
      violationCount: session.violationCount || 0,
    });

    // Check for admin terminate / completed command in heartbeat response.
    // Backend returns `{ status, ... }` at the top level of `data` (see
    // monitoringService.processHeartbeat).
    const serverStatus = result?.data?.status ?? result?.status;
    if (serverStatus === 'terminated') {
      handleAdminTerminate();
      return;
    }
    if (serverStatus === 'completed') {
      log('Server reports session completed — stopping monitoring.');
      await stopMonitoring('completed');
      return;
    }

    // Flush offline queue if we just came back online
    if (isOffline) {
      isOffline = false;
      const queue = await getOfflineQueue();
      if (queue.length > 0) {
        const { sent, failedIndices } = await flushOfflineQueue(queue);
        log(`Flushed ${sent} queued violations`);
        if (failedIndices.length === 0) {
          await clearOfflineQueue();
        } else {
          await removeFromQueue(
            Array.from({ length: queue.length }, (_, i) => i).filter(
              (i) => !failedIndices.includes(i)
            )
          );
        }
      }
    }

    // Update overlay
    if (session.examTabId) {
      chrome.tabs.sendMessage(session.examTabId, {
        type: MSG.UPDATE_OVERLAY,
        payload: {
          violationCount: session.violationCount,
          faceDetected: session.faceDetected,
          isOnline: !isOffline,
          elapsedSeconds: Math.floor((Date.now() - session.startedAt) / 1000),
        },
      }).catch(() => {});
    }
  } catch (err) {
    log('Heartbeat failed:', err.message);
    isOffline = true;
    broadcastStatus();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  TAB / WINDOW EVENT HANDLERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tab activation changed — check if student switched away from exam tab.
 */
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  if (!session) return;
  if (activeInfo.tabId !== session.examTabId) {
    handleTabSwitch(activeInfo.tabId);
  }
});

/**
 * Tab URL changed — check if the exam tab navigated away.
 */
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (!session) return;
  if (tabId === session.examTabId && changeInfo.url) {
    log('Exam tab URL changed to:', changeInfo.url);
    // Could be a legitimate page reload; log as medium
    recordViolation(VIOLATION_TYPES.TAB_SWITCH, SEVERITY.MEDIUM, {
      tabUrl: changeInfo.url,
    });
  }
});

/**
 * Window focus changed — detect the student switching to another Chrome
 * window, another app, or minimizing the browser entirely.
 *
 * WINDOW_ID_NONE means no Chrome window has focus — i.e. the student
 * switched to another application on their computer (Word, WhatsApp, etc.)
 * or minimized Chrome.
 */
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (!session) return;

  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    // Student left Chrome entirely — this is an app switch (high severity)
    handleAppSwitch();
  } else {
    // A Chrome window has focus — could be exam window or another Chrome window
    try {
      const win = await chrome.windows.get(windowId, { populate: false });
      // Determine if the currently focused window contains the exam tab
      const tabs = await chrome.tabs.query({ windowId, active: true });
      const activeTab = tabs?.[0];
      if (activeTab?.id !== session.examTabId) {
        // Switched to another Chrome window
        handleWindowBlur();
      }
      // Otherwise: back on the exam window — clear any pending blur timer
      clearTimeout(violationTimers.windowBlur);
      clearTimeout(violationTimers.appSwitch);
      delete violationTimers.windowBlur;
      delete violationTimers.appSwitch;
    } catch (_) {
      clearTimeout(violationTimers.windowBlur);
      clearTimeout(violationTimers.appSwitch);
    }
  }
});

function handleAppSwitch() {
  // Student switched to another app (or minimized Chrome). Treat as high severity.
  const graceMs = session?.examConfig?.windowBlurGraceMs ?? DEFAULT_THRESHOLDS.windowBlurGraceMs;

  if (graceMs <= 0) {
    recordViolation(VIOLATION_TYPES.APP_SWITCH, SEVERITY.HIGH, {
      note: 'Student switched to another application or minimized the browser',
    });
    return;
  }

  clearTimeout(violationTimers.appSwitch);
  violationTimers.appSwitch = setTimeout(() => {
    recordViolation(VIOLATION_TYPES.APP_SWITCH, SEVERITY.HIGH, {
      note: 'Student switched to another application or minimized the browser',
    });
    delete violationTimers.appSwitch;
  }, graceMs);
}

function handleTabSwitch(newTabId) {
  const graceMs = session?.examConfig?.tabSwitchGraceMs ?? DEFAULT_THRESHOLDS.tabSwitchGraceMs;

  if (graceMs <= 0) {
    // Instant violation — no grace period allowed
    recordViolation(VIOLATION_TYPES.TAB_SWITCH, SEVERITY.HIGH, { tabId: newTabId });
    return;
  }

  clearTimeout(violationTimers.tabSwitch);
  violationTimers.tabSwitch = setTimeout(async () => {
    // Verify they haven't come back
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (activeTab?.id !== session?.examTabId) {
      recordViolation(VIOLATION_TYPES.TAB_SWITCH, SEVERITY.HIGH, { tabId: newTabId });
    }
    delete violationTimers.tabSwitch;
  }, graceMs);
}

function handleWindowBlur() {
  const graceMs = session?.examConfig?.windowBlurGraceMs ?? DEFAULT_THRESHOLDS.windowBlurGraceMs;

  if (graceMs <= 0) {
    // Instant violation — no grace period allowed
    recordViolation(VIOLATION_TYPES.WINDOW_BLUR, SEVERITY.HIGH);
    return;
  }

  clearTimeout(violationTimers.windowBlur);
  violationTimers.windowBlur = setTimeout(() => {
    recordViolation(VIOLATION_TYPES.WINDOW_BLUR, SEVERITY.HIGH);
    delete violationTimers.windowBlur;
  }, graceMs);
}

async function handleAdminTerminate() {
  log('Admin terminated exam session');
  if (session?.examTabId) {
    chrome.tabs.sendMessage(session.examTabId, {
      type: MSG.TERMINATE_EXAM,
      payload: { reason: 'Admin terminated the exam.' },
    }).catch(() => {});
  }
  await stopMonitoring('terminated');
}

// ─────────────────────────────────────────────────────────────────────────────
//  ALARM HANDLER
// ─────────────────────────────────────────────────────────────────────────────
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'heartbeat') {
    handleHeartbeat();
  }
  if (alarm.name === 'tokenRotate') {
    log('Token rotation alarm fired (handled by next heartbeat response)');
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  MESSAGE HANDLER (from popup, content script)
// ─────────────────────────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { type, payload } = message;

  switch (type) {
    // ── Popup requests ────────────────────────────────────────────────
    case MSG.START_MONITORING: {
      startMonitoring(payload)
        .then((result) => sendResponse({ ok: true, ...(result || {}) }))
        .catch((err) => sendResponse({ ok: false, error: err.message }));
      return true; // async
    }

    case MSG.STOP_MONITORING: {
      stopMonitoring(payload?.reason || 'completed')
        .then(() => sendResponse({ ok: true }))
        .catch((err) => sendResponse({ ok: false, error: err.message }));
      return true;
    }

    case MSG.END_EXAM: {
      stopMonitoring('completed')
        .then(() => sendResponse({ ok: true }))
        .catch((err) => sendResponse({ ok: false, error: err.message }));
      return true;
    }

    // Warm the offscreen document + face-api models on login so
    // "Start Exam" only has to run getUserMedia.
    case MSG.PRELOAD_MODELS: {
      preloadOffscreenModels()
        .then((resp) => sendResponse(resp))
        .catch((err) => sendResponse({ ok: false, error: err.message }));
      return true;
    }

    // Free the offscreen doc on logout (no active session).
    case MSG.CLOSE_OFFSCREEN: {
      if (session) {
        // Don't tear down mid-exam
        sendResponse({ ok: false, error: 'session_active' });
        return false;
      }
      closeOffscreenDocument()
        .then(() => sendResponse({ ok: true }))
        .catch((err) => sendResponse({ ok: false, error: err.message }));
      return true;
    }

    case MSG.GET_STATUS: {
      sendResponse({
        ok: true,
        session: session
          ? {
              state: session.state,
              studentName: session.studentName,
              examDetails: session.examDetails,
              violationCount: session.violationCount,
              startedAt: session.startedAt,
              faceDetected: session.faceDetected,
              isOffline,
              cameraError: session.cameraError || null,
            }
          : null,
      });
      return false;
    }

    // ── Content script reports ────────────────────────────────────────
    case MSG.VIOLATION_DETECTED: {
      const { violationType, severity: sev, metadata: meta } = payload;
      recordViolation(violationType, sev, meta || {})
        .then(() => sendResponse({ ok: true }))
        .catch((err) => sendResponse({ ok: false, error: err.message }));
      return true;
    }

    case MSG.FACE_STATUS: {
      if (session) {
        session.faceDetected = payload.detected;
        saveSession(session).catch(() => {});
      }
      sendResponse({ ok: true });
      return false;
    }

    case MSG.SNAPSHOT: {
      forwardSnapshot(payload).catch(() => {});
      sendResponse({ ok: true });
      return false;
    }

    case MSG.PAGE_HIDDEN: {
      // Backup detection from Page Visibility API in content script
      const graceMs = session?.examConfig?.tabSwitchGraceMs ?? DEFAULT_THRESHOLDS.tabSwitchGraceMs;
      clearTimeout(violationTimers.pageHidden);
      violationTimers.pageHidden = setTimeout(() => {
        recordViolation(VIOLATION_TYPES.TAB_SWITCH, SEVERITY.HIGH);
        delete violationTimers.pageHidden;
      }, graceMs);
      sendResponse({ ok: true });
      return false;
    }

    case MSG.PAGE_VISIBLE: {
      clearTimeout(violationTimers.pageHidden);
      delete violationTimers.pageHidden;
      sendResponse({ ok: true });
      return false;
    }

    // ── Offscreen document messages ──────────────────────────────────
    case 'OFFSCREEN_STATUS': {
      // Face status update — forward to popup and content script
      if (session) {
        session.faceDetected = payload.faceDetected;
        // First successful frame means the camera is alive — clear any lingering error.
        if (session.cameraError) session.cameraError = null;
        saveSession(session).catch(() => {});
        if (session.examTabId) {
          chrome.tabs.sendMessage(session.examTabId, {
            type: MSG.FACE_STATUS,
            payload: { detected: payload.faceDetected, faceCount: payload.faceCount },
          }).catch(() => {});
        }
        broadcastStatus();
      }
      sendResponse({ ok: true });
      return false;
    }

    case 'OFFSCREEN_VIOLATION': {
      // Face-related violation from offscreen document
      const { violationType, severity: sev, metadata: meta } = payload;
      recordViolation(violationType, sev, meta || {})
        .then(() => sendResponse({ ok: true }))
        .catch((err) => sendResponse({ ok: false, error: err.message }));
      return true;
    }

    case 'OFFSCREEN_SNAPSHOT': {
      // Snapshot for admin dashboard
      forwardSnapshot(payload).catch(() => {});
      sendResponse({ ok: true });
      return false;
    }

    case 'OFFSCREEN_FRAME': {
      // Preview frame for student's own overlay
      if (session?.examTabId && payload?.frame) {
        chrome.tabs.sendMessage(session.examTabId, {
          type: 'PREVIEW_FRAME',
          payload: { frame: payload.frame },
        }).catch(() => {});
      }
      sendResponse({ ok: true });
      return false;
    }

    case 'OFFSCREEN_ERROR': {
      log('Offscreen error:', payload?.message);
      // Persist on the session so the popup can display it too.
      if (session) {
        session.cameraError = payload?.message || 'Camera error';
        saveSession(session).catch(() => {});
        broadcastStatus();
      }
      if (session?.examTabId) {
        chrome.tabs.sendMessage(session.examTabId, {
          type: 'FACE_ERROR',
          payload: { message: payload?.message },
        }).catch(() => {});
      }
      sendResponse({ ok: true });
      return false;
    }

    case 'OFFSCREEN_READY': {
      log('Offscreen document ready.');
      resolveOffscreenReady();
      sendResponse({ ok: true });
      return false;
    }

    default:
      sendResponse({ ok: false, error: `Unknown message type: ${type}` });
      return false;
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  BROADCAST STATUS (to popup)
// ─────────────────────────────────────────────────────────────────────────────
function broadcastStatus() {
  chrome.runtime.sendMessage({
    type: MSG.STATUS_UPDATE,
    payload: {
      session: session
        ? {
            state: session.state,
            studentName: session.studentName,
            examDetails: session.examDetails,
            violationCount: session.violationCount,
            startedAt: session.startedAt,
            faceDetected: session.faceDetected,
            isOffline,
            cameraError: session.cameraError || null,
          }
        : null,
    },
  }).catch(() => {}); // Popup may not be open
}

// ─────────────────────────────────────────────────────────────────────────────
//  TAB CLOSED (clean up if exam tab closed)
// ─────────────────────────────────────────────────────────────────────────────
chrome.tabs.onRemoved.addListener(async (tabId) => {
  if (session && tabId === session.examTabId) {
    log('Exam tab was closed — ending session');
    await stopMonitoring('tab_closed');
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  INSTALL / UPDATE HANDLER
// ─────────────────────────────────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') {
    // Set default settings
    chrome.storage.local.set({
      [STORAGE_KEYS.SERVER_URL]: 'http://localhost:5000',
      [STORAGE_KEYS.NOTIFICATIONS]: true,
      [STORAGE_KEYS.DEBUG_MODE]: false,
    });
  }
});
