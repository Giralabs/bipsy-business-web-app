// Cuts the Mr. Bip renders in public/mr_bip into the layers the hero and the
// section illustrations animate. Re-run it if the artwork is replaced.
//
//   npm i -D sharp                        (not a project dependency: it is a
//   node scripts/build-bip-rigs.mjs        native module and only this script
//   node scripts/build-bip-rigs.mjs mb-03  needs it, once, by hand)
//
// Flags: --check verifies the cut, --lossless skips WebP quantisation.
//
// ---------------------------------------------------------------------------
// How it works
//
// These are still renders. There is no 3D model of the mascot to re-render
// from, so the movement has to come out of the pictures, and the cuts are
// taken from the artwork rather than traced by hand. That is possible because
// Mr. Bip is a handful of flat materials — blue-grey skin, white shirt,
// near-black suit, and in MB-03 an orange pencil on a brown board:
//
//  * The head is the patch of skin connected to the top of the picture. Found
//    that way it needs no measuring, and the hands come out as their own
//    patches of skin, which is how each arm finds its hand.
//  * Where a hand meets a shirt, a tie or a sheet of paper the edge is a
//    colour edge, and it is taken exactly. Where a sleeve meets the jacket it
//    is black on black and invisible, so a rough capsule along the shoulder →
//    elbow → wrist chain is enough. That is the whole trick: the boundary only
//    has to be accurate where it can be seen.
//  * Whatever a moving layer sits on is then reconstructed (push-pull
//    interpolation of the surrounding cloth, shirt and paper), so the arms
//    have something to move over. Only the few pixels beside a moving edge are
//    ever uncovered.
//
// Stacked back to front, the layers reproduce the source pixel for pixel at
// rest; --check measures it. The numbers printed at the end are the
// transform-origins the stylesheet needs.
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CHECK = process.argv.includes('--check');
const LOSSLESS = process.argv.includes('--lossless');
const ONLY = process.argv.slice(2).filter((a) => !a.startsWith('--'));

/** Width the layers are published at, never upscaled past the source. The
 *  biggest slot shows a rig 340 CSS px wide, so 720 still covers a 2×
 *  display, and full-size layers would cost twice the decoded texture memory
 *  for no visible gain. */
const MAX_OUT_WIDTH = 720;

