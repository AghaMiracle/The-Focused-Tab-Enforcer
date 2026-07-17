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
  });
});

// ─── Load Settings ────────────────────────────────────────────────────────────
async function loadSettings() {
  const settings = await getSettings();
  serverUrlInput.value = settings.serverUrl || DEFAULT_SERVER_URL;
  notificationsToggle.checked = settings.notifications !== false;
  debugToggle.checked = settings.debugMode || false;
}

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
