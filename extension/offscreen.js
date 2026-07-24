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
  OFFSCREEN_START:    'OFFSCREEN_START',
  OFFSCREEN_STOP:     'OFFSCREEN_STOP',
  OFFSCREEN_PRELOAD:  'OFFSCREEN_PRELOAD',
  OFFSCREEN_STATUS:   'OFFSCREEN_STATUS',
  OFFSCREEN_FRAME:    'OFFSCREEN_FRAME',
  OFFSCREEN_VIOLATION:'OFFSCREEN_VIOLATION',
  OFFSCREEN_SNAPSHOT: 'OFFSCREEN_SNAPSHOT',
  OFFSCREEN_ERROR:    'OFFSCREEN_ERROR',
  OFFSCREEN_READY:    'OFFSCREEN_READY',
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
// Cache the in-flight promise so concurrent callers (preload + start) share a
// single load instead of triggering face-api's loaders twice.
let modelsLoadingPromise = null;

async function loadModels() {
  if (modelsLoaded) return;
  if (modelsLoadingPromise) return modelsLoadingPromise;
  if (!window.faceapi) {
    throw new Error('face-api.js not loaded in offscreen document.');
  }
  modelsLoadingPromise = (async () => {
    // face-api's built-in `loadFromUri` computes the manifest URL from the
    // net's default model name and calls fetch() internally. In an MV3
    // offscreen document, that internal fetch has been observed to throw
    // "TypeError: Failed to fetch" against chrome-extension:// URLs on some
    // Chrome builds — usually because of how the loader concatenates the
    // base URL or handles the shard paths inside the manifest.
    //
    // To dodge every version-specific quirk we fetch the manifest JSON and
    // shard bytes ourselves, then hand them to face-api via
    // `loadFromWeightMap(...)` using the bundled tf.io.weightsLoaderFactory.
    // This works on every recent Chrome/face-api combo.
    await loadNetManually(window.faceapi.nets.tinyFaceDetector,   'tiny_face_detector_model');
    await loadNetManually(window.faceapi.nets.faceLandmark68TinyNet, 'face_landmark_68_tiny_model');
    modelsLoaded = true;
  })();
  try {
    await modelsLoadingPromise;
  } finally {
    modelsLoadingPromise = null;
  }
}

/**
 * Load a face-api NeuralNetwork by fetching its manifest + weight shards
 * ourselves and feeding them into the network's WeightMap.
 *
 * face-api's own `loadFromUri` has an internal fetch chain that fails on
 * some Chrome/face-api combos when the URI is a `chrome-extension://` URL
 * (surfaces as "TypeError: Failed to fetch"). We sidestep that entirely by:
 *   1. Fetching the JSON manifest via chrome.runtime.getURL(...) directly.
 *   2. Fetching each shard file listed in the manifest.
 *   3. Concatenating shard bytes into one ArrayBuffer.
 *   4. Calling `faceapi.tf.io.decodeWeights(buffer, weightSpecs)` to build
 *      the WeightMap tf expects.
 *   5. Calling `net.loadFromWeightMap(weightMap)` — face-api's public API
 *      that skips its URL loader entirely.
 *
 * Both `decodeWeights` and `loadFromWeightMap` are confirmed present in the
 * bundled face-api.min.js.
 */
async function loadNetManually(net, modelName) {
  const faceapi = window.faceapi;
  if (!faceapi?.tf?.io?.decodeWeights) {
    throw new Error('face-api build is missing tf.io.decodeWeights — cannot load models.');
  }

  const manifestUrl = chrome.runtime.getURL(`models/${modelName}-weights_manifest.json`);
  let manifest;
  try {
    const resp = await fetch(manifestUrl);
    if (!resp.ok) throw new Error(`HTTP ${resp.status} from ${manifestUrl}`);
    manifest = await resp.json();
  } catch (err) {
    throw new Error(`Could not load model manifest for ${modelName}: ${err.message}`);
  }

  // Manifest is [ { weights: [...specs], paths: ['shard1', 'shard2', ...] }, ... ]
  const weightSpecs = [];
  const shardBuffers = [];
  for (const group of manifest) {
    for (const spec of group.weights) weightSpecs.push(spec);
    for (const shardName of group.paths) {
      const shardUrl = chrome.runtime.getURL(`models/${shardName}`);
      try {
        const shardResp = await fetch(shardUrl);
        if (!shardResp.ok) throw new Error(`HTTP ${shardResp.status} from ${shardUrl}`);
        shardBuffers.push(await shardResp.arrayBuffer());
      } catch (err) {
        throw new Error(`Could not load weight shard ${shardName}: ${err.message}`);
      }
    }
  }

  // Concatenate every shard into a single contiguous buffer for decodeWeights.
  const totalBytes = shardBuffers.reduce((sum, b) => sum + b.byteLength, 0);
  const concat = new Uint8Array(totalBytes);
  let offset = 0;
  for (const b of shardBuffers) {
    concat.set(new Uint8Array(b), offset);
    offset += b.byteLength;
  }

  const weightMap = faceapi.tf.io.decodeWeights(concat.buffer, weightSpecs);
  net.loadFromWeightMap(weightMap);
}

// ─── Camera Permission Probe (no LED) ──────────────────────────────────────────
// Reports whether the extension origin already has camera access, WITHOUT
// opening the camera. Used during preload so the popup can warn the student
// early if they still need to grant access via the Settings page.
async function queryCameraPermission() {
  try {
    if (!navigator.permissions?.query) return 'unknown';
    const status = await navigator.permissions.query({ name: 'camera' });
    return status.state; // 'granted' | 'prompt' | 'denied'
  } catch {
    return 'unknown';
  }
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
    const errorName = err?.name || 'Error';
    const errorMessage = err?.message || String(err);
    send(MSG.OFFSCREEN_ERROR, { message: errorMessage, errorName });
    return { ok: false, error: errorMessage, errorName, errorMessage };
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

  // Preload face-api models without opening the camera. Called shortly after
  // the student logs in so that when they click "Start Exam" the model load
  // step is a no-op and only getUserMedia has to run. Also reports the current
  // camera permission state so the popup can warn early if access is needed.
  if (type === MSG.OFFSCREEN_PRELOAD) {
    (async () => {
      try {
        await loadModels();
        const cameraPermission = await queryCameraPermission();
        sendResponse({ ok: true, cameraPermission });
      } catch (err) {
        send(MSG.OFFSCREEN_ERROR, { message: err?.message || String(err) });
        sendResponse({ ok: false, error: err?.message });
      }
    })();
    return true;
  }

});

// Signal readiness to the service worker
send(MSG.OFFSCREEN_READY, {});
