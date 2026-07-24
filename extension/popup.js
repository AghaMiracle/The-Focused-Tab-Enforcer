/**
 * popup.js
 * Popup controller. Manages view state transitions:
 *   idle → verify → select → active
 *
 * Communicates with background.js via chrome.runtime.sendMessage.
 */

import { MSG, EXT_STATE } from './utils/constants.js';
import {
  getSession,
  saveAuthState, getAuthState, clearAuthState,
} from './utils/storage.js';
import { authenticateStudent, startExamSession } from './utils/api.js';
import { formatTime } from './utils/helpers.js';

// ─── DOM Refs ─────────────────────────────────────────────────────────────────
const views = {
  idle:   document.getElementById('view-idle'),
  verify: document.getElementById('view-verify'),
  select: document.getElementById('view-select'),
  active: document.getElementById('view-active'),
};

const settingsBtn    = document.getElementById('settingsBtn');
const footerSettings = document.getElementById('footerSettings');
const goToSettings   = document.getElementById('goToSettings');

// Verify form (Step 1)
const verifyForm     = document.getElementById('verifyForm');
const examIdInput    = document.getElementById('examId');
const emailInput     = document.getElementById('email');
const regNumInput    = document.getElementById('regNumber');
const verifyBtn      = document.getElementById('verifyBtn');
const verifyBtnText  = verifyBtn?.querySelector('.btn-text');
const verifyLoader   = document.getElementById('verifyLoader');
const verifyError    = document.getElementById('verifyError');
const verifyErrorMsg = document.getElementById('verifyErrorMsg');

// Exam Select (Step 2)
const selectSub      = document.getElementById('selectSub');
const examSearch     = document.getElementById('examSearch');
const examList       = document.getElementById('examList');
const examListEmpty  = document.getElementById('examListEmpty');
const selectError    = document.getElementById('selectError');
const selectErrorMsg = document.getElementById('selectErrorMsg');
const selectBackBtn  = document.getElementById('selectBackBtn');
const startExamBtn   = document.getElementById('startExamBtn');
const startExamBtnText = startExamBtn?.querySelector('.btn-text');
const startExamLoader  = document.getElementById('startExamLoader');
const cameraWarning    = document.getElementById('cameraWarning');
const grantCameraLink  = document.getElementById('grantCameraLink');

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
const activeCameraError = document.getElementById('activeCameraError');
const activeCameraErrorMsg = document.getElementById('activeCameraErrorMsg');
const activeCameraSettingsLink = document.getElementById('activeCameraSettingsLink');
const endExamBtn        = document.getElementById('endExamBtn');
const confirmOverlay    = document.getElementById('confirmOverlay');
const cancelEndBtn      = document.getElementById('cancelEndBtn');
const confirmEndBtn     = document.getElementById('confirmEndBtn');

// ─── State ────────────────────────────────────────────────────────────────────
let timerInterval = null;
let sessionStartedAt = null;
let authState = null;      // { studentAuthToken, studentName, availableExams }
let selectedExamId = null;
let cameraPermission = 'unknown'; // 'granted' | 'prompt' | 'denied' | 'unknown'

// ─── View Switching ───────────────────────────────────────────────────────────
function showView(name) {
  Object.entries(views).forEach(([key, el]) => {
    if (el) el.classList.toggle('hidden', key !== name);
  });
}

// ─── Init ─────────────────────────────────────────────────────────────────────
async function init() {
  // 1. Check for an active monitoring session first (highest priority)
  chrome.runtime.sendMessage({ type: MSG.GET_STATUS }, async (resp) => {
    if (chrome.runtime.lastError) {
      await tryRestoreSessionFromStorage();
      return;
    }
    if (resp?.session) {
      renderActiveView(resp.session);
      return;
    }
    // 2. No active exam — check for persisted student auth state
    await tryRestoreAuthState();
  });
}

async function tryRestoreSessionFromStorage() {
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
    await tryRestoreAuthState();
  }
}

