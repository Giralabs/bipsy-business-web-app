// Mounts the app screenshots on the empty phone of the Mr. Bip renders that hold
// one, and cuts the white background out. Re-run it when a screenshot changes.
//
//   npm i -D sharp                  (not a project dependency, like
//   node scripts/build-bip-phones.mjs   build-bip-rigs.mjs: once, by hand)
//   node scripts/build-bip-phones.mjs mb-10
//
// Reads ../recursos_capturas_bips/, writes design/mr_bip-png/<code>.png (2000 px,
// transparent), public/mr_bip/<CODE>.webp, the file BipSlotComponent looks for,
// and public/app_shots/<name>.webp, the screenshots PhoneComponent shows.
//
// There is no real screenshot of Finanzas yet, so MB-12 uses the drawn screen of
// the site (design/shots/finanzas-mock.png). Drop a business-finanzas.jpeg in
// recursos_capturas_bips and it takes over on the next run.
//
// ---------------------------------------------------------------------------
// How it works
//
//  * The screen is the largest patch of flat light grey. Taken that way it needs
//    no measuring and keeps the exact corners of each render. Its edge is read
//    from the brightness between bezel and grey, so it stays antialiased.
//  * The background is whatever near-white is connected to the border, plus the
//    holes listed in `holes` (a gap closed by an arm cannot be reached from
//    outside). Shirts and cuffs are also white, so the loose threshold only goes
//    HALO px deep, enough for the pale outline these renders have.
//  * The band left along the cut is mixed with white, and would show as a light
//    line on the dark theme. Each pixel is solved against the colour just inside
//    it to get its real alpha and colour.
//  * Screens are not all 2.167 tall like the screenshots. Up to MAX_STRETCH of
//    the difference is absorbed by stretching, which does not show; the rest is
//    cropped from the sides, where the app only has margin.
import sharp from 'sharp';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = resolve(ROOT, '..', 'recursos_capturas_bips');
const PNG_DIR = join(ROOT, 'design', 'mr_bip-png');
const WEBP_DIR = join(ROOT, 'public', 'mr_bip');
const APP_SHOTS_DIR = join(ROOT, 'public', 'app_shots');
const FINANZAS = existsSync(join(SHOTS, 'business-finanzas.jpeg'))
  ? join(SHOTS, 'business-finanzas.jpeg')
  : join(ROOT, 'design', 'shots', 'finanzas-mock.png');

/** Screenshot → name on the site. `.ph` is 282 px wide, so this is 2.3x. */
const APP_SHOTS = {
  'business-agenda-hoy.jpeg': 'business-agenda-hoy',
  'business-cliente-detail.jpeg': 'business-cliente-detail',
  'business-equipo.jpeg': 'business-equipo',
  'business-chat.jpeg': 'business-chat',
  'cliente-reserva-hora.jpeg': 'cliente-reserva-hora',
  'business-reseñas.jpeg': 'business-resenas',
  'business-registro-fichajes.jpeg': 'business-registro-fichajes',
};
const APP_SHOT_WIDTH = 650;

const WEBP_SIZE = 1200;
const STRICT_WHITE = 250;
const LOOSE_WHITE = 232;
const HALO = 7;
const BAND = 5;
const MAX_STRETCH = 0.03;

/** The real push of a new booking: `NotifCopy.newBooking` (who · service · when). */
const NEW_BOOKING = { title: 'Nueva cita', body: 'Marina Alcaide · Tratamiento facial · hoy 09:00' };

const BIPS = [
  { code: 'BIP-01', shot: 'cliente-reserva-hora.jpeg' },
  { code: 'MB-02', shot: 'business-agenta-deldia.jpeg', push: NEW_BOOKING },
  { code: 'MB-10', shot: 'business-agenda-hoy.jpeg' },
  { code: 'MB-11', shot: 'business-cliente-detail.jpeg' },
  { code: 'MB-12', shot: FINANZAS, holes: [[396, 905]] },
  { code: 'MB-13', shot: 'business-registro-fichajes.jpeg' },
  { code: 'MB-14', shot: 'business-portfolio.jpeg', holes: [[401, 1178]] },
];

const escapeXml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

