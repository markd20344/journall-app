// One-off script to generate simple solid-color PWA icon PNGs with rounded
// corners and a centered "J" mark, without pulling in an image library.
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(zlib.crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function buildPng(size, draw) {
  const width = size;
  const height = size;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0; // filter type: none
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = draw(x, y, width, height);
      const px = rowStart + 1 + x * 4;
      raw[px] = r;
      raw[px + 1] = g;
      raw[px + 2] = b;
      raw[px + 3] = a;
    }
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const idatData = zlib.deflateSync(raw);
  const png = Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", idatData),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  return png;
}

const ACCENT = [255, 255, 255]; // white glyph
const BG = [37, 99, 235]; // matches --accent (#2563eb), the app's actual blue branding

function draw(x, y, w, h) {
  const cx = w / 2;
  const cy = h / 2;
  const radius = w * 0.5;
  const dx = x + 0.5 - cx;
  const dy = y + 0.5 - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist > radius) return [0, 0, 0, 0];

  // Background circle
  let [r, g, b] = BG;
  const a = 255;

  // Draw a simple "J" glyph using a few rectangles in accent color.
  const stemWidth = w * 0.11;
  const stemTop = h * 0.28;
  const stemBottom = h * 0.62;
  const stemX = cx + w * 0.06;

  const inStem = x > stemX - stemWidth / 2 && x < stemX + stemWidth / 2 && y > stemTop && y < stemBottom;

  const hookCx = cx - w * 0.08;
  const hookCy = stemBottom;
  const hookOuter = w * 0.2;
  const hookInner = hookOuter - stemWidth;
  const hdx = x - hookCx;
  const hdy = y - hookCy;
  const hookDist = Math.sqrt(hdx * hdx + hdy * hdy);
  const inHook = hookDist < hookOuter && hookDist > hookInner && hdy > -stemWidth / 2;

  const topBarY0 = h * 0.24;
  const topBarY1 = h * 0.24 + stemWidth;
  const inTopBar = x > stemX - w * 0.16 && x < stemX + w * 0.16 && y > topBarY0 && y < topBarY1;

  if (inStem || inHook || inTopBar) {
    [r, g, b] = ACCENT;
  }

  return [r, g, b, a];
}

const outDir = path.join(__dirname, "..", "public", "icons");
fs.mkdirSync(outDir, { recursive: true });

for (const size of [192, 512]) {
  const png = buildPng(size, draw);
  fs.writeFileSync(path.join(outDir, `icon-${size}.png`), png);
  console.log(`wrote icons/icon-${size}.png`);
}

// Maskable icon: same art, but the safe zone is smaller (icon should occupy
// only the inner ~80% so it isn't clipped when masked to a shape).
function drawMaskable(x, y, w, h) {
  const cx = w / 2;
  const cy = h / 2;
  let [r, g, b] = BG;
  const a = 255;

  const scale = 0.7;
  const sx = cx + (x - cx) / scale;
  const sy = cy + (y - cy) / scale;

  const stemWidth = w * 0.11;
  const stemTop = h * 0.28;
  const stemBottom = h * 0.62;
  const stemX = cx + w * 0.06;
  const inStem = sx > stemX - stemWidth / 2 && sx < stemX + stemWidth / 2 && sy > stemTop && sy < stemBottom;

  const hookCx = cx - w * 0.08;
  const hookCy = stemBottom;
  const hookOuter = w * 0.2;
  const hookInner = hookOuter - stemWidth;
  const hdx = sx - hookCx;
  const hdy = sy - hookCy;
  const hookDist = Math.sqrt(hdx * hdx + hdy * hdy);
  const inHook = hookDist < hookOuter && hookDist > hookInner && hdy > -stemWidth / 2;

  const topBarY0 = h * 0.24;
  const topBarY1 = h * 0.24 + stemWidth;
  const inTopBar = sx > stemX - w * 0.16 && sx < stemX + w * 0.16 && sy > topBarY0 && sy < topBarY1;

  if (inStem || inHook || inTopBar) {
    [r, g, b] = ACCENT;
  }
  return [r, g, b, a];
}

const maskablePng = buildPng(512, drawMaskable);
fs.writeFileSync(path.join(outDir, "icon-maskable-512.png"), maskablePng);
console.log("wrote icons/icon-maskable-512.png");
