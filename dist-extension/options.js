/**
 * options.js
 * Settings page controller.
 * Handles connection settings, preferences, and test connection.
 */

import { getSettings, saveSettings } from './utils/storage.js';
import { testConnection } from './utils/api.js';
import { DEFAULT_SERVER_URL } from './utils/constants.js';

// ─── DOM Refs ─────────────────────────────────────────────────────────────────
const navItems        = document.querySelectorAll('.nav-item');
const sections        = document.querySelectorAll('.opts-section');
const toast           = document.getElementById('toast');

// Connection
const institutionKeyInput = document.getElementById('institutionKey');
const serverUrlInput      = document.getElementById('serverUrl');
const toggleKeyBtn        = document.getElementById('toggleKey');
const eyeIcon             = document.getElementById('eyeIcon');
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
  institutionKeyInput.value = settings.institutionKey || '';
  serverUrlInput.value = settings.serverUrl || DEFAULT_SERVER_URL;
  notificationsToggle.checked = settings.notifications !== false;
  debugToggle.checked = settings.debugMode || false;
}

// ─── Toggle API Key Visibility ────────────────────────────────────────────────
let keyVisible = false;
toggleKeyBtn?.addEventListener('click', () => {
  keyVisible = !keyVisible;
  institutionKeyInput.type = keyVisible ? 'text' : 'password';
  // Update eye icon
  eyeIcon.innerHTML = keyVisible
    ? `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
       <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
       <line x1="1" y1="1" x2="23" y2="23"/>`
    : `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
       <circle cx="12" cy="12" r="3"/>`;
});

// ─── Test Connection ──────────────────────────────────────────────────────────
testConnBtn?.addEventListener('click', async () => {
  const key = institutionKeyInput.value.trim();
  const url = serverUrlInput.value.trim() || DEFAULT_SERVER_URL;

  if (!key) {
    showConnResult('error', '⚠ Please enter an Institution API Key first.');
    return;
  }

  testConnBtn.disabled = true;
  testConnBtn.textContent = 'Testing…';
  showConnResult('loading', '🔄 Connecting to server…');

  try {
    const result = await testConnection(url, key);
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
  const key = institutionKeyInput.value.trim();
  const url = serverUrlInput.value.trim() || DEFAULT_SERVER_URL;

  if (!key) {
    showToast('error', 'API key cannot be empty.');
    return;
  }

  try {
    new URL(url); // Validate URL format
  } catch {
    showToast('error', 'Invalid server URL format.');
    return;
  }

  await saveSettings({ institutionKey: key, serverUrl: url });
  showToast('success', '✓ Connection settings saved.');
  // Clear previous test result
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