async function tryRestoreAuthState() {
  const saved = await getAuthState();
  if (saved?.studentAuthToken) {
    authState = saved;
    selectedExamId = null;
    selectSub.textContent = `Hello ${saved.studentName} — choose an exam to begin.`;
    examSearch.value = '';
    startExamBtn.disabled = true;
    renderExamSelect('');
    showView('select');
    // Warm the offscreen doc + face-api models now so Start Exam is instant.
    triggerPreload();
  } else {
    showView('verify');
  }
}

/**
 * Ask the background service worker to warm the offscreen document
 * (create it, load face-api.js, fetch the models) so that when the student
 * clicks "Start Selected Exam", the only remaining step is getUserMedia.
 *
 * The background also reports the current camera-permission state (without
 * turning the camera on). If access hasn't been granted yet, we surface a
 * banner directing the student to the Settings page — the only place a
 * permission prompt can appear reliably (a popup closes the moment the
 * prompt steals focus).
 *
 * Fire-and-forget — never blocks the popup UI.
 */
function triggerPreload() {
  chrome.runtime.sendMessage({ type: MSG.PRELOAD_MODELS }, (resp) => {
    if (chrome.runtime.lastError) return; // preload is best-effort
    if (resp && resp.ok) {
      cameraPermission = resp.cameraPermission || 'unknown';
      updateCameraHint();
    }
  });
}

/**
 * Show or hide the dedicated camera-access banner in the exam-select view.
 * We keep this separate from the generic error banner so the message is
 * persistent and self-explanatory.
 */
function updateCameraHint() {
  if (!cameraWarning) return;
  const needsGrant = cameraPermission === 'denied' || cameraPermission === 'prompt';
  cameraWarning.classList.toggle('hidden', !needsGrant);
}

// ─── Render Active View ────────────────────────────────────────────────────────
function renderActiveView(sessionData) {
  showView('active');

  const { studentName, examDetails, violationCount, startedAt, faceDetected, isOffline, cameraError } = sessionData;

  // Camera error banner — the most important signal when things break.
  if (activeCameraError && activeCameraErrorMsg) {
    if (cameraError) {
      activeCameraErrorMsg.textContent = cameraError;
      activeCameraError.classList.remove('hidden');
    } else {
      activeCameraError.classList.add('hidden');
    }
  }

  if (studentName) {
    activeStudentName.textContent = studentName;
    studentAvatarInit.textContent = studentName.charAt(0).toUpperCase();
  }
  if (examDetails?.title) {
    activeExamTitle.textContent = examDetails.title;
  }

  const count = violationCount || 0;
  activeViolations.textContent = String(count);
  activeViolations.classList.toggle('has-violations', count > 0);

  activeFaceStatus.textContent = faceDetected ? '✓ Detected' : '✕ No Face';
  activeFaceStatus.style.color = faceDetected ? 'var(--lime)' : 'var(--red)';

  if (isOffline) {
    activeConnStatus.textContent = 'Offline';
    activeConnStatus.style.color = 'var(--orange)';
    offlineBanner.classList.remove('hidden');
  } else {
    activeConnStatus.textContent = 'Online';
    activeConnStatus.style.color = 'var(--white)';
    offlineBanner.classList.add('hidden');
  }

  clearInterval(timerInterval);
  sessionStartedAt = startedAt || Date.now();
  timerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - sessionStartedAt) / 1000);
    activeTimer.textContent = formatTime(elapsed);
  }, 1000);
}

