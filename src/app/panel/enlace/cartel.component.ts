import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Input,
  OnChanges,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';
import { businessLink } from '../core/business-link';
import { PnSegmentedComponent } from '../ui/controls';
import { ToastService } from '../ui/toast.service';
import {
  POSTER_DESIGNS,
  POSTER_EXPORT_PIXELS,
  PosterAssets,
  PosterDesign,
  PosterShape,
  PosterTheme,
  drawPoster,
  loadPosterAssets,
} from './poster';
import {
  POSTER_FILE_NAME,
  POSTER_PAPERS,
  PosterPaperId,
  canvasBlob,
  downloadBlob,
  posterPdf,
  printPoster,
} from './poster-export';

/** The poster drawn into a canvas, redrawn whenever an option changes. */
@Component({
  selector: 'pn-poster-canvas',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<canvas #canvas role="img" [attr.aria-label]="label"></canvas>`,
  styles: [`:host { display: block; } canvas { display: block; width: 100%; height: auto; }`],
})
export class PnPosterCanvasComponent implements OnChanges, AfterViewInit {
  @Input({ required: true }) assets!: PosterAssets;
  @Input({ required: true }) link = '';
  @Input() businessName = '';
  @Input() design: PosterDesign = 'wordmark';
  @Input() shape: PosterShape = 'square';
  @Input() theme: PosterTheme = 'light';
  @Input() pixels = 1040;
  @Input() label = '';

  @ViewChild('canvas') private canvas?: ElementRef<HTMLCanvasElement>;

  ngOnChanges(): void {
    this.draw();
  }

  ngAfterViewInit(): void {
    this.draw();
  }

  private draw(): void {
    const canvas = this.canvas?.nativeElement;
    if (!canvas) return;
    drawPoster(
      canvas,
      { link: this.link, businessName: this.businessName, design: this.design, shape: this.shape, theme: this.theme },
      this.assets,
      this.pixels,
    );
  }
}

/**
 * `/panel/enlace/cartel` — `poster_screen.dart`: the poster with the QR, to
 * print it or take it to a print shop. Four designs, light or carbon, square or
 * round, in A4, A5 or a 10 cm sticker.
 *
 * The toggles show where they go, not how it is, like the app's. The thumbnails
 * are the real poster shrunk, not an illustration: choosing one has to show what
 * will come out, shape included.
 */
