// Builds public/<folder>/manifest.json from the frames exported by Blender.
//
// Usage:  npm run hero:manifest                (folder: mr_bip/hero, 30 fps)
//         node scripts/build-hero-manifest.mjs mr_bip/hero 24
//
// It detects the naming pattern from the files themselves (frame_0001.webp,
// 0001.webp, mrbip.0001.webp...), so the export settings in Blender do not
// matter as long as every frame has a number and the same extension.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const folder = process.argv[2] ?? 'mr_bip/hero';
const fps = Number(process.argv[3] ?? 30);
const dir = join(process.cwd(), 'public', folder);

const FRAME = /^(.*?)(\d+)(\.(?:webp|png|jpe?g|avif))$/i;

const frames = readdirSync(dir)
  .map((name) => ({ name, match: FRAME.exec(name) }))
  .filter((f) => f.match)
  .sort((a, b) => Number(a.match[2]) - Number(b.match[2]));

if (frames.length === 0) {
  console.error(`No frames found in public/${folder}. Export them as WebP with a frame number in the name.`);
  process.exit(1);
}

const [, prefix, firstNumber, ext] = frames[0].match;
const pad = firstNumber.length;
const start = Number(firstNumber);

// A gap in the numbering would play as a stutter: better to fail here.
frames.forEach((f, i) => {
  if (Number(f.match[2]) !== start + i) {
    console.error(`Frame numbering has a gap near ${f.name} (expected ${start + i}).`);
    process.exit(1);
  }
});

const { width, height } = readWebpSize(join(dir, frames[0].name)) ?? { width: 1080, height: 1350 };

const manifest = {
  frameCount: frames.length,
  pattern: `${prefix}{n}${ext}`,
  pad,
  start,
  fps,
  loop: true,
  width,
  height,
};

writeFileSync(join(dir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`manifest.json written: ${frames.length} frames at ${fps} fps (${width}x${height}).`);

// Reads the canvas size from a WebP header (VP8, VP8L or VP8X). Returns null
// for other formats; the manifest then falls back to 1080x1350 and the size
// can be corrected by hand.
function readWebpSize(file) {
  const buf = readFileSync(file);
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WEBP') return null;
  const chunk = buf.toString('ascii', 12, 16);
  if (chunk === 'VP8X') {
    return { width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
  }
  if (chunk === 'VP8L') {
    const bits = buf.readUInt32LE(21);
    return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >> 14) & 0x3fff) };
  }
  if (chunk === 'VP8 ') {
    return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
  }
  return null;
}
