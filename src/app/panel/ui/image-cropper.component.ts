import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  ViewChild,
  computed,
  signal,
} from '@angular/core';
import { PnDialogComponent } from './dialog.component';

export type CropShape = 'avatar' | 'cover';

/**
 * The measures of `GipsiImageRatios`: there is one cover ratio, the one the
 * photo is painted with everywhere, and a size that covers a 3x screen without
 * weighing more than it has to.
 */
const CROP_SPECS: Record<CropShape, { ratio: number; maxWidth: number; title: string }> = {
  avatar: { ratio: 1, maxWidth: 1024, title: 'Encuadra tu foto' },
  cover: { ratio: 16 / 9, maxWidth: 1920, title: 'Encuadra la portada' },
};

const MAX_ZOOM = 4;

/**
 * Frames a photo before it is uploaded (`gipsi_image_crop.dart`). A photo
 * straight from the picker was framed by the server, so faces ended up cut or
 * off-centre; here it is framed in the shape it will be shown in.
 *
 * Done with a canvas, no library: drag to move, wheel, pinch or slider to zoom.
 * The state is the source point at the middle of the frame, not pixels on the
 * screen, so it survives the dialog changing size. The result is a JPEG on
 * white: logos with transparency have to land on something, and it stays well
 * under the server's 5 MB at these sizes.
 */
