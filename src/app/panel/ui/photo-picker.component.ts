import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  signal,
} from '@angular/core';
import { CropShape, PnImageCropperComponent } from './image-cropper.component';

/** A photo about to be framed can be big: what travels is the cropped one. */
const MAX_MB_BEFORE_CROP = 40;

/**
 * Elegir una foto y subirla.
 *
 * El navegador no tiene galería del móvil, así que esto es un `input[file]`
 * disfrazado: acepta también arrastrar y soltar, que en un ordenador es lo
 * natural. La subida en sí la hace quien lo usa (`Api.upload`), porque cada
 * sitio tiene su endpoint.
 *
 * Solo imágenes y hasta 8 MB: más grande, el backend lo rechaza y el usuario
 * se queda sin saber por qué.
 *
 * Con `crop`, se encuadra antes de subir: redonda para un avatar y con la
 * proporción de la portada para la portada (`pn-image-cropper`). Con
 * `variant="row"` es una fila con su miniatura y qué foto es, y lo proyectado
 * va a su derecha (el «Quitar»).
 */
@Component({
  selector: 'pn-photo-picker',
  standalone: true,
  imports: [PnImageCropperComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (variant === 'row') {
      <div
        class="prow"
        [class.pick--over]="over()"
        [class.pick--busy]="busy"
        (dragover)="onDragOver($event)"
        (dragleave)="over.set(false)"
        (drop)="onDrop($event)"
      >
        <label class="prow__hit">
          <input type="file" [accept]="accept" (change)="onPick($event)" [attr.aria-label]="label" />
          <span class="prow__thumb" [class.prow__thumb--round]="crop === 'avatar'" [class.prow__thumb--cover]="crop === 'cover'">
            @if (preview() ?? current; as url) {
              <img [src]="url" alt="" />
            } @else {
              <span class="material-symbols-rounded">{{ crop === 'avatar' ? 'person' : 'storefront' }}</span>
            }
          </span>
          <span class="pn-row__main">
            <span class="pn-row__title">{{ busy ? 'Subiendo…' : label }}</span>
            <span class="pn-row__sub">{{ hint }}</span>
          </span>
        </label>
        <ng-content />
      </div>
    } @else {
      <div
        class="pick"
        [class.pick--over]="over()"
        [class.pick--busy]="busy"
        (dragover)="onDragOver($event)"
        (dragleave)="over.set(false)"
        (drop)="onDrop($event)"
      >
        @if (preview(); as url) {
          <img class="pick__img" [src]="url" alt="" />
        } @else if (current) {
          <img class="pick__img" [src]="current" alt="" />
        }

        <label class="pick__drop">
          <input type="file" [accept]="accept" (change)="onPick($event)" [attr.aria-label]="label" />
          <span class="material-symbols-rounded">{{ busy ? 'hourglass_top' : 'add_photo_alternate' }}</span>
          <span class="pick__label">{{ busy ? 'Subiendo…' : label }}</span>
          <span class="pick__hint">{{ hint }}</span>
        </label>
      </div>
    }

    @if (error(); as text) {
      <p class="pick__error">{{ text }}</p>
    }

    @if (framing(); as file) {
      <pn-image-cropper
        [file]="file"
        [shape]="crop!"
        (cropped)="onCropped($event)"
        (cancelled)="framing.set(null)"
        (failed)="onCropFailed()"
      />
    }
  `,
  styles: [
    `
      :host { display: block; }

      .pick {
        position: relative;
        border-radius: var(--pn-radius-row);
        background: var(--pn-field);
        overflow: hidden;
        transition: background-color var(--dur-fast) ease, box-shadow var(--dur-fast) ease;
      }
      .pick--over { box-shadow: inset 0 0 0 2px var(--clr-accent); }
      .pick--busy { opacity: 0.7; pointer-events: none; }

      .pick__img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }

      .pick__drop {
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 4px;
        min-height: 140px;
        padding: 20px;
        text-align: center;
        cursor: pointer;
      }
      /* Con foto puesta, el texto se lee sobre un velo; sin ella, sobre el
         relleno del campo. */
      .pick__img ~ .pick__drop { background: rgba(12, 14, 16, 0.55); color: #fff; }

      .pick__drop input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
      .pick__drop .material-symbols-rounded { font-size: 28px; }
      .pick__label { font-size: 0.9375rem; font-weight: 700; }
      .pick__hint { font-size: 0.8125rem; opacity: 0.75; }

      .prow {
        display: flex;
        align-items: center;
        gap: 8px;
        padding-right: 8px;
        border-radius: var(--pn-radius-row);
        transition: background-color var(--dur-fast) ease, box-shadow var(--dur-fast) ease;
      }
      .prow:hover { background: var(--pn-field); }
      .prow:focus-within { box-shadow: inset 0 0 0 2px var(--pn-accent); }
      .prow__hit {
        position: relative;
        display: flex;
        align-items: center;
        flex: 1;
        min-width: 0;
        gap: 14px;
        padding: 12px;
        cursor: pointer;
      }
      .prow__hit input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
      /* Both thumbnails take the same width so the titles start on one column. */
      .prow__thumb {
        display: grid;
        place-items: center;
        flex: none;
        width: 64px;
        height: 44px;
        overflow: hidden;
        color: var(--clr-text-2);
      }
      .prow__thumb img { width: 100%; height: 100%; object-fit: cover; }
      .prow__thumb .material-symbols-rounded {
        display: grid;
        place-items: center;
        width: 100%;
        height: 100%;
        background: var(--pn-field-strong);
        font-size: 20px;
      }
      .prow__thumb--cover { height: 36px; border-radius: 6px; }
      /* The circle is 44 wide and centred within the 64 of the column. */
      .prow__thumb--round { padding-inline: 10px; }
      .prow__thumb--round img,
      .prow__thumb--round .material-symbols-rounded { border-radius: 50%; }

      .pick__error {
        position: relative;
        padding: 10px 16px;
        font-size: 0.8125rem;
        font-weight: 600;
        color: var(--clr-danger-text);
      }
    `,
  ],
})
export class PnPhotoPickerComponent implements OnChanges {
  @Input() label = 'Subir una foto';
  @Input() hint = 'Arrástrala aquí o haz clic';
  /** Lo que ya hay puesto, para enseñarlo de fondo. */
  @Input() current: string | null = null;
  @Input() busy = false;
  /**
   * What the endpoint takes. Photos: JPEG, PNG or WebP up to 5 MB
   * (`MediaValidation.MAX_SIZE`); animated media: GIF/WebP up to 8 MB.
   */
  @Input() accept = 'image/jpeg,image/png,image/webp';
  @Input() maxMb = 5;
  /** Message when the file is not one of `accept`. */
  @Input() typeError = 'Usa una foto JPEG, PNG o WebP.';
  /** Frames the photo before handing it over. Not for animated media: a canvas keeps one frame. */
  @Input() crop: CropShape | null = null;
  @Input() variant: 'tile' | 'row' = 'tile';
  @Output() picked = new EventEmitter<File>();

  readonly over = signal(false);
  readonly preview = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  /** The file being framed, before it counts as picked. */
  readonly framing = signal<File | null>(null);

  /**
   * The local preview only lives while the upload runs: once it ends, what
   * shows is `current` — the new photo if it worked, the old one if it did
   * not. Keeping the preview after a failure pretended it had been saved.
   */
  ngOnChanges(changes: SimpleChanges): void {
    const busy = changes['busy'];
    if (busy && busy.previousValue === true && busy.currentValue === false) {
      this.preview.set(null);
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.over.set(true);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.over.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) this.take(file);
  }

  onPick(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    // Or choosing the same file after cancelling the crop would fire nothing.
    input.value = '';
    if (file) this.take(file);
  }

  private take(file: File): void {
    this.error.set(null);
    if (!file.type.startsWith('image/')) {
      this.error.set('Eso no es una imagen.');
      return;
    }
    const allowed = this.accept.split(',').map((type) => type.trim());
    if (!allowed.includes('image/*') && !allowed.includes(file.type)) {
      this.error.set(this.typeError);
      return;
    }
    const limit = this.crop ? MAX_MB_BEFORE_CROP : this.maxMb;
    if (file.size > limit * 1024 * 1024) {
      this.error.set(`Pesa más de ${limit} MB. Hazla más pequeña e inténtalo otra vez.`);
      return;
    }
    if (this.crop) {
      this.framing.set(file);
      return;
    }
    this.emit(file);
  }

  onCropped(file: File): void {
    this.framing.set(null);
    this.emit(file);
  }

  onCropFailed(): void {
    this.framing.set(null);
    this.error.set('No se ha podido abrir esa imagen. Prueba con otra.');
  }

  private emit(file: File): void {
    this.preview.set(URL.createObjectURL(file));
    this.picked.emit(file);
  }}
