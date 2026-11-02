import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  Input,
  OnDestroy,
  ViewChild,
  forwardRef,
  inject,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { toPanelRoot } from './float-portal';

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

interface Cell {
  key: string;
  day: number;
  inMonth: boolean;
  today: boolean;
  off: boolean;
}

let nextId = 0;

/**
 * A date field with the panel's own calendar, instead of `<input type="date">`.
 *
 * The native one is the system's: a dd/mm/aaaa box with an icon, and a
 * calendar in the browser's colours with American arrows. This one shows the
 * date written out («lun, 2 nov 2026») and opens a month in the panel's
 * surfaces, Monday first, today ringed, the chosen day filled and the days out
 * of `min`/`max` greyed. A click on the month's title switches to the years,
 * for dates far away (a birth date). Keyboard: arrows move a day or a week,
 * Page Up/Down a month, Enter picks, Escape closes without closing the dialog.
 *
 * The value is the same `YYYY-MM-DD` string the native input gave, so screens
 * keep their `[(ngModel)]` as they were.
 */
@Component({
  selector: 'pn-date',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => PnDateComponent), multi: true }],
  template: `
    <button
      #trigger
      type="button"
      class="pd"
      [class.pn-input]="look === 'field'"
      [class.pd--row]="look === 'row'"
      [class.pd--open]="open"
      [class.pn-input--invalid]="invalid"
      [class.pd--empty]="!value"
      [disabled]="disabled"
      aria-haspopup="dialog"
      [attr.aria-expanded]="open"
      [attr.aria-controls]="panelId"
      [attr.aria-label]="label ? label + ', ' + (value ? spoken(value) : placeholder) : null"
      (click)="toggle()"
      (keydown)="onTriggerKey($event)"
      (blur)="onTouched()"
    >
      <span class="pd__text">{{ value ? written(value) : placeholder }}</span>
      <span class="material-symbols-rounded pd__icon" aria-hidden="true">calendar_today</span>
    </button>

    @if (open) {
      <div
        #panel
        class="pd__panel"
        role="dialog"
        [id]="panelId"
        [attr.aria-label]="label ?? 'Elegir fecha'"
        [style.left.px]="pos.left"
        [style.top.px]="up ? null : pos.top"
        [style.bottom.px]="up ? pos.bottom : null"
        (pointerdown)="$event.preventDefault()"
        (click)="$event.preventDefault()"
        (keydown)="onPanelKey($event)"
      >
        <div class="pd__head">
          <button type="button" class="pd__title" tabindex="-1" (click)="view = view === 'days' ? 'years' : 'days'; revealYear()">
            {{ monthName }} {{ shownYear }}
            <span class="material-symbols-rounded">{{ view === 'days' ? 'expand_more' : 'expand_less' }}</span>
          </button>
          @if (view === 'days') {
            <span class="pd__nav">
              <button type="button" class="pd__arrow" tabindex="-1" aria-label="Mes anterior"
                      [disabled]="!canGo(-1)" (click)="shiftMonth(-1)">
                <span class="material-symbols-rounded">chevron_left</span>
              </button>
              <button type="button" class="pd__arrow" tabindex="-1" aria-label="Mes siguiente"
                      [disabled]="!canGo(1)" (click)="shiftMonth(1)">
                <span class="material-symbols-rounded">chevron_right</span>
              </button>
            </span>
          }
        </div>

        @if (view === 'days') {
          <div class="pd__week" aria-hidden="true">
            @for (d of weekdays; track $index) { <span>{{ d }}</span> }
          </div>
          <div class="pd__grid" role="grid">
            @for (cell of cells; track cell.key) {
              <button
                type="button"
                class="pd__day"
                tabindex="-1"
                role="gridcell"
                [class.pd__day--out]="!cell.inMonth"
                [class.pd__day--today]="cell.today"
                [class.pd__day--on]="cell.key === value"
                [class.pd__day--focus]="cell.key === focusKey"
                [attr.aria-selected]="cell.key === value"
                [attr.aria-label]="spoken(cell.key)"
                [disabled]="cell.off"
                (click)="pick(cell.key)"
              >{{ cell.day }}</button>
            }
          </div>
          <div class="pd__foot">
            <button type="button" class="pd__link" tabindex="-1" [disabled]="!inRange(todayKey)" (click)="pick(todayKey)">Hoy</button>
          </div>
        } @else {
          <div #years class="pd__years">
            @for (y of yearList; track y) {
              <button type="button" class="pd__year" tabindex="-1"
                      [class.pd__year--on]="y === shownYear" [attr.data-year]="y" (click)="chooseYear(y)">{{ y }}</button>
            }
          </div>
        }
      </div>
    }
  `,
  styles: [
    `
      :host { display: block; min-width: 0; }
      .pd { display: flex; align-items: center; gap: 10px; width: 100%; text-align: left; cursor: pointer; user-select: none; }
      .pd:disabled { cursor: not-allowed; opacity: 0.55; }
      .pd__text { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .pd--empty .pd__text { color: var(--clr-text-3); }
      .pd__icon { flex: none; font-size: 18px; color: var(--clr-text-3); }
      .pn-input.pd--open { background: var(--pn-field-strong); box-shadow: inset 0 0 0 1.5px var(--pn-accent-line); }
      .pd--row {
        min-height: 46px;
        padding: 0;
        border: 0;
        background: none;
        color: var(--clr-text);
        font: inherit;
        font-size: 0.9375rem;
        font-weight: 500;
      }
      .pd--row:focus, .pd--row:focus-visible { outline: none !important; }

      .pd__panel {
        position: fixed;
        z-index: 400;
        width: 296px;
        padding: 12px;
        border-radius: 14px;
        background: var(--pn-card-hi);
        box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.08), 0 14px 40px rgba(0, 0, 0, 0.45);
        animation: pd-in 120ms cubic-bezier(0.2, 0.9, 0.3, 1) both;
        user-select: none;
      }
      @keyframes pd-in { from { opacity: 0; transform: scale(0.97) translateY(-3px); } }
      @media (prefers-reduced-motion: reduce) { .pd__panel { animation: none; } }

      .pd__head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
      .pd__title {
        display: inline-flex;
        align-items: center;
        gap: 2px;
        padding: 6px 8px;
        border: 0;
        border-radius: 8px;
        background: none;
        color: var(--clr-text);
        font: inherit;
        font-size: 0.9375rem;
        font-weight: 700;
        text-transform: capitalize;
        cursor: pointer;
      }
      .pd__title:hover { background: var(--pn-field); }
      .pd__title .material-symbols-rounded { font-size: 18px; color: var(--clr-text-3); }
      .pd__nav { display: flex; gap: 2px; }
      .pd__arrow {
        display: grid;
        place-items: center;
        width: 32px;
        height: 32px;
        border: 0;
        border-radius: 8px;
        background: none;
        color: var(--clr-text);
        cursor: pointer;
      }
      .pd__arrow:hover:not(:disabled) { background: var(--pn-field); }
      .pd__arrow:disabled { opacity: 0.3; cursor: default; }
      .pd__arrow .material-symbols-rounded { font-size: 20px; }

      .pd__week, .pd__grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
      .pd__week span {
        padding: 4px 0 6px;
        text-align: center;
        font-size: 0.6875rem;
        font-weight: 700;
        letter-spacing: 0.4px;
        color: var(--clr-text-3);
      }
      .pd__day {
        height: 36px;
        border: 0;
        border-radius: 10px;
        background: none;
        color: var(--clr-text);
        font: inherit;
        font-size: 0.875rem;
        font-weight: 600;
        font-variant-numeric: tabular-nums;
        cursor: pointer;
        transition: background-color 80ms ease;
      }
      .pd__day:hover:not(:disabled) { background: var(--pn-field); }
      .pd__day--out { color: var(--clr-text-3); font-weight: 500; }
      .pd__day--today { box-shadow: inset 0 0 0 1.5px var(--pn-accent-line); }
      .pd__day--focus { background: var(--pn-field-strong); }
      .pd__day--on, .pd__day--on:hover:not(:disabled) { background: var(--pn-accent); color: var(--pn-on-accent); box-shadow: none; }
      .pd__day:disabled { color: var(--clr-text-3); opacity: 0.4; cursor: default; }

      .pd__foot { display: flex; justify-content: flex-end; margin-top: 8px; }
      .pd__link {
        padding: 6px 10px;
        border: 0;
        border-radius: 8px;
        background: none;
        color: var(--clr-text);
        font: inherit;
        font-size: 0.8125rem;
        font-weight: 700;
        cursor: pointer;
      }
      .pd__link:hover:not(:disabled) { background: var(--pn-field); }
      .pd__link:disabled { opacity: 0.35; cursor: default; }

      .pd__years {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 4px;
        max-height: 264px;
        overflow-y: auto;
        overscroll-behavior: contain;
        scrollbar-width: thin;
      }
      .pd__year {
        height: 38px;
        border: 0;
        border-radius: 10px;
        background: none;
        color: var(--clr-text);
        font: inherit;
        font-size: 0.875rem;
        font-weight: 600;
        font-variant-numeric: tabular-nums;
        cursor: pointer;
      }
      .pd__year:hover { background: var(--pn-field); }
      .pd__year--on, .pd__year--on:hover { background: var(--pn-accent); color: var(--pn-on-accent); }

      @media (prefers-color-scheme: light) {
        .pd__panel { box-shadow: 0 0 0 1px rgba(26, 37, 41, 0.1), 0 14px 40px rgba(26, 37, 41, 0.2); }
      }
    `,
  ],
})
export class PnDateComponent implements ControlValueAccessor, OnDestroy {
  @Input() min: string | null = null;
  @Input() max: string | null = null;
  @Input() placeholder = 'Elegir fecha';
  @Input() label: string | null = null;
  @Input() look: 'field' | 'row' = 'field';
  @Input() invalid = false;
  @Input() disabled = false;

