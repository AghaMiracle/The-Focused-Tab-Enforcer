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
} from './utils/storage.js';
import { logViolation, sendHeartbeat, flushOfflineQueue, isOnline } from './utils/api.js';
import { throttle, retryWithBackoff } from './utils/helpers.js';

// ─── In-memory session state (per SW lifecycle) ──────────────────────────────
let session = null;           // { sessionToken, sessionId, examTabId, examConfig, ... }
let violationTimers = {};     // Track pending grace-period timers
let lastViolationTime = {};   // Throttle same-type violations
let isOffline = false;

// ─── Restore session on SW activation ────────────────────────────────────────
async function restoreSession() {
  const stored = await getSession();
  if (stored && stored.state === EXT_STATE.ACTIVE) {
    session = stored;
    log('Session restored from storage:', session.sessionId);
    // Re-register the heartbeat alarm
    chrome.alarms.create('heartbeat', { periodInMinutes: 0.5 });
  }
}
restoreSession();

// ─── Logging helper ──────────────────────────────────────────────────────────
async function log(...args) {
  const settings = await getSettings().catch(() => ({ debugMode: false }));
  if (settings.debugMode) console.log('[FTE BG]', ...args);
}

// ─────────────────────────────────────────────────────────────────────────────
//  START MONITORING
// ─────────────────────────────────────────────────────────────────────────────
async function startMonitoring({ sessionToken, sessionId, examConfig, examDetails, studentName, tabId }) {
  session = {
    state: EXT_STATE.ACTIVE,
    sessionToken,
    sessionId,
    examTabId: tabId,
    examConfig: { ...DEFAULT_THRESHOLDS, ...examConfig },
    examDetails,
    studentName,
    violationCount: 0,
    violationSummary: {},
    startedAt: Date.now(),
    faceDetected: false,
    isOffline: false,
  };

  await saveSession(session);

  // Register heartbeat alarm (every 30 seconds)
  chrome.alarms.create('heartbeat', { periodInMinutes: 0.5 });
  // Token rotation alarm (every 15 minutes)
  chrome.alarms.create('tokenRotate', { periodInMinutes: 15 });

  // Notify content script to initialize overlay
  chrome.tabs.sendMessage(tabId, {
    type: MSG.INIT_OVERLAY,
    payload: { examDetails, studentName, examConfig: session.examConfig },
  }).catch(() => {});

  log('Monitoring started for session', sessionId);
  broadcastStatus();
}

// ─────────────────────────────────────────────────────────────────────────────
//  STOP MONITORING
// ─────────────────────────────────────────────────────────────────────────────
async function stopMonitoring(reason = 'completed') {
  if (!session) return;

  // Cancel alarms
  chrome.alarms.clear('heartbeat');
  chrome.alarms.clear('tokenRotate');

  // Clear grace timers
  Object.values(violationTimers).forEach(clearTimeout);
  violationTimers = {};

  // Send session end to backend (best-effort)
  try {
    const settings = await getSettings();
    const { serverUrl } = settings;
    const endReason = reason === 'terminated' ? 'terminated'
      : reason === 'tab_closed' ? 'student_left'
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

    // Check for admin terminate command in heartbeat response
    if (result?.data?.status === 'terminated') {
      handleAdminTerminate();
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
 * Window focus changed — detect student switching to another application.
 */
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (!session) return;
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    handleWindowBlur();
  } else {
    // Window regained focus — clear any pending blur timer
    clearTimeout(violationTimers.windowBlur);
    delete violationTimers.windowBlur;
  }
});

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
        .then(() => sendResponse({ ok: true }))
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