@Component({
  selector: 'app-panel-cartel',
  standalone: true,
  imports: [RouterLink, PnPosterCanvasComponent, PnSegmentedComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="pn-main">
      <a class="pn-btn pn-btn--text pn-btn--sm cz-back" routerLink="/panel/enlace">
        <span class="material-symbols-rounded">arrow_back</span>Mi enlace
      </a>

      <div class="pn-head">
        <div class="pn-head__text"><h1>Cartel</h1></div>
      </div>

      @if (assets(); as loaded) {
        <div class="cz">
          <div class="cz__preview">
            <pn-poster-canvas
              [assets]="loaded"
              [link]="link()"
              [businessName]="name()"
              [design]="design()"
              [shape]="shape()"
              [theme]="theme()"
              label="Vista previa del cartel"
            />
          </div>

          <div class="cz__options">
            <div class="cz__head">
              <h2>Diseño</h2>
              <button type="button" class="cz__toggle"
                      [attr.aria-label]="shape() === 'square' ? 'Hacerlo redondo' : 'Hacerlo cuadrado'"
                      [attr.title]="shape() === 'square' ? 'Hacerlo redondo' : 'Hacerlo cuadrado'"
                      (click)="shape.set(shape() === 'square' ? 'round' : 'square')">
                <!-- A trazos: lo que se elige es por dónde se recorta. -->
                <span class="cz__cut" [class.cz__cut--round]="shape() === 'square'"></span>
              </button>
              <button type="button" class="cz__toggle"
                      [attr.aria-label]="theme() === 'light' ? 'Ponerlo en oscuro' : 'Ponerlo en claro'"
                      [attr.title]="theme() === 'light' ? 'Ponerlo en oscuro' : 'Ponerlo en claro'"
                      (click)="theme.set(theme() === 'light' ? 'dark' : 'light')">
                <span class="material-symbols-rounded">{{ theme() === 'light' ? 'dark_mode' : 'light_mode' }}</span>
              </button>
            </div>

            <div class="cz__designs">
              @for (option of designs; track option.id) {
                <button type="button" class="cz__design"
                        [class.cz__design--round]="shape() === 'round'"
                        [class.is-on]="design() === option.id"
                        [attr.aria-label]="option.label"
                        [attr.aria-pressed]="design() === option.id"
                        [attr.title]="option.label"
                        (click)="design.set(option.id)">
                  <pn-poster-canvas
                    [assets]="loaded"
                    [link]="link()"
                    [businessName]="name()"
                    [design]="option.id"
                    [shape]="shape()"
                    [theme]="theme()"
                    [pixels]="312"
                  />
                </button>
              }
            </div>

            <h2 class="cz__title">Tamaño</h2>
            <pn-segmented label="Tamaño" [options]="papers" [value]="paperId()" (valueChange)="paperId.set($any($event))" />

            <div class="cz__actions">
              <button type="button" class="pn-btn pn-btn--primary" [disabled]="busy()" (click)="print()">
                <span class="material-symbols-rounded">print</span>Imprimir
              </button>
              <button type="button" class="pn-btn pn-btn--secondary" [disabled]="busy()" (click)="savePdf()">
                <span class="material-symbols-rounded">picture_as_pdf</span>Guardar PDF
              </button>
              <button type="button" class="pn-btn pn-btn--secondary" [disabled]="busy()" (click)="saveImage()">
                <span class="material-symbols-rounded">image</span>Guardar imagen
              </button>
            </div>
          </div>
        </div>
      } @else if (assetsFailed()) {
        <div class="pn-notice pn-notice--error" role="alert">
          <span class="material-symbols-rounded">error</span>
          <div>No se ha podido preparar el cartel</div>
        </div>
      } @else {
        <div class="pn-skeleton" style="height:420px"></div>
      }
    </main>
  `,
  styles: [
    `
      :host { display: block; }
      .cz-back { margin: 0 0 14px -12px; text-decoration: none; }
      .cz { display: grid; grid-template-columns: minmax(0, 420px) minmax(0, 1fr); gap: 32px; align-items: start; }
      .cz__preview { min-width: 0; }
      .cz__head { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
      .cz__head h2 { flex: 1; }
      .cz h2 { font-size: 1rem; font-weight: 700; }
      .cz__title { margin: 24px 0 10px; }

      .cz__toggle {
        display: grid;
        place-items: center;
        width: 44px;
        height: 44px;
        border: 0;
        border-radius: 50%;
        background: var(--pn-card);
        box-shadow: var(--pn-rim);
        color: var(--clr-text);
        cursor: pointer;
      }
      .cz__toggle:hover { background: var(--pn-field); }
      .cz__toggle .material-symbols-rounded { font-size: 21px; }
      .cz__cut { width: 20px; height: 20px; border: 1.6px dashed currentColor; border-radius: 5px; }
      .cz__cut--round { border-radius: 50%; }

      .cz__designs { display: grid; grid-template-columns: repeat(auto-fill, minmax(104px, 1fr)); gap: 10px; }
      /* The ring follows the poster's outline, and its gap is always reserved so
         the row does not jump when choosing another design. */
      .cz__design {
        padding: 4px;
        border: 2px solid transparent;
        border-radius: 14px;
        background: none;
        cursor: pointer;
      }
      .cz__design--round { border-radius: 50%; }
      .cz__design.is-on { border-color: var(--pn-accent); }

      .cz__actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 24px; }

      @media (max-width: 820px) {
        .cz { grid-template-columns: minmax(0, 1fr); }
        .cz__preview { max-width: 360px; width: 100%; margin-inline: auto; }
      }
    `,
  ],
})
export class CartelComponent {
  private readonly auth = inject(AuthService);
  private readonly toasts = inject(ToastService);

  readonly designs = POSTER_DESIGNS;
  readonly papers = POSTER_PAPERS.map((paper) => ({ id: paper.id, label: paper.label }));

  readonly assets = signal<PosterAssets | null>(null);
  readonly assetsFailed = signal(false);
  readonly design = signal<PosterDesign>('wordmark');
  readonly shape = signal<PosterShape>('square');
  readonly theme = signal<PosterTheme>('light');
  readonly paperId = signal<PosterPaperId>('a4');
  readonly busy = signal(false);

  /** Empty until the employer loads: the poster is useful without it. */
  readonly name = computed(() => this.auth.businessName());
  readonly link = computed(() => {
    const id = this.auth.businessId();
    return id == null ? '' : businessLink(id, this.name());
  });

  constructor() {
    loadPosterAssets()
      .then((assets) => this.assets.set(assets))
      .catch(() => this.assetsFailed.set(true));
  }

  print(): Promise<void> {
    return this.exporting(async (canvas) => {
      await printPoster(await canvasBlob(canvas, 'image/png'), this.paper());
    });
  }

  saveImage(): Promise<void> {
    return this.exporting(async (canvas) => {
      downloadBlob(await canvasBlob(canvas, 'image/png'), `${POSTER_FILE_NAME}.png`);
    });
  }

  savePdf(): Promise<void> {
    return this.exporting(async (canvas) => {
      // A JPEG has no transparency, and the corners of a round poster are paper.
      const flat = document.createElement('canvas');
      flat.width = canvas.width;
      flat.height = canvas.height;
      const ctx = flat.getContext('2d');
      if (!ctx) throw new Error('Sin canvas');
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, flat.width, flat.height);
      ctx.drawImage(canvas, 0, 0);
      const jpeg = new Uint8Array(await (await canvasBlob(flat, 'image/jpeg', 0.95)).arrayBuffer());
      downloadBlob(posterPdf(jpeg, flat.width, this.paper()), `${POSTER_FILE_NAME}.pdf`);
    });
  }

  private paper() {
    return POSTER_PAPERS.find((paper) => paper.id === this.paperId()) ?? POSTER_PAPERS[0];
  }

  /** The three start the same way, and would fail just as quietly if not watched. */
  private async exporting(action: (canvas: HTMLCanvasElement) => Promise<void>): Promise<void> {
    const assets = this.assets();
    if (!assets || this.busy()) return;
    this.busy.set(true);
    try {
      const canvas = document.createElement('canvas');
      drawPoster(
        canvas,
        { link: this.link(), businessName: this.name(), design: this.design(), shape: this.shape(), theme: this.theme() },
        assets,
        POSTER_EXPORT_PIXELS,
      );
      await action(canvas);
    } catch {
      this.toasts.error('No se ha podido preparar el cartel');
    } finally {
      this.busy.set(false);
    }
  }
}
