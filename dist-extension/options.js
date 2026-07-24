/**
 * options.js
 * Settings page controller.
 * Handles server URL settings and preferences.
 * No API key needed — students connect via Exam ID.
 */

import { getSettings, saveSettings } from './utils/storage.js';
import { testConnection } from './utils/api.js';
import { DEFAULT_SERVER_URL } from './utils/constants.js';

// ─── DOM Refs ─────────────────────────────────────────────────────────────────
const navItems        = document.querySelectorAll('.nav-item');
const sections        = document.querySelectorAll('.opts-section');
const toast           = document.getElementById('toast');

// Connection
const serverUrlInput      = document.getElementById('serverUrl');
const testConnBtn         = document.getElementById('testConnectionBtn');
const saveConnBtn         = document.getElementById('saveConnectionBtn');
const connResult          = document.getElementById('connectionResult');

// Preferences
const notificationsToggle = document.getElementById('notificationsToggle');
const debugToggle         = document.getElementById('debugToggle');
const savePrefsBtn        = document.getElementById('savePrefsBtn');

// Camera
const cameraSelect       = document.getElementById('cameraSelect');
const cameraPreview      = document.getElementById('cameraPreview');
const cameraPreviewWrap  = document.getElementById('cameraPreviewWrap');
const cameraResult       = document.getElementById('cameraResult');
const grantCameraBtn     = document.getElementById('grantCameraBtn');
const refreshCamerasBtn  = document.getElementById('refreshCamerasBtn');
const saveCameraBtn      = document.getElementById('saveCameraBtn');
let previewStream = null;
let savedCameraDeviceId = null;

// ─── Navigation ───────────────────────────────────────────────────────────────
navItems.forEach((item) => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    const target = item.dataset.section;
    navItems.forEach((n) => n.classList.remove('active'));
    item.classList.add('active');
    sections.forEach((s) => {
      s.classList.toggle('hidden', s.id !== `section-${target}`);
    });
    // Free the camera when leaving the camera section
    if (target !== 'camera' && typeof stopPreview === 'function') {
      stopPreview();
    }
  });
});

// ─── Load Settings ────────────────────────────────────────────────────────────
async function loadSettings() {
  const settings = await getSettings();
  serverUrlInput.value = settings.serverUrl || DEFAULT_SERVER_URL;
  notificationsToggle.checked = settings.notifications !== false;
  debugToggle.checked = settings.debugMode || false;
  savedCameraDeviceId = settings.cameraDeviceId || null;

  // Populate camera list (labels may be empty until permission is granted)
  await refreshCameraList();
}

// ─── Camera Enumeration ───────────────────────────────────────────────────────
async function refreshCameraList() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cameras = devices.filter((d) => d.kind === 'videoinput');

    // Preserve the "default" option and replace the rest
    cameraSelect.innerHTML = '<option value="">Default (system chooses)</option>';

    cameras.forEach((cam, i) => {
      const opt = document.createElement('option');
      opt.value = cam.deviceId;
      opt.textContent = cam.label || `Camera ${i + 1} (grant access to see name)`;
      cameraSelect.appendChild(opt);
    });

    // Restore saved selection if it still exists
    if (savedCameraDeviceId && cameras.some((c) => c.deviceId === savedCameraDeviceId)) {
      cameraSelect.value = savedCameraDeviceId;
    }

    if (cameras.length === 0) {
      showCameraResult('error', '✕ No cameras detected on this device.');
    } else if (!cameras[0].label) {
      showCameraResult('loading', 'ℹ Camera labels are hidden until you grant access.');
    } else {
      showCameraResult('', '');
    }
  } catch (err) {
    showCameraResult('error', `✕ Failed to list cameras: ${err.message}`);
  }
}

async function startPreview(deviceId) {
  stopPreview();
  try {
    const constraints = {
      video: deviceId ? { deviceId: { exact: deviceId } } : true,
      audio: false,
    };
    previewStream = await navigator.mediaDevices.getUserMedia(constraints);
    cameraPreview.srcObject = previewStream;
    cameraPreviewWrap.style.display = 'block';
    showCameraResult('success', '✓ Camera ready.');
    // After granting permission, labels become available — refresh list
    await refreshCameraList();
  } catch (err) {
    let msg = err.message;
    if (err.name === 'NotAllowedError') msg = 'Permission denied. Please allow camera access.';
    if (err.name === 'NotFoundError') msg = 'Selected camera is not connected.';
    if (err.name === 'NotReadableError') msg = 'Camera is already in use by another application.';
    showCameraResult('error', `✕ ${msg}`);
  }
}

