/**
 * Generate simple PWA icons as PNG files.
 *
 * Creates solid-color icons with a stylized "K" letter.
 * Uses only Node.js built-ins — no external dependencies.
 *
 * Usage: npx tsx tools/generate-icons.ts
 */

import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { deflateSync } from "node:zlib";

const OUTPUT_DIR = "public/icons";

interface IconSpec {
  name: string;
  size: number;
}

const ICONS: IconSpec[] = [
  { name: "icon-192.png", size: 192 },
  { name: "icon-512.png", size: 512 },
];

// Colors
const BG_COLOR = { r: 26, g: 26, b: 46 }; // #1a1a2e
const ACCENT_COLOR = { r: 233, g: 69, b: 96 }; // #e94560

function createPNG(size: number): Buffer {
  // Build raw image data: filter byte + RGB for each pixel
  const rawData: number[] = [];

  for (let y = 0; y < size; y++) {
    rawData.push(0); // filter: None

    for (let x = 0; x < size; x++) {
      const color = getPixelColor(x, y, size);
      rawData.push(color.r, color.g, color.b);
    }
  }

  const raw = Buffer.from(rawData);
  const compressed = deflateSync(raw);

  // Build PNG
  const chunks: Buffer[] = [];

  // PNG signature
  chunks.push(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); // width
  ihdr.writeUInt32BE(size, 4); // height
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  chunks.push(createChunk("IHDR", ihdr));

  // IDAT chunk
  chunks.push(createChunk("IDAT", compressed));

  // IEND chunk
  chunks.push(createChunk("IEND", Buffer.alloc(0)));

  return Buffer.concat(chunks);
}

function getPixelColor(
  x: number,
  y: number,
  size: number,
): { r: number; g: number; b: number } {
  const cx = size / 2;
  const cy = size / 2;
  const scale = size * 0.35;

  // Draw a stylized "K" shape
  const rx = (x - cx) / scale;
  const ry = (y - cy) / scale;

  // Vertical bar of K
  const verticalBar = Math.abs(rx + 0.6) < 0.18 && Math.abs(ry) < 1.0;
  // Upper arm of K
  const upperArm =
    ry < 0.1 && ry > -0.9 && Math.abs(rx - lerp(-0.15, 0.8, (-ry - 0.1) / 0.8)) < 0.14;
  // Lower arm of K
  const lowerArm =
    ry > -0.1 && ry < 0.9 && Math.abs(rx - lerp(-0.15, 0.8, (ry + 0.1) / 0.8)) < 0.14;

  if (verticalBar || upperArm || lowerArm) {
    return ACCENT_COLOR;
  }

  // Subtle border
  const borderWidth = size * 0.04;
  if (
    x < borderWidth ||
    x > size - borderWidth ||
    y < borderWidth ||
    y > size - borderWidth
  ) {
    return {
      r: BG_COLOR.r + 20,
      g: BG_COLOR.g + 20,
      b: BG_COLOR.b + 20,
    };
  }

  return BG_COLOR;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function createChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const typeAndData = Buffer.concat([
    Buffer.from(type, "ascii"),
    data,
  ]);

  // CRC32
  const crc = crc32(typeAndData);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc, 0);

  return Buffer.concat([length, typeAndData, crcBuf]);
}

// CRC32 implementation
const CRC_TABLE: number[] = [];
function initCRCTable(): void {
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    CRC_TABLE[i] = c;
  }
}

function crc32(data: Buffer): number {
  if (CRC_TABLE.length === 0) initCRCTable();
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// ---- Main ----

async function main(): Promise<void> {
  await mkdir(OUTPUT_DIR, { recursive: true });

  for (const icon of ICONS) {
    const png = createPNG(icon.size);
    const path = `${OUTPUT_DIR}/${icon.name}`;
    const stream = createWriteStream(path);
    stream.write(png);
    stream.end();
    console.log(`Generated ${path} (${png.length} bytes)`);
  }
}

main().catch(console.error);
