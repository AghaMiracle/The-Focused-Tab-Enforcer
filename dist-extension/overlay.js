/**
 * overlay.js
 * Creates and manages the glassmorphism monitoring overlay UI.
 * Obsidian & Lime design system throughout.
 *
 * Elements created:
 *   - Top status bar (fixed, glassmorphism)
 *   - Warning overlay (full-screen, red tint)
 *   - Terminated overlay (full-screen, permanent)
 */

import { formatTime } from './utils/helpers.js';

// ─── Injected Google Fonts (Space Grotesk + JetBrains Mono) ──────────────────
function injectFonts() {
  if (document.getElementById('fte-fonts')) return;
  const link = document.createElement('link');
  link.id = 'fte-fonts';
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap';
  document.head.appendChild(link);
}

// ─── State ────────────────────────────────────────────────────────────────────
let statusBar = null;
let warningOverlay = null;
let terminatedOverlay = null;
let timerInterval = null;
let startTime = null;
let warningTimeout = null;
let overlayData = {
  violationCount: 0,
  faceDetected: false,
  isOnline: true,
  elapsedSeconds: 0,
  examTitle: '',
  studentName: '',
};

// ─── Create Status Bar ────────────────────────────────────────────────────────
function createStatusBar(examDetails, studentName) {
  if (statusBar) statusBar.remove();
  injectFonts();

  statusBar = document.createElement('div');
  statusBar.id = 'fte-status-bar';
  statusBar.innerHTML = `
    <div class="fte-bar-left">
      <div class="fte-logo">FT</div>
      <div class="fte-status-info">
        <span class="fte-status-label">MONITORING ACTIVE</span>
        <span class="fte-exam-title">${examDetails?.title || 'Exam'}</span>
      </div>
    </div>
    <div class="fte-bar-center">
      <div class="fte-timer-wrap">
        <span class="fte-timer-icon">⏱</span>
        <span class="fte-timer" id="fte-timer">00:00:00</span>
      </div>
      <div class="fte-face-status" id="fte-face-status" title="Face detection status">
        <span class="fte-face-dot" id="fte-face-dot"></span>
        <span class="fte-face-label" id="fte-face-label">Detecting…</span>
      </div>
    </div>
    <div class="fte-bar-right">
      <div class="fte-violation-badge" id="fte-violation-badge" title="Violation count">
        <span class="fte-violation-count" id="fte-violation-count">0</span>
        <span class="fte-violation-label">violations</span>
      </div>
      <div class="fte-conn-status" id="fte-conn-status" title="Connection status">
        <span class="fte-conn-dot" id="fte-conn-dot"></span>
        <span class="fte-conn-label" id="fte-conn-label">Online</span>
      </div>
    </div>
  `;

  applyStatusBarStyles();
  document.body.appendChild(statusBar);
  startTime = Date.now();

  // Timer interval
  timerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const el = document.getElementById('fte-timer');
    if (el) el.textContent = formatTime(elapsed);
  }, 1000);
}

// ─── Update Overlay Data ──────────────────────────────────────────────────────
function updateOverlay({ violationCount, faceDetected, isOnline, elapsedSeconds }) {
  overlayData = { ...overlayData, violationCount, faceDetected, isOnline };

  // Violation count
  const countEl = document.getElementById('fte-violation-count');
  const badgeEl = document.getElementById('fte-violation-badge');
  if (countEl) countEl.textContent = String(violationCount || 0);
  if (badgeEl) {
    badgeEl.style.borderColor = violationCount > 0
      ? 'rgba(255,68,68,0.6)'
      : 'rgba(204,255,0,0.3)';
    badgeEl.style.color = violationCount > 0 ? '#ff4444' : '#ccff00';
  }

  // Face status
  const faceDot = document.getElementById('fte-face-dot');
  const faceLabel = document.getElementById('fte-face-label');
  if (faceDot && faceLabel) {
    faceDot.style.background = faceDetected ? '#ccff00' : '#ff4444';
    faceDot.style.boxShadow = faceDetected
      ? '0 0 6px rgba(204,255,0,0.8)'
      : '0 0 6px rgba(255,68,68,0.8)';
    faceLabel.textContent = faceDetected ? 'Face OK' : 'No Face';
    faceLabel.style.color = faceDetected ? '#ccff00' : '#ff4444';
  }

  // Connection status
  const connDot = document.getElementById('fte-conn-dot');
  const connLabel = document.getElementById('fte-conn-label');
  if (connDot && connLabel) {
    connDot.style.background = isOnline ? '#ccff00' : '#ff8c00';
    connLabel.textContent = isOnline ? 'Online' : 'Offline';
    connLabel.style.color = isOnline ? '#ebebeb' : '#ff8c00';
  }
}