@Component({
  selector: 'pn-image-cropper',
  standalone: true,
  imports: [PnDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <pn-dialog [title]="spec().title" (closed)="cancelled.emit()">
      <div
        #stage
        class="crop"
        tabindex="0"
        role="application"
        aria-label="Arrastra para mover la foto. También con las flechas del teclado."
        [class.crop--round]="shape === 'avatar'"
        [style.aspect-ratio]="spec().ratio"
        (pointerdown)="onDown($event)"
        (pointermove)="onMove($event)"
        (pointerup)="onUp($event)"
        (pointercancel)="onUp($event)"
        (wheel)="onWheel($event)"
        (keydown)="onKey($event)"
      >
        @if (url(); as source) {
          <img
            #image
            class="crop__img"
            [src]="source"
            alt=""
            draggable="false"
            [style.width.px]="box().width"
            [style.height.px]="box().height"
            [style.left.px]="box().left"
            [style.top.px]="box().top"
            (load)="onLoaded($event)"
            (error)="failed.emit()"
          />
        }
        <span class="crop__frame" aria-hidden="true"></span>
      </div>

      <label class="crop__zoom">
        <span class="material-symbols-rounded" aria-hidden="true">zoom_out</span>
        <input
          type="range"
          min="1"
          [max]="maxZoom"
          step="0.01"
          aria-label="Acercar la foto"
          [value]="zoom()"
          (input)="setZoom(+$any($event.target).value)"
        />
        <span class="material-symbols-rounded" aria-hidden="true">zoom_in</span>
      </label>

      <ng-container dialogActions>
        <button type="button" class="pn-btn pn-btn--secondary" (click)="cancelled.emit()">Cancelar</button>
        <button type="button" class="pn-btn pn-btn--primary" [disabled]="!ready()" (click)="confirm()">Usar foto</button>
      </ng-container>
    </pn-dialog>
  `,
  styles: [
    `
      .crop {
        position: relative;
        width: 100%;
        overflow: hidden;
        border-radius: var(--pn-radius-row);
        background: var(--pn-field);
        cursor: grab;
        touch-action: none;
        user-select: none;
      }
      .crop:active { cursor: grabbing; }
      .crop:focus-visible { outline: 2px solid var(--pn-accent); outline-offset: 2px; }
      .crop__img { position: absolute; max-width: none; pointer-events: none; }
      /* The round frame shows what stays; the corners only darken, since the
         square is what travels and the circle is how it gets painted. */
      .crop__frame { position: absolute; inset: 0; pointer-events: none; }
      .crop--round .crop__frame {
        border-radius: 50%;
        box-shadow: 0 0 0 9999px rgba(12, 14, 16, 0.55);
      }
      .crop__zoom { display: flex; align-items: center; gap: 10px; margin-top: 14px; color: var(--clr-text-2); }
      .crop__zoom input { flex: 1; accent-color: var(--pn-accent); }
      .crop__zoom .material-symbols-rounded { font-size: 20px; }
    `,
  ],
})
export class PnImageCropperComponent implements OnChanges, AfterViewInit, OnDestroy {
  @Input({ required: true }) file!: File;
  @Input() shape: CropShape = 'avatar';
  @Output() cropped = new EventEmitter<File>();
  @Output() cancelled = new EventEmitter<void>();
  /** The browser could not decode it. */
  @Output() failed = new EventEmitter<void>();

  @ViewChild('stage') private stage?: ElementRef<HTMLElement>;
  @ViewChild('image') private image?: ElementRef<HTMLImageElement>;

  readonly maxZoom = MAX_ZOOM;
  readonly url = signal<string | null>(null);
  readonly zoom = signal(1);

  private readonly stageWidth = signal(0);
  private readonly natural = signal({ width: 0, height: 0 });
  private readonly center = signal({ x: 0, y: 0 });
  private readonly shapeNow = signal<CropShape>('avatar');

  readonly spec = computed(() => CROP_SPECS[this.shapeNow()]);
  readonly ready = computed(() => this.natural().width > 0 && this.stageWidth() > 0);

  /** Screen pixels per source pixel. At zoom 1 the photo just covers the frame. */
  private readonly scale = computed(() => {
    const { width, height } = this.natural();
    const stageWidth = this.stageWidth();
    if (!width || !height || !stageWidth) return 1;
    return Math.max(stageWidth / width, stageWidth / this.spec().ratio / height) * this.zoom();
  });

  readonly box = computed(() => {
    const scale = this.scale();
    const stageWidth = this.stageWidth();
    const { width, height } = this.natural();
    const { x, y } = this.center();
    return {
      width: width * scale,
      height: height * scale,
      left: stageWidth / 2 - x * scale,
      top: stageWidth / this.spec().ratio / 2 - y * scale,
    };
  });

  private observer?: ResizeObserver;
  private readonly pointers = new Map<number, { x: number; y: number }>();
  private pinchDistance = 0;

  ngOnChanges(): void {
    this.shapeNow.set(this.shape);
    this.revoke();
    this.natural.set({ width: 0, height: 0 });
    this.zoom.set(1);
    this.url.set(URL.createObjectURL(this.file));
  }

  ngAfterViewInit(): void {
    const stage = this.stage?.nativeElement;
    if (!stage) return;
    this.stageWidth.set(stage.clientWidth);
    this.observer = new ResizeObserver(() => {
      this.stageWidth.set(stage.clientWidth);
      this.moveTo(this.center());
    });
    this.observer.observe(stage);
    stage.focus({ preventScroll: true });
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    this.revoke();
  }

  onLoaded(event: Event): void {
    const img = event.target as HTMLImageElement;
    this.natural.set({ width: img.naturalWidth, height: img.naturalHeight });
    this.center.set({ x: img.naturalWidth / 2, y: img.naturalHeight / 2 });
  }

  setZoom(value: number): void {
    this.zoom.set(Math.min(MAX_ZOOM, Math.max(1, value)));
    this.moveTo(this.center());
  }

  onDown(event: PointerEvent): void {
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    this.pinchDistance = this.pointerDistance();
  }

  onMove(event: PointerEvent): void {
    const last = this.pointers.get(event.pointerId);
    if (!last) return;
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (this.pointers.size >= 2) {
      const distance = this.pointerDistance();
      if (this.pinchDistance > 0) this.setZoom((this.zoom() * distance) / this.pinchDistance);
      this.pinchDistance = distance;
      return;
    }
    this.nudge(event.clientX - last.x, event.clientY - last.y);
  }

  onUp(event: PointerEvent): void {
    this.pointers.delete(event.pointerId);
    this.pinchDistance = this.pointerDistance();
  }

  onWheel(event: WheelEvent): void {
    event.preventDefault();
    this.setZoom(this.zoom() * Math.exp(-event.deltaY * 0.0015));
  }

  onKey(event: KeyboardEvent): void {
    const step: Record<string, [number, number]> = {
      ArrowLeft: [12, 0],
      ArrowRight: [-12, 0],
      ArrowUp: [0, 12],
      ArrowDown: [0, -12],
    };
    const move = step[event.key];
    if (!move) return;
    event.preventDefault();
    this.nudge(move[0], move[1]);
  }

  confirm(): void {
    const img = this.image?.nativeElement;
    if (!img || !this.ready()) return;
    const { ratio, maxWidth } = this.spec();
    const scale = this.scale();
    const sourceWidth = this.stageWidth() / scale;
    const sourceHeight = sourceWidth / ratio;
    const { x, y } = this.center();

    // Never above what the photo really has: enlarging only adds weight.
    const width = Math.max(1, Math.round(Math.min(maxWidth, sourceWidth)));
    const height = Math.max(1, Math.round(width / ratio));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      this.failed.emit();
      return;
    }
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, x - sourceWidth / 2, y - sourceHeight / 2, sourceWidth, sourceHeight, 0, 0, width, height);

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          this.failed.emit();
          return;
        }
        const name = this.file.name.replace(/\.[^.]+$/, '') || 'foto';
        this.cropped.emit(new File([blob], `${name}.jpg`, { type: 'image/jpeg' }));
      },
      'image/jpeg',
      0.9,
    );
  }

  private nudge(dx: number, dy: number): void {
    const scale = this.scale();
    const { x, y } = this.center();
    this.moveTo({ x: x - dx / scale, y: y - dy / scale });
  }

  /** Keeps the photo covering the frame: no empty edge can end up in the crop. */
  private moveTo(point: { x: number; y: number }): void {
    const { width, height } = this.natural();
    if (!width) return;
    const scale = this.scale();
    const halfWidth = this.stageWidth() / scale / 2;
    const halfHeight = this.stageWidth() / this.spec().ratio / scale / 2;
    this.center.set({
      x: Math.min(width - halfWidth, Math.max(halfWidth, point.x)),
      y: Math.min(height - halfHeight, Math.max(halfHeight, point.y)),
    });
  }

  private pointerDistance(): number {
    const [a, b] = [...this.pointers.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }

  private revoke(): void {
    const url = this.url();
    if (url) URL.revokeObjectURL(url);
  }
}
