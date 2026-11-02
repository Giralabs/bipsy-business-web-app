import { qrMatrix } from './qr.component';

/**
 * The poster with the business's QR (`widgets/share_poster.dart`), defined ONCE:
 * the preview, the thumbnails, the printed sheet and the downloads all come out
 * of `drawPoster`, so what is printed cannot drift from what was seen. It always
 * measures `POSTER_SIDE` units and whoever draws it picks the pixels.
 *
 * A canvas and not the DOM, because the browser has no way of turning an element
 * into an image without a library.
 */
export type PosterDesign = 'qrOnly' | 'wordmark' | 'businessName' | 'bip';
export type PosterShape = 'square' | 'round';
export type PosterTheme = 'light' | 'dark';

export interface PosterOptions {
  link: string;
  businessName: string;
  design: PosterDesign;
  shape: PosterShape;
  theme: PosterTheme;
}

export const POSTER_DESIGNS: { id: PosterDesign; label: string }[] = [
  { id: 'qrOnly', label: 'Solo QR' },
  { id: 'wordmark', label: 'Con Bipsy' },
  { id: 'businessName', label: 'Con tu nombre' },
  { id: 'bip', label: 'Con Bip' },
];

export const POSTER_SIDE = 520;

/** 2080 px: printed at 15 cm, the QR of an A4 with its margins, about 350 dpi. */
export const POSTER_EXPORT_PIXELS = POSTER_SIDE * 4;

const CALL_TO_ACTION = 'Escanea y pide cita';

interface MarkAsset {
  file: string;
  /** The real box of the drawing within the file, measured on its alpha channel. */
  widthFactor: number;
  heightFactor: number;
  alignX: number;
  alignY: number;
  aspectRatio: number;
}

/** The suffix says which BACKGROUND it goes on, not what colour it is. */
const MARKS = {
  wordmarkOnLight: { file: 'bipsy_wordmark_on_light.webp', widthFactor: 0.791, heightFactor: 0.222, alignX: -0.038, alignY: 0.005, aspectRatio: 3.563 },
  wordmarkOnDark: { file: 'bipsy_wordmark_on_dark.webp', widthFactor: 0.786, heightFactor: 0.216, alignX: 0.056, alignY: 0.013, aspectRatio: 3.641 },
  symbolOnLight: { file: 'bipsy_symbol_on_light.webp', widthFactor: 0.489, heightFactor: 0.477, alignX: -0.004, alignY: 0.013, aspectRatio: 1.026 },
  symbolOnDark: { file: 'bipsy_symbol_on_dark.webp', widthFactor: 0.5, heightFactor: 0.493, alignX: 0.016, alignY: -0.028, aspectRatio: 1.013 },
  bip: { file: 'bip_pointing.png', widthFactor: 0.409, heightFactor: 0.849, alignX: -0.01, alignY: -0.384, aspectRatio: 0.482 },
} satisfies Record<string, MarkAsset>;

/** The poster's own colours: it is printed, whatever the panel's theme is. */
const PALETTES = {
  light: {
    paper: '#FFFFFF',
    ink: '#1C1F23',
    muted: '#6B7280',
    cut: '#D9DEDA',
    wordmark: MARKS.wordmarkOnLight,
    symbol: MARKS.symbolOnLight,
    qrOnCard: false,
  },
  dark: {
    paper: '#2E343B',
    ink: '#FFFFFF',
    muted: '#A7B0B8',
    cut: '#454D56',
    wordmark: MARKS.wordmarkOnDark,
    symbol: MARKS.symbolOnDark,
    // The QR NEVER goes negative: on the carbon poster it stays dark on a white
    // card, and that white is the quiet zone readers need.
    qrOnCard: true,
  },
} as const;

type Palette = (typeof PALETTES)[PosterTheme];

export interface PosterAssets {
  images: Map<string, HTMLImageElement>;
  displayFont: string;
  bodyFont: string;
}

let assetsOnce: Promise<PosterAssets> | null = null;

/** The brand pieces and the fonts, once: a canvas does not wait for either. */
export function loadPosterAssets(): Promise<PosterAssets> {
  assetsOnce ??= readAssets().catch((cause) => {
    assetsOnce = null;
    throw cause;
  });
  return assetsOnce;
}

