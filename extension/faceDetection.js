/**
 * faceDetection.js
 * Face detection and head pose estimation module.
 * Uses face-api.js (TinyFaceDetector + FaceLandmark68TinyNet) loaded from CDN.
 *
 * ALL processing is done client-side. NO video frames are transmitted.
 * Only violation metadata (no images) is sent to the backend.
 */

import { VIOLATION_TYPES, SEVERITY, DEFAULT_THRESHOLDS } from './utils/constants.js';

// face-api.js local path (served from extension's web_accessible_resources)
const FACE_API_LOCAL = chrome.runtime.getURL('assets/face-api.min.js');
// Model base URL (served from extension's web_accessible_resources)
const MODEL_BASE_URL = chrome.runtime.getURL('models');

// ─── State ───────────────────────────────────────────────────────────────────
let videoElement = null;
let canvasElement = null;
let detectionInterval = null;
let stream = null;
let faceApiLoaded = false;
let modelsLoaded = false;

// Consecutive absence counter
let consecutiveNoFaceFrames = 0;
// Attention away timer
let attentionAwayStart = null;
// Multiple faces timer
let multipleFacesStart = null;

// Config (set from examConfig on init)
let config = { ...DEFAULT_THRESHOLDS };

// Callbacks
let onViolation = null;
let onFaceStatus = null;
let onError = null;

// ─── Load face-api.js dynamically ────────────────────────────────────────────

async function loadFaceApi() {
  if (faceApiLoaded) return true;
  return new Promise((resolve, reject) => {
    if (window.faceapi) {
      faceApiLoaded = true;
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = FACE_API_LOCAL;  // local extension file, CSP-safe
    script.onload = () => {
      faceApiLoaded = true;
      resolve(true);
    };
    script.onerror = () => reject(new Error('Failed to load face-api.js'));
    document.head.appendChild(script);
  });
}

// ─── Load Models ──────────────────────────────────────────────────────────────

async function loadModels() {
  if (modelsLoaded) return;
  await window.faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_BASE_URL);
  await window.faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_BASE_URL);
  modelsLoaded = true;
}

// ─── Initialize webcam ────────────────────────────────────────────────────────

async function initWebcam() {
  stream = await navigator.mediaDevices.getUserMedia({
    video: {
      width: { ideal: 320 },
      height: { ideal: 240 },
      facingMode: 'user',
    },
    audio: false,
  });

  videoElement = document.createElement('video');
  videoElement.setAttribute('autoplay', '');
  videoElement.setAttribute('muted', '');
  videoElement.setAttribute('playsinline', '');
  videoElement.style.cssText = `
    position: fixed;
    bottom: 16px;
    right: 16px;
    width: 200px;
    height: 150px;
    border-radius: 12px;
    border: 2px solid rgba(204,255,0,0.4);
    transform: scaleX(-1);
    z-index: 2147483645;
    object-fit: cover;
    pointer-events: none;
  `;
  videoElement.srcObject = stream;
  document.body.appendChild(videoElement);
  await videoElement.play();

  // Canvas overlay for bounding boxes
  canvasElement = document.createElement('canvas');
  canvasElement.setAttribute('id', 'fte-face-canvas');
  canvasElement.style.cssText = `
    position: fixed;
    bottom: 16px;
    right: 16px;
    width: 200px;
    height: 150px;
    border-radius: 12px;
    z-index: 2147483646;
    pointer-events: none;
    transform: scaleX(-1);
  `;
  document.body.appendChild(canvasElement);
}

// ─── Detection Loop ───────────────────────────────────────────────────────────

async function runDetection() {
  if (!videoElement || videoElement.readyState < 2) return;

  try {
    const detections = await window.faceapi
      .detectAllFaces(videoElement, new window.faceapi.TinyFaceDetectorOptions({
        inputSize: 320,
        scoreThreshold: 0.5,
      }))
      .withFaceLandmarks(true);

    // Resize canvas to video dimensions
    const dims = window.faceapi.matchDimensions(canvasElement, videoElement, true);
    const resized = window.faceapi.resizeResults(detections, dims);

    // Clear canvas
    const ctx = canvasElement.getContext('2d');
    ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    // Draw bounding boxes
    resized.forEach(({ detection }) => {
      const { x, y, width, height } = detection.box;
      ctx.strokeStyle = '#ccff00';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, width, height);
    });

    analyzeDetections(detections);
  } catch (err) {
    // Ignore canvas/video errors in detection loop
    console.warn('[FTE FaceDetect]', err.message);
  }
}

// ─── Analyze Detections ───────────────────────────────────────────────────────

