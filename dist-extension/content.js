/**
 * content.js — Classic content script (NO ES imports).
 *
 * Injected into every page. Activates only when an active exam session is
 * stored and the current URL matches allowed domains.
 *
 * IMPORTANT: Statically declared content scripts run as CLASSIC scripts and
 * CANNOT use `import`/`export`. That is why all constants, helpers, and the
 * overlay UI code are inlined below rather than pulled in from utils/*.js.
 * Editing this file is safe; keep it dependency-free.
 *
 * Responsibilities:
 *  - Draw the monitoring status bar + webcam preview.
 *  - Enforce anti-cheat behavior (no copy/paste/context-menu/devtools).
 *  - Relay page-visibility events to the background worker.
 *  - Render camera / face-detection error banners.
 *  - Show admin-terminated overlay.
 */

/* eslint-disable no-var */
(function () {
  'use strict';

  // ─── Inlined constants (subset of utils/constants.js used here) ────────────
  var MSG = {
    START_MONITORING:   'START_MONITORING',
    STOP_MONITORING:    'STOP_MONITORING',
    GET_STATUS:         'GET_STATUS',
    VERIFY_STUDENT:     'VERIFY_STUDENT',
    END_EXAM:           'END_EXAM',
    INIT_OVERLAY:       'INIT_OVERLAY',
    REMOVE_OVERLAY:     'REMOVE_OVERLAY',
    UPDATE_OVERLAY:     'UPDATE_OVERLAY',
    SHOW_WARNING:       'SHOW_WARNING',
    TERMINATE_EXAM:     'TERMINATE_EXAM',
    VIOLATION_DETECTED: 'VIOLATION_DETECTED',
    FACE_STATUS:        'FACE_STATUS',
    SNAPSHOT:           'SNAPSHOT',
    PAGE_VISIBLE:       'PAGE_VISIBLE',
    PAGE_HIDDEN:        'PAGE_HIDDEN',
    CONTENT_READY:      'CONTENT_READY',
    STATUS_UPDATE:      'STATUS_UPDATE',
  };

  var VIOLATION_TYPES = {
    TAB_SWITCH:      'tab_switch',
    WINDOW_BLUR:     'window_blur',
    FACE_ABSENCE:    'face_absence',
    MULTIPLE_FACES:  'multiple_faces',
    ATTENTION_AWAY:  'attention_away',
    PERMISSION_DENIED: 'permission_denied',
    DEVTOOLS_OPENED: 'devtools_opened',
    FULLSCREEN_EXIT: 'fullscreen_exit',
    APP_SWITCH:      'app_switch',
  };

  var SEVERITY = { LOW: 'low', MEDIUM: 'medium', HIGH: 'high' };

  var STORAGE_KEYS = {
    ACTIVE_SESSION: 'fte_active_session',
  };

  // ─── Inlined helpers ───────────────────────────────────────────────────────
  function formatTime(totalSeconds) {
    var h = Math.floor(totalSeconds / 3600);
    var m = Math.floor((totalSeconds % 3600) / 60);
    var s = totalSeconds % 60;
    return [h, m, s].map(function (v) { return String(v).padStart(2, '0'); }).join(':');
  }

  function throttle(fn, limit) {
    var lastCall = 0;
    return function () {
      var now = Date.now();
      if (now - lastCall >= limit) {
        lastCall = now;
        return fn.apply(this, arguments);
      }
    };
  }

  function isAllowedDomain(url, allowedDomains) {
    if (!allowedDomains || allowedDomains.length === 0) return true;
    try {
      var hostname = new URL(url).hostname;
      return allowedDomains.some(function (domain) {
        var clean = domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
        return hostname === clean || hostname.endsWith('.' + clean);
      });
    } catch (_) {
      return false;
    }
  }

  function getSession() {
    return new Promise(function (resolve) {
      try {
        chrome.storage.local.get(STORAGE_KEYS.ACTIVE_SESSION, function (result) {
          resolve(result[STORAGE_KEYS.ACTIVE_SESSION] || null);
        });
      } catch (_) {
        resolve(null);
      }
    });
  }

  // ─── Runtime state ─────────────────────────────────────────────────────────
  var isMonitoring = false;
  var examConfig = null;
  var devToolsCheckInterval = null;

  // Overlay element handles
  var statusBar = null;
  var previewImg = null;
  var warningOverlay = null;
  var terminatedOverlay = null;
  var faceErrorBanner = null;
  var timerInterval = null;
  var startTime = null;
  var warningTimeout = null;

  // ─── Init ──────────────────────────────────────────────────────────────────
  function init() {
    getSession().then(function (session) {
      if (!session || session.state !== 'active') return;
      var allowed = session.examConfig && session.examConfig.allowedDomains;
      if (allowed && allowed.length > 0 && !isAllowedDomain(window.location.href, allowed)) {
        return;
      }
      activateMonitoring(session);
    });
  }

  function activateMonitoring(session) {
    if (isMonitoring) return;
    isMonitoring = true;
    examConfig = session.examConfig || {};

    createStatusBar(session.examDetails, session.studentName);
    installAntiCheat();
    requestFullscreen();
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    startDevToolsDetection();

    try {
      chrome.runtime.sendMessage({ type: MSG.CONTENT_READY });
    } catch (_) {}
  }

  // ─── Anti-cheat handlers ───────────────────────────────────────────────────
  function installAntiCheat() {
    document.addEventListener('copy', preventEvent, true);
    document.addEventListener('cut', preventEvent, true);
    document.addEventListener('paste', preventEvent, true);
    document.addEventListener('contextmenu', preventEvent, true);
    document.addEventListener('keydown', handleKeydown, true);
    window.addEventListener('beforeprint', function (e) { e.preventDefault(); }, true);
  }

  function preventEvent(e) { e.preventDefault(); e.stopPropagation(); }

  function handleKeydown(e) {
    if (!isMonitoring) return;
    if (e.key === 'F12') {
      e.preventDefault(); e.stopPropagation();
      flagDevTools('F12 pressed');
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
      var k = e.key.toUpperCase();
      if (['I', 'J', 'C', 'K'].indexOf(k) !== -1) {
        e.preventDefault(); e.stopPropagation();
        flagDevTools('Ctrl+Shift+' + k);
        return;
      }
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') { preventEvent(e); return; }
    if ((e.ctrlKey || e.metaKey) && ['c', 'x', 'v'].indexOf(e.key.toLowerCase()) !== -1) {
      preventEvent(e); return;
    }
    if (e.key === 'Escape') setTimeout(requestFullscreen, 300);
  }

  var _throttledDevToolsViolation = throttle(function () {
    sendViolation(VIOLATION_TYPES.DEVTOOLS_OPENED, SEVERITY.HIGH);
  }, 5000);

  function flagDevTools() { _throttledDevToolsViolation(); }

  function startDevToolsDetection() {
    var open = false;
    devToolsCheckInterval = setInterval(function () {
      var thresh = 200;
      var wDiff = window.outerWidth - window.innerWidth;
      var hDiff = window.outerHeight - window.innerHeight;
      var isOpen = wDiff > thresh || hDiff > thresh;
      if (isOpen && !open) { open = true; _throttledDevToolsViolation(); }
      else if (!isOpen) { open = false; }
    }, 2000);
  }

  // ─── Fullscreen ────────────────────────────────────────────────────────────
  function requestFullscreen() {
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(function () {});
    }
  }

  function handleFullscreenChange() {
    if (!document.fullscreenElement && isMonitoring) {
      sendViolation(VIOLATION_TYPES.FULLSCREEN_EXIT, SEVERITY.MEDIUM);
      setTimeout(requestFullscreen, 500);
    }
  }

  // ─── Page visibility ───────────────────────────────────────────────────────
  function handleVisibilityChange() {
    if (!isMonitoring) return;
    try {
      chrome.runtime.sendMessage({
        type: document.hidden ? MSG.PAGE_HIDDEN : MSG.PAGE_VISIBLE,
      });
    } catch (_) {}
  }

  function handleBeforeUnload(e) {
    if (!isMonitoring) return;
    e.preventDefault();
    e.returnValue = 'Leaving this page will terminate your exam session. Are you sure?';
    return e.returnValue;
  }

  // ─── Relay helpers ────────────────────────────────────────────────────────
  function sendViolation(type, severity, metadata) {
    try {
      chrome.runtime.sendMessage({
        type: MSG.VIOLATION_DETECTED,
        payload: { violationType: type, severity: severity, metadata: metadata || {} },
      });
    } catch (_) {}
  }

  // ─── Font injection (used by the overlay) ──────────────────────────────────
  function injectFonts() {
    if (document.getElementById('fte-fonts')) return;
    var link = document.createElement('link');
    link.id = 'fte-fonts';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap';
    document.head.appendChild(link);
  }

  // ─── Status bar ────────────────────────────────────────────────────────────
  function createStatusBar(examDetails, studentName) {
    if (statusBar) statusBar.remove();
    injectFonts();

    statusBar = document.createElement('div');
    statusBar.id = 'fte-status-bar';
    statusBar.innerHTML = ''
      + '<div class="fte-bar-left">'
      +   '<div class="fte-logo">FT</div>'
      +   '<div class="fte-status-info">'
      +     '<span class="fte-status-label">MONITORING ACTIVE</span>'
      +     '<span class="fte-exam-title">' + escapeHtml((examDetails && examDetails.title) || 'Exam') + '</span>'
      +   '</div>'
      + '</div>'
      + '<div class="fte-bar-center">'
      +   '<div class="fte-timer-wrap">'
      +     '<span class="fte-timer-icon">⏱</span>'
      +     '<span class="fte-timer" id="fte-timer">00:00:00</span>'
      +   '</div>'
      +   '<div class="fte-face-status">'
      +     '<span class="fte-face-dot" id="fte-face-dot"></span>'
      +     '<span class="fte-face-label" id="fte-face-label">Detecting…</span>'
      +   '</div>'
      + '</div>'
      + '<div class="fte-bar-right">'
      +   '<div class="fte-violation-badge" id="fte-violation-badge">'
      +     '<span class="fte-violation-count" id="fte-violation-count">0</span>'
      +     '<span class="fte-violation-label">violations</span>'
      +   '</div>'
      +   '<div class="fte-conn-status">'
      +     '<span class="fte-conn-dot"></span>'
      +     '<span class="fte-conn-label" id="fte-conn-label">Online</span>'
      +   '</div>'
      + '</div>';

    applyStatusBarStyles();
    (document.body || document.documentElement).appendChild(statusBar);
    startTime = Date.now();

    timerInterval = setInterval(function () {
      var elapsed = Math.floor((Date.now() - startTime) / 1000);
      var el = document.getElementById('fte-timer');
      if (el) el.textContent = formatTime(elapsed);
    }, 1000);

    createPreviewElement();
  }

  function createPreviewElement() {
    if (previewImg) return;
    previewImg = document.createElement('img');
    previewImg.id = 'fte-preview';
    previewImg.alt = 'Your webcam feed';
    previewImg.style.cssText = [
      'position:fixed !important',
      'bottom:16px !important',
      'right:16px !important',
      'width:200px !important',
      'height:150px !important',
      'border-radius:12px !important',
      'border:2px solid rgba(204,255,0,0.4) !important',
      'box-shadow:0 6px 24px rgba(0,0,0,0.5) !important',
      'object-fit:cover !important',
      'z-index:2147483645 !important',
      'background:rgba(12,12,12,0.9) !important',
      'pointer-events:none !important',
      'opacity:0.95 !important',
    ].join(';');
    (document.body || document.documentElement).appendChild(previewImg);
  }

  function updatePreviewFrame(dataUrl) {
    if (!previewImg) createPreviewElement();
    if (previewImg && dataUrl) previewImg.src = dataUrl;
  }

  function updateOverlay(data) {
    var count = data.violationCount || 0;
    var countEl = document.getElementById('fte-violation-count');
    var badgeEl = document.getElementById('fte-violation-badge');
    if (countEl) countEl.textContent = String(count);
    if (badgeEl) {
      badgeEl.style.borderColor = count > 0 ? 'rgba(255,68,68,0.6)' : 'rgba(204,255,0,0.3)';
      badgeEl.style.color = count > 0 ? '#ff4444' : '#ccff00';
    }
    var faceDot = document.getElementById('fte-face-dot');
    var faceLabel = document.getElementById('fte-face-label');
    if (faceDot && faceLabel) {
      faceDot.style.background = data.faceDetected ? '#ccff00' : '#ff4444';
      faceDot.style.boxShadow = data.faceDetected
        ? '0 0 6px rgba(204,255,0,0.8)'
        : '0 0 6px rgba(255,68,68,0.8)';
      faceLabel.textContent = data.faceDetected ? 'Face OK' : 'No Face';
      faceLabel.style.color = data.faceDetected ? '#ccff00' : '#ff4444';
    }
    var connLabel = document.getElementById('fte-conn-label');
    if (connLabel) {
      connLabel.textContent = data.isOnline ? 'Online' : 'Offline';
      connLabel.style.color = data.isOnline ? '#ebebeb' : '#ff8c00';
    }
  }

  function showWarning(violationType) {
    if (warningOverlay) warningOverlay.remove();
    clearTimeout(warningTimeout);
    var label = String(violationType || '').replace(/_/g, ' ').toUpperCase();

    warningOverlay = document.createElement('div');
    warningOverlay.id = 'fte-warning-overlay';
    warningOverlay.innerHTML = ''
      + '<div class="fte-warning-card">'
      +   '<div class="fte-warning-icon">⚠</div>'
      +   '<h2 class="fte-warning-title">VIOLATION DETECTED</h2>'
      +   '<p class="fte-warning-type">' + escapeHtml(label) + '</p>'
      +   '<p class="fte-warning-msg">This incident has been logged and reported to your examiner.</p>'
      +   '<div class="fte-warning-bar"></div>'
      + '</div>';
    applyWarningStyles();
    (document.body || document.documentElement).appendChild(warningOverlay);
    warningTimeout = setTimeout(function () {
      if (warningOverlay) { warningOverlay.remove(); warningOverlay = null; }
    }, 4000);
  }

  function showTerminated(reason) {
    if (terminatedOverlay) return;
    terminatedOverlay = document.createElement('div');
    terminatedOverlay.id = 'fte-terminated-overlay';
    terminatedOverlay.innerHTML = ''
      + '<div class="fte-term-card">'
      +   '<div class="fte-term-icon">🔒</div>'
      +   '<h2 class="fte-term-title">EXAM TERMINATED</h2>'
      +   '<p class="fte-term-reason">' + escapeHtml(reason || 'Your exam session has been ended.') + '</p>'
      +   '<p class="fte-term-note">Please contact your examiner for further instructions.</p>'
      + '</div>';
    applyTerminatedStyles();
    (document.body || document.documentElement).appendChild(terminatedOverlay);
  }

  function showFaceError(message) {
    if (faceErrorBanner) faceErrorBanner.remove();
    faceErrorBanner = document.createElement('div');
    faceErrorBanner.id = 'fte-face-error';
    faceErrorBanner.textContent = '⚠ ' + (message || 'Camera error');
    faceErrorBanner.style.cssText = [
      'position:fixed !important',
      'bottom:180px !important',
      'right:16px !important',
      'z-index:2147483645 !important',
      'background:rgba(12,12,12,0.94) !important',
      'border:1px solid rgba(255,140,0,0.5) !important',
      'border-radius:12px !important',
      'padding:10px 14px !important',
      "font-family:'Space Grotesk',sans-serif !important",
      'font-size:12px !important',
      'color:#ff8c00 !important',
      'max-width:220px !important',
      'pointer-events:none !important',
      'box-shadow:0 4px 12px rgba(0,0,0,0.4) !important',
    ].join(';');
    (document.body || document.documentElement).appendChild(faceErrorBanner);
    // Sticky — persists until camera recovers.
  }

  function clearFaceError() {
    if (faceErrorBanner) { faceErrorBanner.remove(); faceErrorBanner = null; }
  }

  function removeOverlay() {
    clearInterval(timerInterval);
    clearTimeout(warningTimeout);
    if (statusBar) statusBar.remove();
    if (warningOverlay) warningOverlay.remove();
    if (previewImg) previewImg.remove();
    if (faceErrorBanner) faceErrorBanner.remove();
    statusBar = warningOverlay = previewImg = faceErrorBanner = null;
    timerInterval = null;
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, function (c) {
      return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c];
    });
  }

  // ─── Styles (injected once) ────────────────────────────────────────────────
  function applyStatusBarStyles() {
    if (document.getElementById('fte-bar-style')) return;
    var style = document.createElement('style');
    style.id = 'fte-bar-style';
    style.textContent = [
      '#fte-status-bar{position:fixed !important;top:0 !important;left:0 !important;right:0 !important;height:52px !important;z-index:2147483647 !important;display:flex !important;align-items:center !important;justify-content:space-between !important;padding:0 20px !important;background:rgba(12,12,12,0.92) !important;backdrop-filter:blur(16px) !important;-webkit-backdrop-filter:blur(16px) !important;border-bottom:1px solid rgba(204,255,0,0.2) !important;font-family:"Space Grotesk",sans-serif !important;box-shadow:0 2px 24px rgba(0,0,0,0.6),0 1px 0 rgba(204,255,0,0.1) !important;pointer-events:none !important;user-select:none !important;}',
      '.fte-bar-left,.fte-bar-center,.fte-bar-right{display:flex !important;align-items:center !important;gap:12px !important;}',
      '.fte-logo{width:32px !important;height:32px !important;background:#ccff00 !important;color:#0c0c0c !important;border-radius:8px !important;display:flex !important;align-items:center !important;justify-content:center !important;font-weight:700 !important;font-size:13px !important;letter-spacing:-0.5px !important;flex-shrink:0 !important;}',
      '.fte-status-info{display:flex !important;flex-direction:column !important;gap:1px !important;}',
      '.fte-status-label{font-size:9px !important;font-weight:600 !important;letter-spacing:1.5px !important;color:#ccff00 !important;line-height:1 !important;}',
      '.fte-exam-title{font-size:12px !important;color:rgba(235,235,235,0.7) !important;max-width:200px !important;overflow:hidden !important;text-overflow:ellipsis !important;white-space:nowrap !important;}',
      '.fte-timer-wrap{display:flex !important;align-items:center !important;gap:6px !important;}',
      '.fte-timer{font-family:"JetBrains Mono",monospace !important;font-size:16px !important;font-weight:600 !important;color:#ebebeb !important;letter-spacing:1px !important;}',
      '.fte-face-status{display:flex !important;align-items:center !important;gap:6px !important;padding:4px 10px !important;background:rgba(255,255,255,0.04) !important;border:1px solid rgba(255,255,255,0.08) !important;border-radius:20px !important;}',
      '.fte-face-dot{width:8px !important;height:8px !important;border-radius:50% !important;background:#888 !important;flex-shrink:0 !important;}',
      '.fte-face-label{font-size:11px !important;color:#ebebeb !important;font-weight:500 !important;}',
      '.fte-violation-badge{display:flex !important;align-items:center !important;gap:5px !important;padding:4px 10px !important;background:rgba(255,255,255,0.04) !important;border:1px solid rgba(204,255,0,0.3) !important;border-radius:20px !important;color:#ccff00 !important;}',
      '.fte-violation-count{font-family:"JetBrains Mono",monospace !important;font-size:13px !important;font-weight:600 !important;}',
      '.fte-violation-label{font-size:10px !important;color:rgba(235,235,235,0.5) !important;}',
      '.fte-conn-dot{width:7px !important;height:7px !important;border-radius:50% !important;background:#ccff00 !important;animation:fte-pulse 2s infinite !important;}',
      '.fte-conn-label{font-size:11px !important;color:#ebebeb !important;}',
      '@keyframes fte-pulse{0%,100%{opacity:1;transform:scale(1);}50%{opacity:0.5;transform:scale(0.85);}}',
    ].join('\n');
    document.head.appendChild(style);
  }

  function applyWarningStyles() {
    if (document.getElementById('fte-warning-style')) return;
    var style = document.createElement('style');
    style.id = 'fte-warning-style';
    style.textContent = [
      '#fte-warning-overlay{position:fixed !important;inset:0 !important;z-index:2147483646 !important;display:flex !important;align-items:center !important;justify-content:center !important;background:rgba(255,44,44,0.15) !important;backdrop-filter:blur(4px) !important;pointer-events:none !important;}',
      '.fte-warning-card{background:rgba(20,4,4,0.95) !important;border:1px solid rgba(255,68,68,0.5) !important;border-radius:24px !important;padding:40px 52px !important;text-align:center !important;font-family:"Space Grotesk",sans-serif !important;max-width:480px !important;box-shadow:0 0 60px rgba(255,44,44,0.3) !important;}',
      '.fte-warning-icon{font-size:48px !important;margin-bottom:16px !important;display:block !important;}',
      '.fte-warning-title{font-size:22px !important;font-weight:700 !important;color:#ff4444 !important;letter-spacing:2px !important;margin:0 0 8px !important;}',
      '.fte-warning-type{font-family:"JetBrains Mono",monospace !important;font-size:14px !important;color:rgba(255,68,68,0.8) !important;margin:0 0 12px !important;letter-spacing:1px !important;}',
      '.fte-warning-msg{font-size:13px !important;color:rgba(235,235,235,0.6) !important;margin:0 0 20px !important;}',
      '.fte-warning-bar{height:3px !important;background:#ff4444 !important;border-radius:2px !important;animation:fte-shrink 4s linear forwards !important;}',
      '@keyframes fte-shrink{from{width:100%;}to{width:0%;}}',
    ].join('\n');
    document.head.appendChild(style);
  }

  function applyTerminatedStyles() {
    if (document.getElementById('fte-term-style')) return;
    var style = document.createElement('style');
    style.id = 'fte-term-style';
    style.textContent = [
      '#fte-terminated-overlay{position:fixed !important;inset:0 !important;z-index:2147483647 !important;display:flex !important;align-items:center !important;justify-content:center !important;background:rgba(12,12,12,0.97) !important;backdrop-filter:blur(20px) !important;}',
      '.fte-term-card{background:rgba(255,255,255,0.03) !important;border:1px solid rgba(255,255,255,0.1) !important;border-radius:24px !important;padding:56px 64px !important;text-align:center !important;font-family:"Space Grotesk",sans-serif !important;max-width:480px !important;}',
      '.fte-term-icon{font-size:56px !important;margin-bottom:24px !important;display:block !important;}',
      '.fte-term-title{font-size:28px !important;font-weight:700 !important;color:#ebebeb !important;letter-spacing:2px !important;margin:0 0 16px !important;}',
      '.fte-term-reason{font-size:15px !important;color:rgba(235,235,235,0.7) !important;margin:0 0 8px !important;}',
      '.fte-term-note{font-size:13px !important;color:rgba(235,235,235,0.4) !important;margin:0 !important;}',
    ].join('\n');
    document.head.appendChild(style);
  }

  // ─── Message listener from background ─────────────────────────────────────
  chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    var type = message && message.type;
    var payload = message && message.payload;

    switch (type) {
      case MSG.INIT_OVERLAY: {
        activateMonitoring({
          state: 'active',
          examDetails: payload.examDetails,
          studentName: payload.studentName,
          examConfig: payload.examConfig,
        });
        sendResponse({ ok: true });
        break;
      }
      case MSG.UPDATE_OVERLAY: {
        updateOverlay(payload);
        sendResponse({ ok: true });
        break;
      }
      case MSG.SHOW_WARNING: {
        showWarning(payload.violationType);
        sendResponse({ ok: true });
        break;
      }
      case MSG.REMOVE_OVERLAY: {
        removeOverlay();
        isMonitoring = false;
        clearInterval(devToolsCheckInterval);
        sendResponse({ ok: true });
        break;
      }
      case MSG.TERMINATE_EXAM: {
        removeOverlay();
        isMonitoring = false;
        clearInterval(devToolsCheckInterval);
        window.removeEventListener('beforeunload', handleBeforeUnload);
        showTerminated(payload && payload.reason);
        sendResponse({ ok: true });
        break;
      }
      case MSG.FACE_STATUS: {
        clearFaceError();
        sendResponse({ ok: true });
        break;
      }
      case 'PREVIEW_FRAME': {
        if (isMonitoring && payload && payload.frame) updatePreviewFrame(payload.frame);
        sendResponse({ ok: true });
        break;
      }
      case 'FACE_ERROR': {
        showFaceError((payload && payload.message) || 'Face detection error.');
        sendResponse({ ok: true });
        break;
      }
      default:
        sendResponse({ ok: false });
    }
    return false;
  });

  // ─── Boot ─────────────────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