// ─── Show Warning Overlay ─────────────────────────────────────────────────────
function showWarning(violationType, severity) {
  if (warningOverlay) warningOverlay.remove();
  clearTimeout(warningTimeout);

  const typeLabel = (violationType || '').replace(/_/g, ' ').toUpperCase();

  warningOverlay = document.createElement('div');
  warningOverlay.id = 'fte-warning-overlay';
  warningOverlay.innerHTML = `
    <div class="fte-warning-card">
      <div class="fte-warning-icon">⚠</div>
      <h2 class="fte-warning-title">VIOLATION DETECTED</h2>
      <p class="fte-warning-type">${typeLabel}</p>
      <p class="fte-warning-msg">This incident has been logged and reported to your examiner.</p>
      <div class="fte-warning-bar"></div>
    </div>
  `;

  applyWarningStyles();
  document.body.appendChild(warningOverlay);

  // Auto-dismiss after 4 seconds
  warningTimeout = setTimeout(() => {
    warningOverlay?.remove();
    warningOverlay = null;
  }, 4000);
}

// ─── Show Terminated Overlay ──────────────────────────────────────────────────
function showTerminated(reason) {
  if (terminatedOverlay) return;

  terminatedOverlay = document.createElement('div');
  terminatedOverlay.id = 'fte-terminated-overlay';
  terminatedOverlay.innerHTML = `
    <div class="fte-term-card">
      <div class="fte-term-icon">🔒</div>
      <h2 class="fte-term-title">EXAM TERMINATED</h2>
      <p class="fte-term-reason">${reason || 'Your exam session has been ended.'}</p>
      <p class="fte-term-note">Please contact your examiner for further instructions.</p>
    </div>
  `;

  applyTerminatedStyles();
  document.body.appendChild(terminatedOverlay);
}

// ─── Remove Overlay ───────────────────────────────────────────────────────────
function removeOverlay() {
  clearInterval(timerInterval);
  clearTimeout(warningTimeout);
  statusBar?.remove();
  warningOverlay?.remove();
  statusBar = null;
  warningOverlay = null;
  timerInterval = null;
}

// ─── Styles ───────────────────────────────────────────────────────────────────
function applyStatusBarStyles() {
  const style = document.createElement('style');
  style.id = 'fte-bar-style';
  style.textContent = `
    #fte-status-bar {
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      right: 0 !important;
      height: 52px !important;
      z-index: 2147483647 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      padding: 0 20px !important;
      background: rgba(12,12,12,0.92) !important;
      backdrop-filter: blur(16px) !important;
      -webkit-backdrop-filter: blur(16px) !important;
      border-bottom: 1px solid rgba(204,255,0,0.2) !important;
      font-family: 'Space Grotesk', sans-serif !important;
      box-shadow: 0 2px 24px rgba(0,0,0,0.6), 0 1px 0 rgba(204,255,0,0.1) !important;
      pointer-events: none !important;
      user-select: none !important;
    }
    .fte-bar-left, .fte-bar-center, .fte-bar-right {
      display: flex !important;
      align-items: center !important;
      gap: 12px !important;
    }
    .fte-logo {
      width: 32px !important;
      height: 32px !important;
      background: #ccff00 !important;
      color: #0c0c0c !important;
      border-radius: 8px !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      font-weight: 700 !important;
      font-size: 13px !important;
      letter-spacing: -0.5px !important;
      flex-shrink: 0 !important;
    }
    .fte-status-info {
      display: flex !important;
      flex-direction: column !important;
      gap: 1px !important;
    }
    .fte-status-label {
      font-size: 9px !important;
      font-weight: 600 !important;
      letter-spacing: 1.5px !important;
      color: #ccff00 !important;
      line-height: 1 !important;
    }
    .fte-exam-title {
      font-size: 12px !important;
      color: rgba(235,235,235,0.7) !important;
      font-weight: 400 !important;
      max-width: 200px !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      white-space: nowrap !important;
    }
    .fte-timer-wrap {
      display: flex !important;
      align-items: center !important;
      gap: 6px !important;
    }
    .fte-timer-icon { font-size: 14px !important; }
    .fte-timer {
      font-family: 'JetBrains Mono', monospace !important;
      font-size: 16px !important;
      font-weight: 600 !important;
      color: #ebebeb !important;
      letter-spacing: 1px !important;
    }
    .fte-face-status {
      display: flex !important;
      align-items: center !important;
      gap: 6px !important;
      padding: 4px 10px !important;
      background: rgba(255,255,255,0.04) !important;
      border: 1px solid rgba(255,255,255,0.08) !important;
      border-radius: 20px !important;
    }
    .fte-face-dot {
      width: 8px !important;
      height: 8px !important;
      border-radius: 50% !important;
      background: #888 !important;
      transition: background 0.3s, box-shadow 0.3s !important;
      flex-shrink: 0 !important;
    }
    .fte-face-label {
      font-size: 11px !important;
      color: #ebebeb !important;
      font-weight: 500 !important;
    }
    .fte-violation-badge {
      display: flex !important;
      align-items: center !important;
      gap: 5px !important;
      padding: 4px 10px !important;
      background: rgba(255,255,255,0.04) !important;
      border: 1px solid rgba(204,255,0,0.3) !important;
      border-radius: 20px !important;
      color: #ccff00 !important;
      transition: border-color 0.3s, color 0.3s !important;
    }
    .fte-violation-count {
      font-family: 'JetBrains Mono', monospace !important;
      font-size: 13px !important;
      font-weight: 600 !important;
    }
    .fte-violation-label {
      font-size: 10px !important;
      color: rgba(235,235,235,0.5) !important;
    }
    .fte-conn-status {
      display: flex !important;
      align-items: center !important;
      gap: 6px !important;
    }
    .fte-conn-dot {
      width: 7px !important;
      height: 7px !important;
      border-radius: 50% !important;
      background: #ccff00 !important;
      animation: fte-pulse 2s infinite !important;
      flex-shrink: 0 !important;
    }
    .fte-conn-label {
      font-size: 11px !important;
      color: #ebebeb !important;
    }
    @keyframes fte-pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.5; transform: scale(0.85); }
    }
  `;
  if (!document.getElementById('fte-bar-style')) {
    document.head.appendChild(style);
  }
}

