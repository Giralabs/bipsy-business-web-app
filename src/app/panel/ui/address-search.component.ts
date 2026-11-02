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
 * `GET /places/details`), never to Google: the server key stays there.
 *
 * A 503 (no key, or Google refusing it) does not leave the field dumb: it
 * switches to Photon, straight from the browser, so suggestions keep coming
 * while the server key is fixed. Only if Photon fails too does `available`
 * emit `false` and the field become a plain input, with no error to read.
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
  readonly active = signal(-1);

  private timer: ReturnType<typeof setTimeout> | null = null;
  /** Answers that arrive after a newer query are dropped. */
  private seq = 0;
  private disabledByServer = false;
  /**
   * The backend answered 503 (its Google key refused) and the field now asks
   * Photon instead. Google stays first: the day the key works, nothing here
   * is used.
   */
  private usingFallback = false;
  /** What Photon said about each suggestion, to resolve it on pick with no second call. */
  private fallbackHits = new Map<string, ResolvedAddress>();
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
    if (this.usingFallback) {
      await this.searchFallback(query, mine);
      return;
    }
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
      if ((cause as { status?: number }).status === 503) {
        // Google refused: the same query goes to Photon right away, so the
        // user never sees an empty list for it.
        this.usingFallback = true;
        await this.searchFallback(query, mine);
        return;
      }
      this.fail(cause);
    } finally {
      if (mine === this.seq) this.loading.set(false);
    }
  }

  /**
   * Photon (komoot, built on OpenStreetMap data): free, no key, CORS open and
   * made for search-as-you-type. Limited to Spain, where Bipsy works.
   */
  private async searchFallback(query: string, mine: number): Promise<void> {
    try {
      const params = new URLSearchParams({ q: query, limit: '6', lat: '40.4', lon: '-3.7', bbox: SPAIN_BBOX });
      for (const layer of this.citiesOnly ? ['city'] : ['house', 'street']) params.append('layer', layer);
      const res = await fetch(`https://photon.komoot.io/api/?${params}`);
      if (!res.ok) throw new Error(String(res.status));
      const body = (await res.json()) as { features?: PhotonFeature[] };
      if (mine !== this.seq) return;
      this.fallbackHits.clear();
      const list: PlaceSuggestion[] = [];
      for (const feature of body.features ?? []) {
        const hit = fromPhoton(feature, this.citiesOnly);
        // A long street comes as several OSM ways with the same name: one row.
        const label = (s: PlaceSuggestion) => `${s.mainText}|${s.secondaryText ?? ''}`;
        if (!hit || list.some((s) => label(s) === label(hit.suggestion))) continue;
        this.fallbackHits.set(hit.suggestion.placeId, hit.address);
        list.push(hit.suggestion);
      }
      this.suggestions.set(list);
      this.active.set(-1);
    } catch {
      if (mine !== this.seq) return;
      // Neither answers: the field stays a plain input and the screen offers
      // the manual fields.
      this.suggestions.set([]);
      this.disabledByServer = true;
      this.available.emit(false);
    } finally {
      if (mine === this.seq) this.loading.set(false);
    }
  }

  async choose(item: PlaceSuggestion): Promise<void> {
    const mine = ++this.seq;
    this.suggestions.set([]);
    const known = this.fallbackHits.get(item.placeId);
    if (known) {
      const text = known.formatted ?? item.mainText;
      this.value.set(text);
      this.textChange.emit(text);
      this.resolved.emit(known);
      return;
    }
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
      // What was typed stays, and the city is written by hand.
      this.fail(cause);
    } finally {
      if (mine === this.seq) this.loading.set(false);
    }
  }

  /** 503 = Google is not going to answer: stop spending calls on it. */
  private fail(cause: unknown): void {
    if ((cause as { status?: number }).status !== 503) return;
    this.disabledByServer = true;
    this.available.emit(false);
  }
}

/** Peninsula, Balearics, Canaries, Ceuta and Melilla: west, south, east, north. */
const SPAIN_BBOX = '-18.2,27.6,4.4,43.9';

interface PhotonFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    osm_type?: string;
    osm_id?: number;
    type?: string;
    name?: string;
    street?: string;
    housenumber?: string;
    postcode?: string;
    city?: string;
    district?: string;
    county?: string;
    state?: string;
    countrycode?: string;
  };
}

/**
 * The 52 provinces by the first two digits of the postal code, which in
 * Spain IS the province. Photon's `county` is often the comarca and `state`
 * the region, so neither can be trusted for it.
 */
const PROVINCES = [
  'Álava', 'Albacete', 'Alicante', 'Almería', 'Ávila', 'Badajoz', 'Islas Baleares', 'Barcelona', 'Burgos',
  'Cáceres', 'Cádiz', 'Castellón', 'Ciudad Real', 'Córdoba', 'A Coruña', 'Cuenca', 'Girona', 'Granada',
  'Guadalajara', 'Gipuzkoa', 'Huelva', 'Huesca', 'Jaén', 'León', 'Lleida', 'La Rioja', 'Lugo', 'Madrid',
  'Málaga', 'Murcia', 'Navarra', 'Ourense', 'Asturias', 'Palencia', 'Las Palmas', 'Pontevedra', 'Salamanca',
  'Santa Cruz de Tenerife', 'Cantabria', 'Segovia', 'Sevilla', 'Soria', 'Tarragona', 'Teruel', 'Toledo',
  'Valencia', 'Valladolid', 'Bizkaia', 'Zamora', 'Zaragoza', 'Ceuta', 'Melilla',
];

function provinceOf(postcode: string | undefined): string | null {
  const n = Number((postcode ?? '').trim().slice(0, 2));
  return /^\d{5}$/.test((postcode ?? '').trim()) && n >= 1 && n <= 52 ? PROVINCES[n - 1] : null;
}

/**
 * A Photon hit as the same `ResolvedAddress` the backend gives for Google:
 * `address` is street and number, the province comes from the postal code.
 */
function fromPhoton(
  feature: PhotonFeature,
  citiesOnly: boolean,
): { suggestion: PlaceSuggestion; address: ResolvedAddress } | null {
  const p = feature.properties;
  const point = feature.geometry?.coordinates;
  if (!p || p.countrycode !== 'ES' || !point) return null;
  const city = p.city ?? (p.type === 'city' ? p.name : null) ?? p.district ?? null;
  const streetName = p.street ?? (p.type === 'street' ? p.name : null);
  if (citiesOnly ? !city : !streetName) return null;

  const street = streetName ? [streetName, p.housenumber].filter(Boolean).join(' ') : null;
  const province = provinceOf(p.postcode) ?? p.state ?? null;
  const place = [p.postcode, city].filter(Boolean).join(' ');
  const mainText = citiesOnly ? city! : street!;
  const secondaryText = (citiesOnly ? province : [place, province].filter(Boolean).join(', ')) || null;
  return {
    suggestion: { placeId: `osm:${p.osm_type ?? ''}${p.osm_id ?? mainText}`, mainText, secondaryText },
    address: {
      address: street,
      streetNumber: p.housenumber ?? null,
      formatted: [mainText, secondaryText].filter(Boolean).join(', '),
      city,
      province,
      postalCode: p.postcode ?? null,
      latitude: point[1],
      longitude: point[0],
      placeId: null,
    },
  };
}

function newToken(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
