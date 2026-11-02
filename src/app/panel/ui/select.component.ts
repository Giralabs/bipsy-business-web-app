import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnDestroy,
  Output,
  ViewChild,
  forwardRef,
  inject,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { toPanelRoot } from './float-portal';

export interface PnOption<T = unknown> {
  value: T;
  label: string;
  disabled?: boolean;
}

let nextId = 0;

/**
 * The pop-up button of a macOS form, instead of a native `<select>`.
 *
 * The native list is painted by the system: white on Windows over a dark
 * panel, with the system's blue on the chosen row. This one opens a menu in
 * the panel's own surfaces, the chosen option ticked, anchored to the button
 * and flipped above it when there is no room below.
 *
 * Keyboard as a listbox: arrows, Home/End, typing a letter jumps to it, Enter
 * or Space picks and Escape closes without closing the dialog under it.
 * Drop-in for `[(ngModel)]`; screens that write by hand use `[value]` and
 * `(changed)`.
 *
 * `look="row"` is the borderless value of a `.pn-fg__row`; the default is the
 * filled field (`.pn-select`). It can sit inside a `<label>`: a click on the
 * label's text opens it, and a click in the menu is kept from bouncing back
 * to the label (which would open it again).
 */
@Component({
  selector: 'pn-select',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => PnSelectComponent), multi: true }],
  template: `
    <button
      #trigger
      type="button"
      class="ps"
      [class.pn-select]="look === 'field'"
      [class.ps--row]="look === 'row'"
      [class.ps--open]="open"
      [class.pn-input--invalid]="invalid"
      [class.ps--placeholder]="current === null"
      [disabled]="disabled"
      role="combobox"
      aria-haspopup="listbox"
      [attr.aria-expanded]="open"
      [attr.aria-controls]="listId"
      [attr.aria-label]="label"
      [attr.aria-activedescendant]="open && active >= 0 ? listId + '-' + active : null"
      (click)="toggle()"
      (keydown)="onKey($event)"
      (blur)="onTouched()"
    >
      <span class="ps__text">{{ current ? labelOf(current) : placeholder }}</span>
      @if (look === 'row') {
        <span class="material-symbols-rounded ps__chev" aria-hidden="true">unfold_more</span>
      }
    </button>

    @if (open) {
      <ul
        #menu
        class="ps__menu"
        role="listbox"
        [id]="listId"
        [class.ps__menu--up]="up"
        [style.left.px]="pos.left"
        [style.top.px]="up ? null : pos.top"
        [style.bottom.px]="up ? pos.bottom : null"
        [style.min-width.px]="pos.width"
        [style.max-height.px]="pos.maxHeight"
        (pointerdown)="$event.preventDefault()"
        (click)="$event.preventDefault()"
      >
        @for (option of list; track $index; let i = $index) {
          <li
            class="ps__item"
            role="option"
            [id]="listId + '-' + i"
            [class.ps__item--on]="i === active"
            [class.ps__item--off]="option.disabled"
            [attr.aria-selected]="isChosen(option)"
            [attr.aria-disabled]="option.disabled || null"
            (pointerenter)="option.disabled || (active = i)"
            (click)="pick(option)"
          >
            <span class="material-symbols-rounded ps__tick" aria-hidden="true">{{ isChosen(option) ? 'check' : '' }}</span>
            <span class="ps__label">{{ labelOf(option) }}</span>
          </li>
        }
      </ul>
    }
  `,
  styles: [
    `
      :host { display: block; min-width: 0; }
      .ps {
        display: flex;
        align-items: center;
        width: 100%;
        text-align: left;
        user-select: none;
      }
      .ps:disabled { cursor: not-allowed; opacity: 0.55; }
      .ps__text { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .ps--placeholder .ps__text { color: var(--clr-text-3); }
      .pn-select.ps--open { background-color: var(--pn-field-strong); box-shadow: inset 0 0 0 1.5px var(--pn-accent-line); }

      /* In a grouped row: no box, the value and a double chevron on the right, as macOS. */
      .ps--row {
        gap: 6px;
        min-height: 46px;
        padding: 0;
        border: 0;
        background: none;
        color: var(--clr-text);
        font: inherit;
        font-size: 0.9375rem;
        font-weight: 500;
        cursor: pointer;
      }
      /* The row lights up on focus (.pn-fg__row:focus-within): no ring of its own. */
      .ps--row:focus, .ps--row:focus-visible { outline: none !important; }
      .ps__chev { flex: none; font-size: 18px; color: var(--clr-text-3); }

      .ps__menu {
        position: fixed;
        z-index: 400;
        margin: 0;
        padding: 5px;
        list-style: none;
        overflow-y: auto;
        overscroll-behavior: contain;
        border-radius: 12px;
        background: var(--pn-card-hi);
        box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.08), 0 12px 36px rgba(0, 0, 0, 0.42);
        animation: ps-in 110ms cubic-bezier(0.2, 0.9, 0.3, 1) both;
        transform-origin: top center;
      }
      .ps__menu--up { transform-origin: bottom center; }
      @keyframes ps-in { from { opacity: 0; transform: scale(0.97) translateY(-3px); } }
      @media (prefers-reduced-motion: reduce) { .ps__menu { animation: none; } }

      .ps__item {
        display: flex;
        align-items: center;
        gap: 6px;
        min-height: 34px;
        padding: 6px 12px 6px 6px;
        border-radius: 8px;
        font-size: 0.9375rem;
        font-weight: 500;
        color: var(--clr-text);
        cursor: pointer;
        white-space: nowrap;
      }
      .ps__item--on { background: var(--pn-accent); color: var(--pn-on-accent); }
      .ps__item--off { color: var(--clr-text-3); cursor: default; }
      .ps__tick { width: 20px; flex: none; font-size: 18px; }
      .ps__label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; }

      @media (prefers-color-scheme: light) {
        .ps__menu { box-shadow: 0 0 0 1px rgba(26, 37, 41, 0.1), 0 12px 36px rgba(26, 37, 41, 0.2); }
      }
    `,
  ],
})
export class PnSelectComponent<T = unknown> implements ControlValueAccessor, OnDestroy {
  /**
   * `PnOption`s, any objects read through `valueKey` and `labelKey`, or plain
   * strings and numbers (an hour list: «09:30» is both value and text).
   */
  @Input() set options(list: readonly (object | string | number)[] | null | undefined) {
    this.list = (list ?? []).map((item) =>
      typeof item === 'object'
        ? (item as PnOption<T>)
        : ({ [this.valueKey]: item, [this.labelKey]: String(item) } as unknown as PnOption<T>),
    );
  }
  list: PnOption<T>[] = [];
  /** Which field of each option is its value, and which its text. */
  @Input() valueKey = 'value';
  @Input() labelKey = 'label';
  @Input() placeholder = 'Elegir';
  @Input() label: string | null = null;
  @Input() look: 'field' | 'row' = 'field';
  @Input() invalid = false;
  @Input() disabled = false;

