/**
 * The cut-up Mr. Bip renders, and where each layer turns.
 *
 * Geometry only: `scripts/build-bip-rigs.mjs` cuts the layers out of the
 * artwork and prints exactly these numbers when it runs, so this file is
 * copied from its output rather than measured by hand. What each rig *does*
 * lives in the stylesheet, keyed by the rig's name.
 */
export interface BipRigLayer {
  /** File name inside the rig's folder, without the extension. */
  readonly file: string;
  /** CSS `transform-origin`: the joint this layer turns on. */
  readonly origin: string;
}

export interface BipRig {
  /** Folder under `public/mr_bip/rig/`, and the class the stylesheet keys on. */
  readonly name: string;
  /** Intrinsic size of the published layers, for `width`/`height` on the img. */
  readonly width: number;
  readonly height: number;
  /** Aspect ratio of the published layers. */
  readonly aspect: string;
  /** What the animation shows, for screen readers. */
  readonly label: string;
  /** Back to front. */
  readonly layers: readonly BipRigLayer[];
}

/**
 * MB-00: takes hold of his tie and pulls the knot up to the collar.
 *
 * The legs go in front of the torso: the two only overlap in the hidden band
 * below the waist, where the torso keeps an opaque skirt that closes the
 * silhouette while it pulls up.
 */
const MB_00: BipRig = {
  name: 'mb-00',
  // Narrower than the rest of the series: this render was redrawn (the first
  // one had five fingers) and came back 690 wide instead of 959.
  width: 690,
  height: 1639,
  aspect: '690 / 1639',
  label: 'Mr. Bip, la mascota de Bipsy Business, ajustándose la corbata',
  layers: [
    { file: 'head', origin: '49.86% 44.84%' },
    { file: 'torso', origin: '50% 67.11%' },
    { file: 'arm-left', origin: '76.09% 48.57%' },
    { file: 'arm-right', origin: '24.64% 48.57%' },
    { file: 'legs', origin: '50% 67.11%' },
  ],
};

/** MB-03: ticks his way down the checklist, pencil in hand. */
const MB_03: BipRig = {
  name: 'mb-03',
  width: 720,
  height: 1231,
  aspect: '720 / 1231',
  label: 'Mr. Bip repasando una lista de tareas con un lápiz',
  layers: [
    { file: 'head', origin: '49.64% 44.17%' },
    { file: 'body', origin: '50% 100%' },
    { file: 'arm-pencil', origin: '28.36% 46.37%' },
  ],
};

/**
 * MB-05: opens his arms in welcome.
 *
 * The head turns on a point inside the collar rather than on the chin. This
 * head sits straight on the shoulders with no neck between them, so anything
 * that lifts it opens a seam along the whole jaw; turning it about a pivot
 * below the chin keeps the jaw where it is.
 */
const MB_05: BipRig = {
  name: 'mb-05',
  width: 720,
  height: 1231,
  aspect: '720 / 1231',
  label: 'Mr. Bip con los brazos abiertos, dando la bienvenida',
  layers: [
    { file: 'head', origin: '50.63% 55.8%' },
    { file: 'body', origin: '50% 100%' },
    // Shoulders, on the middle of the sleeve where it meets the body.
    { file: 'arm-right', origin: '31.28% 56.01%' },
    { file: 'arm-left', origin: '70.70% 57.96%' },
  ],
};

/** MB-06: lifts the piggy bank and shows it off. */
const MB_06: BipRig = {
  name: 'mb-06',
  width: 720,
  height: 1231,
  aspect: '720 / 1231',
  label: 'Mr. Bip sosteniendo una hucha, contento',
  layers: [
    { file: 'head', origin: '50.05% 50.70%' },
    { file: 'body', origin: '50% 100%' },
    // Both arms and the bank are one layer: they hold each other, and split
    // apart they could only drift.
    { file: 'arms-piggy', origin: '49.95% 56.74%' },
  ],
};

/**
 * MB-08: the free hand offers help.
 *
 * No head layer. This one wears a headset whose earcups and boom mic stick
 * out past the skin, and the other hand rests on one of them, so a head that
 * turned would leave all three behind. It stays put and the breath carries it.
 */
const MB_08: BipRig = {
  name: 'mb-08',
  width: 720,
  height: 1231,
  aspect: '720 / 1231',
  label: 'Mr. Bip con cascos de soporte, ofreciendo ayuda',
  layers: [
    { file: 'body', origin: '50% 100%' },
    { file: 'arm-gesture', origin: '36.70% 54.91%' },
  ],
};

/**
 * MB-15: sits reading, and the newspaper rustles.
 *
 * No head layer either, and for a different reason from MB-08: his reading
 * glasses cut the face into two separate patches of skin, so the generator's
 * "the head is the patch of skin touching the top" finds only the forehead.
 * The paper carries the movement, and both hands ride with it because they
 * are holding it.
 */
const MB_15: BipRig = {
  name: 'mb-15',
  width: 720,
  height: 1231,
  aspect: '720 / 1231',
  label: 'Mr. Bip sentado leyendo un periódico',
  layers: [
    { file: 'body', origin: '50% 100%' },
    { file: 'paper', origin: '59.96% 72.00%' },
  ],
};

/**
 * MB-17: the worker — works a wrench with one hand, thumb up with the other.
 *
 * The hi-vis vest covers both shoulders, so each arm turns on the middle of
 * the seam where its sleeve meets the vest. The head turns on a point inside
 * the collar, for the same reason as MB-05: no neck, so a pivot on the chin
 * would lift the jaw off the shoulders.
 */
const MB_17: BipRig = {
  name: 'mb-17',
  width: 720,
  height: 1231,
  aspect: '720 / 1231',
  label: 'Mr. Bip con chaleco reflectante, apretando con una llave inglesa y con el pulgar arriba',
  layers: [
    { file: 'head', origin: '50.83% 51.9%' },
    { file: 'body', origin: '50% 100%' },
    { file: 'arm-wrench', origin: '37.12% 54.30%' },
    { file: 'arm-thumb', origin: '74.66% 54.30%' },
  ],
};

export const BIP_RIGS: Readonly<Record<string, BipRig>> = {
  'mb-00': MB_00,
  'mb-03': MB_03,
  'mb-05': MB_05,
  'mb-06': MB_06,
  'mb-08': MB_08,
  'mb-15': MB_15,
  'mb-17': MB_17,
};

/**
 * Bumped whenever `scripts/build-bip-rigs.mjs` is re-run.
 *
 * The layer files live in `public/`, which Angular copies without hashing, so
 * their URLs never change and a browser that has them will keep the old ones
 * however many times they are regenerated. This is what makes a rebuilt rig
 * actually reach the page.
 */
export const BIP_RIG_VERSION = 7;

export type BipRigName = keyof typeof BIP_RIGS;
