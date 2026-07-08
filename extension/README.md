# Focused Tab Enforcer — Chrome Extension

AI-powered exam monitoring extension (Manifest V3). Ensures academic integrity through real-time tab focus tracking and client-side facial presence detection.

## Design System

**Obsidian & Lime Glassmorphism** — matching the frontend dashboard:
- Base: `#0c0c0c` obsidian backgrounds, `#ccff00` lime accents, `#ebebeb` white text
- Typography: **Space Grotesk** (headings) + **JetBrains Mono** (technical data)
- Glass: `rgba(255,255,255,0.03)` bg · `blur(16px)` · `rgba(255,255,255,0.09)` borders

---

## Installation (Developer Mode)

### Prerequisites

- Google Chrome 109+ (Manifest V3 support)
- Node.js 18+ (for scripts only — not required to run the extension)

### Steps

```bash
# 1. Clone / navigate to the extension directory
cd "The Focused Tab Enforcer/extension"

# 2. Download face detection models (~270KB total)
node scripts/download-models.js

# 3. Generate PNG icons (optional — placeholders are included)
#    Option A: Use browser (open scripts/generate-icons.html)
#    Option B: Install sharp and run
npm install sharp
node scripts/generate-icons.js
```

#### Load in Chrome

1. Open `chrome://extensions/`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `extension/` folder
5. The "FT" icon appears in your toolbar

### First-Time Setup

1. Click the **FT** extension icon → click the ⚙ settings gear
2. In **Connection Settings**:
   - Enter your **Institution API Key** (from institution portal → API Settings)
   - Set **Server URL** (default: `http://localhost:5000`)
3. Click **Test Connection** to verify
4. Click **Save Settings**

---

## Architecture

```
extension/
├── manifest.json          # MV3 manifest
├── background.js          # Service worker: sessions, events, heartbeat
├── content.js             # Injected: overlay, anti-cheat, visibility
├── content.css            # Content script CSS resets
├── faceDetection.js       # face-api.js wrapper: webcam + detection loop
├── overlay.js             # Glassmorphism UI DOM builder
├── popup.html/js/css      # Extension popup (360px)
├── options.html/js/css    # Settings page
├── utils/
│   ├── api.js             # Backend HTTP communication
│   ├── storage.js         # chrome.storage wrappers
│   ├── constants.js       # Violation types, thresholds, keys
│   └── helpers.js         # Formatting, debounce, retry, UUID
├── models/                # face-api.js model weights (tiny)
├── icons/                 # 16/48/128px PNG icons
├── assets/                # logo.svg, noise.svg
└── scripts/
    ├── build.js           # Production build → dist-extension/
    ├── download-models.js # Fetch model weights from GitHub
    ├── generate-icons.js  # SVG → PNG icon generation
    ├── generate-icons.html # Browser-based icon generator
    └── zip.js             # Package for Chrome Web Store
```

---

## How It Works

### Student Flow

```
1. Student opens exam page in Chrome
2. Clicks the FT extension icon
3. Enters: Exam ID, Email, Registration Number
4. Extension POSTs to /api/ext/verify with x-extension-key header
5. Backend returns sessionToken + examConfig
6. Background script starts monitoring session
7. Content script injects:
   - Glassmorphism status bar (top of page)
   - Webcam feed + face bounding box (bottom-right)
   - Anti-cheat keyboard/context-menu blocking
   - Fullscreen enforcement
8. Face detection loop runs every 500ms (client-side only)
9. Violations are sent to /api/ext/log as they occur
10. Heartbeat every 30s to /api/ext/heartbeat
11. Exam ends: student submits or admin terminates
```

### Violation Types

| Type | Trigger | Default Threshold |
|------|---------|-------------------|
| `tab_switch` | Active tab changes from exam tab | 2s grace period |
| `window_blur` | Chrome window loses focus | 3s grace period |
| `face_absence` | No face detected | 3 consecutive frames (1.5s) |
| `multiple_faces` | >1 face in frame | Immediate |
| `attention_away` | Head pose > 45° from screen | 5s continuous |
| `devtools_opened` | DevTools shortcut / window size heuristic | Immediate |
| `fullscreen_exit` | Fullscreen exited without ending exam | Immediate |

