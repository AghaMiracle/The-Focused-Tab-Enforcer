/**
 * constants.js
 * Central constants for violation types, severity levels, thresholds,
 * storage keys, and message types used across the extension.
 */

// ─── Violation Types ────────────────────────────────────────────────────────
export const VIOLATION_TYPES = {
  TAB_SWITCH:      'tab_switch',
  WINDOW_BLUR:     'window_blur',
  FACE_ABSENCE:    'face_absence',
  MULTIPLE_FACES:  'multiple_faces',
  ATTENTION_AWAY:  'attention_away',
  PERMISSION_DENIED: 'permission_denied',
  DEVTOOLS_OPENED: 'devtools_opened',
  FULLSCREEN_EXIT: 'fullscreen_exit',
};

// ─── Severity Levels ────────────────────────────────────────────────────────
export const SEVERITY = {
  LOW:    'low',
  MEDIUM: 'medium',
  HIGH:   'high',
};

// ─── Default Thresholds ─────────────────────────────────────────────────────
export const DEFAULT_THRESHOLDS = {
  tabSwitchGraceMs:      2000,   // ms before tab switch is a violation
  windowBlurGraceMs:     3000,   // ms before window blur is a violation
  faceAbsenceFrames:     3,      // consecutive frames without face
  faceAbsenceMs:         1500,   // ms equivalent of 3 frames @ 500ms
  multipleFaceTolerance: 1,      // faces > this triggers violation
  attentionAwayMs:       5000,   // ms of head-pose deviation before violation
  headPoseAngleDeg:      45,     // degrees deviation threshold
  heartbeatIntervalSec:  30,     // seconds between heartbeat pings
  violationThrottleMs:   1000,   // min ms between same-type violations
  sessionTokenRotateMs:  900000, // 15 minutes
  offlineQueueMax:       200,    // max violations to queue offline
};

// ─── Storage Keys ────────────────────────────────────────────────────────────
export const STORAGE_KEYS = {
  ACTIVE_SESSION:     'fte_active_session',
  INSTITUTION_KEY:    'fte_institution_key',
  SERVER_URL:         'fte_server_url',
  OFFLINE_QUEUE:      'fte_offline_queue',
  DEBUG_MODE:         'fte_debug_mode',
  NOTIFICATIONS:      'fte_notifications',
  SETTINGS:           'fte_settings',
};

// ─── Message Types (extension internal messaging) ───────────────────────────
export const MSG = {
  // Popup → Background
  START_MONITORING:   'START_MONITORING',
  STOP_MONITORING:    'STOP_MONITORING',
  GET_STATUS:         'GET_STATUS',
  VERIFY_STUDENT:     'VERIFY_STUDENT',
  END_EXAM:           'END_EXAM',

  // Background → Content
  INIT_OVERLAY:       'INIT_OVERLAY',
  REMOVE_OVERLAY:     'REMOVE_OVERLAY',
  UPDATE_OVERLAY:     'UPDATE_OVERLAY',
  SHOW_WARNING:       'SHOW_WARNING',
  TERMINATE_EXAM:     'TERMINATE_EXAM',

  // Content → Background
  VIOLATION_DETECTED: 'VIOLATION_DETECTED',
  FACE_STATUS:        'FACE_STATUS',
  PAGE_VISIBLE:       'PAGE_VISIBLE',
  PAGE_HIDDEN:        'PAGE_HIDDEN',
  CONTENT_READY:      'CONTENT_READY',

  // Background → Popup
  STATUS_UPDATE:      'STATUS_UPDATE',
};

// ─── API Endpoints ───────────────────────────────────────────────────────────
export const API_ENDPOINTS = {
  VERIFY:     '/api/ext/verify',
  CONFIG:     '/api/ext/config',
  HEARTBEAT:  '/api/ext/heartbeat',
  LOG:        '/api/ext/log',
};

// ─── Extension States ────────────────────────────────────────────────────────
export const EXT_STATE = {
  IDLE:        'idle',
  VERIFYING:   'verifying',
  ACTIVE:      'active',
  PAUSED:      'paused',
  TERMINATED:  'terminated',
  ERROR:       'error',
  OFFLINE:     'offline',
};

// ─── Default Server URL ──────────────────────────────────────────────────────
export const DEFAULT_SERVER_URL = 'http://localhost:5000';