/** Draws the banner of a push over a screenshot. Everything is in screenshot px. */
async function withPush(shot, push) {
  const { width: W } = await sharp(shot).metadata();
  const x = 30, y = 88, w = W - 60, h = 146;
  const icon = await sharp(join(ROOT, 'public', 'icons', 'icon-192.webp')).resize(84, 84).png().toBuffer();
  const svg = `<svg width="${W}" height="${y + h + 60}" xmlns="http://www.w3.org/2000/svg">
    <defs><filter id="s" x="-10%" y="-30%" width="120%" height="170%">
      <feDropShadow dx="0" dy="14" stdDeviation="22" flood-color="#000" flood-opacity=".22"/></filter>
      <clipPath id="r"><rect x="${x + 30}" y="${y + 31}" width="84" height="84" rx="19"/></clipPath></defs>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="46" fill="#fff" fill-opacity=".97" filter="url(#s)"/>
    <image x="${x + 30}" y="${y + 31}" width="84" height="84" clip-path="url(#r)"
           href="data:image/png;base64,${icon.toString('base64')}"/>
    <text x="${x + 134}" y="${y + 62}" font-family="Segoe UI" font-weight="700" font-size="34" fill="#15171A">${escapeXml(push.title)}</text>
    <text x="${x + w - 32}" y="${y + 60}" text-anchor="end" font-family="Segoe UI" font-size="26" fill="#7F8E89">ahora</text>
    <text x="${x + 134}" y="${y + 106}" font-family="Segoe UI" font-size="29" fill="#2E343B">${escapeXml(push.body)}</text>
  </svg>`;
  return sharp(shot).composite([{ input: Buffer.from(svg), top: 0, left: 0 }]).jpeg({ quality: 98 }).toBuffer();
}

function largestPatch(W, H, test) {
  const seen = new Uint8Array(W * H);
  const queue = new Int32Array(W * H);
  let best = null;
  for (let s = 0; s < W * H; s++) {
    if (seen[s] || !test(s)) continue;
    let head = 0, tail = 0;
    queue[tail++] = s;
    seen[s] = 1;
    while (head < tail) {
      const p = queue[head++];
      const x = p % W;
      if (x > 0 && !seen[p - 1] && test(p - 1)) { seen[p - 1] = 1; queue[tail++] = p - 1; }
      if (x < W - 1 && !seen[p + 1] && test(p + 1)) { seen[p + 1] = 1; queue[tail++] = p + 1; }
      if (p >= W && !seen[p - W] && test(p - W)) { seen[p - W] = 1; queue[tail++] = p - W; }
      if (p < W * (H - 1) && !seen[p + W] && test(p + W)) { seen[p + W] = 1; queue[tail++] = p + W; }
    }
    if (!best || tail > best.length) best = queue.slice(0, tail);
  }
  return best;
}

/** Marks the background: 1 = background. `src` is RGBA, with transparency kept. */
function findBackground(src, W, H, holes) {
  const N = W * H;
  const bg = new Uint8Array(N);
  const lum = (i) => Math.min(src[i * 4], src[i * 4 + 1], src[i * 4 + 2]);
  const queue = new Int32Array(N);
  let tail = 0;
  const push = (p) => { if (!bg[p]) { bg[p] = 1; queue[tail++] = p; } };

  for (let i = 0; i < N; i++) if (src[i * 4 + 3] < 10) push(i);
  for (let x = 0; x < W; x++) { push(x); push(N - 1 - x); }
  for (let y = 0; y < H; y++) { push(y * W); push(y * W + W - 1); }
  for (const [x, y] of holes ?? []) push(y * W + x);

  let head = 0;
  while (head < tail) {
    const p = queue[head++];
    const x = p % W;
    for (const n of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, p >= W ? p - W : -1, p < N - W ? p + W : -1]) {
      if (n >= 0 && !bg[n] && lum(n) >= STRICT_WHITE) push(n);
    }
  }

  // The pale outline: only HALO px deep, or it would eat the cuffs.
  let frontier = queue.slice(0, tail);
  for (let d = 0; d < HALO; d++) {
    const next = [];
    for (const p of frontier) {
      const x = p % W;
      for (const n of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, p >= W ? p - W : -1, p < N - W ? p + W : -1]) {
        if (n >= 0 && !bg[n] && lum(n) >= LOOSE_WHITE && src[n * 4 + 3] >= 10) { bg[n] = 1; next.push(n); }
      }
    }
    frontier = next;
  }
  return bg;
}