async function readAssets(): Promise<PosterAssets> {
  const entries = await Promise.all(
    Object.values(MARKS).map(async (mark) => {
      const image = new Image();
      image.src = `assets_bipsy_business/Poster/${mark.file}`;
      await image.decode();
      return [mark.file, image] as const;
    }),
  );
  const displayFont = getComputedStyle(document.documentElement).getPropertyValue('--ff-display').trim() || 'sans-serif';
  const bodyFont = getComputedStyle(document.body).fontFamily || 'sans-serif';
  // Without the font the poster still works; it just comes out in a fallback.
  await Promise.all(
    [`800 24px ${displayFont}`, `700 16px ${bodyFont}`, `400 13px ${bodyFont}`].map((font) =>
      document.fonts.load(font).catch(() => []),
    ),
  );
  return { images: new Map(entries), displayFont, bodyFont };
}

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function drawPoster(canvas: HTMLCanvasElement, options: PosterOptions, assets: PosterAssets, pixels: number): void {
  canvas.width = pixels;
  canvas.height = pixels;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Sin canvas');
  ctx.scale(pixels / POSTER_SIDE, pixels / POSTER_SIDE);
  ctx.imageSmoothingQuality = 'high';

  const palette = PALETTES[options.theme];
  const round = options.shape === 'round';

  // A cut line so faint it does not show from a metre away, but without it
  // there is no way of cutting straight.
  ctx.beginPath();
  if (round) ctx.arc(POSTER_SIDE / 2, POSTER_SIDE / 2, POSTER_SIDE / 2 - 0.5, 0, Math.PI * 2);
  else ctx.roundRect(0.5, 0.5, POSTER_SIDE - 1, POSTER_SIDE - 1, POSTER_SIDE * 0.07);
  ctx.fillStyle = palette.paper;
  ctx.fill();
  ctx.strokeStyle = palette.cut;
  ctx.lineWidth = 1;
  ctx.stroke();

  // What fits inside the circle without touching it: the diagonal of this box
  // has to stay below the diameter.
  const padX = POSTER_SIDE * (round ? 0.16 : 0.07);
  const padY = POSTER_SIDE * (round ? 0.14 : 0.07);
  const box: Box = { x: padX, y: padY, width: POSTER_SIDE - padX * 2, height: POSTER_SIDE - padY * 2 };

  const draw = new Painter(ctx, options, assets, palette);
  if (options.design === 'qrOnly') {
    draw.qr(box);
    return;
  }

  // A column: the marks on top, the footer at the bottom and the rest for the QR.
  let y = box.y;
  let gapBelow = POSTER_SIDE * 0.03;
  if (options.design === 'wordmark') {
    y += draw.mark(palette.wordmark, box, y, 46) + POSTER_SIDE * 0.045;
    gapBelow = POSTER_SIDE * 0.035;
  } else if (options.design === 'businessName') {
    y += draw.mark(palette.symbol, box, y, 34) + POSTER_SIDE * 0.015;
    y += draw.name(box, y) + POSTER_SIDE * 0.025;
  } else {
    y += draw.mark(palette.wordmark, box, y, 38) + POSTER_SIDE * 0.03;
  }

  const footerTop = box.y + box.height - FOOTER_HEIGHT;
  const area: Box = { x: box.x, y, width: box.width, height: footerTop - gapBelow - y };
  if (options.design === 'bip') draw.bipAndQr(area);
  else draw.qr(area);
  draw.footer(box, footerTop);
}

const FOOTER_HEIGHT = 43;
const NAME_HEIGHT = 70;

class Painter {
  constructor(
    private readonly ctx: CanvasRenderingContext2D,
    private readonly options: PosterOptions,
    private readonly assets: PosterAssets,
    private readonly palette: Palette,
  ) {}

  /**
   * The file is square with the drawing small in the middle, so it is painted
   * ENLARGED by its factor and clipped to the box: that way the drawing fills it.
   */
  mark(asset: MarkAsset, box: Box, y: number, height: number): number {
    const width = height * asset.aspectRatio;
    this.image(asset, box.x + (box.width - width) / 2, y, width, height);
    return height;
  }

