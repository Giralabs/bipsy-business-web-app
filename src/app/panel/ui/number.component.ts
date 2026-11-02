import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  HostBinding,
  Input,
  OnDestroy,
  forwardRef,
  inject,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

/** First repeat after holding a button, then the pace while it stays down. */
const HOLD_DELAY = 380;
const HOLD_EVERY = 70;

/**
 * A number with its own − and + buttons, instead of `<input type="number">`.
 *
 * The native arrows are the system's: tiny, grey-on-grey in the dark theme,
 * and a wheel over the field changes the value by accident. Here the field is
 * plain text that takes «12,5» as well as «12.5», and the buttons are big
 * enough to press: holding one keeps counting, as in the app's steppers.
 * Arrows step from the keyboard (with Shift, ten steps). The value is clamped
 * to `min`/`max` when the field is left, not while typing.
 *
 * Drop-in for `[(ngModel)]`. An empty field gives `null` when `optional`.
 * `look="row"` sits inside a `.pn-fg__row`.
 */
@Component({
  selector: 'pn-number',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => PnNumberComponent), multi: true }],
  template: `
    <span class="nb" [class.nb--row]="look === 'row'" [class.nb--wide]="wide" [class.nb--off]="disabled" [class.pn-input--invalid]="invalid">
      <!-- Spans and not buttons: inside a <label>, a click on its text goes to
           the first button, and the label would subtract one. -->
      <span class="nb__btn" aria-hidden="true" [class.nb__btn--off]="disabled || atMin"
            (pointerdown)="hold($event, -1)" (pointerup)="release()" (pointerleave)="release()" (pointercancel)="release()"
            (click)="$event.preventDefault()">
        <span class="material-symbols-rounded">remove</span>
      </span>
      <input
        class="nb__input pn-tabular"
        type="text"
        [attr.inputmode]="decimals ? 'decimal' : 'numeric'"
        autocomplete="off"
        role="spinbutton"
        [attr.name]="name"
        [attr.aria-label]="label"
        [attr.aria-valuemin]="min"
        [attr.aria-valuemax]="max"
        [attr.aria-valuenow]="value"
        [placeholder]="placeholder"
        [disabled]="disabled"
        [value]="text"
        (input)="onInput($event)"
        (keydown)="onKey($event)"
        (blur)="onBlur()"
      />
      @if (unit) {
        <span class="nb__unit">{{ unit }}</span>
      }
      <span class="nb__btn" aria-hidden="true" [class.nb__btn--off]="disabled || atMax"
            (pointerdown)="hold($event, 1)" (pointerup)="release()" (pointerleave)="release()" (pointercancel)="release()"
            (click)="$event.preventDefault()">
        <span class="material-symbols-rounded">add</span>
      </span>
    </span>
  `,
  styles: [
    `
      :host { display: inline-block; min-width: 0; }
      .nb {
        display: inline-flex;
        align-items: center;
        gap: 2px;
        height: 44px;
        padding: 4px;
        border-radius: var(--pn-radius-field, 12px);
        background: var(--pn-field);
        transition: background-color 90ms ease, box-shadow 90ms ease;
      }
      .nb:focus-within { background: var(--pn-field-strong); box-shadow: inset 0 0 0 1.5px var(--pn-accent-line); }
      .nb.pn-input--invalid { box-shadow: inset 0 0 0 1.5px var(--clr-danger); }
      .nb--off { opacity: 0.55; }
      :host(.pn-number--wide) { display: block; }
      .nb--wide { display: flex; width: 100%; height: 48px; }
      .nb--wide .nb__input { flex: 1; }

      /* In a grouped row the row is the box: only the buttons are drawn. */
      .nb--row { height: 36px; padding: 0; background: none; }
      .nb--row:focus-within { background: none; box-shadow: none; }

      .nb__btn {
        display: grid;
        place-items: center;
        width: 32px;
        height: 32px;
        flex: none;
        padding: 0;
        border: 0;
        border-radius: 9px;
        background: var(--pn-field-strong);
        color: var(--clr-text);
        cursor: pointer;
        touch-action: manipulation;
        user-select: none;
        transition: background-color 90ms ease, transform 90ms ease;
      }
      .nb--row .nb__btn { background: var(--pn-field); }
      .nb__btn:hover:not(.nb__btn--off) { background: var(--pn-subtle); }
      .nb__btn:active:not(.nb__btn--off) { transform: scale(0.92); }
      .nb__btn--off { opacity: 0.35; cursor: default; pointer-events: none; }
      .nb__btn .material-symbols-rounded { font-size: 18px; }

      .nb__input {
        width: var(--nb-width, 4.5ch);
        min-width: 0;
        padding: 0 2px;
        border: 0;
        background: none;
        color: var(--clr-text);
        font: inherit;
        font-size: 1rem;
        font-weight: 600;
        text-align: center;
      }
      .nb__input:focus, .nb__input:focus-visible { outline: none; }
      .nb__input::placeholder { color: var(--clr-text-3); font-weight: 500; }
      .nb__unit { padding-right: 6px; font-size: 0.875rem; font-weight: 500; color: var(--clr-text-2); white-space: nowrap; }
    `,
  ],
})
export class PnNumberComponent implements ControlValueAccessor, OnDestroy {
  @Input() min: number | null = null;
  @Input() max: number | null = null;
  @Input() step = 1;
  @Input() unit: string | null = null;
  @Input() placeholder = '';
  @Input() label: string | null = null;
  @Input() name: string | null = null;
  @Input() look: 'field' | 'row' = 'field';
  @Input() invalid = false;
  /** Empty means «none» and gives `null`; otherwise an empty field goes back to its last value. */
  @Input() optional = false;
  @Input() disabled = false;
  /** Fills its container, as a form field does, instead of hugging the number. */
  @Input() wide = false;

