/**
 * download-models.js
 * Downloads face-api.js model files for offline use.
 * Run: node scripts/download-models.js
 *
 * Downloads to: extension/models/
 */

import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights';
const MODELS_DIR = path.join(__dirname, '../models');

const FILES = [
  'tiny_face_detector_model-weights_manifest.json',
  'tiny_face_detector_model-shard1',
  'face_landmark_68_tiny_model-weights_manifest.json',
  'face_landmark_68_tiny_model-shard1',
];

if (!fs.existsSync(MODELS_DIR)) {
  fs.mkdirSync(MODELS_DIR, { recursive: true });
}

async function downloadFile(filename) {
  const url = `${BASE_URL}/${filename}`;
  const dest = path.join(MODELS_DIR, filename);

  if (fs.existsSync(dest)) {
    console.log(`  ⏭  ${filename} (already exists)`);
    return;
  }

  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${filename}`));
        return;
      }
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        const size = fs.statSync(dest).size;
        console.log(`  ✓ ${filename} (${(size / 1024).toFixed(1)}KB)`);
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

async function main() {
  console.log('Downloading face-api.js models...\n');
  let success = 0;
  for (const file of FILES) {
    try {
      await downloadFile(file);
      success++;
    } catch (err) {
      console.error(`  ✕ Failed: ${file} — ${err.message}`);
    }
  }
  console.log(`\n${success}/${FILES.length} files downloaded to models/`);
  if (success < FILES.length) {
    console.log('\nSome files failed. Check your internet connection and try again.');
    console.log('Or download manually from:');
    console.log('https://github.com/justadudewhohacks/face-api.js/tree/master/weights');
  }
}

main();
