/**
 * content.js
 * Injected into all pages. Activates only when an active exam session is
 * stored and the current URL matches allowed domains.
 *
 * Responsibilities:
 *  - Initialize monitoring overlay UI
 *  - Prevent copy/paste, right-click, devtools shortcuts, print
 *  - Enforce fullscreen
 *  - Page Visibility API listener (backup tab-switch detection)
 *  - Warn on page unload
 *  - Drive face detection via faceDetection.js
 *  - Relay violations and face status to background service worker
 */

import { MSG, VIOLATION_TYPES, SEVERITY } from './utils/constants.js';
import { getSession } from './utils/storage.js';
import { isAllowedDomain, throttle } from './utils/helpers.js';
import { createStatusBar, updateOverlay, showWarning, showTerminated, removeOverlay } from './overlay.js';
import { startFaceDetection, stopFaceDetection } from './faceDetection.js';

// ─── State ────────────────────────────────────────────────────────────────────
let isMonitoring = false;
let examConfig = null;
let devToolsCheckInterval = null;

// ─── Initialize ───────────────────────────────────────────────────────────────
async function init() {
  const session = await getSession().catch(() => null);

  if (!session || session.state !== 'active') {
    return; // No active session — don't do anything
  }

  // Check if this tab/URL should be monitored
  const allowed = session.examConfig?.allowedDomains;
  if (allowed && allowed.length > 0 && !isAllowedDomain(window.location.href, allowed)) {
    return; // Not an exam page
  }

  activateMonitoring(session);
}

// ─── Activate Monitoring ──────────────────────────────────────────────────────
async function activateMonitoring(session) {
  isMonitoring = true;
  examConfig = session.examConfig || {};

  // Create overlay
  createStatusBar(session.examDetails, session.studentName);

  // Anti-cheat event listeners
  installAntiCheat();

  // Fullscreen enforcement
  requestFullscreen();
  document.addEventListener('fullscreenchange', handleFullscreenChange);

  // Page Visibility (backup to background tab-switch detection)
  document.addEventListener('visibilitychange', handleVisibilityChange);

  // Unload warning
  window.addEventListener('beforeunload', handleBeforeUnload);

  // DevTools detection
  startDevToolsDetection();

  // Start face detection
  const faceResult = await startFaceDetection(
    examConfig,
    (type, severity, meta) => sendViolation(type, severity, meta),
    (detected) => sendFaceStatus(detected),
    (err) => handleFaceError(err)
  );

  if (!faceResult.success) {
    // Fallback: show error in overlay but continue with tab/window monitoring
    showFaceError('Face detection unavailable. Tab monitoring is active.');
  }

  // Tell background script content is ready
  chrome.runtime.sendMessage({ type: MSG.CONTENT_READY });
}

// ─── Anti-Cheat Event Listeners ───────────────────────────────────────────────
function installAntiCheat() {
  // Prevent copy, cut, paste
  document.addEventListener('copy', (e) => { e.preventDefault(); e.stopPropagation(); }, true);
  document.addEventListener('cut', (e) => { e.preventDefault(); e.stopPropagation(); }, true);
  document.addEventListener('paste', (e) => { e.preventDefault(); e.stopPropagation(); }, true);

  // Prevent right-click context menu
  document.addEventListener('contextmenu', (e) => { e.preventDefault(); e.stopPropagation(); }, true);

  // Block keyboard shortcuts
  document.addEventListener('keydown', handleKeydown, true);

  // Block print
  window.addEventListener('beforeprint', (e) => { e.preventDefault(); }, true);
}

const BLOCKED_KEYS = new Set([
  'F12',        // DevTools
  'PrintScreen',
]);

function handleKeydown(e) {
  if (!isMonitoring) return;

  // F12
  if (e.key === 'F12') {
    e.preventDefault(); e.stopPropagation();
    flagDevTools('F12 pressed');
    return;
  }

  // Ctrl/Cmd + Shift combos (DevTools)
  if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
    const k = e.key.toUpperCase();
    if (['I', 'J', 'C', 'K'].includes(k)) {
      e.preventDefault(); e.stopPropagation();
      flagDevTools(`Ctrl+Shift+${k}`);
      return;
    }
  }

  // Ctrl+P (print)
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
    e.preventDefault(); e.stopPropagation();
    return;
  }

  // Ctrl+C / Ctrl+X / Ctrl+V
  if ((e.ctrlKey || e.metaKey) && ['c', 'x', 'v'].includes(e.key.toLowerCase())) {
    e.preventDefault(); e.stopPropagation();
    return;
  }

  // Escape from fullscreen — re-request after a tick
  if (e.key === 'Escape') {
    setTimeout(requestFullscreen, 300);
  }
}

// ─── DevTools Detection ───────────────────────────────────────────────────────
const _throttledDevToolsViolation = throttle(
  () => sendViolation(VIOLATION_TYPES.DEVTOOLS_OPENED, SEVERITY.HIGH),
  5000
);

