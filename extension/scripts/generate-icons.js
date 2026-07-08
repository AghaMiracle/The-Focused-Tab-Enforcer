/**
 * generate-icons.js
 * Node.js script to generate PNG icons from the SVG logo.
 * Run with: node scripts/generate-icons.js
 *
 * Requires: npm install sharp
 * Or use the included generate-icons.html in a browser to download.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Try to use sharp if available
async function generateWithSharp() {
  const { default: sharp } = await import('sharp');
  const svgPath = path.join(__dirname, '../assets/logo.svg');
  const iconsDir = path.join(__dirname, '../icons');

  if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true });

  const sizes = [16, 48, 128];
  for (const size of sizes) {
    await sharp(svgPath)
      .resize(size, size)
      .png()
      .toFile(path.join(iconsDir, `icon${size}.png`));
    console.log(`✓ Generated icon${size}.png`);
  }
  console.log('All icons generated!');
}

generateWithSharp().catch((err) => {
  console.error('sharp not available:', err.message);
  console.log('');
  console.log('To generate icons, either:');
  console.log('  1. npm install sharp && node scripts/generate-icons.js');
  console.log('  2. Open scripts/generate-icons.html in a browser');
  console.log('  3. Use an online SVG-to-PNG converter for sizes 16, 48, 128');
  console.log('');
  console.log('Generating placeholder PNGs via canvas fallback...');
  generatePlaceholders();
});

/**
 * Generate minimal valid PNG files as placeholders.
 * These are solid lime (#ccff00) squares — replace with real icons.
 */
function generatePlaceholders() {
  const iconsDir = path.join(__dirname, '../icons');
  if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true });

  // Minimal 1x1 lime PNG (base64 encoded), resized declarations only
  // Real PNG generation would require a canvas or image library
  // This creates valid PNG files that Chrome will accept
  const sizes = [16, 48, 128];

  sizes.forEach((size) => {
    const outPath = path.join(iconsDir, `icon${size}.png`);
    if (!fs.existsSync(outPath)) {
      // Write a minimal valid PNG (1x1 transparent pixel)
      const pngData = Buffer.from(
        '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489' +
        '0000000a49444154789c6260000000020001e221bc330000000049454e44ae426082',
        'hex'
      );
      fs.writeFileSync(outPath, pngData);
      console.log(`✓ Placeholder icon${size}.png created (replace with real icon)`);
    } else {
      console.log(`  icon${size}.png already exists — skipping`);
    }
  });
}