// ---------------------------------------------------------------------------
// The figures. `chain` joints are [x, y, radius] along shoulder → elbow →
// wrist → hand; `pivot` is the joint the layer turns on in the stylesheet.
const FIGURES = {
  // Re-measured for the 690×1639 render that replaced the original one (the
  // first had five fingers). Same gesture, different proportions: every seam
  // below moved.
  'mb-00': {
    source: 'MB-00',
    // The torso pulls up, so it is split from the legs at a waist seam:
    // y=1100 sits in the long run (1080..1140) where every row is solid black
    // jacket, and a horizontal cut there gives nothing away.
    waist: { y: 1100, skirt: 42 },
    tab: { x0: 210, x1: 470, bottom: 840 },
    // His arms are folded across his chest, so most of what is behind them is
    // chest — but the elbows sit out on the silhouette with nothing behind
    // them at all. A short reach fills the one and leaves the other alone;
    // filled all the way, the reconstruction becomes a body-wide smear that
    // shows the moment the arms move.
    fillReach: 24,
    arms: [
      {
        key: 'arm-right', pivot: [170, 796],
        // The far joints stop short of the collar: reaching into it, the
        // capsule takes bites out of the shirt and the neck comes apart.
        chain: [[170, 800, 62], [118, 862, 64], [92, 930, 60], [124, 984, 54],
                [196, 942, 54], [250, 898, 52], [296, 864, 50]],
        cuff: [214, 838, 288, 924],
        fabric: 'suit',
        // The knot goes with this hand: it is the one gripping it, so the knot
        // rides up into the collar with the fist.
        take: [{ box: [318, 752, 370, 812], test: 'black' }],
      },
      {
        key: 'arm-left', pivot: [525, 796],
        chain: [[525, 800, 62], [574, 866, 62], [602, 938, 58], [576, 998, 54],
                [502, 1014, 54], [442, 984, 52], [394, 950, 50]],
        cuff: [396, 940, 468, 1024],
        fabric: 'suit',
      },
    ],
  },

  'mb-03': {
    source: 'MB-03',
    tab: { x0: 330, x1: 640, bottom: 800 },
    arms: [
      {
        key: 'arm-pencil', pivot: [272, 760],
        chain: [[272, 760, 52], [225, 830, 54], [205, 895, 56], [225, 955, 52],
                [300, 940, 50], [370, 895, 56], [440, 870, 60], [495, 875, 45]],
        cuff: [336, 842, 404, 970],
        grow: 9,
        take: [
          // The pencil. Not by "is it orange": its wooden tip (r−b 68) and its
          // shaded side are no more orange than the brown board, and a strict
          // test leaves the tip behind on the paper as a second, ghost pencil.
          // Inside a capsule that follows the pencil, "anything that is not
          // paper" is the pencil — eraser, grey ferrule, wood and all. The
          // capsule clips a few pixels of the board's edge too; the fill puts
          // brown back there, which is what surrounds it.
          {
            capsule: [[348, 746, 19], [392, 788, 16], [440, 832, 15],
                      [490, 878, 13], [528, 912, 11]],
            test: 'pencil',
          },
          // The pencil's cast shadow stays on the body on purpose. Carried
          // with the pencil it swings off the paper and onto the jacket and
          // the board, where a pale grey ribbon is far more obvious than a
          // shadow sitting a few pixels from the thing casting it.
        ],
      },
    ],
  },

  // The piggy bank is held in both hands, so both arms and the bank move as
  // one piece — they are rigid with respect to each other and splitting them
  // would only let them drift apart.
  'mb-06': {
    source: 'MB-06',
    tab: { x0: 350, x1: 620, bottom: 930 },
    arms: [
      {
        key: 'arms-piggy', pivot: [479, 930],
        chain: [[322, 884, 58], [262, 1004, 56], [300, 1092, 54], [430, 1104, 58],
                [560, 1164, 58], [668, 1112, 56], [710, 1004, 54], [652, 886, 58]],
        // The bank is the only pink thing in the picture: nothing else has red
        // this far above both green and blue.
        take: [{ box: [370, 870, 710, 1210], test: 'pink' }],
      },
    ],
  },

  // Only the gesturing arm moves. The head wears a headset whose earcups and
  // boom mic stick out past the skin, and the other hand rests on one of
  // them; tilting the head would leave all three behind, so it stays put and
  // the whole-body breath carries the life instead.
  'mb-08': {
    source: 'MB-08',
    head: false,
    arms: [
      {
        key: 'arm-gesture', pivot: [352, 900],
        chain: [[352, 900, 56], [300, 932, 54], [248, 964, 52], [210, 986, 50], [170, 1000, 54]],
        cuff: [210, 930, 290, 1030],
        fabric: 'any',
      },
    ],
    fillReach: 10,
  },

  // Seated, reading. The newspaper is the same grey family as the armchair
  // behind it, so it does not separate by colour the way a pencil or a piggy
  // bank does — it is taken by its outline instead, and everything inside
  // that outline is newspaper because the paper is in front of everything.
  'mb-15': {
    source: 'MB-15',
    // No head layer: his glasses cut the face into two separate patches of
    // skin, so "the patch of skin touching the top" finds only the forehead.
    // The head stays with the body and the paper carries the movement.
    head: false,
    arms: [
      {
        key: 'paper', pivot: [575, 1180],
        // Only to put both hands on this layer: they hold the paper, so they
        // have to travel with it.
        fabric: 'none',
        chain: [[303, 1041, 90], [575, 1130, 90], [836, 1026, 90]],
        take: [{
          // Traced off the artwork. Generous anywhere would swallow the
          // armchair, the coffee cup and his knees, all of which are the same
          // greys as the newsprint.
          poly: [[268, 838], [360, 856], [460, 884], [560, 862], [700, 824], [878, 796],
                 [830, 900], [795, 1010], [765, 1110], [730, 1170],
                 [560, 1205], [420, 1190], [340, 1152],
                 [300, 1040], [282, 940]],
          test: 'any',
        }],
      },
    ],
  },

  'mb-05': {
    source: 'MB-05',
    tab: { x0: 336, x1: 624, bottom: 960 },
    // The arms are held out against the background, so only the pixels around
    // the shoulder have any body behind them.
    fillReach: 22,
    arms: [
      // Joints on the middle of the sleeve, radii on its half-thickness, both
      // measured off the artwork column by column. Laid along the top edge
      // instead — which is where they started — the capsule leaves the whole
      // underside of the sleeve on the body, and that wedge sits still while
      // the arm lifts off it: the second sleeve.
      {
        key: 'arm-right', pivot: [300, 918],
        chain: [[300, 918, 76], [248, 936, 70], [196, 934, 70], [148, 918, 76], [104, 888, 74]],
        cuff: [130, 844, 235, 1000],
        fabric: 'any',
      },
      {
        key: 'arm-left', pivot: [678, 950],
        chain: [[678, 950, 80], [720, 974, 74], [768, 990, 70], [816, 988, 66], [868, 962, 76]],
        cuff: [740, 912, 848, 1064],
        fabric: 'any',
      },
    ],
  },
};

// ---------------------------------------------------------------------------
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const luma = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;
const byte = (v) => (v < 0 ? 0 : v > 255 ? 255 : Math.round(v));

for (const [name, fig] of Object.entries(FIGURES)) {
  if (ONLY.length && !ONLY.includes(name)) continue;
  await buildFigure(name, fig);
}