/** Writes alpha into `out` and takes the white out of the band along the cut. */
function cutOut(out, bg, W, H) {
  const N = W * H;
  const dist = new Uint8Array(N);
  const queue = new Int32Array(N);
  let head = 0, tail = 0;
  for (let i = 0; i < N; i++) {
    if (bg[i]) { out[i * 4 + 3] = 0; dist[i] = 255; queue[tail++] = i; }
  }
  const neighbours = (p) => {
    const x = p % W;
    return [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, p >= W ? p - W : -1, p < N - W ? p + W : -1];
  };
  // Distance from the cut, BAND px in.
  const band = [];
  let level = 0;
  let frontierEnd = tail;
  while (head < tail && level < BAND) {
    for (; head < frontierEnd; head++) {
      for (const n of neighbours(queue[head])) {
        if (n >= 0 && !bg[n] && !dist[n]) { dist[n] = level + 1; queue[tail++] = n; band.push(n); }
      }
    }
    frontierEnd = tail;
    level++;
  }
  // The colour just inside, carried outwards from the deepest ring.
  const inner = new Int32Array(N).fill(-1);
  for (const p of band) if (dist[p] === BAND) inner[p] = p;
  for (let d = BAND - 1; d >= 1; d--) {
    for (const p of band) {
      if (dist[p] !== d) continue;
      for (const n of neighbours(p)) {
        if (n >= 0 && dist[n] === d + 1 && inner[n] >= 0) { inner[p] = inner[n]; break; }
      }
    }
  }
  for (const p of band) {
    if (dist[p] === BAND || inner[p] < 0) continue;
    const q = inner[p] * 4, i = p * 4;
    const f = [out[q], out[q + 1], out[q + 2]];
    const c = [out[i], out[i + 1], out[i + 2]];
    const fw = f.map((v) => 255 - v);
    const fw2 = fw[0] ** 2 + fw[1] ** 2 + fw[2] ** 2;
    if (fw2 < 2500) {
      // White on white (a cuff at the edge): nothing to solve, just soften it.
      out[i + 3] = dist[p] === 1 ? 128 : 255;
      continue;
    }
    const a = Math.max(0, Math.min(1, ((255 - c[0]) * fw[0] + (255 - c[1]) * fw[1] + (255 - c[2]) * fw[2]) / fw2));
    out[i + 3] = Math.round(a * 255);
    const blend = a < 0.6 ? 1 : (1 - a) / 0.4;
    for (let k = 0; k < 3; k++) {
      const solved = a > 0.01 ? Math.max(0, Math.min(255, (c[k] - (1 - a) * 255) / a)) : f[k];
      out[i + k] = Math.round(solved * (1 - blend) + f[k] * blend);
    }
  }
}

