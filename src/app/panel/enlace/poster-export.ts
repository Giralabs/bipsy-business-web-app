/**
 * Getting the poster out (`poster_export.dart`): to the printer, to a PDF or to
 * an image. In every case it is centred on a page of the chosen size.
 */
export type PosterPaperId = 'a4' | 'a5' | 'sticker';

export interface PosterPaper {
  id: PosterPaperId;
  label: string;
  widthMm: number;
  heightMm: number;
  /** The sticker gets cut, so it has the minimum a home printer can reach. */
  marginMm: number;
}

export const POSTER_PAPERS: PosterPaper[] = [
  { id: 'a4', label: 'A4', widthMm: 210, heightMm: 297, marginMm: 20 },
  { id: 'a5', label: 'A5', widthMm: 148, heightMm: 210, marginMm: 15 },
  { id: 'sticker', label: '10 × 10 cm', widthMm: 100, heightMm: 100, marginMm: 5 },
];

export const POSTER_FILE_NAME = 'bipsy-qr';

const POINTS_PER_MM = 72 / 25.4;

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** A canvas as a blob, or a rejection if the browser refuses. */
export function canvasBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Sin imagen'))), type, quality);
  });
}

/**
 * A one-page PDF with a JPEG centred on it. The format embeds a JPEG untouched,
 * so a real file costs these few lines and needs no library, and whoever wants
 * the PDF does not have to go through the print dialog.
 */
export function posterPdf(jpeg: Uint8Array, pixels: number, paper: PosterPaper): Blob {
  const pageWidth = paper.widthMm * POINTS_PER_MM;
  const pageHeight = paper.heightMm * POINTS_PER_MM;
  const side = Math.min(paper.widthMm, paper.heightMm) * POINTS_PER_MM - paper.marginMm * POINTS_PER_MM * 2;
  const x = (pageWidth - side) / 2;
  const y = (pageHeight - side) / 2;
  const content = `q ${n(side)} 0 0 ${n(side)} ${n(x)} ${n(y)} cm /Im0 Do Q`;

  const objects: (string | [string, Uint8Array])[] = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${n(pageWidth)} ${n(pageHeight)}] ` +
      '/Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>',
    [
      `<< /Type /XObject /Subtype /Image /Width ${pixels} /Height ${pixels} /ColorSpace /DeviceRGB ` +
        `/BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>`,
      jpeg,
    ],
    [`<< /Length ${content.length} >>`, new TextEncoder().encode(content)],
  ];

  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];
  let offset = 0;
  const push = (part: string | Uint8Array) => {
    const bytes = typeof part === 'string' ? encoder.encode(part) : part;
    parts.push(bytes);
    offset += bytes.length;
  };

  push('%PDF-1.4\n');
  const offsets: number[] = [];
  objects.forEach((object, index) => {
    offsets.push(offset);
    push(`${index + 1} 0 obj\n`);
    if (typeof object === 'string') {
      push(`${object}\n`);
    } else {
      push(`${object[0]}\nstream\n`);
      push(object[1]);
      push('\nendstream\n');
    }
    push('endobj\n');
  });

  const xref = offset;
  push(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`);
  offsets.forEach((at) => push(`${String(at).padStart(10, '0')} 00000 n \n`));
  push(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);

  return new Blob(parts as BlobPart[], { type: 'application/pdf' });
}

function n(value: number): string {
  return value.toFixed(2);
}

/**
 * The browser's print dialog, with just the poster on a page of the right size.
 * In an iframe of its own so none of the panel's chrome or styles get printed.
 */
export function printPoster(png: Blob, paper: PosterPaper): Promise<void> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(png);
    const side = Math.min(paper.widthMm, paper.heightMm) - paper.marginMm * 2;
    const top = (paper.heightMm - paper.marginMm * 2 - side) / 2;

    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    // Not `display: none`: a browser does not print what it did not lay out.
    frame.style.cssText = 'position:fixed;width:0;height:0;border:0;visibility:hidden';

    let finished = false;
    const cleanUp = () => {
      if (finished) return;
      finished = true;
      frame.remove();
      URL.revokeObjectURL(url);
    };

    frame.srcdoc =
      '<!doctype html><html><head><title>Bipsy</title><style>' +
      `@page { size: ${paper.widthMm}mm ${paper.heightMm}mm; margin: ${paper.marginMm}mm; }` +
      'html, body { margin: 0; padding: 0; background: #fff; }' +
      `img { display: block; width: ${side}mm; height: ${side}mm; margin: ${top}mm auto 0; }` +
      `</style></head><body><img src="${url}" alt="" /></body></html>`;

    frame.onload = () => {
      const view = frame.contentWindow;
      const image = frame.contentDocument?.querySelector('img');
      if (!view || !image) {
        cleanUp();
        reject(new Error('Sin marco de impresión'));
        return;
      }
      void image
        .decode()
        .then(() => {
          // The dialog blocks on some browsers and not on others, hence both.
          view.addEventListener('afterprint', cleanUp);
          setTimeout(cleanUp, 120_000);
          view.focus();
          view.print();
          resolve();
        })
        .catch((cause) => {
          cleanUp();
          reject(cause);
        });
    };
    document.body.append(frame);
  });
}