function stopPreview() {
  if (previewStream) {
    previewStream.getTracks().forEach((t) => t.stop());
    previewStream = null;
  }
  if (cameraPreview) cameraPreview.srcObject = null;
  cameraPreviewWrap.style.display = 'none';
}

function showCameraResult(type, message) {
  if (!message) {
    cameraResult.className = 'connection-test';
    cameraResult.textContent = '';
    return;
  }
  cameraResult.className = `connection-test ${type}`;
  cameraResult.textContent = message;
}

// ─── Camera Event Handlers ────────────────────────────────────────────────────
grantCameraBtn?.addEventListener('click', async () => {
  grantCameraBtn.disabled = true;
  grantCameraBtn.textContent = 'Requesting…';
  await startPreview(cameraSelect.value || undefined);
  grantCameraBtn.disabled = false;
  grantCameraBtn.textContent = 'Grant Camera Access';
});

refreshCamerasBtn?.addEventListener('click', async () => {
  refreshCamerasBtn.disabled = true;
  refreshCamerasBtn.textContent = 'Refreshing…';
  await refreshCameraList();
  refreshCamerasBtn.disabled = false;
  refreshCamerasBtn.textContent = 'Refresh List';
});

cameraSelect?.addEventListener('change', async () => {
  const deviceId = cameraSelect.value;
  if (previewStream) {
    // Live-switch the preview to the newly selected camera
    await startPreview(deviceId || undefined);
  }
});

saveCameraBtn?.addEventListener('click', async () => {
  const deviceId = cameraSelect.value || null;
  await saveSettings({ cameraDeviceId: deviceId });
  savedCameraDeviceId = deviceId;
  const label = deviceId
    ? (cameraSelect.options[cameraSelect.selectedIndex].textContent || 'Selected camera')
    : 'Default camera';
  showToast('success', `✓ Saved: ${label}`);
});

// Stop preview when leaving the camera section
window.addEventListener('beforeunload', () => stopPreview());

// ─── Test Connection ──────────────────────────────────────────────────────────
testConnBtn?.addEventListener('click', async () => {
  const url = serverUrlInput.value.trim() || DEFAULT_SERVER_URL;

  testConnBtn.disabled = true;
  testConnBtn.textContent = 'Testing…';
  showConnResult('loading', '🔄 Connecting to server…');

  try {
    const result = await testConnection(url);
    showConnResult(result.ok ? 'success' : 'error', result.ok ? `✓ ${result.message}` : `✕ ${result.message}`);
  } catch (err) {
    showConnResult('error', `✕ ${err.message}`);
  } finally {
    testConnBtn.disabled = false;
    testConnBtn.textContent = 'Test Connection';
  }
});

function showConnResult(type, message) {
  connResult.className = `connection-test ${type}`;
  connResult.textContent = message;
}

// ─── Save Connection Settings ─────────────────────────────────────────────────
saveConnBtn?.addEventListener('click', async () => {
  const url = serverUrlInput.value.trim() || DEFAULT_SERVER_URL;

  try {
    new URL(url);
  } catch {
    showToast('error', 'Invalid server URL format.');
    return;
  }

  await saveSettings({ serverUrl: url });
  showToast('success', '✓ Settings saved.');
  connResult.className = 'connection-test';
  connResult.textContent = '';
});

// ─── Save Preferences ─────────────────────────────────────────────────────────
savePrefsBtn?.addEventListener('click', async () => {
  await saveSettings({
    notifications: notificationsToggle.checked,
    debugMode: debugToggle.checked,
  });
  showToast('success', '✓ Preferences saved.');
});

// ─── Toast ────────────────────────────────────────────────────────────────────
let toastTimeout = null;

function showToast(type, message) {
  toast.textContent = message;
  toast.className = `toast ${type} show`;
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
loadSettings();
