/**
 * zip.js
 * Creates a distributable ZIP of the extension for the Chrome Web Store.
 * Run: node scripts/zip.js
 *
 * Output: focused-tab-enforcer-v1.0.0.zip
 * Requires: npm install archiver
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function zip() {
  let archiver;
  try {
    archiver = (await import('archiver')).default;
  } catch {
    console.error('archiver not installed. Run: npm install archiver');
    process.exit(1);
  }

  const ROOT = path.join(__dirname, '..');
  const outputPath = path.join(ROOT, '..', 'focused-tab-enforcer-v1.0.0.zip');

  const output = fs.createWriteStream(outputPath);
  const archive = archiver('zip', { zlib: { level: 9 } });

  output.on('close', () => {
    console.log(`✓ Created: focused-tab-enforcer-v1.0.0.zip (${(archive.pointer() / 1024).toFixed(0)}KB)`);
  });

  archive.on('error', (err) => { throw err; });
  archive.pipe(output);

  // Add all extension files, excluding dev artifacts
  archive.glob('**/*', {
    cwd: ROOT,
    ignore: [
      'node_modules/**',
      'scripts/**',
      'dist/**',
      '*.zip',
      '.git/**',
      'README.md',
    ],
  });

  await archive.finalize();
}

zip().catch(console.error);