### Anti-Cheat Measures

- Blocks: `Ctrl+C/X/V`, right-click, `F12`, `Ctrl+Shift+I/J/C/K`, `Ctrl+P`
- Enforces fullscreen (re-requests on exit)
- Monitors window size for DevTools detection
- Page Visibility API as backup tab-switch detection
- `beforeunload` warning prevents accidental page close
- Offline queue ensures violations are not lost on network failure

### Privacy

> **All face detection is client-side. No video frames, images, or biometrics are transmitted to the server.**
> Only violation metadata (type, timestamp, severity, duration) is sent.

---

## Backend API

All requests include `x-extension-key` header (institution API key).

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/ext/verify` | POST | Verify student credentials, get sessionToken |
| `/api/ext/heartbeat` | POST | Keep session alive, check for admin commands |
| `/api/ext/log` | POST | Log a violation event |
| `/api/ext/config` | POST | Get exam configuration |

### Verify Request

```json
{
  "examId": "EXAM-2025-001",
  "email": "student@university.edu",
  "registrationNumber": "STU/2021/0042"
}
```

### Verify Response

```json
{
  "status": "success",
  "data": {
    "sessionToken": "eyJ...",
    "enrollmentId": "64a...",
    "isResuming": false,
    "examDetails": {
      "title": "CS301 Final Exam",
      "examId": "EXAM-2025-001",
      "durationMinutes": 120,
      "allowedDomains": ["exam.university.edu"]
    },
    "monitoringConfig": {
      "tabSwitchSeconds": 2,
      "faceAbsenceFrames": 3,
      "attentionAwaySeconds": 5
    },
    "studentName": "John Doe"
  }
}
```

### Violation Log Request

```json
{
  "sessionToken": "eyJ...",
  "sessionId": "64b...",
  "eventType": "tab_switch",
  "severity": "high",
  "timestamp": "2025-07-07T10:30:00.000Z",
  "duration": 5000,
  "metadata": {
    "tabUrl": "https://google.com"
  }
}
```

---

## Development

### Modifying the Extension

Since the extension uses native ES modules, **no build step is required** during development:

1. Make your changes
2. Go to `chrome://extensions/`
3. Click the **↻** reload button on the extension card
4. Changes are live

### Debug Mode

1. Open extension settings → **Preferences** → enable **Debug Mode**
2. Background logs: chrome://extensions/ → FTE → **Inspect service worker**
3. Content script logs: DevTools console on the exam page

### Production Build

```bash
node scripts/build.js
# → Outputs to dist-extension/
```

### Packaging for Chrome Web Store

```bash
npm install archiver
node scripts/zip.js
# → Creates focused-tab-enforcer-v1.0.0.zip
```

---

## Configuration

Default thresholds (configurable per exam via backend):

```js
tabSwitchGraceMs:      2000   // 2 seconds before tab switch is logged
windowBlurGraceMs:     3000   // 3 seconds before window blur is logged
faceAbsenceFrames:     3      // consecutive missing-face frames
attentionAwayMs:       5000   // 5 seconds of head turn before logging
headPoseAngleDeg:      45     // head angle threshold in degrees
heartbeatIntervalSec:  30     // seconds between heartbeats
violationThrottleMs:   1000   // min ms between same-type violations
```

---

## Troubleshooting

**"Extension API key not configured"**
→ Open Settings → enter your institution API key → Save

**"Webcam access denied"**
→ Click the 🔒 icon in Chrome's address bar → Allow camera → reload

**"Failed to load face detection models"**
→ Run `node scripts/download-models.js` → check models/ directory has 4 files

**Overlay not showing on exam page**
→ Ensure the exam URL matches `allowedDomains` from your exam config
→ Check that monitoring is active in the popup

**"Invalid or revoked extension API key"**
→ Contact your institution admin to generate a new API key

---

## Browser Permissions

| Permission | Purpose |
|------------|---------|
| `tabs` | Detect tab switches |
| `activeTab` | Access current tab URL |
| `storage` | Store session data and settings |
| `scripting` | Inject content scripts dynamically |
| `alarms` | Schedule heartbeat (every 30s) |
| `notifications` | High-severity violation alerts |
| `<all_urls>` | Monitor any exam page URL |
