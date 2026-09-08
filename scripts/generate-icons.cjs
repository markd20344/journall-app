// One-off script to generate simple solid-color PWA icon PNGs — one
// distinct mark + color per app, so they're easy to tell apart on a phone's
// home screen — without pulling in an image library.
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
  return Buffer.concat([signature, chunk("IHDR", ihdr), chunk("IDAT", idatData), chunk("IEND", Buffer.alloc(0))]);
}

const WHITE = [255, 255, 255];

// Each glyph function takes scaled coordinates (sx, sy already have the
// maskable safe-zone shrink applied, or are just x/y for the regular icon)
// plus the icon's center/size, and returns true if that pixel is part of
// the mark.

function journalGlyph(sx, sy, cx, w, h) {
  // A simple "J": a vertical stem, a hook at the bottom, and a top bar.
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

  return inStem || inHook || inTopBar;
}

function kitRunsGlyph(sx, sy, cx, w, h) {
  // A shipping box: a hollow square outline with a lid-seam line near the
  // top — a package to collect, not a letter mark, so it reads instantly
  // as a different app from Journall OS.
  const half = w * 0.22;
  const cy = h / 2;
  const bx0 = cx - half;
  const bx1 = cx + half;
  const by0 = cy - half;
  const by1 = cy + half;
  const border = w * 0.05;
  const inBox = sx > bx0 && sx < bx1 && sy > by0 && sy < by1;
  const nearEdge = sx < bx0 + border || sx > bx1 - border || sy < by0 + border || sy > by1 - border;
  const inOutline = inBox && nearEdge;

  const lidY0 = by0 + (by1 - by0) * 0.32;
  const lidY1 = lidY0 + border;
  const inLid = inBox && sy > lidY0 && sy < lidY1;

  return inOutline || inLid;
}

function familyTreeGlyph(sx, sy, cx, w, h) {
  // A tree: a short trunk under a three-lobed canopy.
  const trunkWidth = w * 0.09;
  const trunkTop = h * 0.5; // tucks under the canopy's overlap so there's no visible gap
  const trunkBottom = h * 0.72;
  const inTrunk = sx > cx - trunkWidth / 2 && sx < cx + trunkWidth / 2 && sy > trunkTop && sy < trunkBottom;

  const lobes = [
    { cx: cx, cy: h * 0.34, r: w * 0.17 },
    { cx: cx - w * 0.14, cy: h * 0.47, r: w * 0.15 },
    { cx: cx + w * 0.14, cy: h * 0.47, r: w * 0.15 },
  ];
  const inCanopy = lobes.some((l) => {
    const dx = sx - l.cx;
    const dy = sy - l.cy;
    return Math.sqrt(dx * dx + dy * dy) < l.r;
  });

  return inTrunk || inCanopy;
}

const APPS = [
  { name: "journal", bg: [37, 99, 235], glyph: journalGlyph }, // matches --accent (#2563eb)
  { name: "kit-runs", bg: [217, 119, 6], glyph: kitRunsGlyph }, // amber (#d97706)
  { name: "family-tree", bg: [21, 128, 61], glyph: familyTreeGlyph }, // green (#15803d)
];

function makeDraw(app, maskable) {
  return function draw(x, y, w, h) {
    const cx = w / 2;
    const cy = h / 2;
    const radius = w * 0.5;
    const dx = x + 0.5 - cx;
    const dy = y + 0.5 - cy;
    if (Math.sqrt(dx * dx + dy * dy) > radius) return [0, 0, 0, 0];

    // Maskable icons get masked to arbitrary shapes by the OS, so the mark
    // needs to sit inside a smaller safe zone (~70%) or it gets clipped.
    const scale = maskable ? 0.7 : 1;
    const sx = cx + (x + 0.5 - cx) / scale;
    const sy = cy + (y + 0.5 - cy) / scale;

    const [r, g, b] = app.glyph(sx, sy, cx, w, h) ? WHITE : app.bg;
    return [r, g, b, 255];
  };
}

for (const app of APPS) {
  const outDir = path.join(__dirname, "..", "apps", app.name, "public", "icons");
  fs.mkdirSync(outDir, { recursive: true });

  for (const size of [192, 512]) {
    fs.writeFileSync(path.join(outDir, `icon-${size}.png`), buildPng(size, makeDraw(app, false)));
  }
  fs.writeFileSync(path.join(outDir, "icon-maskable-512.png"), buildPng(512, makeDraw(app, true)));
  console.log(`wrote icons for ${app.name}`);
}