  /** For screens not using ngModel. */
  @Input() set value(value: T | null) {
    this.model = value;
  }
  @Output() changed = new EventEmitter<T>();

  @ViewChild('trigger', { static: true }) private trigger!: ElementRef<HTMLButtonElement>;
  private menu?: ElementRef<HTMLElement>;
  @ViewChild('menu') private set menuRef(ref: ElementRef<HTMLElement> | undefined) {
    this.menu = ref;
    if (ref) toPanelRoot(ref.nativeElement, this.host.nativeElement);
  }
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);

  readonly listId = `pn-select-${++nextId}`;
  model: T | null = null;
  open = false;
  up = false;
  active = -1;
  pos = { left: 0, top: 0, bottom: 0, width: 0, maxHeight: 320 };

  private typed = '';
  private typedAt = 0;
  private onChange: (value: T) => void = () => {};
  onTouched: () => void = () => {};

  get current(): PnOption<T> | null {
    return this.list.find((o) => this.same(this.valueOf(o), this.model)) ?? null;
  }

  isChosen(option: PnOption<T>): boolean {
    return this.same(this.valueOf(option), this.model);
  }

  writeValue(value: T | null): void {
    this.model = value;
    this.cdr.markForCheck();
  }
  registerOnChange(fn: (value: T) => void): void {
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

  pick(option: PnOption<T>): void {
    if (option.disabled) return;
    const value = this.valueOf(option);
    const changed = !this.same(value, this.model);
    this.model = value;
    this.close();
    if (!changed) return;
    this.onChange(value);
    this.changed.emit(value);
  }

  /** Lists that already have their own shape (`{ id, label }`) are passed as they are. */
  valueOf(option: PnOption<T>): T {
    return (option as unknown as Record<string, T>)[this.valueKey];
  }
  labelOf(option: PnOption<T>): string {
    return String((option as unknown as Record<string, unknown>)[this.labelKey] ?? '');
  }

  onKey(event: KeyboardEvent): void {
    if (this.disabled) return;
    const key = event.key;
    if (!this.open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(key)) {
        event.preventDefault();
        this.show();
      }
      return;
    }
    if (key === 'Escape' || key === 'Tab') {
      // Escape belongs to the menu, not to the dialog under it.
      if (key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
      }
      this.close();
    } else if (key === 'ArrowDown' || key === 'ArrowUp') {
      event.preventDefault();
      this.move(key === 'ArrowDown' ? 1 : -1);
    } else if (key === 'Home' || key === 'End') {
      event.preventDefault();
      this.active = key === 'Home' ? this.firstEnabled(0, 1) : this.firstEnabled(this.list.length - 1, -1);
      this.reveal();
    } else if (key === 'Enter' || key === ' ') {
      event.preventDefault();
      const option = this.list[this.active];
      if (option) this.pick(option);
    } else if (key.length === 1 && !event.ctrlKey && !event.metaKey) {
      this.typeahead(key);
    }
  }

  /** Escape is caught on the document too: a dialog listens there. */
  @HostListener('document:keydown.escape', ['$event'])
  onEscape(event: Event): void {
    if (!this.open) return;
    event.stopImmediatePropagation();
    this.close();
  }

  @HostListener('document:pointerdown', ['$event'])
  onOutside(event: PointerEvent): void {
    const target = event.target as Node;
    // The menu lives outside the host once open (toPanelRoot): it counts as inside.
    if (this.open && !this.host.nativeElement.contains(target) && !this.menu?.nativeElement.contains(target)) {
      this.close(false);
    }
  }

  @HostListener('window:resize')
  onResize(): void {
    this.close(false);
  }

  /** A menu left floating while what it belongs to scrolls away reads as broken. */
  onScroll(event?: Event): void {
    if (!this.open) return;
    if (event && this.menu?.nativeElement.contains(event.target as Node)) return;
    this.close(false);
  }

  private show(): void {
    if (this.disabled || this.list.length === 0) return;
    const rect = this.trigger.nativeElement.getBoundingClientRect();
    const below = window.innerHeight - rect.bottom - 12;
    const above = rect.top - 12;
    const wanted = Math.min(320, this.list.length * 34 + 10);
    this.up = below < wanted && above > below;
    this.pos = {
      left: Math.max(8, Math.min(rect.left, window.innerWidth - Math.max(rect.width, 160) - 8)),
      top: rect.bottom + 4,
      bottom: window.innerHeight - rect.top + 4,
      width: rect.width,
      maxHeight: Math.max(120, Math.min(320, this.up ? above : below)),
    };
    const chosen = this.list.findIndex((o) => this.same(this.valueOf(o), this.model));
    this.active = chosen >= 0 ? chosen : this.firstEnabled(0, 1);
    this.open = true;
    this.cdr.markForCheck();
    // Document scroll is a capture listener so scrolling any panel closes it.
    document.addEventListener('scroll', this.scrollListener, true);
    setTimeout(() => this.reveal());
  }

  private readonly scrollListener = (event: Event) => {
    this.onScroll(event);
    this.cdr.markForCheck();
  };

  /** `refocus` is false when the user went elsewhere: the focus is theirs. */
  private close(refocus = true): void {
    if (!this.open) return;
    this.open = false;
    document.removeEventListener('scroll', this.scrollListener, true);
    this.cdr.markForCheck();
    if (refocus) this.trigger.nativeElement.focus({ preventScroll: true });
  }

  private move(step: 1 | -1): void {
    const n = this.list.length;
    let i = this.active;
    for (let tries = 0; tries < n; tries++) {
      i = (i + step + n) % n;
      if (!this.list[i].disabled) break;
    }
    this.active = i;
    this.reveal();
  }

  private firstEnabled(from: number, step: 1 | -1): number {
    for (let i = from; i >= 0 && i < this.list.length; i += step) if (!this.list[i].disabled) return i;
    return -1;
  }

  private typeahead(key: string): void {
    const now = Date.now();
    this.typed = now - this.typedAt < 700 ? this.typed + key.toLowerCase() : key.toLowerCase();
    this.typedAt = now;
    const found = this.list.findIndex((o) => !o.disabled && fold(this.labelOf(o)).startsWith(fold(this.typed)));
    if (found >= 0) {
      this.active = found;
      this.reveal();
    }
  }

  private reveal(): void {
    this.cdr.markForCheck();
    setTimeout(() => {
      this.menu?.nativeElement
        .querySelector<HTMLElement>(`#${this.listId}-${this.active}`)
        ?.scrollIntoView({ block: 'nearest' });
    });
  }

  private same(a: unknown, b: unknown): boolean {
    return a === b || (a != null && b != null && String(a) === String(b));
  }
}

/** «Días» matches «dias»: accents do not count when typing to jump. */
function fold(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}
