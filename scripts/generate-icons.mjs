import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';

function createPng(width, height, r, g, b, a = 255) {
  // Simple uncompressed or deflate PNG
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // RGBA
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace

  const ihdr = makeChunk('IHDR', ihdrData);

  // Raw image data with scanline filter byte 0
  const scanlineLength = width * 4 + 1;
  const raw = Buffer.alloc(scanlineLength * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * scanlineLength;
    raw[rowOffset] = 0; // filter type 0: None

    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      // Draw a rounded card with a glowing pulse circle
      const cx = width / 2;
      const cy = height / 2;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Background dark slate
      let pr = 10, pg = 12, pb = 18, pa = 255;

      // Outer border radius
      const cornerR = width * 0.22;
      const rx = Math.max(0, Math.abs(dx) - (width / 2 - cornerR));
      const ry = Math.max(0, Math.abs(dy) - (height / 2 - cornerR));
      const cornerDist = Math.sqrt(rx * rx + ry * ry);
      if (cornerDist > cornerR) {
        pa = 0;
      } else {
        // Inner amber ring
        const ring1 = Math.abs(dist - width * 0.28);
        const ring2 = Math.abs(dist - width * 0.18);
        const center = dist < width * 0.08;

        if (center) {
          pr = 230; pg = 162; pb = 74; pa = 255;
        } else if (ring2 < width * 0.035) {
          pr = 245; pg = 180; pb = 90; pa = 255;
        } else if (ring1 < width * 0.025) {
          pr = 217; pg = 119; pb = 6; pa = 220;
        } else if (dist < width * 0.38 && (Math.abs(dx) < 2 || Math.abs(dy) < 2)) {
          pr = 70; pg = 201; pb = 138; pa = 180;
        }
      }

      raw[pxOffset] = pr;
      raw[pxOffset + 1] = pg;
      raw[pxOffset + 2] = pb;
      raw[pxOffset + 3] = pa;
    }
  }

  const idatData = zlib.deflateSync(raw);
  const idat = makeChunk('IDAT', idatData);
  const iend = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

function makeChunk(type, data) {
  const len = data.length;
  const buf = Buffer.alloc(len + 12);
  buf.writeUInt32BE(len, 0);
  buf.write(type, 4, 4, 'ascii');
  data.copy(buf, 8);
  const crc = crc32(buf.subarray(4, len + 8));
  buf.writeUInt32BE(crc, len + 8);
  return buf;
}

// standard CRC32 table
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const publicDir = '<REPO_ROOT>/public';
fs.writeFileSync(path.join(publicDir, 'icon-192.png'), createPng(192, 192, 230, 162, 74));
fs.writeFileSync(path.join(publicDir, 'icon-512.png'), createPng(512, 512, 230, 162, 74));
console.log('Generated icon-192.png and icon-512.png successfully!');