function analyzeDetections(detections) {
  const faceCount = detections.length;
  const now = Date.now();

  // ── 1. No Face Detected ───────────────────────────────────────────────────
  if (faceCount === 0) {
    consecutiveNoFaceFrames++;
    attentionAwayStart = null;
    multipleFacesStart = null;

    if (onFaceStatus) onFaceStatus(false);

    if (consecutiveNoFaceFrames >= config.faceAbsenceFrames) {
      const severity = consecutiveNoFaceFrames >= config.faceAbsenceFrames * 3
        ? SEVERITY.HIGH
        : SEVERITY.MEDIUM;

      if (onViolation) {
        onViolation(VIOLATION_TYPES.FACE_ABSENCE, severity, {
          duration: consecutiveNoFaceFrames * 500, // approx ms
        });
      }
    }
    return;
  }

  // Face(s) detected — reset absence counter
  consecutiveNoFaceFrames = 0;
  if (onFaceStatus) onFaceStatus(true);

  // ── 2. Multiple Faces ─────────────────────────────────────────────────────
  if (faceCount > 1) {
    if (!multipleFacesStart) multipleFacesStart = now;
    // Fire after 1 second of multiple faces
    if (now - multipleFacesStart > 1000) {
      if (onViolation) {
        onViolation(VIOLATION_TYPES.MULTIPLE_FACES, SEVERITY.HIGH, {
          faceCount,
          duration: now - multipleFacesStart,
        });
      }
      multipleFacesStart = now; // Reset to avoid continuous spam
    }
  } else {
    multipleFacesStart = null;
  }

  // ── 3. Head Pose / Attention Away ─────────────────────────────────────────
  if (detections[0]?.landmarks) {
    const landmarks = detections[0].landmarks;
    const isLookingAway = estimateHeadPose(landmarks);

    if (isLookingAway) {
      if (!attentionAwayStart) attentionAwayStart = now;
      const awayDuration = now - attentionAwayStart;

      if (awayDuration >= config.attentionAwayMs) {
        if (onViolation) {
          onViolation(VIOLATION_TYPES.ATTENTION_AWAY, SEVERITY.MEDIUM, {
            duration: awayDuration,
          });
        }
        attentionAwayStart = now; // Reset
      }
    } else {
      attentionAwayStart = null;
    }
  }
}

/**
 * Estimate head pose from 68-point landmarks.
 * Returns true if the user appears to be looking away (> threshold degrees).
 * Uses the nose tip vs. midpoint between eyes for a simple lateral estimation.
 *
 * @param {faceapi.FaceLandmarks68} landmarks
 * @returns {boolean}
 */
function estimateHeadPose(landmarks) {
  try {
    const nose = landmarks.getNose();
    const leftEye = landmarks.getLeftEye();
    const rightEye = landmarks.getRightEye();

    // Center of eyes
    const leftCenter = centroid(leftEye);
    const rightCenter = centroid(rightEye);
    const eyeMidX = (leftCenter.x + rightCenter.x) / 2;
    const eyeMidY = (leftCenter.y + rightCenter.y) / 2;

    // Nose tip (bottom of nose array)
    const noseTip = nose[nose.length - 1];

    // Horizontal deviation: nose tip vs. eye midpoint
    const eyeWidth = Math.abs(rightCenter.x - leftCenter.x);
    if (eyeWidth < 10) return false; // Too small to measure

    const lateralOffset = Math.abs(noseTip.x - eyeMidX) / eyeWidth;
    // Vertical deviation
    const faceHeight = Math.abs(noseTip.y - eyeMidY);
    const verticalOffset = Math.abs(noseTip.y - (eyeMidY + faceHeight * 0.3)) / faceHeight;

    // If lateral ratio > 0.35 → roughly > 40° turn
    const angleDeg = config.headPoseAngleDeg || DEFAULT_THRESHOLDS.headPoseAngleDeg;
    const lateralThreshold = Math.tan((angleDeg * Math.PI) / 180) * 0.5;

    return lateralOffset > lateralThreshold || verticalOffset > 0.5;
  } catch {
    return false;
  }
}

function centroid(points) {
  const x = points.reduce((s, p) => s + p.x, 0) / points.length;
  const y = points.reduce((s, p) => s + p.y, 0) / points.length;
  return { x, y };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Initialize and start face detection.
 * @param {object} examConfig
 * @param {Function} violationCallback - (type, severity, metadata) => void
 * @param {Function} faceStatusCallback - (detected: boolean) => void
 * @param {Function} errorCallback - (error: Error) => void
 * @returns {Promise<{success: boolean, fallback: boolean}>}
 */
export async function startFaceDetection(examConfig, violationCallback, faceStatusCallback, errorCallback) {
  config = { ...DEFAULT_THRESHOLDS, ...examConfig };
  onViolation = violationCallback;
  onFaceStatus = faceStatusCallback;
  onError = errorCallback;

  // Step 1: Load face-api.js
  try {
    await loadFaceApi();
  } catch (err) {
    onError?.(err);
    return { success: false, fallback: true };
  }

  // Step 2: Load models
  try {
    await loadModels();
  } catch (err) {
    onError?.(new Error('Failed to load face detection models. Tab monitoring will continue.'));
    return { success: false, fallback: true };
  }

  // Step 3: Initialize webcam
  try {
    await initWebcam();
  } catch (err) {
    const msg = err.name === 'NotAllowedError'
      ? 'Webcam access denied. Please allow camera access and retry.'
      : `Webcam error: ${err.message}`;
    onError?.(new Error(msg));
    return { success: false, fallback: true };
  }

  // Step 4: Start detection loop (every 500ms)
  detectionInterval = setInterval(runDetection, 500);

  return { success: true, fallback: false };
}

/**
 * Stop face detection and release webcam.
 */
export function stopFaceDetection() {
  if (detectionInterval) {
    clearInterval(detectionInterval);
    detectionInterval = null;
  }
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
    stream = null;
  }
  videoElement?.remove();
  canvasElement?.remove();
  videoElement = null;
  canvasElement = null;
  consecutiveNoFaceFrames = 0;
  attentionAwayStart = null;
  multipleFacesStart = null;
}

/**
 * Get the current video element (for overlay preview).
 * @returns {HTMLVideoElement|null}
 */
export function getVideoElement() {
  return videoElement;
}