  @HostBinding('class.pn-number--wide') get wideHost(): boolean {
    return this.wide;
  }
  /** In a grouped row it goes to the right end, where the row's other steppers are. */
  @HostBinding('style.justify-self') get rowAlign(): string | null {
    return this.look === 'row' ? 'end' : null;
  }

  private readonly cdr = inject(ChangeDetectorRef);

  value: number | null = null;
  text = '';
  private timer: ReturnType<typeof setTimeout> | null = null;
  private onChange: (value: number | null) => void = () => {};
  private onTouched: () => void = () => {};

  get decimals(): boolean {
    return !Number.isInteger(this.step);
  }
  get atMin(): boolean {
    return this.min !== null && this.value !== null && this.value <= this.min;
  }
  get atMax(): boolean {
    return this.max !== null && this.value !== null && this.value >= this.max;
  }

  writeValue(value: number | string | null): void {
    const n = value === null || value === undefined || value === '' ? null : Number(value);
    this.value = n === null || Number.isNaN(n) ? null : n;
    this.text = format(this.value);
    this.cdr.markForCheck();
  }
  registerOnChange(fn: (value: number | null) => void): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  setDisabledState(disabled: boolean): void {
    this.disabled = disabled;
    this.cdr.markForCheck();
  }

  ngOnDestroy(): void {
    this.release();
  }

  onInput(event: Event): void {
    this.text = (event.target as HTMLInputElement).value;
    const parsed = parse(this.text);
    if (this.text.trim() === '') {
      this.value = null;
      if (this.optional) this.onChange(null);
    } else if (parsed !== null) {
      this.value = parsed;
      this.onChange(parsed);
    }
  }

  onBlur(): void {
    this.onTouched();
    if (this.text.trim() === '' && this.optional) return;
    const parsed = parse(this.text) ?? this.value ?? this.min ?? 0;
    this.commit(parsed);
  }

  onKey(event: KeyboardEvent): void {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    event.preventDefault();
    this.bump((event.key === 'ArrowUp' ? 1 : -1) * (event.shiftKey ? 10 : 1));
  }

  /** One step now and, while the button stays down, more and faster. */
  hold(event: PointerEvent, direction: 1 | -1): void {
    if (event.button !== 0 || this.disabled) return;
    // preventDefault keeps the focus where it is: the field, if it had it.
    event.preventDefault();
    this.bump(direction);
    this.release();
    const again = () => {
      this.bump(direction);
      this.timer = setTimeout(again, HOLD_EVERY);
    };
    this.timer = setTimeout(again, HOLD_DELAY);
  }

  release(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private bump(steps: number): void {
    if (this.disabled) return;
    const base = parse(this.text) ?? this.value ?? this.min ?? 0;
    // Snapped to the step's grid, so 7 + 5 with step 5 gives 10, not 12.
    const next = Math.round((base + steps * this.step) / this.step) * this.step;
    this.commit(next);
    if ((steps > 0 && this.atMax) || (steps < 0 && this.atMin)) this.release();
  }

  private commit(raw: number): void {
    let n = Number(raw.toFixed(4));
    if (this.min !== null) n = Math.max(this.min, n);
    if (this.max !== null) n = Math.min(this.max, n);
    const changed = n !== this.value;
    this.value = n;
    this.text = format(n);
    this.cdr.markForCheck();
    if (changed) this.onChange(n);
  }
}

function parse(text: string): number | null {
  const clean = text.trim().replace(/\s/g, '').replace(',', '.');
  if (!/^-?\d*\.?\d+$|^-?\d+\.$/.test(clean)) return null;
  const n = Number(clean);
  return Number.isFinite(n) ? n : null;
}

/** Spanish style: a comma for the decimals, none when it is whole. */
function format(value: number | null): string {
  if (value === null) return '';
  return String(Number(value.toFixed(2))).replace('.', ',');
}