  private image(asset: MarkAsset, x: number, y: number, width: number, height: number): void {
    const image = this.assets.images.get(asset.file);
    if (!image) return;
    const fileWidth = width / asset.widthFactor;
    const fileHeight = height / asset.heightFactor;
    const { ctx } = this;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, width, height);
    ctx.clip();
    ctx.drawImage(
      image,
      x + ((width - fileWidth) / 2) * (1 + asset.alignX),
      y + ((height - fileHeight) / 2) * (1 + asset.alignY),
      fileWidth,
      fileHeight,
    );
    ctx.restore();
  }

  /** Two lines reserved always, or a short name and a long one move the QR. */
  name(box: Box, y: number): number {
    const { ctx } = this;
    ctx.font = `800 24px ${this.assets.displayFont}`;
    ctx.fillStyle = this.palette.ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const lines = wrap(ctx, this.options.businessName.trim(), box.width);
    const lineHeight = 24 * 1.15;
    const top = y + (NAME_HEIGHT - lineHeight * lines.length) / 2 + lineHeight / 2;
    lines.forEach((line, index) => ctx.fillText(line, box.x + box.width / 2, top + index * lineHeight));
    return NAME_HEIGHT;
  }

  /** Bip points to his right, so the QR goes on his right. */
  bipAndQr(area: Box): void {
    const width = area.height * MARKS.bip.aspectRatio;
    this.image(MARKS.bip, area.x, area.y, width, area.height);
    const gap = POSTER_SIDE * 0.03;
    this.qr({ x: area.x + width + gap, y: area.y, width: area.width - width - gap, height: area.height });
  }

  /** As big as it is allowed, always square and centred. */
  qr(area: Box): void {
    const { ctx } = this;
    const side = Math.min(area.width, area.height);
    const x = area.x + (area.width - side) / 2;
    const y = area.y + (area.height - side) / 2;

    if (this.palette.qrOnCard) {
      const pad = POSTER_SIDE * 0.022;
      ctx.beginPath();
      ctx.roundRect(x, y, side, side, POSTER_SIDE * 0.035);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
      this.modules(x + pad, y + pad, side - pad * 2);
    } else {
      this.modules(x, y, side);
    }
  }

  private modules(x: number, y: number, side: number): void {
    const { ctx } = this;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(x, y, side, side);

    // 11% per side, as the app: 4 modules or more at the length of these links.
    const margin = side * 0.11;
    const matrix = qrMatrix(this.options.link);
    const unit = (side - margin * 2) / matrix.size;

    // One path and one fill. Module by module, antialiasing leaves threads of the
    // background between neighbours, and from afar the code shows a light grid.
    ctx.beginPath();
    for (let row = 0; row < matrix.size; row++) {
      for (let col = 0; col < matrix.size; col++) {
        if (matrix.isDark(row, col)) ctx.rect(x + margin + col * unit, y + margin + row * unit, unit, unit);
      }
    }
    ctx.fillStyle = '#1C1F23';
    ctx.fill();
  }

  footer(box: Box, y: number): void {
    const { ctx } = this;
    const center = box.x + box.width / 2;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = `700 16px ${this.assets.bodyFont}`;
    ctx.fillStyle = this.palette.ink;
    ctx.fillText(CALL_TO_ACTION, center, y + 17);

    // It shrinks instead of being cut: the link ends in the number, which is what
    // opens it, and an ellipsis would eat exactly that. Without the protocol:
    // nobody types it, and from afar only the domain matters.
    const text = this.options.link.replace(/^https?:\/\//, '');
    ctx.font = `400 13px ${this.assets.bodyFont}`;
    const width = ctx.measureText(text).width;
    const size = width > box.width ? (13 * box.width) / width : 13;
    ctx.font = `400 ${size}px ${this.assets.bodyFont}`;
    ctx.fillStyle = this.palette.muted;
    ctx.fillText(text, center, y + 39);
  }
}

/** At most two lines; what does not fit ends in an ellipsis. */
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  if (!text) return [];
  const lines: string[] = [];
  let line = '';
  const words = text.split(/\s+/);
  for (let index = 0; index < words.length; index++) {
    const candidate = line ? `${line} ${words[index]}` : words[index];
    if (ctx.measureText(candidate).width <= width || !line) {
      line = candidate;
      continue;
    }
    if (lines.length === 1) {
      return [lines[0], ellipsize(ctx, `${line} ${words.slice(index).join(' ')}`, width)];
    }
    lines.push(line);
    line = words[index];
  }
  lines.push(line);
  return lines.map((item) => ellipsize(ctx, item, width));
}

function ellipsize(ctx: CanvasRenderingContext2D, text: string, width: number): string {
  if (ctx.measureText(text).width <= width) return text;
  let cut = text;
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > width) cut = cut.slice(0, -1);
  return `${cut.trimEnd()}…`;
}