async function build({ code, shot, holes, push }) {
  const file = join(SHOTS, `${code}.png`);
  const { data: raw, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, N = W * H;

  // Transparent pixels count as the white the other renders have.
  const src = Buffer.from(raw);
  for (let i = 0; i < N; i++) {
    const a = src[i * 4 + 3] / 255;
    for (let k = 0; k < 3; k++) src[i * 4 + k] = Math.round(src[i * 4 + k] * a + 255 * (1 - a));
  }

  // 1. The screen.
  const isGrey = (i) => {
    const r = src[i * 4], g = src[i * 4 + 1], b = src[i * 4 + 2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    return raw[i * 4 + 3] > 200 && mn > 190 && mx < 248 && mx - mn < 22;
  };
  const patch = largestPatch(W, H, isGrey);
  let minx = W, maxx = 0, miny = H, maxy = 0, sum = 0;
  for (const p of patch) {
    const x = p % W, y = (p / W) | 0;
    if (x < minx) minx = x;
    if (x > maxx) maxx = x;
    if (y < miny) miny = y;
    if (y > maxy) maxy = y;
    sum += src[p * 4 + 1];
  }
  const grey = sum / patch.length;
  const screenMask = new Uint8Array(N);
  for (const p of patch) screenMask[p] = 255;
  // Close the small holes in the patch and read the antialiased rim, 4 px out.
  for (let y = miny; y <= maxy; y++) {
    let first = -1, last = -1;
    for (let x = minx; x <= maxx; x++) if (screenMask[y * W + x]) { if (first < 0) first = x; last = x; }
    for (let x = first; first >= 0 && x <= last; x++) screenMask[y * W + x] = 255;
  }
  const rim = [];
  for (let y = miny - 4; y <= maxy + 4; y++) {
    for (let x = minx - 4; x <= maxx + 4; x++) {
      const p = y * W + x;
      if (screenMask[p]) continue;
      let near = false;
      for (let dy = -4; dy <= 4 && !near; dy++) {
        for (let dx = -4; dx <= 4; dx++) if (screenMask[(y + dy) * W + x + dx] === 255) { near = true; break; }
      }
      if (near) rim.push(p);
    }
  }
  for (const p of rim) {
    const mid = src[p * 4 + 1];
    screenMask[p] = Math.round(Math.max(0, Math.min(1, (mid - 40) / (grey - 40))) * 255);
  }

  // 2. The screenshot, fitted to the screen.
  const sw = maxx - minx + 1, sh = maxy - miny + 1;
  const shotFile = resolve(SHOTS, shot);
  const shotInput = push ? await withPush(shotFile, push) : shotFile;
  const meta = await sharp(shotInput).metadata();
  const want = sh / sw, have = meta.height / meta.width;
  const excess = want / have - 1; // >0: the screen is taller than the screenshot
  const absorbed = Math.max(-MAX_STRETCH, Math.min(MAX_STRETCH, excess));
  const rest = (1 + excess) / (1 + absorbed) - 1;
  let fitted;
  if (rest > 0) {
    const scaledW = Math.round(sw * (1 + rest));
    fitted = sharp(await sharp(shotInput).resize(scaledW, sh, { fit: 'fill', kernel: 'lanczos3' }).png().toBuffer())
      .extract({ left: Math.floor((scaledW - sw) / 2), top: 0, width: sw, height: sh });
  } else {
    const scaledH = Math.round(sh * (1 - rest));
    fitted = sharp(await sharp(shotInput).resize(sw, scaledH, { fit: 'fill', kernel: 'lanczos3' }).png().toBuffer())
      .extract({ left: 0, top: 0, width: sw, height: sh });
  }
  const screen = await fitted.removeAlpha().raw().toBuffer();

  // A breath of depth along the glass, so the shot sits in the phone and not on it.
  const shade = await sharp(Buffer.from(screenMask), { raw: { width: W, height: H, channels: 1 } })
    .blur(7).extractChannel(0).raw().toBuffer();

  // 3. Together.
  const out = Buffer.from(src);
  for (let y = Math.max(0, miny - 4); y <= Math.min(H - 1, maxy + 4); y++) {
    for (let x = Math.max(0, minx - 4); x <= Math.min(W - 1, maxx + 4); x++) {
      const p = y * W + x;
      const a = screenMask[p] / 255;
      if (!a) continue;
      const sx = Math.max(0, Math.min(sw - 1, x - minx)), sy = Math.max(0, Math.min(sh - 1, y - miny));
      const q = (sy * sw + sx) * 3;
      const depth = 0.9 + 0.1 * Math.min(1, Math.max(0, (shade[p] / 255 - 0.5) * 2));
      for (let k = 0; k < 3; k++) {
        out[p * 4 + k] = Math.round(screen[q + k] * depth * a + src[p * 4 + k] * (1 - a));
      }
    }
  }

  // 4. The cut. The screen is enclosed by the bezel, so it can never be reached.
  const bg = findBackground(Buffer.concat([src.subarray(0, 0), maskedAlpha(src, raw, N)]), W, H, holes);
  cutOut(out, bg, W, H);

  const png = sharp(out, { raw: { width: W, height: H, channels: 4 } }).png({ compressionLevel: 9 });
  mkdirSync(PNG_DIR, { recursive: true });
  await png.clone().toFile(join(PNG_DIR, `${code.toLowerCase()}.png`));
  await png.clone().resize(WEBP_SIZE, WEBP_SIZE, { kernel: 'lanczos3' })
    .webp({ quality: 88, alphaQuality: 95, effort: 6 })
    .toFile(join(WEBP_DIR, `${code}.webp`));
  console.log(`${code}: screen ${sw}x${sh} at ${minx},${miny}, ${shot}, stretch ${(absorbed * 100).toFixed(1)}%`);
}

/** The flattened pixels with the original transparency back, for the flood fill. */
function maskedAlpha(flat, raw, N) {
  const b = Buffer.from(flat);
  for (let i = 0; i < N; i++) b[i * 4 + 3] = raw[i * 4 + 3];
  return b;
}

const only = process.argv.slice(2).map((s) => s.toUpperCase());
for (const bip of BIPS) {
  if (!only.length || only.includes(bip.code)) await build(bip);
}
if (!only.length) {
  mkdirSync(APP_SHOTS_DIR, { recursive: true });
  for (const [file, name] of Object.entries(APP_SHOTS)) {
    await sharp(join(SHOTS, file)).resize({ width: APP_SHOT_WIDTH, kernel: 'lanczos3' })
      .webp({ quality: 84, effort: 6 }).toFile(join(APP_SHOTS_DIR, `${name}.webp`));
  }
}
