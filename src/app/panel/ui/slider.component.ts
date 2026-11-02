import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild,
  forwardRef,
  inject,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

/**
 * The slider of the app (`CupertinoSlider` / `policy_slider_row.dart`), drawn
 * by hand instead of an `<input type="range">`.
 *
 * The native one is grabbed only by its small thumb and, inside a dialog that
 * re-renders on every step, a drag could be lost halfway. This one is a single
 * target: press anywhere on the track and drag; the pointer is captured, so the
 * drag goes on even when it leaves the track. Arrows, Page keys and Home/End
 * work too. Drop-in for `[(ngModel)]`; `settle` fires once the finger lifts.
 */
@Component({
  selector: 'pn-slider',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => PnSliderComponent), multi: true }],
  template: `
    <div
      #track
      class="sl"
      [class.sl--off]="disabled"
      [class.sl--dragging]="dragging"
      role="slider"
      [attr.tabindex]="disabled ? -1 : 0"
      [attr.aria-label]="label"
      [attr.aria-valuemin]="min"
      [attr.aria-valuemax]="max"
      [attr.aria-valuenow]="value"
      [attr.aria-disabled]="disabled"
      (pointerdown)="onDown($event)"
      (pointermove)="onMove($event)"
      (pointerup)="onUp($event)"
      (pointercancel)="onUp($event)"
      (keydown)="onKey($event)"
    >
      <span class="sl__rail"><span class="sl__fill" [style.width.%]="percent"></span></span>
      <span class="sl__thumb" [style.left.%]="percent"></span>
    </div>
  `,
  styles: [
    `
      :host { display: block; }
      .sl {
        position: relative;
        height: 28px;
        cursor: pointer;
        touch-action: none;
        user-select: none;
        outline: none;
      }
      .sl--off { cursor: default; opacity: 0.45; }
      .sl__rail {
        position: absolute;
        left: 0;
        right: 0;
        top: 50%;
        height: 4px;
        translate: 0 -50%;
        border-radius: 99px;
        background: var(--pn-subtle);
        overflow: hidden;
      }
      .sl__fill { position: absolute; inset: 0 auto 0 0; background: var(--pn-accent); border-radius: inherit; }
      .sl__thumb {
        position: absolute;
        top: 50%;
        width: 24px;
        height: 24px;
        translate: -50% -50%;
        border-radius: 50%;
        background: #fff;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.25), 0 2px 8px rgba(0, 0, 0, 0.18), 0 0 0 0.5px rgba(0, 0, 0, 0.08);
        transition: scale 120ms ease;
      }
      .sl:not(.sl--off):hover .sl__thumb { scale: 1.06; }
      .sl--dragging .sl__thumb { scale: 1.12; }
      .sl:focus-visible .sl__thumb { box-shadow: 0 0 0 4px var(--pn-accent-line), 0 2px 8px rgba(0, 0, 0, 0.18); }
    `,
  ],
})
export class PnSliderComponent implements ControlValueAccessor {
  @Input() min = 0;
  @Input() max = 100;
  @Input() step = 1;
  @Input() label = '';
  @Input() disabled = false;
  /** Once per gesture, when the finger lifts or a key is let go: the moment to save. */
  @Output() settle = new EventEmitter<number>();

  @ViewChild('track', { static: true }) private track!: ElementRef<HTMLElement>;
  private readonly cdr = inject(ChangeDetectorRef);

  value = 0;
  dragging = false;
  private onChange: (value: number) => void = () => {};
  private onTouched: () => void = () => {};

  get percent(): number {
    const span = this.max - this.min;
    return span <= 0 ? 0 : ((this.value - this.min) / span) * 100;
  }

  writeValue(value: unknown): void {
    this.value = this.clamp(Number(value ?? this.min));
    this.cdr.markForCheck();
  }
  registerOnChange(fn: (value: number) => void): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  setDisabledState(disabled: boolean): void {
    this.disabled = disabled;
    this.cdr.markForCheck();
  }

  onDown(event: PointerEvent): void {
    if (this.disabled || event.button !== 0) return;
    event.preventDefault();
    this.track.nativeElement.setPointerCapture(event.pointerId);
    this.track.nativeElement.focus({ preventScroll: true });
    this.dragging = true;
    this.setFromPointer(event);
  }

  onMove(event: PointerEvent): void {
    if (this.dragging) this.setFromPointer(event);
  }

  onUp(event: PointerEvent): void {
    if (!this.dragging) return;
    this.dragging = false;
    this.track.nativeElement.releasePointerCapture?.(event.pointerId);
    this.onTouched();
    this.settle.emit(this.value);
    this.cdr.markForCheck();
  }

  onKey(event: KeyboardEvent): void {
    if (this.disabled) return;
    const big = Math.max(this.step, (this.max - this.min) / 10);
    const moves: Record<string, number> = {
      ArrowRight: this.step, ArrowUp: this.step, ArrowLeft: -this.step, ArrowDown: -this.step,
      PageUp: big, PageDown: -big,
    };
    let next: number;
    if (event.key in moves) next = this.value + moves[event.key];
    else if (event.key === 'Home') next = this.min;
    else if (event.key === 'End') next = this.max;
    else return;
    event.preventDefault();
    this.set(next);
    this.settle.emit(this.value);
  }

  private setFromPointer(event: PointerEvent): void {
    const box = this.track.nativeElement.getBoundingClientRect();
    const ratio = box.width === 0 ? 0 : (event.clientX - box.left) / box.width;
    this.set(this.min + Math.min(1, Math.max(0, ratio)) * (this.max - this.min));
  }

  private set(raw: number): void {
    const next = this.clamp(raw);
    if (next === this.value) return;
    this.value = next;
    this.onChange(next);
    this.cdr.markForCheck();
  }

  private clamp(raw: number): number {
    const stepped = Math.round((raw - this.min) / this.step) * this.step + this.min;
    const fixed = Number(stepped.toFixed(4));
    return Math.min(this.max, Math.max(this.min, Number.isFinite(fixed) ? fixed : this.min));
  }
}
