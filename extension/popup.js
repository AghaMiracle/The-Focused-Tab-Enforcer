/**
 * popup.js
 * Popup controller. Manages view state transitions:
 *   idle → verify → active
 *
 * Communicates with background.js via chrome.runtime.sendMessage.
 */

import { MSG, EXT_STATE } from './utils/constants.js';
import { getSettings, getSession } from './utils/storage.js';
import { verifyStudent } from './utils/api.js';
import { formatTime } from './utils/helpers.js';

// ─── DOM Refs ─────────────────────────────────────────────────────────────────
const views = {
  idle:   document.getElementById('view-idle'),
  verify: document.getElementById('view-verify'),
  active: document.getElementById('view-active'),
};

const settingsBtn    = document.getElementById('settingsBtn');
const footerSettings = document.getElementById('footerSettings');
const goToSettings   = document.getElementById('goToSettings');
const noKeyWarning   = document.getElementById('noKeyWarning');

// Verify form
const verifyForm     = document.getElementById('verifyForm');
const examIdInput    = document.getElementById('examId');
const emailInput     = document.getElementById('email');
const regNumInput    = document.getElementById('regNumber');
const verifyBtn      = document.getElementById('verifyBtn');
const verifyBtnText  = verifyBtn?.querySelector('.btn-text');
const verifyLoader   = document.getElementById('verifyLoader');
const verifyError    = document.getElementById('verifyError');
const verifyErrorMsg = document.getElementById('verifyErrorMsg');

// Active view
const activePulseDot    = document.getElementById('activePulseDot');
const activeStatusText  = document.getElementById('activeStatusText');
const activeStudentName = document.getElementById('activeStudentName');
const activeExamTitle   = document.getElementById('activeExamTitle');
const studentAvatarInit = document.getElementById('studentAvatarInitial');
const activeTimer       = document.getElementById('activeTimer');
const activeViolations  = document.getElementById('activeViolations');
const activeFaceStatus  = document.getElementById('activeFaceStatus');
const activeConnStatus  = document.getElementById('activeConnStatus');
const offlineBanner     = document.getElementById('offlineBanner');
const endExamBtn        = document.getElementById('endExamBtn');
const confirmOverlay    = document.getElementById('confirmOverlay');
const cancelEndBtn      = document.getElementById('cancelEndBtn');
const confirmEndBtn     = document.getElementById('confirmEndBtn');

// ─── State ────────────────────────────────────────────────────────────────────
let timerInterval = null;
let sessionStartedAt = null;

// ─── View Switching ───────────────────────────────────────────────────────────
function showView(name) {
  Object.entries(views).forEach(([key, el]) => {
    el.classList.toggle('hidden', key !== name);
  });
}

// ─── Init ─────────────────────────────────────────────────────────────────────
async function init() {
  // Check for API key
  const settings = await getSettings();
  if (!settings.institutionKey) {
    noKeyWarning.classList.remove('hidden');
  }

  // Get current session state from background
  chrome.runtime.sendMessage({ type: MSG.GET_STATUS }, (resp) => {
    if (chrome.runtime.lastError) {
      // Background not ready yet — check storage directly
      checkStorageSession();
      return;
    }
    if (resp?.session) {
      renderActiveView(resp.session);
    } else {
      // No active session — show idle or verify based on current tab
      checkCurrentTab(settings);
    }
  });
}

async function checkStorageSession() {
  const session = await getSession();
  if (session && session.state === EXT_STATE.ACTIVE) {
    renderActiveView({
      state: session.state,
      studentName: session.studentName,
      examDetails: session.examDetails,
      violationCount: session.violationCount,
      startedAt: session.startedAt,
      faceDetected: session.faceDetected,
      isOffline: false,
    });
  } else {
    showView('idle');
  }
}

async function checkCurrentTab(settings) {
  // If we have an API key and we're on a page, show verify form
  if (settings.institutionKey) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
      showView('verify');
    } else {
      showView('idle');
    }
  } else {
    showView('idle');
  }
}