// ─── Render Exam Select View ──────────────────────────────────────────────────
function renderExamSelect(filter = '') {
  if (!authState) return;
  const q = filter.trim().toLowerCase();
  const exams = authState.availableExams.filter((e) =>
    !q ||
    e.title.toLowerCase().includes(q) ||
    (e.examId || '').toLowerCase().includes(q)
  );

  examList.innerHTML = '';
  if (exams.length === 0) {
    examListEmpty.classList.remove('hidden');
    return;
  }
  examListEmpty.classList.add('hidden');

  for (const exam of exams) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'exam-card' + (selectedExamId === exam._id ? ' selected' : '');
    card.dataset.examId = exam._id;
    card.setAttribute('role', 'listitem');

    const dateStr = exam.scheduledDate
      ? new Date(exam.scheduledDate).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      : 'Scheduled TBD';

    card.innerHTML = `
      <div class="exam-card-title">${escapeHtml(exam.title)}</div>
      <div class="exam-card-meta">
        <span class="exam-card-id">${escapeHtml(exam.examId || '—')}</span>
        <span>·</span>
        <span>${escapeHtml(dateStr)}</span>
        <span>·</span>
        <span>${exam.durationMinutes}m</span>
        <span class="exam-card-status ${exam.status}">${exam.status}</span>
      </div>
    `;

    card.addEventListener('click', () => {
      selectedExamId = exam._id;
      renderExamSelect(examSearch.value);
      startExamBtn.disabled = false;
    });

    examList.appendChild(card);
  }
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// ─── Verify Form (Step 1: Authenticate) ───────────────────────────────────────
verifyForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideVerifyError();

  const examId = examIdInput.value.trim();
  const email = emailInput.value.trim().toLowerCase();
  const registrationNumber = regNumInput.value.trim().toUpperCase();

  if (!examId || !email || !registrationNumber) {
    showVerifyError('All fields are required.');
    return;
  }

  setVerifyLoading(true);

  try {
    const result = await authenticateStudent({ examId, email, registrationNumber });
    authState = result;
    selectedExamId = null;
    // Persist auth state so student doesn't have to log in each time the popup opens
    await saveAuthState(result);
    selectSub.textContent = `Hello ${result.studentName} — choose an exam to begin.`;
    examSearch.value = '';
    startExamBtn.disabled = true;
    renderExamSelect('');
    showView('select');
    // Warm the offscreen doc + face-api models now so Start Exam is instant.
    triggerPreload();
  } catch (err) {
    showVerifyError(err.message || 'Login failed. Please try again.');
  } finally {
    setVerifyLoading(false);
  }
});

// ─── Exam Search ──────────────────────────────────────────────────────────────
examSearch?.addEventListener('input', (e) => {
  renderExamSelect(e.target.value);
});

// ─── Back / Log Out ───────────────────────────────────────────────────────────
selectBackBtn?.addEventListener('click', async () => {
  authState = null;
  selectedExamId = null;
  await clearAuthState();
  hideSelectError();
  // Tear down the preloaded offscreen doc — no active exam needs it anymore.
  chrome.runtime.sendMessage({ type: MSG.CLOSE_OFFSCREEN }, () => {
    void chrome.runtime.lastError;
  });
  showView('verify');
});

// ─── Camera-error mapper ──────────────────────────────────────────────────────
/**
 * Convert a raw getUserMedia error (name + message) coming back from the
 * offscreen document into a student-facing message. Also decides whether we
 * should send the student to chrome://settings to grant persistent access.
 */
function explainCameraFailure(errorName, errorMessage) {
  const name = errorName || 'Error';
  const raw  = errorMessage || 'Unknown camera error.';

  if (name === 'NotAllowedError' || name === 'SecurityError' || /Permission|shutdown/i.test(raw)) {
    openChromeCameraSettings();
    return (
      'Camera access is not persistent. In the Chrome tab that just opened, ' +
      'set "Camera" to Allow (not "Allow this time"), reload the extension, then try again.'
    );
  }
  if (name === 'NotReadableError') {
    return 'Your camera is in use by another app (Zoom, Teams, Meet, etc.). Close it and try again.';
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return 'No camera detected. Plug in a webcam or pick a different one in Settings → Camera.';
  }
  return 'Camera check failed: ' + name + ' — ' + raw;
}

