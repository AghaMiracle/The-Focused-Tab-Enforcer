/**
 * offscreen.js — Runs in the extension's origin (chrome-extension://...)
 *
 * Owns the webcam stream, runs face-api.js detection, and reports
 * face status, violations, and snapshots back to the service worker.
 *
 * The extension origin means:
 *  - getUserMedia works reliably (extension has its own permission)
 *  - Works with any exam page (HTTP or HTTPS)
 *  - Permission is granted once and persists for the extension
 */

// ─── Constants (inline copy — offscreen is a classic script, no imports) ─────
const MSG = {
  OFFSCREEN_START:   'OFFSCREEN_START',
  OFFSCREEN_STOP:    'OFFSCREEN_STOP',
  OFFSCREEN_STATUS:  'OFFSCREEN_STATUS',
  OFFSCREEN_FRAME:   'OFFSCREEN_FRAME',
  OFFSCREEN_VIOLATION: 'OFFSCREEN_VIOLATION',
  OFFSCREEN_SNAPSHOT:  'OFFSCREEN_SNAPSHOT',
  OFFSCREEN_ERROR:   'OFFSCREEN_ERROR',
  OFFSCREEN_READY:   'OFFSCREEN_READY',
};

const VIOLATION_TYPES = {
  FACE_ABSENCE:   'face_absence',
  MULTIPLE_FACES: 'multiple_faces',
  ATTENTION_AWAY: 'attention_away',
};

const SEVERITY = { LOW: 'low', MEDIUM: 'medium', HIGH: 'high' };

const DEFAULTS = {
  faceAbsenceFrames: 3,
  multipleFaceTolerance: 1,
  attentionAwayMs: 5000,
  headPoseAngleDeg: 45,
  snapshotIntervalMs: 3000,
  previewIntervalMs: 500,
};

const MODEL_BASE = chrome.runtime.getURL('models');

// ─── State ────────────────────────────────────────────────────────────────────
let video = null;
let canvas = null;
let stream = null;
let detectionInterval = null;
let snapshotInterval = null;
let previewInterval = null;
let modelsLoaded = false;
let isRunning = false;

let consecutiveNoFaceFrames = 0;
let attentionAwayStart = null;
let multipleFacesStart = null;

let cfg = { ...DEFAULTS };

// ─── Load Models ──────────────────────────────────────────────────────────────
async function loadModels() {
  if (modelsLoaded) return;
  if (!window.faceapi) {
    throw new Error('face-api.js not loaded in offscreen document.');
  }
  await window.faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_BASE);
  await window.faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_BASE);
  modelsLoaded = true;
}

// ─── Init Webcam ──────────────────────────────────────────────────────────────
async function initWebcam(cameraDeviceId) {
  video = document.getElementById('webcam');
  canvas = document.getElementById('canvas');
  if (!video || !canvas) throw new Error('Offscreen DOM not ready.');

  // Build video constraints — prefer the user-selected camera if one exists
  const videoConstraints = {
    width: { ideal: 320 },
    height: { ideal: 240 },
  };
  if (cameraDeviceId) {
    videoConstraints.deviceId = { exact: cameraDeviceId };
  } else {
    videoConstraints.facingMode = 'user';
  }

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: videoConstraints,
      audio: false,
    });
  } catch (err) {
    // If the selected camera is unavailable, fall back to any camera
    if (cameraDeviceId && (err.name === 'OverconstrainedError' || err.name === 'NotFoundError')) {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 320 }, height: { ideal: 240 }, facingMode: 'user' },
        audio: false,
      });
    } else {
      throw err;
    }
  }

  video.srcObject = stream;
  await video.play();

  canvas.width = 160;
  canvas.height = Math.round(160 * (video.videoHeight || 240) / (video.videoWidth || 320));
}

// ─── Detection Loop ───────────────────────────────────────────────────────────
async function runDetection() {
  if (!isRunning || !video || video.readyState < 2 || !window.faceapi) return;

  try {
    const detections = await window.faceapi
      .detectAllFaces(video, new window.faceapi.TinyFaceDetectorOptions({
        inputSize: 320,
        scoreThreshold: 0.5,
      }))
      .withFaceLandmarks(true);

    analyzeDetections(detections);
  } catch (err) {
    // Swallow one-off frame errors
  }
}