async function buildFigure(name, fig) {
  const SRC = join(ROOT, `public/mr_bip/${fig.source}.webp`);
  const OUT = join(ROOT, `public/mr_bip/rig/${name}`);
  mkdirSync(OUT, { recursive: true });

  const { data: src, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const N = W * H;

  const rgbAt = (p) => [src[p * 4], src[p * 4 + 1], src[p * 4 + 2]];
  const alphaAt = (p) => src[p * 4 + 3] / 255;
  // Material tests on the unpremultiplied colour, so a half-transparent pixel
  // at the outline still reads as the material it is.
  const skinAt = (p) => { const [r, g, b] = rgbAt(p); return clamp01((b - r - 3) / 9) * clamp01((luma(r, g, b) - 42) / 22); };
  const blackAt = (p) => clamp01((92 - luma(...rgbAt(p))) / 22);
  // Cuffs are white but shade to grey at the rim; a plain "is it white" test
  // leaves those crescents behind, sitting still while the hand moves off them.
  const lightAt = (p) => clamp01((luma(...rgbAt(p)) - 95) / 35);
  const warmAt = (p) => { const [r, , b] = rgbAt(p); return clamp01((r - b - 100) / 30); };
  const pinkAt = (p) => {
    const [r, g, b] = rgbAt(p);
    return clamp01((r - b - 28) / 10) * clamp01((r - g - 24) / 10) * clamp01((luma(r, g, b) - 90) / 20);
  };
  // Darker than the paper and warm with it: the pencil's own cast shadow.
  const shadowAt = (p) => {
    const [r, g, b] = rgbAt(p);
    return clamp01((205 - luma(r, g, b)) / 25) * clamp01((r - b - 12) / 10);
  };
  // Everything that is not the sheet of paper: neutral and bright is paper.
  const notPaperAt = (p) => {
    const [r, g, b] = rgbAt(p);
    return 1 - clamp01((25 - (r - b)) / 8) * clamp01((luma(r, g, b) - 150) / 12);
  };
  // Jacket cloth: anything that is not skin and not bright shirt. A sleeve is
  // not uniformly black — it has lit edges and sheen — so testing for black
  // alone leaves those highlights behind on the body, where they read as a
  // second sleeve. This keeps them without swallowing the collar.
  const suitAt = (p) => {
    const [r, g, b] = rgbAt(p);
    return (1 - skinAt(p)) * clamp01((165 - luma(r, g, b)) / 25);
  };
  // Dark and colourless: the suit, and the printing on the checklist.
  const darkNeutralAt = (p) => {
    const [r, g, b] = rgbAt(p);
    return clamp01((70 - luma(r, g, b)) / 18) * clamp01((12 - Math.abs(r - b)) / 6);
  };
  // The pencil is everything in its own narrow tube that is neither the paper
  // nor dark-and-colourless. Without the second half the tube also lifts the
  // wedge of jacket it passes over, and that black wedge then slides across
  // the white collar as the pencil moves; and it lifts a corner of the third
  // tick, which would travel with the pencil off its own checkbox.
  const pencilAt = (p) => notPaperAt(p) * (1 - darkNeutralAt(p));
  const TESTS = {
    skin: skinAt, black: blackAt, light: lightAt, warm: warmAt, pink: pinkAt,
    shadow: shadowAt, notpaper: notPaperAt, pencil: pencilAt, any: () => 1,
  };

  const inBox = (x, y, [x0, y0, x1, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
  // Even-odd crossing test, for the shapes no capsule describes: a sheet of
  // newspaper is a quadrilateral, not a run of discs.
  const inPoly = (x, y, pts) => {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };

  function capsule(joints) {
    const f = new Float32Array(N);
    for (let s = 0; s < joints.length - 1; s++) {
      const [ax, ay, ar] = joints[s], [bx, by, br] = joints[s + 1];
      const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy, rm = Math.max(ar, br) + 2;
      for (let y = Math.max(0, Math.floor(Math.min(ay, by) - rm)); y <= Math.min(H - 1, Math.max(ay, by) + rm); y++)
        for (let x = Math.max(0, Math.floor(Math.min(ax, bx) - rm)); x <= Math.min(W - 1, Math.max(ax, bx) + rm); x++) {
          const t = len2 ? clamp01(((x - ax) * dx + (y - ay) * dy) / len2) : 0;
          const d = Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
          const v = clamp01((ar + t * (br - ar) - d) / 2), k = y * W + x;
          if (v > f[k]) f[k] = v;
        }
    }
    return f;
  }
  const distToChain = (x, y, joints) => {
    let best = Infinity;
    for (let s = 0; s < joints.length - 1; s++) {
      const [ax, ay] = joints[s], [bx, by] = joints[s + 1];
      const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
      const t = len2 ? clamp01(((x - ax) * dx + (y - ay) * dy) / len2) : 0;
      best = Math.min(best, Math.hypot(x - (ax + t * dx), y - (ay + t * dy)));
    }
    return best;
  };

  // ---- skin patches: the head is the one touching the top of the picture,
  // the others are hands ---------------------------------------------------
  const isSkin = new Uint8Array(N);
  for (let p = 0; p < N; p++) isSkin[p] = alphaAt(p) > 0.5 && skinAt(p) > 0.5 ? 1 : 0;

  const label = new Int32Array(N).fill(-1);
  const patches = [];
  const stack = new Int32Array(N);
  for (let seed = 0; seed < N; seed++) {
    if (!isSkin[seed] || label[seed] >= 0) continue;
    const id = patches.length;
    const patch = { id, size: 0, box: [W, H, 0, 0], pixels: [] };
    let sp = 0;
    stack[sp++] = seed; label[seed] = id;
    while (sp > 0) {
      const p = stack[--sp];
      const x = p % W, y = (p / W) | 0;
      patch.size++; patch.pixels.push(p);
      if (x < patch.box[0]) patch.box[0] = x;
      if (y < patch.box[1]) patch.box[1] = y;
      if (x > patch.box[2]) patch.box[2] = x;
      if (y > patch.box[3]) patch.box[3] = y;
      for (const q of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, y > 0 ? p - W : -1, y < H - 1 ? p + W : -1]) {
        if (q >= 0 && isSkin[q] && label[q] < 0) { label[q] = id; stack[sp++] = q; }
      }
    }
    patches.push(patch);
  }
  patches.sort((a, b) => a.box[1] - b.box[1]);
  const headPatch = patches[0];
  const hands = patches.filter((q) => q !== headPatch && q.size > 1500);
  console.log(`${name}: ${patches.length} skin patches, head ${headPatch.size}px at y${headPatch.box[1]}` +
    `, ${hands.length} hand${hands.length === 1 ? '' : 's'} (${hands.map((q) => q.size).join(', ')}px)`);

  // Fill the head's holes — eyes, brows, mouth are black inside it — by
  // flooding the outside of the patch within its own bounding box.
  const head0 = new Uint8Array(N);
  for (const p of headPatch.pixels) head0[p] = 1;
  {
    const [x0, y0, x1, y1] = headPatch.box;
    const seen = new Uint8Array(N);
    let sp = 0;
    const push = (x, y) => {
      const p = y * W + x;
      if (x < x0 || x > x1 || y < y0 || y > y1 || seen[p] || head0[p]) return;
      seen[p] = 1; stack[sp++] = p;
    };
    for (let x = x0; x <= x1; x++) { push(x, y0); push(x, y1); }
    for (let y = y0; y <= y1; y++) { push(x0, y); push(x1, y); }
    while (sp > 0) {
      const p = stack[--sp], x = p % W, y = (p / W) | 0;
      push(x - 1, y); push(x + 1, y); push(x, y - 1); push(x, y + 1);
    }
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const p = y * W + x;
      if (!seen[p]) head0[p] = 1;
    }
  }
  // Grow it by a couple of pixels first, for the same reason as the hands:
  // the head's own antialiased rim is too blended to pass the "is it skin"
  // test, and left on the body it stays behind as a speckled outline of where
  // the head used to be.
  for (let pass = 0; pass < 2; pass++) {
    const grownHead = Uint8Array.from(head0);
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const p = y * W + x;
      if (head0[p] || alphaAt(p) === 0) continue;
      if (head0[p - 1] || head0[p + 1] || head0[p - W] || head0[p + W]) grownHead[p] = 1;
    }
    head0.set(grownHead);
  }
  // Soft rim: inside stays 1, the outermost ring follows the colour, so the
  // chin fades into the collar instead of cutting across it.
  const eroded = erode(erode(head0));
  const m = new Float32Array(N);
  // `head: false` leaves the head in the body. A head that never moves is a
  // layer, a file and a seam for nothing.
  if (fig.head !== false) {
    for (let p = 0; p < N; p++) {
      if (eroded[p]) m[p] = 1;
      else if (head0[p]) m[p] = Math.max(skinAt(p), alphaAt(p) < 0.99 ? 1 : 0);
    }
  }
  function erode(mask) {
    const out = new Uint8Array(N);
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const p = y * W + x;
      out[p] = mask[p] && mask[p - 1] && mask[p + 1] && mask[p - W] && mask[p + W] ? 1 : 0;
    }
    return out;
  }

  // The tab: real collar pixels carried behind the body, so a tilted head can
  // never open a transparent gap where the chin used to be.
  // It starts well inside the head and fades in, rather than at the chin: the
  // chin is a curve and a tab that begins at its lowest point has a hard edge
  // hanging in the open under the cheeks, which shows as a straight bar under
  // the jaw the moment the head lifts. Inside the head it costs nothing — the
  // head is already opaque there, and it is the same pixel either way.
  const tab = new Float32Array(N);
  if (fig.tab) {
    const { x0, x1, bottom } = fig.tab;
    const top = headPatch.box[3] - 120;
    const s = (e0, e1, v) => { const t = clamp01((v - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };
    for (let y = top; y <= bottom; y++) for (let x = x0; x <= x1; x++) {
      tab[y * W + x] = s(top, top + 30, y) * s(bottom, bottom - 26, y)
        * s(x0, x0 + 26, x) * s(x1, x1 - 26, x);
    }
  }

  // ---- arms ---------------------------------------------------------------
  const armMasks = fig.arms.map(() => new Float32Array(N));
  const caps = fig.arms.map((a) => capsule(a.chain));
  const extras = fig.arms.map((a) => (a.take ?? []).map((t) => ({ ...t, cap: t.capsule ? capsule(t.capsule) : null })));
  // Each hand goes to the arm whose chain ends nearest to it — but only if it
  // is actually at the end of that chain. MB-03 has two hands and one moving
  // arm, and without the distance test the hand holding the clipboard would be
  // dragged along by the one holding the pencil.
  const MAX_HAND_DIST = 110;
  const handOwner = hands.map((q) => {
    const cx = (q.box[0] + q.box[2]) / 2, cy = (q.box[1] + q.box[3]) / 2;
    let best = -1, bestD = MAX_HAND_DIST;
    fig.arms.forEach((a, i) => {
      const d = distToChain(cx, cy, a.chain);
      if (d < bestD) { bestD = d; best = i; }
    });
    return best;
  });
  hands.forEach((q, i) => {
    const cx = ((q.box[0] + q.box[2]) / 2) | 0, cy = ((q.box[1] + q.box[3]) / 2) | 0;
    console.log(`  hand ${q.size}px at (${cx},${cy}) → ` +
      (handOwner[i] < 0 ? 'left on the body' : fig.arms[handOwner[i]].key));
  });

  for (let p = 0; p < N; p++) {
    if (alphaAt(p) === 0) continue;
    const x = p % W, y = (p / W) | 0;
    const black = blackAt(p);
    const vals = fig.arms.map((a, i) => {
      // `fabric: 'any'` claims everything the capsule covers, not only what is
      // black enough. A sleeve is not uniformly black — it has lit edges and
      // sheen — and testing for black leaves those highlights on the body,
      // where they read as a second sleeve trailing the real one. Only safe
      // where nothing but sleeve and background lies inside the capsule,
      // which is the case for an arm held away from the chest.
      // 'none' claims nothing from the capsule: the chain is there only to
      // tell the hands which layer they belong to, for a layer whose shape
      // comes from somewhere else entirely — an outline, say.
      const fabric = a.fabric === 'any' ? 1
        : a.fabric === 'none' ? 0
        : a.fabric === 'suit' ? suitAt(p)
        : black;
      let v = caps[i][p] * fabric;
      if (a.cuff && inBox(x, y, a.cuff)) v = Math.max(v, lightAt(p));
      for (const t of extras[i]) {
        if (t.box && !inBox(x, y, t.box)) continue;
        if (t.poly && !inPoly(x, y, t.poly)) continue;
        if (t.cap && t.cap[p] <= 0) continue;
        const inside = t.cap ? t.cap[p] : 1;
        v = Math.max(v, inside * TESTS[t.test](p));
      }
      return v;
    });
    // Where two capsules reach the same pixel, the nearer chain wins.
    if (vals.filter((v) => v > 0).length > 1) {
      let best = 0, bestD = Infinity;
      fig.arms.forEach((a, i) => { const d = distToChain(x, y, a.chain); if (d < bestD) { bestD = d; best = i; } });
      vals.forEach((_, i) => { if (i !== best) vals[i] = 0; });
    }
    vals.forEach((v, i) => { armMasks[i][p] = v; });
  }
  // Hands are whole: a patch of skin belongs to its arm outright, grown by a
  // couple of pixels so it takes its own antialiased rim with it. The rim is
  // too blended to pass the "is it skin" test, and left on the body it stays
  // behind as a dotted tracing of where the hand used to be.
  hands.forEach((q, i) => {
    const claim = handOwner[i];
    const rim = new Set();
    for (const p of q.pixels) {
      const x = p % W, y = (p / W) | 0;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || xx >= W || yy < 0 || yy >= H) continue;
        const r = yy * W + xx;
        if (alphaAt(r) > 0 && m[r] < 0.5) rim.add(r);
      }
    }
    for (const p of rim) armMasks.forEach((mask, j) => { mask[p] = j === claim ? 1 : 0; });
  });

  // Close the holes inside each mask. A colour test picks a material, not an
  // object: "is it pink" finds the piggy bank's body but not its eyes, snout,
  // mouth or coin slot, and those stay behind on the chest as a floating
  // line-drawing of a pig. Anything enclosed by a mask belongs to it.
  for (const mask of armMasks) {
    let x0 = W, y0 = H, x1 = 0, y1 = 0;
    for (let p = 0; p < N; p++) {
      if (mask[p] <= 0.5) continue;
      const x = p % W, y = (p / W) | 0;
      if (x < x0) x0 = x; if (y < y0) y0 = y;
      if (x > x1) x1 = x; if (y > y1) y1 = y;
    }
    if (x1 <= x0) continue;
    x0 = Math.max(0, x0 - 1); y0 = Math.max(0, y0 - 1);
    x1 = Math.min(W - 1, x1 + 1); y1 = Math.min(H - 1, y1 + 1);
    const seen = new Uint8Array(N);
    const queue = new Int32Array((x1 - x0 + 1) * (y1 - y0 + 1));
    let qn = 0;
    const push = (x, y) => {
      if (x < x0 || x > x1 || y < y0 || y > y1) return;
      const p = y * W + x;
      if (seen[p] || mask[p] > 0.5) return;
      seen[p] = 1; queue[qn++] = p;
    };
    for (let x = x0; x <= x1; x++) { push(x, y0); push(x, y1); }
    for (let y = y0; y <= y1; y++) { push(x0, y); push(x1, y); }
    for (let i = 0; i < qn; i++) {
      const p = queue[i], x = p % W, y = (p / W) | 0;
      push(x - 1, y); push(x + 1, y); push(x, y - 1); push(x, y + 1);
    }
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const p = y * W + x;
      if (!seen[p] && mask[p] <= 0.5 && alphaAt(p) > 0) mask[p] = 1;
    }
  }

  // One pixel of growth all round. Every one of these masks comes from a
  // colour test, and a colour test always stops one pixel short: the outermost
  // ring of anything is blended with what is behind it. Left on the body those
  // rings stay put as a faint outline of wherever the thing used to be. The
  // pixel it takes from the neighbour is over the reconstruction anyway.
  // A half-claimed pixel is grown too, not only an unclaimed one: where the
  // colour test fades out it leaves a trail of 0.3s, and the body keeps the
  // other 0.7 of each — which is how the piggy bank's outline stayed on the
  // chest as a pink line drawing even after its eyes and snout were fixed.
  for (let pass = 0; pass < 2; pass++) {
    const before = armMasks.map((a) => Float32Array.from(a));
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const p = y * W + x;
      if (alphaAt(p) === 0 || m[p] > 0.5) continue;
      let best = -1, bestV = 0, takenByOther = false;
      for (let i = 0; i < before.length; i++) {
        const v = Math.max(before[i][p - 1], before[i][p + 1], before[i][p - W], before[i][p + W]);
        if (v > bestV) { bestV = v; best = i; }
      }
      if (best < 0 || bestV <= 0.5) continue;
      for (let i = 0; i < before.length; i++) if (i !== best && before[i][p] > 0.5) takenByOther = true;
      if (!takenByOther) armMasks[best][p] = Math.max(armMasks[best][p], bestV);
    }
  }

  const hiddenOf = (p) => { let v = 0; for (const a of armMasks) if (a[p] > v) v = a[p]; return v; };

  // ---- reconstruct what the arms sit on -----------------------------------
  // Grow the arm mask before deciding what counts as known. The pixels just
  // outside a hand are its own soft edge, and feeding those to the fill paints
  // their ghost onto the chest.
  const grown = new Float32Array(N);
  {
    const R = Math.max(...fig.arms.map((a) => a.grow ?? 5)), tmp = new Float32Array(N);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let v = 0;
      for (let d = -R; d <= R; d++) {
        const xx = x + d;
        if (xx >= 0 && xx < W) { const u = hiddenOf(y * W + xx); if (u > v) v = u; }
      }
      tmp[y * W + x] = v;
    }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let v = 0;
      for (let d = -R; d <= R; d++) {
        const yy = y + d;
        if (yy >= 0 && yy < H) { const u = tmp[yy * W + x]; if (u > v) v = u; }
      }
      grown[y * W + x] = v;
    }
  }
  const known = new Float32Array(N);
  for (let p = 0; p < N; p++) {
    // Solid body that is neither head nor (grown) arm. The background is left
    // out so the fill cannot drag the transparent edge inwards.
    known[p] = alphaAt(p) > 0.6 && m[p] < 0.5 ? clamp01(1 - grown[p]) : 0;
  }
  const { fill, dist } = reconstruct(src, known, W, H);
  // How far from real body the reconstruction is allowed to stay solid.
  // MB-00's fists and MB-03's pencil hand lie across the chest, so there is
  // body behind them the whole way and the fill reaches everywhere. MB-05's
  // arms are held out in the open: behind them is background, and filling
  // there leaves a grey arm-shaped ghost standing still while the real arms
  // lift away from it. A short reach still closes the shoulder joint.
  const reach = fig.fillReach ?? Infinity;
  const backing = (p) => {
    if (reach === Infinity) return 1;
    const d = Math.sqrt(dist[p]);
    return d <= reach - 8 ? 1 : d >= reach + 8 ? 0 : 1 - (((d - reach + 8) / 16) ** 2 * (3 - 2 * (d - reach + 8) / 16));
  };

  // ---- emit ---------------------------------------------------------------
  const blank = () => Buffer.alloc(N * 4);
  const put = (buf, p, rgb, a) => {
    if (a <= 0.002) return;
    buf[p * 4] = byte(rgb[0]); buf[p * 4 + 1] = byte(rgb[1]); buf[p * 4 + 2] = byte(rgb[2]);
    buf[p * 4 + 3] = Math.round(clamp01(a) * 255);
  };

  const head = blank(), body = blank(), legs = fig.waist ? blank() : null;
  const armBufs = fig.arms.map(() => blank());
  const WAIST = fig.waist?.y ?? H + 1;

  for (let p = 0; p < N; p++) {
    const a = alphaAt(p);
    if (a === 0) continue;
    const rgb = rgbAt(p);
    const hidden = hiddenOf(p);

    fig.arms.forEach((_, i) => put(armBufs[i], p, rgb, a * armMasks[i][p]));

    // What the arm layers cover, and therefore how opaque the stack underneath
    // has to be for "arms over the rest" to come back to the original. Where
    // an arm covers outright the answer is free, and we choose opaque: that is
    // the reconstruction the hand moves over.
    // Only the free choice is damped. `under` is what the whole stack beneath
    // the arms has to add up to, head included, so damping it everywhere
    // erases the head along with the ghost.
    const A = a * hidden;
    const under = A >= 0.999 ? backing(p) : clamp01((a - A) / (1 - A));

    // Body. Only a pixel an arm covers outright takes the reconstructed
    // colour; one that is even partly its own keeps the artwork, or the blend
    // at the soft edge of a hand would not add back up to the original.
    const y = (p / W) | 0;
    const t = y < WAIST ? under * (1 - m[p]) : 0;
    if (y < WAIST) put(body, p, hidden >= 0.999 ? [fill[p * 3], fill[p * 3 + 1], fill[p * 3 + 2]] : rgb, t);

    // Head: whatever is needed under the body to complete it. A plain `a * m`
    // would leave the soft chin edge translucent, because "body over head" is
    // not "body + head". The tab is kept to fully opaque pixels only; anywhere
    // else it shows through, as a halo past the chin or a darker rim along the
    // shoulders, since a second layer under a soft edge adds opacity.
    const solid = a > 0.99 ? 1 : 0;
    const exact = t >= 0.999 ? 0 : clamp01((under - t) / (1 - t));
    const real = m[p] > 0 ? exact : 0;
    const headA = Math.max(real, tab[p] * solid);
    // Tab-only pixels are darkened. They are a copy of the collar, and on a
    // head that sits straight on its shoulders, lifting it slides that copy
    // up into view as a second collar line. What belongs in the gap under a
    // raised chin is shadow, so that is what the tab carries. It is hidden
    // behind the body at rest either way, so this costs nothing there.
    const k = headA > 0 ? 0.34 + 0.66 * (real / headA) : 1;
    put(head, p, [rgb[0] * k, rgb[1] * k, rgb[2] * k], headA);

    if (legs && y >= WAIST) put(legs, p, rgb, a);
  }

  // The torso's skirt: the waist row repeated downwards. Hard-edged and kept
  // to fully opaque pixels so it never double-darkens the jacket's antialiased
  // rim, and clipped to the real silhouette so it cannot poke out where the
  // jacket narrows at the hem. The legs hide it; it is what closes the outline
  // when the torso pulls up.
  if (fig.waist) {
    const { y: waist, skirt } = fig.waist;
    for (let y = waist; y < Math.min(waist + skirt, H); y++) for (let x = 0; x < W; x++) {
      const s = (waist - 1) * W + x;
      if (alphaAt(s) > 0.99 && alphaAt(y * W + x) > 0.99) put(body, y * W + x, rgbAt(s), 1);
    }
  }

  // Back to front. The legs go in front of the torso: they only overlap in the
  // hidden band below the waist, where the skirt closes the silhouette.
  const layers = fig.head === false ? [] : [['head.webp', head]];
  layers.push([fig.waist ? 'torso.webp' : 'body.webp', body]);
  fig.arms.forEach((a, i) => layers.push([`${a.key}.webp`, armBufs[i]]));
  if (legs) layers.push(['legs.webp', legs]);

  if (CHECK) {
    const dst = blank();
    for (const [, buf] of layers) for (let p = 0; p < N; p++) {
      const i = p * 4, av = buf[i + 3] / 255;
      if (av <= 0) continue;
      const da = dst[i + 3] / 255, oa = av + da * (1 - av);
      for (let c = 0; c < 3; c++) dst[i + c] = Math.round((buf[i + c] * av + dst[i + c] * da * (1 - av)) / oa);
      dst[i + 3] = Math.round(oa * 255);
    }
    // Compare what the eye sees: both sides flattened onto the same
    // background, so the arbitrary colour of transparent pixels cannot count.
    const BG = 242;
    let worst = 0, where = null, over = 0;
    for (let p = 0; p < N; p++) {
      const i = p * 4, ra = dst[i + 3] / 255, sa = src[i + 3] / 255;
      let d = 0;
      for (let c = 0; c < 3; c++)
        d = Math.max(d, Math.abs((dst[i + c] * ra + BG * (1 - ra)) - (src[i + c] * sa + BG * (1 - sa))));
      if (d > 6) over++;
      if (d > worst) { worst = d; where = [p % W, (p / W) | 0]; }
    }
    console.log(`  check: worst visible difference ${worst.toFixed(1)} at ${where}, pixels over 6: ${over}`);
  }

  // Give every fully transparent pixel the artwork's own colour before the
  // layers are resized. Left at black, those pixels bleed a dark fringe into
  // every edge as soon as the resampling kernel reaches them.
  for (const [, buf] of layers) for (let p = 0; p < N; p++) {
    if (buf[p * 4 + 3] !== 0) continue;
    buf[p * 4] = src[p * 4]; buf[p * 4 + 1] = src[p * 4 + 1]; buf[p * 4 + 2] = src[p * 4 + 2];
  }

  // --overlay paints the masks over the artwork so a cut can be judged by eye,
  // which is the only way to catch a boundary that is right at rest and wrong
  // once the layer moves.
  if (process.argv.includes('--overlay')) {
    const TINT = [[255, 90, 90], [90, 230, 120], [120, 170, 255]];
    const vis = Buffer.alloc(N * 4);
    for (let p = 0; p < N; p++) {
      const a = alphaAt(p), bg = 238;
      const c = rgbAt(p).map((v) => v * a + bg * (1 - a));
      armMasks.forEach((mask, i) => {
        const t = TINT[i % TINT.length];
        for (let k = 0; k < 3; k++) c[k] = c[k] * (1 - 0.55 * mask[p]) + t[k] * 0.55 * mask[p];
      });
      for (let k = 0; k < 3; k++) c[k] = c[k] * (1 - 0.35 * m[p]) + 250 * 0.35 * m[p];
      put(vis, p, c, 1);
    }
    await sharp(vis, { raw: { width: W, height: H, channels: 4 } })
      .resize({ width: 520 }).png().toFile(join(OUT, '_mask.png'));
    console.log(`  _mask.png written`);
  }

  const opts = LOSSLESS ? { lossless: true, effort: 6 } : { quality: 90, alphaQuality: 100, effort: 6 };
  const outWidth = Math.min(MAX_OUT_WIDTH, W);
  let total = 0;
  for (const [file, buf] of layers) {
    const { size } = await sharp(buf, { raw: { width: W, height: H, channels: 4 } })
      .resize({ width: outWidth, kernel: 'lanczos3' }).webp(opts).toFile(join(OUT, file));
    total += size;
    console.log(`  ${file.padEnd(15)} ${(size / 1024).toFixed(1)} kB`);
  }
  const pct = (v, of) => `${(v / of * 100).toFixed(2)}%`;
  console.log(`  total ${(total / 1024).toFixed(1)} kB — ${W}x${H} published ${outWidth} wide`);
  console.log(`  aspect ${outWidth} / ${Math.round(H * outWidth / W)}`);
  const origins = [`head ${pct(headPatch.box[0] / 2 + headPatch.box[2] / 2, W)} ${pct(headPatch.box[3] - 10, H)}`];
  if (fig.waist) origins.push(`torso 50% ${pct(fig.waist.y, H)}`);
  fig.arms.forEach((a) => origins.push(`${a.key} ${pct(a.pivot[0], W)} ${pct(a.pivot[1], H)}`));
  console.log(`  transform-origins: ${origins.join(' | ')}`);
}

