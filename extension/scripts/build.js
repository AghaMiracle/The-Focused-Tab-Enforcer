/**
 * build.js
 * Simple build script for the Focused Tab Enforcer Chrome Extension.
 *
 * This extension uses ES modules natively (supported in MV3 background
 * service workers and HTML pages). No bundler is required for development.
 *
 * For production, this script copies all necessary files to /dist/
 * maintaining the exact structure Chrome expects.
 *
 * Usage:
 *   node scripts/build.js          → production build to /dist
 *   node scripts/build.js --watch  → development (just validates)
 *
 * To load in Chrome:
 *   1. Go to chrome://extensions/
 *   2. Enable "Developer mode"
 *   3. Click "Load unpacked"
 *   4. Select the /extension folder (or /dist for production)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, '..', 'dist-extension');
const isWatch = process.argv.includes('--watch');

// ─── Files to copy to dist ────────────────────────────────────────────────────
const COPY_PATTERNS = [
  // Root files
  'manifest.json',
  'background.js',
  'content.js',
  'content.css',
  'faceDetection.js',
  'overlay.js',
  'popup.html',
  'popup.js',
  'popup.css',
  'options.html',
  'options.js',
  'options.css',
  // Offscreen document (runs webcam + face detection off-screen)
  'offscreen.html',
  'offscreen.js',
  // Directories
  'utils/',
  'icons/',
  'models/',
  'assets/',
];

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function build() {
  console.log('Building Focused Tab Enforcer extension...\n');
  const start = Date.now();

  // Clean dist
  if (fs.existsSync(DIST)) {
    fs.rmSync(DIST, { recursive: true, force: true });
  }
  fs.mkdirSync(DIST, { recursive: true });

  let copied = 0;
  let skipped = 0;

  for (const pattern of COPY_PATTERNS) {
    const src = path.join(ROOT, pattern);

    if (pattern.endsWith('/')) {
      // Directory
      const dirName = pattern.slice(0, -1);
      const destDir = path.join(DIST, dirName);
      if (fs.existsSync(src.slice(0, -1))) {
        copyDir(src.slice(0, -1), destDir);
        const count = countFiles(destDir);
        console.log(`  ✓ ${dirName}/ (${count} files)`);
        copied += count;
      } else {
        console.log(`  ⚠ ${dirName}/ not found — skipping`);
        skipped++;
      }
    } else {
      // File
      const dest = path.join(DIST, pattern);
      if (fs.existsSync(src)) {
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(src, dest);
        console.log(`  ✓ ${pattern}`);
        copied++;
      } else {
        console.log(`  ⚠ ${pattern} not found — skipping`);
        skipped++;
      }
    }
  }

  const elapsed = Date.now() - start;
  console.log(`\n✅ Build complete: ${copied} files → dist-extension/ (${elapsed}ms)`);
  if (skipped > 0) {
    console.log(`⚠  ${skipped} items skipped (run download-models and generate-icons first)`);
  }
  console.log('\nTo load in Chrome:');
  console.log('  1. Open chrome://extensions/');
  console.log('  2. Enable "Developer mode"');
  console.log('  3. Click "Load unpacked" → select the /extension folder');
}

function countFiles(dir) {
  if (!fs.existsSync(dir)) return 0;
  let count = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    count += entry.isDirectory() ? countFiles(path.join(dir, entry.name)) : 1;
  }
  return count;
}

if (isWatch) {
  console.log('[FTE] Watch mode — load the /extension folder directly in Chrome for development.');
  console.log('Changes are reflected immediately on extension reload (Ctrl+R on chrome://extensions/).\n');
} else {
  build();
}