// ─── Render Active View ────────────────────────────────────────────────────────
function renderActiveView(sessionData) {
  showView('active');

  const { studentName, examDetails, violationCount, startedAt, faceDetected, isOffline } = sessionData;

  if (studentName) {
    activeStudentName.textContent = studentName;
    studentAvatarInit.textContent = studentName.charAt(0).toUpperCase();
  }
  if (examDetails?.title) {
    activeExamTitle.textContent = examDetails.title;
  }

  // Update violation count
  const count = violationCount || 0;
  activeViolations.textContent = String(count);
  activeViolations.classList.toggle('has-violations', count > 0);

  // Face status
  activeFaceStatus.textContent = faceDetected ? '✓ Detected' : '✕ No Face';
  activeFaceStatus.style.color = faceDetected ? 'var(--lime)' : 'var(--red)';

  // Connection
  if (isOffline) {
    activeConnStatus.textContent = 'Offline';
    activeConnStatus.style.color = 'var(--orange)';
    offlineBanner.classList.remove('hidden');
  } else {
    activeConnStatus.textContent = 'Online';
    activeConnStatus.style.color = 'var(--white)';
    offlineBanner.classList.add('hidden');
  }

  // Start timer
  clearInterval(timerInterval);
  sessionStartedAt = startedAt || Date.now();
  timerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - sessionStartedAt) / 1000);
    activeTimer.textContent = formatTime(elapsed);
  }, 1000);
}

// ─── Verify Form ───────────────────────────────────────────────────────────────
verifyForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideError();

  const examId = examIdInput.value.trim();
  const email = emailInput.value.trim().toLowerCase();
  const registrationNumber = regNumInput.value.trim().toUpperCase();

  if (!examId || !email || !registrationNumber) {
    showError('All fields are required.');
    return;
  }

  setLoading(true);

  try {
    // Verify with backend
    const result = await verifyStudent({ examId, email, registrationNumber });

    // Get current active tab ID
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) throw new Error('Could not identify active tab.');

    // Start monitoring via background
    const resp = await sendToBackground(MSG.START_MONITORING, {
      sessionToken: result.sessionToken,
      sessionId: result.sessionId || result.enrollmentId,
      examConfig: result.monitoringConfig,
      examDetails: result.examDetails,
      studentName: result.studentName,
      tabId: tab.id,
    });

    if (!resp.ok) throw new Error(resp.error || 'Failed to start monitoring.');

    // Render active view
    renderActiveView({
      studentName: result.studentName,
      examDetails: result.examDetails,
      violationCount: 0,
      startedAt: Date.now(),
      faceDetected: false,
      isOffline: false,
    });

  } catch (err) {
    showError(err.message || 'Verification failed. Please try again.');
  } finally {
    setLoading(false);
  }
});

// ─── End Exam ─────────────────────────────────────────────────────────────────
endExamBtn?.addEventListener('click', () => {
  confirmOverlay.classList.remove('hidden');
});

cancelEndBtn?.addEventListener('click', () => {
  confirmOverlay.classList.add('hidden');
});

confirmEndBtn?.addEventListener('click', async () => {
  confirmOverlay.classList.add('hidden');
  clearInterval(timerInterval);

  const resp = await sendToBackground(MSG.END_EXAM, {});
  if (resp?.ok) {
    showView('idle');
  }
});

// ─── Settings Navigation ──────────────────────────────────────────────────────
function openSettings() {
  chrome.runtime.openOptionsPage();
}

settingsBtn?.addEventListener('click', openSettings);
footerSettings?.addEventListener('click', (e) => { e.preventDefault(); openSettings(); });
goToSettings?.addEventListener('click', openSettings);

// ─── Background Status Updates ────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === MSG.STATUS_UPDATE) {
    const { session } = message.payload;
    if (session) {
      renderActiveView(session);
    } else {
      clearInterval(timerInterval);
      showView('idle');
    }
  }
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
function sendToBackground(type, payload) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type, payload }, (resp) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, error: chrome.runtime.lastError.message });
      } else {
        resolve(resp || { ok: false });
      }
    });
  });
}

function setLoading(loading) {
  verifyBtn.disabled = loading;
  verifyBtnText.classList.toggle('hidden', loading);
  verifyLoader.classList.toggle('hidden', !loading);
}

function showError(msg) {
  verifyErrorMsg.textContent = msg;
  verifyError.classList.remove('hidden');
}

function hideError() {
  verifyError.classList.add('hidden');
  verifyErrorMsg.textContent = '';
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
init();
