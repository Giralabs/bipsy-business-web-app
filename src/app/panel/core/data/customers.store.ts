import { Injectable, computed, inject, signal } from '@angular/core';
import { Api } from '../api/api';
import {
  BusinessCustomer,
  BusinessCustomerDetail,
  CustomerOrigin,
  SaveCustomerRequest,
} from '../api/models';
import { resource } from './resource';

/** How long the search waits after the last keystroke before asking. */
const SEARCH_DEBOUNCE_MS = 250;

/**
 * The shop's own phone book — not Bipsy accounts. Twin of
 * `customers_providers.dart`.
 *
 * Two lists, like the app: `customers` is the WHOLE agenda (vetoed people, the
 * import's duplicate check and «is the agenda empty» read it) and `matches` is
 * what the server answers to the search box and the three filters. Nothing is
 * narrowed in the browser: the phone search compares normalised digits, trust
 * comes from the customer's booking history and the booking count from an
 * aggregation, so repeating any of it here would end up finding other people.
 */
@Injectable({ providedIn: 'root' })
export class CustomersStore {
  private readonly api = inject(Api);

  readonly customers = resource<BusinessCustomer[]>(
    () => this.api.get<BusinessCustomer[]>('/businesses/me/customers'),
    [],
  );

  readonly query = signal('');
  /** Where the cards came from. Null = everyone. */
  readonly origin = signal<CustomerOrigin | null>(null);
  /** Only trusted customers. Null = everyone. */
  readonly trusted = signal<boolean | null>(null);
  /** With an appointment (true), with none (false) or everyone (null). */
  readonly withBooking = signal<boolean | null>(null);

  /** Whether any filter is on, to offer clearing them in one go. */
  readonly filtersActive = computed(
    () => this.origin() !== null || this.trusted() !== null || this.withBooking() !== null,
  );

  /** A search term or a filter: the list on screen is the server's answer. */
  private readonly narrowed = computed(() => this.query().trim() !== '' || this.filtersActive());

  /** The server's answer to the current search and filters; null until it arrives. */
  private readonly matches = signal<BusinessCustomer[] | null>(null);
  readonly searching = signal(false);
  /** The filtered request failed: the list on screen is not what was asked for. */
  readonly searchFailed = signal(false);

  private timer: ReturnType<typeof setTimeout> | null = null;
  /** Only the latest request may write: answers can come back out of order. */
  private ticket = 0;

  readonly all = this.customers.value;

  /**
   * What the list shows. Until the first answer to a new search arrives the
   * previous list stays on screen instead of blinking to a skeleton.
   */
  readonly filtered = computed(() => {
    const list = this.narrowed() ? (this.matches() ?? this.all()) : this.all();
    return list.filter((c) => !c.banned);
  });

  readonly banned = computed(() => this.all().filter((c) => c.banned));

  /** Grouped by initial, the way the app lists them (A, B, C… and then #). */
  readonly sections = computed(() => {
    const groups = new Map<string, BusinessCustomer[]>();
    for (const person of [...this.filtered()].sort((a, b) => a.name.localeCompare(b.name, 'es'))) {
      const first = person.name.trim()[0]?.toUpperCase() ?? '#';
      const letter = /[A-ZÁÉÍÓÚÑ]/.test(first) ? first : '#';
      groups.set(letter, [...(groups.get(letter) ?? []), person]);
    }
    return [...groups.entries()].map(([letter, people]) => ({ letter, people }));
  });

  load(): Promise<void> {
    return this.customers.load();
  }

  // ----- SEARCH AND FILTERS ------------------------------------------------

  /** The box updates at once; the request waits for the typing to stop. */
  setQuery(value: string): void {
    this.query.set(value);
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.search(), SEARCH_DEBOUNCE_MS);
  }

  setOrigin(origin: CustomerOrigin | null): void {
    this.origin.set(origin);
    void this.search();
  }

  /** Tapping the one already on takes it off, as in the app's sheet. */
  toggleTrusted(): void {
    this.trusted.update((current) => (current === true ? null : true));
    void this.search();
  }

  /** The two exclude each other: someone has come or has not. */
  toggleWithBooking(value: boolean): void {
    this.withBooking.update((current) => (current === value ? null : value));
    void this.search();
  }

  /** Puts the three filters back. The search box is something else and stays. */
  clearFilters(): void {
    this.origin.set(null);
    this.trusted.set(null);
    this.withBooking.set(null);
    void this.search();
  }

  /** Asks the server for the list the box and the filters describe. */
  async search(): Promise<void> {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    const ticket = ++this.ticket;
    this.searchFailed.set(false);

    if (!this.narrowed()) {
      this.matches.set(null);
      this.searching.set(false);
      return;
    }

    this.searching.set(true);
    try {
      const found = await this.api.get<BusinessCustomer[]>('/businesses/me/customers', {
        q: this.query().trim(),
        origin: this.origin(),
        trusted: this.trusted(),
        withBooking: this.withBooking(),
      });
      if (ticket === this.ticket) this.matches.set(found);
    } catch {
      if (ticket === this.ticket) this.searchFailed.set(true);
    } finally {
      if (ticket === this.ticket) this.searching.set(false);
    }
  }

  /** The twin of `ref.invalidate(businessCustomersProvider)`: both lists again. */
  private async refresh(): Promise<void> {
    await Promise.all([this.customers.reload(), this.search()]);
  }

  // ----- CARDS -------------------------------------------------------------

  detail(id: number): Promise<BusinessCustomerDetail> {
    return this.api.get<BusinessCustomerDetail>(`/businesses/me/customers/${id}`);
  }

  async create(payload: SaveCustomerRequest): Promise<void> {
    await this.api.post('/businesses/me/customers', payload);
    await this.refresh();
  }

  async update(id: number, payload: SaveCustomerRequest): Promise<void> {
    await this.api.put(`/businesses/me/customers/${id}`, payload);
    await this.refresh();
  }

  async remove(id: number): Promise<void> {
    await this.api.delete(`/businesses/me/customers/${id}`);
    await this.refresh();
  }

  async invite(id: number): Promise<void> {
    await this.api.post(`/businesses/me/customers/${id}/invite`);
    await this.refresh();
  }

  /**
   * Sets or removes the trusted mark: whoever has it is not asked for a card.
   * Only for cards with a Bipsy account — the server rejects the rest.
   *
   * Returns the updated card, and the lists are refreshed without making the
   * switch wait for them.
   */
  async setTrusted(id: number, trusted: boolean): Promise<BusinessCustomer> {
    const updated = await this.api.put<BusinessCustomer>(
      `/businesses/me/customers/${id}/trusted`,
      { trusted },
    );
    void this.refresh();
    return updated;
  }

  /**
   * Bans are on the Bipsy account, not on the phone-book entry: `customerId`
   * is `BusinessCustomer.linkedCustomerId`, never the entry's own id.
   */
  async ban(customerId: number, reason: string, report: boolean): Promise<void> {
    await this.api.post(`/businesses/me/bans/${customerId}`, {
      reason: reason.trim() || null,
      sendReport: report,
    });
    await this.refresh();
  }

  /** Same id as `ban()`: the linked Bipsy customer. */
  async unban(customerId: number): Promise<void> {
    await this.api.delete(`/businesses/me/bans/${customerId}`);
    await this.refresh();
  }
}