function flagDevTools(trigger) {
  console.warn('[FTE] DevTools shortcut blocked:', trigger);
  _throttledDevToolsViolation();
}

function startDevToolsDetection() {
  // Heuristic: window outer/inner size difference > 200px indicates devtools open
  let devToolsOpen = false;
  devToolsCheckInterval = setInterval(() => {
    const threshold = 200;
    const widthDiff = window.outerWidth - window.innerWidth;
    const heightDiff = window.outerHeight - window.innerHeight;
    const isOpen = widthDiff > threshold || heightDiff > threshold;
    if (isOpen && !devToolsOpen) {
      devToolsOpen = true;
      _throttledDevToolsViolation();
    } else if (!isOpen) {
      devToolsOpen = false;
    }
  }, 2000);
}

// ─── Fullscreen Enforcement ───────────────────────────────────────────────────
function requestFullscreen() {
  if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
    document.documentElement.requestFullscreen().catch(() => {
      // Browser may block on non-user-gesture — best effort
    });
  }
}

function handleFullscreenChange() {
  if (!document.fullscreenElement && isMonitoring) {
    sendViolation(VIOLATION_TYPES.FULLSCREEN_EXIT, SEVERITY.MEDIUM);
    // Try to re-request after short delay
    setTimeout(requestFullscreen, 500);
  }
}

// ─── Page Visibility ──────────────────────────────────────────────────────────
function handleVisibilityChange() {
  if (!isMonitoring) return;
  if (document.hidden) {
    chrome.runtime.sendMessage({ type: MSG.PAGE_HIDDEN });
  } else {
    chrome.runtime.sendMessage({ type: MSG.PAGE_VISIBLE });
  }
}

// ─── Unload Warning ───────────────────────────────────────────────────────────
function handleBeforeUnload(e) {
  if (!isMonitoring) return;
  e.preventDefault();
  e.returnValue = 'Leaving this page will terminate your exam session. Are you sure?';
  return e.returnValue;
}

// ─── Violation Relay ─────────────────────────────────────────────────────────
function sendViolation(type, severity, metadata = {}) {
  chrome.runtime.sendMessage({
    type: MSG.VIOLATION_DETECTED,
    payload: { violationType: type, severity, metadata },
  }).catch(() => {});
}

// ─── Face Status Relay ────────────────────────────────────────────────────────
function sendFaceStatus(detected) {
  chrome.runtime.sendMessage({
    type: MSG.FACE_STATUS,
    payload: { detected },
  }).catch(() => {});
}

// ─── Face Error Display ───────────────────────────────────────────────────────
function handleFaceError(err) {
  console.warn('[FTE] Face detection error:', err.message);
  showFaceError(err.message);
}

function showFaceError(message) {
  const existing = document.getElementById('fte-face-error');
  if (existing) return;

  const el = document.createElement('div');
  el.id = 'fte-face-error';
  el.textContent = `⚠ ${message}`;
  el.style.cssText = `
    position: fixed !important;
    bottom: 20px !important;
    left: 20px !important;
    z-index: 2147483645 !important;
    background: rgba(12,12,12,0.92) !important;
    border: 1px solid rgba(255,140,0,0.5) !important;
    border-radius: 12px !important;
    padding: 10px 16px !important;
    font-family: 'Space Grotesk', sans-serif !important;
    font-size: 12px !important;
    color: #ff8c00 !important;
    max-width: 280px !important;
    pointer-events: none !important;
  `;
  document.body.appendChild(el);

  // Auto-remove after 8 seconds
  setTimeout(() => el.remove(), 8000);
}

// ─── Message Listener (from background) ──────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { type, payload } = message;

  switch (type) {
    case MSG.INIT_OVERLAY: {
      createStatusBar(payload.examDetails, payload.studentName);
      sendResponse({ ok: true });
      break;
    }

    case MSG.UPDATE_OVERLAY: {
      updateOverlay(payload);
      sendResponse({ ok: true });
      break;
    }

    case MSG.SHOW_WARNING: {
      showWarning(payload.violationType, payload.severity);
      sendResponse({ ok: true });
      break;
    }

    case MSG.REMOVE_OVERLAY: {
      removeOverlay();
      stopFaceDetection();
      isMonitoring = false;
      clearInterval(devToolsCheckInterval);
      sendResponse({ ok: true });
      break;
    }

    case MSG.TERMINATE_EXAM: {
      removeOverlay();
      stopFaceDetection();
      isMonitoring = false;
      clearInterval(devToolsCheckInterval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      showTerminated(payload?.reason || 'Your exam session has been terminated.');
      sendResponse({ ok: true });
      break;
    }

    default:
      sendResponse({ ok: false });
  }
  return false;
});

// ─── Boot ─────────────────────────────────────────────────────────────────────
// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
