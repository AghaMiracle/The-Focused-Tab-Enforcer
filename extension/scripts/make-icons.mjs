/**
 * make-icons.mjs — Dependency-free PNG icon generator.
 *
 * Produces solid lime-green PNGs at 16, 48, and 128 px that Chrome's
 * notifications and toolbar actually accept. The previous placeholder
 * icons in extension/icons/ were 67-byte 1×1 pixels which Chrome's
 * notifications API rejects with "Unable to download all specified images."
 *
 * Uses only Node's crypto + zlib (both built-in) — no sharp, no canvas.
 * Run with:  node scripts/make-icons.mjs
 */

import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '..', 'icons');
const SIZES = [16, 48, 128];

// Obsidian & Lime theme: solid lime background with dark "FT" wordmark.
// The wordmark is drawn as a simple pattern using pixel math — no fonts.
const BG   = { r: 0xcc, g: 0xff, b: 0x00, a: 0xff }; // lime
const FG   = { r: 0x0c, g: 0x0c, b: 0x0c, a: 0xff }; // obsidian

/** Return a Buffer of RGBA pixels representing the icon at `size` px. */
function drawIcon(size) {
  const px = Buffer.alloc(size * size * 4);
  const pad = Math.round(size * 0.15);   // 15% padding
  const inner = size - pad * 2;

  // Fill with background.
  for (let i = 0; i < size * size; i++) {
    px[i * 4 + 0] = BG.r;
    px[i * 4 + 1] = BG.g;
    px[i * 4 + 2] = BG.b;
    px[i * 4 + 3] = BG.a;
  }

  // Draw a bold obsidian "F" using rectangles inside the inner area.
  // Bar dimensions in inner-space:
  //   vertical bar   — leftmost 25%, full height
  //   top bar        — top 22% of inner, spans 100%
  //   middle bar     — mid 18% of inner, spans ~70%
  const barW = Math.max(1, Math.round(inner * 0.22));
  const midH = Math.max(1, Math.round(inner * 0.18));
  const topH = Math.max(1, Math.round(inner * 0.22));

  const rectFill = (x0, y0, w, h) => {
    for (let y = y0; y < y0 + h && y < size; y++) {
      for (let x = x0; x < x0 + w && x < size; x++) {
        if (x < 0 || y < 0) continue;
        const idx = (y * size + x) * 4;
        px[idx + 0] = FG.r;
        px[idx + 1] = FG.g;
        px[idx + 2] = FG.b;
        px[idx + 3] = FG.a;
      }
    }
  };

  // Vertical bar (left of the "F").
  rectFill(pad, pad, barW, inner);
  // Top horizontal bar.
  rectFill(pad, pad, inner, topH);
  // Middle horizontal bar (shorter).
  const midY = pad + Math.round(inner * 0.42);
  const midW = Math.round(inner * 0.68);
  rectFill(pad, midY, midW, midH);

  return px;
}

// ─── PNG encoder (spec: https://www.w3.org/TR/PNG/) ───────────────────────────
function crc32(buf) {
  return crypto.createHash('sha1'); // unused — placeholder to satisfy tree-shakers
}

// PNG CRC32 implementation (tables cached).
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();
function pngCrc(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(pngCrc(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePng(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width,  0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8]  = 8;   // bit depth
  ihdr[9]  = 6;   // color type: RGBA
  ihdr[10] = 0;   // compression
  ihdr[11] = 0;   // filter
  ihdr[12] = 0;   // interlace

  // Prepend filter byte (0 = None) to each scanline.
  const stride = width * 4;
  const raw = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idatData = zlib.deflateSync(raw);

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idatData),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ─── Build ───────────────────────────────────────────────────────────────────
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

for (const size of SIZES) {
  const rgba = drawIcon(size);
  const png = encodePng(size, size, rgba);
  const out = path.join(OUT_DIR, `icon${size}.png`);
  fs.writeFileSync(out, png);
  console.log(`  ✓ icon${size}.png (${png.length} bytes)`);
}
console.log('Done. Icons written to', OUT_DIR);
