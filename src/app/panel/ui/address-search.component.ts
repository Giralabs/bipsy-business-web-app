import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  Output,
  inject,
  signal,
} from '@angular/core';
import { Api } from '../core/api/api';
import { PlaceSuggestion, ResolvedAddress } from '../core/api/models';

/** How long to wait after the last key: every Places call costs money. */
const DEBOUNCE_MS = 350;

/**
 * Address field that suggests while typing and, on pick, hands back the
 * address already split into street, city, province, postal code and point.
 * The web twin of `GipsiAddressSearchField` (`gipsi_shared_ui`).
 *
 * It talks to the backend proxy (`GET /places/autocomplete` and
 * `GET /places/details`), never to Google: the server key stays there. When
 * the backend has no key it answers 503; then the field stays a plain text
 * input and `available` emits `false` so the screen can show the manual
 * city/province inputs, like the app does.
 *
 * The suggestions open inline under the field, not as a floating layer: it
 * is how the app does it and it needs no shadow to separate it.
 */
@Component({
  selector: 'pn-address-search',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="as">
      <label class="pn-field as__field">
        <span class="pn-field__label">{{ label }}</span>
        <span class="as__box">
          <span class="material-symbols-rounded as__pin">location_on</span>
          <input
            class="pn-input as__input"
            type="text"
            autocomplete="off"
            maxlength="200"
            role="combobox"
            aria-autocomplete="list"
            [attr.aria-expanded]="suggestions().length > 0"
            [class.pn-input--invalid]="!!error"
            [placeholder]="placeholder"
            [disabled]="disabled"
            [value]="value()"
            (input)="onInput($event)"
            (keydown)="onKey($event)"
            (blur)="onBlur()"
          />
          @if (loading()) {
            <span class="pn-spinner as__spin"></span>
          }
        </span>
        @if (error) {
          <span class="pn-field__error">{{ error }}</span>
        } @else if (hint) {
          <span class="pn-field__hint">{{ hint }}</span>
        }
      </label>

      @if (notice(); as text) {
        <p class="as__notice">
          <span class="material-symbols-rounded">info</span>{{ text }}
        </p>
      }

      @if (suggestions().length > 0) {
        <ul class="as__list" role="listbox">
          @for (item of suggestions(); track item.placeId; let i = $index) {
            <li
              role="option"
              class="as__item"
              [class.as__item--on]="i === active()"
              [attr.aria-selected]="i === active()"
              (mousedown)="$event.preventDefault()"
              (click)="choose(item)"
              (mouseenter)="active.set(i)"
            >
              <span class="material-symbols-rounded">place</span>
              <span class="as__text">
                <span class="as__main">{{ item.mainText }}</span>
                @if (item.secondaryText) {
                  <span class="as__sub">{{ item.secondaryText }}</span>
                }
              </span>
            </li>
          }
        </ul>
      }
    </div>
  `,
  styles: [
    `
      :host { display: block; }
      .as { margin-bottom: 18px; }
      .as__field { margin-bottom: 0; }
      .as__box { position: relative; display: block; }
      .as__pin {
        position: absolute;
        left: 16px;
        top: 50%;
        translate: 0 -50%;
        font-size: 20px;
        color: var(--clr-text-3);
        pointer-events: none;
      }
      .as__input { padding-left: 46px; padding-right: 46px; }
      .as__spin { position: absolute; right: 16px; top: 50%; translate: 0 -50%; }

      .as__notice {
        display: flex;
        gap: 8px;
        align-items: flex-start;
        margin-top: 10px;
        font-size: 0.8125rem;
        line-height: 1.45;
        color: var(--clr-text-2);
      }
      .as__notice .material-symbols-rounded { font-size: 17px; color: var(--clr-warn-text); }

      .as__list {
        margin: 10px 0 0;
        padding: 6px;
        list-style: none;
        border-radius: var(--pn-radius-field);
        background: var(--pn-field);
      }
      .as__item {
        display: flex;
        gap: 12px;
        align-items: flex-start;
        padding: 11px 12px;
        border-radius: var(--pn-radius-row);
        cursor: pointer;
      }
      .as__item--on { background: var(--pn-field-strong); }
      .as__item .material-symbols-rounded { font-size: 20px; color: var(--clr-text-3); margin-top: 1px; }
      .as__text { display: flex; flex-direction: column; min-width: 0; }
      .as__main { font-size: 0.9375rem; font-weight: 700; }
      .as__sub { font-size: 0.8125rem; color: var(--clr-text-2); }
    `,
  ],
})
export class PnAddressSearchComponent implements OnDestroy {
  private readonly api = inject(Api);

  @Input() label = 'Dirección';
  @Input() placeholder = 'Empieza a escribir tu dirección…';
  @Input() hint: string | null = null;
  @Input() error: string | null = null;
  /** Suggest towns instead of street addresses (a zone, not a door). */
  @Input() citiesOnly = false;
  @Input() disabled = false;

  /** Visible text. Two-way: `[(text)]`. */
  @Input() set text(value: string | null | undefined) {
    this.value.set(value ?? '');
  }
  @Output() textChange = new EventEmitter<string>();
  /** A suggestion was picked and resolved. */
  @Output() resolved = new EventEmitter<ResolvedAddress>();
  /** The user typed: whatever was resolved before no longer matches the text. */
  @Output() typed = new EventEmitter<void>();
  /** `false` once the backend says the search is off (503). */
  @Output() available = new EventEmitter<boolean>();

  readonly value = signal('');
  readonly suggestions = signal<PlaceSuggestion[]>([]);
  readonly loading = signal(false);
  readonly notice = signal<string | null>(null);
  readonly active = signal(-1);

  private timer: ReturnType<typeof setTimeout> | null = null;
  /** Answers that arrive after a newer query are dropped. */
  private seq = 0;
  private disabledByServer = false;
  /**
   * Groups the search with the detail call so Google bills them as one
   * session. It changes after a pick, which is when the session ends.
   */
  private sessionToken = newToken();

  ngOnDestroy(): void {
    if (this.timer) clearTimeout(this.timer);
  }

  onInput(event: Event): void {
    const text = (event.target as HTMLInputElement).value;
    this.value.set(text);
    this.textChange.emit(text);
    this.typed.emit();
    if (this.timer) clearTimeout(this.timer);
    if (this.disabledByServer) return;

    const query = text.trim();
    if (query.length < 3) {
      this.suggestions.set([]);
      this.notice.set(null);
      return;
    }
    this.timer = setTimeout(() => void this.search(query), DEBOUNCE_MS);
  }

  onKey(event: KeyboardEvent): void {
    const list = this.suggestions();
    if (list.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.active.set((this.active() + 1) % list.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.active.set(this.active() <= 0 ? list.length - 1 : this.active() - 1);
    } else if (event.key === 'Enter') {
      const item = list[this.active()] ?? list[0];
      event.preventDefault();
      void this.choose(item);
    } else if (event.key === 'Escape') {
      event.stopPropagation();
      this.suggestions.set([]);
    }
  }

  onBlur(): void {
    // A click on a suggestion keeps the focus (mousedown is prevented), so
    // losing it means the user went elsewhere.
    this.suggestions.set([]);
  }

  private async search(query: string): Promise<void> {
    const mine = ++this.seq;
    this.loading.set(true);
    this.notice.set(null);
    try {
      const res = await this.api.get<{ suggestions: PlaceSuggestion[] }>('/places/autocomplete', {
        q: query,
        sessionToken: this.sessionToken,
        citiesOnly: this.citiesOnly,
      });
      if (mine !== this.seq) return;
      this.suggestions.set(res.suggestions ?? []);
      this.active.set(-1);
    } catch (cause) {
      if (mine !== this.seq) return;
      this.suggestions.set([]);
      this.fail(cause, 'No hemos podido buscar direcciones. Escríbela a mano.');
    } finally {
      if (mine === this.seq) this.loading.set(false);
    }
  }

  async choose(item: PlaceSuggestion): Promise<void> {
    const mine = ++this.seq;
    this.suggestions.set([]);
    this.loading.set(true);
    try {
      const address = await this.api.get<ResolvedAddress>('/places/details', {
        placeId: item.placeId,
        sessionToken: this.sessionToken,
      });
      if (mine !== this.seq) return;
      const text = address.formatted ?? [item.mainText, item.secondaryText].filter(Boolean).join(', ');
      this.value.set(text);
      this.textChange.emit(text);
      this.sessionToken = newToken();
      this.resolved.emit(address);
    } catch (cause) {
      if (mine !== this.seq) return;
      this.fail(cause, 'No hemos podido obtener esa dirección.');
    } finally {
      if (mine === this.seq) this.loading.set(false);
    }
  }

  /** 503 = the backend has no Places key: stop asking and fall back to free text. */
  private fail(cause: unknown, fallback: string): void {
    const status = (cause as { status?: number }).status;
    const detail = (cause as { error?: { message?: string } }).error?.message;
    if (status === 503) {
      this.disabledByServer = true;
      this.available.emit(false);
      this.notice.set('El buscador de direcciones no está disponible ahora mismo. Escríbela a mano.');
      return;
    }
    this.notice.set(detail || fallback);
  }
}

function newToken(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