// What goes behind a layer that moves.
//
// Two fills, blended by how deep into the hole a pixel is. Near the edge the
// nearest known pixel is used, which carries each material straight on: the
// pencil crosses jacket, board edge and paper within a few pixels of each
// other, and a smooth interpolation there averages black into white and leaves
// a grey ribbon lying along wherever the pencil used to be. Deep inside a
// large hole — behind a fist, say — nearest-neighbour would show its seams
// instead, so the smooth fill takes over. Only the first few pixels beside a
// moving edge are ever uncovered, so the near-edge half is the one that has to
// be right.
function reconstruct(src, known, W, H) {
  const smooth = pushPull(src, known, W, H);
  const { color: near, dist } = nearestKnown(src, known, W, H);
  const fill = new Float32Array(W * H * 3);
  for (let p = 0; p < W * H; p++) {
    const d = Math.sqrt(dist[p]);
    const t = d <= 6 ? 0 : d >= 30 ? 1 : ((d - 6) / 24) ** 2 * (3 - 2 * (d - 6) / 24);
    for (let c = 0; c < 3; c++) fill[p * 3 + c] = near[p * 3 + c] * (1 - t) + smooth[p * 3 + c] * t;
  }
  return { fill, dist };
}

// 8SSEDT: two sweeps carrying the coordinates of the nearest known pixel.
function nearestKnown(src, known, W, H) {
  const nx = new Int32Array(W * H).fill(-1), ny = new Int32Array(W * H).fill(-1);
  const dist = new Float64Array(W * H).fill(Infinity);
  for (let p = 0; p < W * H; p++) {
    if (known[p] > 0.5) { nx[p] = p % W; ny[p] = (p / W) | 0; dist[p] = 0; }
  }
  const relax = (p, q, x, y) => {
    if (nx[q] < 0) return;
    const dx = x - nx[q], dy = y - ny[q], d = dx * dx + dy * dy;
    if (d < dist[p]) { dist[p] = d; nx[p] = nx[q]; ny[p] = ny[q]; }
  };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const p = y * W + x;
    if (x > 0) relax(p, p - 1, x, y);
    if (y > 0) relax(p, p - W, x, y);
    if (x > 0 && y > 0) relax(p, p - W - 1, x, y);
    if (x < W - 1 && y > 0) relax(p, p - W + 1, x, y);
  }
  for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) {
    const p = y * W + x;
    if (x < W - 1) relax(p, p + 1, x, y);
    if (y < H - 1) relax(p, p + W, x, y);
    if (x < W - 1 && y < H - 1) relax(p, p + W + 1, x, y);
    if (x > 0 && y < H - 1) relax(p, p + W - 1, x, y);
  }
  const color = new Float32Array(W * H * 3);
  for (let p = 0; p < W * H; p++) {
    const q = nx[p] >= 0 ? ny[p] * W + nx[p] : p;
    for (let c = 0; c < 3; c++) color[p * 3 + c] = src[q * 4 + c];
  }
  return { color, dist };
}

