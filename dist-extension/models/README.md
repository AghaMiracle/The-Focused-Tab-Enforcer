# Face Detection Models

This directory contains the face-api.js model weights for:

1. **tiny_face_detector** — Fast face detection (~190KB)
2. **face_landmark_68_tiny** — Facial landmark detection for head pose (~80KB)

## Download Instructions

Run the download script from the extension root:

```bash
node scripts/download-models.js
```

Or download manually from the face-api.js GitHub repository:

### Required Files

```
models/
├── tiny_face_detector_model-weights_manifest.json
├── tiny_face_detector_model-shard1
├── face_landmark_68_tiny_model-weights_manifest.json
└── face_landmark_68_tiny_model-shard1
```

### Manual Download URLs

From: https://github.com/justadudewhohacks/face-api.js/tree/master/weights

- `tiny_face_detector_model-weights_manifest.json`
- `tiny_face_detector_model-shard1`
- `face_landmark_68_tiny_model-weights_manifest.json`
- `face_landmark_68_tiny_model-shard1`

### Alternative: CDN Loading

If model files are not present locally, faceDetection.js will attempt to
load models from the extension's `models/` directory. If that fails, the
extension gracefully degrades to tab/window monitoring only.

The `MODEL_BASE_URL` in `faceDetection.js` points to:
```js
const MODEL_BASE_URL = chrome.runtime.getURL('models');
```

This means the model files must be in this directory for offline support.