  @ViewChild('trigger', { static: true }) private trigger!: ElementRef<HTMLButtonElement>;
  @ViewChild('years') private years?: ElementRef<HTMLElement>;
  private panel?: ElementRef<HTMLElement>;
  @ViewChild('panel') private set panelRef(ref: ElementRef<HTMLElement> | undefined) {
    this.panel = ref;
    if (ref) toPanelRoot(ref.nativeElement, this.host.nativeElement);
  }
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);

  readonly panelId = `pn-date-${++nextId}`;
  readonly weekdays = WEEKDAYS;
  value: string | null = null;
  open = false;
  up = false;
  view: 'days' | 'years' = 'days';
  pos = { left: 0, top: 0, bottom: 0 };

  /** The month on screen, and the day the keyboard is on. */
  shownYear = 0;
  shownMonth = 0;
  focusKey = '';
  cells: Cell[] = [];

  private onChange: (value: string | null) => void = () => {};
  onTouched: () => void = () => {};

  get todayKey(): string {
    return keyOf(new Date());
  }
  get monthName(): string {
    return this.view === 'days' ? MONTHS[this.shownMonth] : '';
  }
  get yearList(): number[] {
    const now = new Date().getFullYear();
    const from = this.min ? Number(this.min.slice(0, 4)) : now - 100;
    const to = this.max ? Number(this.max.slice(0, 4)) : now + 10;
    const list: number[] = [];
    for (let y = from; y <= to; y++) list.push(y);
    return list;
  }

  writeValue(value: string | null): void {
    this.value = value ? String(value).slice(0, 10) : null;
    this.cdr.markForCheck();
  }
  registerOnChange(fn: (value: string | null) => void): void {
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
    document.removeEventListener('scroll', this.scrollListener, true);
  }

  toggle(): void {
    if (this.open) this.close();
    else this.show();
  }

  pick(key: string): void {
    if (!this.inRange(key)) return;
    const changed = key !== this.value;
    this.value = key;
    this.close();
    if (changed) this.onChange(key);
  }

  chooseYear(year: number): void {
    this.shownYear = year;
    this.view = 'days';
    this.clampShown();
    this.build();
  }

  shiftMonth(step: number): void {
    const d = new Date(this.shownYear, this.shownMonth + step, 1);
    this.shownYear = d.getFullYear();
    this.shownMonth = d.getMonth();
    this.build();
  }

  canGo(step: number): boolean {
    const first = new Date(this.shownYear, this.shownMonth + step, 1);
    const last = new Date(this.shownYear, this.shownMonth + step + 1, 0);
    if (step < 0 && this.min && keyOf(last) < this.min) return false;
    if (step > 0 && this.max && keyOf(first) > this.max) return false;
    return true;
  }

  inRange(key: string): boolean {
    return (!this.min || key >= this.min) && (!this.max || key <= this.max);
  }

  /** «lun, 2 nov 2026»: what a person reads, not «02/11/2026». */
  written(key: string): string {
    return parse(key).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  }
  spoken(key: string): string {
    return parse(key).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  onTriggerKey(event: KeyboardEvent): void {
    if (this.disabled) return;
    if (!this.open) {
      if (['ArrowDown', 'Enter', ' '].includes(event.key)) {
        event.preventDefault();
        this.show();
      }
      return;
    }
    this.onPanelKey(event);
  }

  onPanelKey(event: KeyboardEvent): void {
    const moves: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.close();
    } else if (event.key === 'Tab') {
      this.close(false);
    } else if (this.view === 'days' && event.key in moves) {
      event.preventDefault();
      this.moveFocus(addDays(this.focusKey, moves[event.key]));
    } else if (this.view === 'days' && (event.key === 'PageUp' || event.key === 'PageDown')) {
      event.preventDefault();
      const d = parse(this.focusKey);
      d.setMonth(d.getMonth() + (event.key === 'PageUp' ? -1 : 1));
      this.moveFocus(keyOf(d));
    } else if (this.view === 'days' && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      this.pick(this.focusKey);
    }
  }

  @HostListener('document:pointerdown', ['$event'])
  onOutside(event: PointerEvent): void {
    const target = event.target as Node;
    // The calendar lives outside the host once open (toPanelRoot): it counts as inside.
    if (this.open && !this.host.nativeElement.contains(target) && !this.panel?.nativeElement.contains(target)) {
      this.close(false);
    }
  }

  @HostListener('window:resize')
  onResize(): void {
    this.close(false);
  }

  revealYear(): void {
    setTimeout(() => {
      this.years?.nativeElement
        .querySelector<HTMLElement>(`[data-year="${this.shownYear}"]`)
        ?.scrollIntoView({ block: 'center' });
    });
  }

  private readonly scrollListener = (event: Event) => {
    if (this.panel?.nativeElement.contains(event.target as Node)) return;
    this.close(false);
  };

  private show(): void {
    if (this.disabled) return;
    // With no value, today; if today is out of range, the end closest to it
    // (a birth date opens on the latest allowed, not 120 years back).
    const today = this.todayKey;
    const start =
      this.value ?? (this.min && today < this.min ? this.min : this.max && today > this.max ? this.max : today);
    const d = parse(start);
    this.shownYear = d.getFullYear();
    this.shownMonth = d.getMonth();
    this.focusKey = start;
    this.view = 'days';
    this.build();

    const rect = this.trigger.nativeElement.getBoundingClientRect();
    const height = 372;
    const below = window.innerHeight - rect.bottom - 12;
    this.up = below < height && rect.top - 12 > below;
    const left = this.look === 'row' ? rect.left - 8 : rect.left;
    this.pos = {
      left: Math.max(8, Math.min(left, window.innerWidth - 296 - 8)),
      top: rect.bottom + 4,
      bottom: window.innerHeight - rect.top + 4,
    };
    this.open = true;
    this.cdr.markForCheck();
    document.addEventListener('scroll', this.scrollListener, true);
  }

  private close(refocus = true): void {
    if (!this.open) return;
    this.open = false;
    document.removeEventListener('scroll', this.scrollListener, true);
    this.cdr.markForCheck();
    if (refocus) this.trigger.nativeElement.focus({ preventScroll: true });
  }

  private moveFocus(key: string): void {
    if (this.min && key < this.min) key = this.min;
    if (this.max && key > this.max) key = this.max;
    this.focusKey = key;
    const d = parse(key);
    if (d.getFullYear() !== this.shownYear || d.getMonth() !== this.shownMonth) {
      this.shownYear = d.getFullYear();
      this.shownMonth = d.getMonth();
    }
    this.build();
  }

  /** After jumping years, stay inside min/max. */
  private clampShown(): void {
    const first = keyOf(new Date(this.shownYear, this.shownMonth, 1));
    if (this.min && keyOf(new Date(this.shownYear, this.shownMonth + 1, 0)) < this.min) {
      const m = parse(this.min);
      this.shownMonth = m.getMonth();
    } else if (this.max && first > this.max) {
      const m = parse(this.max);
      this.shownMonth = m.getMonth();
    }
  }

  /** Six weeks from the Monday on or before the 1st: the grid never jumps in height. */
  private build(): void {
    const first = new Date(this.shownYear, this.shownMonth, 1);
    const offset = (first.getDay() + 6) % 7;
    const start = new Date(this.shownYear, this.shownMonth, 1 - offset);
    const today = this.todayKey;
    const cells: Cell[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      const key = keyOf(d);
      cells.push({ key, day: d.getDate(), inMonth: d.getMonth() === this.shownMonth, today: key === today, off: !this.inRange(key) });
    }
    this.cells = cells;
    this.cdr.markForCheck();
  }
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}
function keyOf(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function parse(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function addDays(key: string, days: number): string {
  const d = parse(key);
  d.setDate(d.getDate() + days);
  return keyOf(d);
}