// ─── Start Exam (Step 2) ──────────────────────────────────────────────────────
startExamBtn?.addEventListener('click', async () => {
  if (!authState || !selectedExamId) return;
  hideSelectError();
  setStartExamLoading(true);

  try {
    // 1. Get the current active tab (will be the exam window).
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) throw new Error('Could not identify active tab.');

    // 2. Register the session on the backend.
    const result = await startExamSession({
      studentAuthToken: authState.studentAuthToken,
      examId: selectedExamId,
    });

    // 3. Ask the background to start monitoring. This opens the camera in
    //    the offscreen document. The response tells us whether the camera
    //    actually came up, plus a structured error if not.
    const resp = await sendToBackground(MSG.START_MONITORING, {
      sessionToken: result.sessionToken,
      sessionId: result.sessionId,
      examConfig: result.monitoringConfig,
      examDetails: result.examDetails,
      studentName: result.studentName,
      tabId: tab.id,
    });

    if (!resp.ok) throw new Error(resp.error || 'Failed to start monitoring.');

    // Even if the camera failed, the session is running (tab monitoring,
    // heartbeat, backend session). We render the active view and surface
    // the camera error inside it so the student can act on it.
    const cameraErrorMsg = resp.cameraOk
      ? null
      : explainCameraFailure(resp.cameraErrorName, resp.cameraError);

    renderActiveView({
      studentName: result.studentName,
      examDetails: result.examDetails,
      violationCount: 0,
      startedAt: Date.now(),
      faceDetected: false,
      isOffline: false,
      cameraError: cameraErrorMsg,
    });
  } catch (err) {
    showSelectError(err.message || 'Failed to start exam.');
  } finally {
    setStartExamLoading(false);
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
    // Keep authState so student can pick another exam without re-logging in
    selectedExamId = null;
    if (authState) {
      renderExamSelect('');
      showView('select');
    } else {
      showView('verify');
    }
  }
});

// ─── Settings Navigation ──────────────────────────────────────────────────────
function openSettings() {
  chrome.runtime.openOptionsPage();
}

settingsBtn?.addEventListener('click', openSettings);
footerSettings?.addEventListener('click', (e) => { e.preventDefault(); openSettings(); });
goToSettings?.addEventListener('click', openSettings);
/**
 * Open Chrome's site-details page for THIS extension origin. That page lets
 * the student flip Camera from "Ask (default)" or "Allow this time" to a
 * persistent "Allow", which is what the offscreen doc requires.
 */
function openChromeCameraSettings() {
  try {
    const url = 'chrome://settings/content/siteDetails?site=chrome-extension%3A%2F%2F' + chrome.runtime.id + '%2F';
    chrome.tabs.create({ url });
  } catch {
    openSettings();
  }
}

grantCameraLink?.addEventListener('click', (e) => { e.preventDefault(); openChromeCameraSettings(); });
activeCameraSettingsLink?.addEventListener('click', (e) => { e.preventDefault(); openChromeCameraSettings(); });

// ─── Background Status Updates ────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === MSG.STATUS_UPDATE) {
    const { session } = message.payload;
    if (session) {
      renderActiveView(session);
    } else {
      clearInterval(timerInterval);
      // If student is still logged in, show exam select; otherwise verify
      if (authState) {
        showView('select');
      } else {
        showView('verify');
      }
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

function setVerifyLoading(loading) {
  verifyBtn.disabled = loading;
  verifyBtnText.classList.toggle('hidden', loading);
  verifyLoader.classList.toggle('hidden', !loading);
}

function setStartExamLoading(loading) {
  startExamBtn.disabled = loading || !selectedExamId;
  startExamBtnText.classList.toggle('hidden', loading);
  startExamLoader.classList.toggle('hidden', !loading);
}

function showVerifyError(msg) {
  verifyErrorMsg.textContent = msg;
  verifyError.classList.remove('hidden');
}

function hideVerifyError() {
  verifyError.classList.add('hidden');
  verifyErrorMsg.textContent = '';
}

function showSelectError(msg) {
  selectErrorMsg.textContent = msg;
  selectError.classList.remove('hidden');
}

function hideSelectError() {
  selectError.classList.add('hidden');
  selectErrorMsg.textContent = '';
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
init();