function applyWarningStyles() {
  const style = document.createElement('style');
  style.id = 'fte-warning-style';
  style.textContent = `
    #fte-warning-overlay {
      position: fixed !important;
      inset: 0 !important;
      z-index: 2147483646 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      background: rgba(255,44,44,0.15) !important;
      backdrop-filter: blur(4px) !important;
      animation: fte-fade-in 0.2s ease !important;
      pointer-events: none !important;
    }
    .fte-warning-card {
      background: rgba(20,4,4,0.95) !important;
      border: 1px solid rgba(255,68,68,0.5) !important;
      border-radius: 24px !important;
      padding: 40px 52px !important;
      text-align: center !important;
      font-family: 'Space Grotesk', sans-serif !important;
      max-width: 480px !important;
      box-shadow: 0 0 60px rgba(255,44,44,0.3) !important;
    }
    .fte-warning-icon {
      font-size: 48px !important;
      margin-bottom: 16px !important;
      display: block !important;
    }
    .fte-warning-title {
      font-size: 22px !important;
      font-weight: 700 !important;
      color: #ff4444 !important;
      letter-spacing: 2px !important;
      margin: 0 0 8px !important;
    }
    .fte-warning-type {
      font-family: 'JetBrains Mono', monospace !important;
      font-size: 14px !important;
      color: rgba(255,68,68,0.8) !important;
      margin: 0 0 12px !important;
      letter-spacing: 1px !important;
    }
    .fte-warning-msg {
      font-size: 13px !important;
      color: rgba(235,235,235,0.6) !important;
      margin: 0 0 20px !important;
    }
    .fte-warning-bar {
      height: 3px !important;
      background: #ff4444 !important;
      border-radius: 2px !important;
      animation: fte-shrink 4s linear forwards !important;
    }
    @keyframes fte-fade-in {
      from { opacity: 0; transform: scale(0.95); }
      to { opacity: 1; transform: scale(1); }
    }
    @keyframes fte-shrink {
      from { width: 100%; }
      to { width: 0%; }
    }
  `;
  if (!document.getElementById('fte-warning-style')) {
    document.head.appendChild(style);
  }
}

function applyTerminatedStyles() {
  const style = document.createElement('style');
  style.id = 'fte-term-style';
  style.textContent = `
    #fte-terminated-overlay {
      position: fixed !important;
      inset: 0 !important;
      z-index: 2147483647 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      background: rgba(12,12,12,0.97) !important;
      backdrop-filter: blur(20px) !important;
    }
    .fte-term-card {
      background: rgba(255,255,255,0.03) !important;
      border: 1px solid rgba(255,255,255,0.1) !important;
      border-radius: 24px !important;
      padding: 56px 64px !important;
      text-align: center !important;
      font-family: 'Space Grotesk', sans-serif !important;
      max-width: 480px !important;
    }
    .fte-term-icon { font-size: 56px !important; margin-bottom: 24px !important; display: block !important; }
    .fte-term-title {
      font-size: 28px !important;
      font-weight: 700 !important;
      color: #ebebeb !important;
      letter-spacing: 2px !important;
      margin: 0 0 16px !important;
    }
    .fte-term-reason {
      font-size: 15px !important;
      color: rgba(235,235,235,0.7) !important;
      margin: 0 0 8px !important;
    }
    .fte-term-note {
      font-size: 13px !important;
      color: rgba(235,235,235,0.4) !important;
      margin: 0 !important;
    }
  `;
  if (!document.getElementById('fte-term-style')) {
    document.head.appendChild(style);
  }
}

// ─── Exports ──────────────────────────────────────────────────────────────────
export {
  createStatusBar,
  updateOverlay,
  showWarning,
  showTerminated,
  removeOverlay,
};