// Push-pull: average what is known up a pyramid, then push it back down into
// the hole. Each level keeps plain colours plus a coverage weight, so every
// step re-weights properly; mixing weighted and unweighted sums overflows and
// comes back as colour confetti.
function pushPull(src, known, W, H) {
  const levels = [];
  {
    const c = new Float32Array(W * H * 3), k = new Float32Array(W * H);
    for (let p = 0; p < W * H; p++) {
      k[p] = known[p];
      for (let i = 0; i < 3; i++) c[p * 3 + i] = src[p * 4 + i];
    }
    levels.push({ w: W, h: H, c, k });
  }
  for (;;) {
    const prev = levels[levels.length - 1];
    if (prev.w <= 2 || prev.h <= 2) break;
    const nw = Math.ceil(prev.w / 2), nh = Math.ceil(prev.h / 2);
    const c = new Float32Array(nw * nh * 3), k = new Float32Array(nw * nh);
    for (let y = 0; y < nh; y++) for (let x = 0; x < nw; x++) {
      let sw = 0; const s = [0, 0, 0];
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
        const px = x * 2 + dx, py = y * 2 + dy;
        if (px >= prev.w || py >= prev.h) continue;
        const q = py * prev.w + px, kw = prev.k[q];
        sw += kw;
        for (let i = 0; i < 3; i++) s[i] += prev.c[q * 3 + i] * kw;
      }
      const i = y * nw + x;
      if (sw > 0) { for (let j = 0; j < 3; j++) c[i * 3 + j] = s[j] / sw; k[i] = Math.min(1, sw); }
    }
    levels.push({ w: nw, h: nh, c, k });
  }
  // Bilinear on the way down, or the fill comes back as visible blocks.
  for (let l = levels.length - 2; l >= 0; l--) {
    const fine = levels[l], co = levels[l + 1];
    const coarse = (fx, fy, ch) => {
      const x = Math.min(co.w - 1, Math.max(0, fx)), y = Math.min(co.h - 1, Math.max(0, fy));
      const x0 = Math.floor(x), y0 = Math.floor(y);
      const x1 = Math.min(co.w - 1, x0 + 1), y1 = Math.min(co.h - 1, y0 + 1);
      const tx = x - x0, ty = y - y0, g = (xx, yy) => co.c[(yy * co.w + xx) * 3 + ch];
      return (g(x0, y0) * (1 - tx) + g(x1, y0) * tx) * (1 - ty)
           + (g(x0, y1) * (1 - tx) + g(x1, y1) * tx) * ty;
    };
    for (let y = 0; y < fine.h; y++) for (let x = 0; x < fine.w; x++) {
      const i = y * fine.w + x;
      if (fine.k[i] >= 1) continue;
      const fx = (x + 0.5) / 2 - 0.5, fy = (y + 0.5) / 2 - 0.5, a = fine.k[i];
      for (let ch = 0; ch < 3; ch++) fine.c[i * 3 + ch] = fine.c[i * 3 + ch] * a + coarse(fx, fy, ch) * (1 - a);
      fine.k[i] = 1;
    }
  }
  return levels[0].c;
}