function analyzeDetections(detections) {
  const faceCount = detections.length;
  const now = Date.now();

  if (faceCount === 0) {
    consecutiveNoFaceFrames++;
    attentionAwayStart = null;
    multipleFacesStart = null;
    sendStatus({ faceDetected: false, faceCount: 0 });
    if (consecutiveNoFaceFrames >= cfg.faceAbsenceFrames) {
      const severity = consecutiveNoFaceFrames >= cfg.faceAbsenceFrames * 3
        ? SEVERITY.HIGH : SEVERITY.MEDIUM;
      sendViolation(VIOLATION_TYPES.FACE_ABSENCE, severity, {
        duration: consecutiveNoFaceFrames * 500,
      });
    }
    return;
  }

  consecutiveNoFaceFrames = 0;
  sendStatus({ faceDetected: true, faceCount });

  if (faceCount > (cfg.multipleFaceTolerance || 1)) {
    if (!multipleFacesStart) multipleFacesStart = now;
    if (now - multipleFacesStart > 1000) {
      sendViolation(VIOLATION_TYPES.MULTIPLE_FACES, SEVERITY.HIGH, {
        faceCount, duration: now - multipleFacesStart,
      });
      multipleFacesStart = now;
    }
  } else {
    multipleFacesStart = null;
  }

  const landmarks = detections[0]?.landmarks;
  if (landmarks) {
    const isLookingAway = estimateHeadPose(landmarks);
    if (isLookingAway) {
      if (!attentionAwayStart) attentionAwayStart = now;
      const awayDuration = now - attentionAwayStart;
      if (awayDuration >= cfg.attentionAwayMs) {
        sendViolation(VIOLATION_TYPES.ATTENTION_AWAY, SEVERITY.MEDIUM, {
          duration: awayDuration,
        });
        attentionAwayStart = now;
      }
    } else {
      attentionAwayStart = null;
    }
  }
}

function estimateHeadPose(landmarks) {
  try {
    const nose = landmarks.getNose();
    const leftEye = landmarks.getLeftEye();
    const rightEye = landmarks.getRightEye();
    const leftCenter = centroid(leftEye);
    const rightCenter = centroid(rightEye);
    const eyeMidX = (leftCenter.x + rightCenter.x) / 2;
    const eyeMidY = (leftCenter.y + rightCenter.y) / 2;
    const noseTip = nose[nose.length - 1];
    const eyeWidth = Math.abs(rightCenter.x - leftCenter.x);
    if (eyeWidth < 10) return false;
    const lateralOffset = Math.abs(noseTip.x - eyeMidX) / eyeWidth;
    const faceHeight = Math.abs(noseTip.y - eyeMidY);
    const verticalOffset = Math.abs(noseTip.y - (eyeMidY + faceHeight * 0.3)) / (faceHeight || 1);
    const lateralThreshold = Math.tan((cfg.headPoseAngleDeg * Math.PI) / 180) * 0.5;
    return lateralOffset > lateralThreshold || verticalOffset > 0.5;
  } catch { return false; }
}

function centroid(points) {
  const x = points.reduce((s, p) => s + p.x, 0) / points.length;
  const y = points.reduce((s, p) => s + p.y, 0) / points.length;
  return { x, y };
}

// ─── Frame Capture ────────────────────────────────────────────────────────────
function captureFrame(width = 160, quality = 0.4) {
  if (!video || video.readyState < 2 || !canvas) return null;
  try {
    const vw = video.videoWidth || 320;
    const vh = video.videoHeight || 240;
    const h = Math.round(width * (vh / vw));
    canvas.width = width;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // Mirror horizontally
    ctx.translate(width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, width, h);
    return canvas.toDataURL('image/jpeg', quality);
  } catch {
    return null;
  }
}

// ─── Messaging ────────────────────────────────────────────────────────────────
function send(type, payload) {
  chrome.runtime.sendMessage({ type, payload }).catch(() => {});
}
function sendStatus(payload) { send(MSG.OFFSCREEN_STATUS, payload); }
function sendViolation(type, severity, metadata) {
  send(MSG.OFFSCREEN_VIOLATION, { violationType: type, severity, metadata });
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────
async function start(config) {
  if (isRunning) return { ok: true };
  cfg = { ...DEFAULTS, ...(config || {}) };

  try {
    await loadModels();
    await initWebcam(config?.cameraDeviceId || null);
  } catch (err) {
    send(MSG.OFFSCREEN_ERROR, { message: err?.message || String(err) });
    return { ok: false, error: err.message };
  }

  isRunning = true;
  consecutiveNoFaceFrames = 0;
  attentionAwayStart = null;
  multipleFacesStart = null;

  detectionInterval = setInterval(runDetection, 500);

  // Preview frames for the content script overlay
  previewInterval = setInterval(() => {
    if (!isRunning) return;
    const frame = captureFrame(160, 0.5);
    if (frame) send(MSG.OFFSCREEN_FRAME, { frame });
  }, cfg.previewIntervalMs || 500);

  // Snapshots for the admin dashboard
  snapshotInterval = setInterval(() => {
    if (!isRunning) return;
    const snapshot = captureFrame(160, 0.4);
    if (!snapshot) return;
    send(MSG.OFFSCREEN_SNAPSHOT, { snapshot, capturedAt: Date.now() });
  }, cfg.snapshotIntervalMs || 3000);

  return { ok: true };
}

function stop() {
  isRunning = false;
  clearInterval(detectionInterval);
  clearInterval(previewInterval);
  clearInterval(snapshotInterval);
  detectionInterval = previewInterval = snapshotInterval = null;
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }
  if (video) video.srcObject = null;
}

// ─── Message Listener ─────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { type, payload } = message || {};

  if (type === MSG.OFFSCREEN_START) {
    start(payload)
      .then((r) => sendResponse(r))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (type === MSG.OFFSCREEN_STOP) {
    stop();
    sendResponse({ ok: true });
    return false;
  }
});

// Signal readiness to the service worker
send(MSG.OFFSCREEN_READY, {});
