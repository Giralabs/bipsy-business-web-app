import { Injectable, computed, inject, signal } from '@angular/core';
import { Api } from '../api/api';
import {
  BusinessCustomer,
  BusinessCustomerDetail,
  CustomerOrigin,
  SaveCustomerRequest,
} from '../api/models';
import { AuthService } from '../auth/auth.service';
import { resource } from './resource';

/** How long the search waits after the last keystroke before asking. */
const SEARCH_DEBOUNCE_MS = 250;

/**
 * The shop's own phone book — not Bipsy accounts. Twin of
 * `customers_providers.dart`.
 *
 * Two lists, like the app: `customers` is the WHOLE agenda (vetoed people, the
 * import's duplicate check and «is the agenda empty» read it) and `matches` is
 * what the server answers to the search box and two of the filters: the phone
 * search compares normalised digits, trust comes from the customer's booking
 * history and the booking count from an aggregation, so repeating any of it here
 * would end up finding other people.
 *
 * The ORIGIN does not travel. The three pages come out of the SAME answer and
 * are split here (`ofOrigin`), so moving between them costs no request and does
 * not flash. It can be done because it comes entirely from each row's `source`,
 * exactly as the server does it; if `CustomerOrigin.matches` changes there, it
 * changes here.
 */
@Injectable({ providedIn: 'root' })
export class CustomersStore {
  private readonly api = inject(Api);
  private readonly auth = inject(AuthService);

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

  /** A search term or a server filter: the list on screen is the server's answer. */
  private readonly narrowed = computed(
    () => this.query().trim() !== '' || this.trusted() !== null || this.withBooking() !== null,
  );

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
    return ofOrigin(list, this.origin()).filter((c) => !c.banned);
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

  /** No request: the three pages are the same list. */
  setOrigin(origin: CustomerOrigin | null): void {
    this.origin.set(origin);
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

  /** The email is mandatory here (400 without it), not when editing or importing. */
  async create(payload: SaveCustomerRequest): Promise<BusinessCustomer> {
    const created = await this.api.post<BusinessCustomer>('/businesses/me/customers', payload);
    await this.refresh();
    return created;
  }

  async update(id: number, payload: SaveCustomerRequest): Promise<void> {
    await this.api.put(`/businesses/me/customers/${id}`, payload);
    await this.refresh();
  }

  async remove(id: number): Promise<void> {
    await this.api.delete(`/businesses/me/customers/${id}`);
    await this.refresh();
  }

  /** Stamps that they were invited. The owner's: the route does not let a worker through. */
  async invite(id: number): Promise<BusinessCustomer> {
    const updated = await this.api.post<BusinessCustomer>(`/businesses/me/customers/${id}/invite`);
    await this.refresh();
    return updated;
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

  /**
   * The code that goes in an invitation, or null if none has been chosen. A
   * worker reads the business's through his own route. If asking fails it is
   * null too, and the invitation goes without it: not inviting anybody for not
   * having read an optional code would be worse.
   */
  async referralCode(): Promise<string | null> {
    const path = this.auth.isWorker() ? '/workers/me/referral' : '/businesses/me/referral';
    try {
      // `editable` stays true only while there is none chosen: a suggestion is not a code.
      const { code, editable } = await this.api.get<{ code: string | null; editable: boolean }>(path);
      return code && !editable ? code : null;
    } catch {
      return null;
    }
  }
}

/** Mine or from Bipsy: whoever arrived by booking, and everything else. */
function ofOrigin(list: BusinessCustomer[], origin: CustomerOrigin | null): BusinessCustomer[] {
  if (origin === null) return list;
  return list.filter((c) => (c.source === 'BOOKING') === (origin === 'BIPSY'));
}

/**
 * What stops a card from being saved (`customer_form_sheet.dart`). The email is
 * mandatory only when adding: it is the one channel that reaches a customer
 * without the app, but older cards and imported contacts may have none and must
 * still be editable. Without phone or email a card serves for nothing.
 */
export function customerFormError(
  form: { name: string; phone: string; email: string },
  adding: boolean,
): string | null {
  const email = form.email.trim();
  if (!form.name.trim()) return 'El nombre es obligatorio.';
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return 'El email no es válido.';
  if (adding && !email) return 'Añade su email: es por donde le llegan los avisos de sus citas.';
  if (!form.phone.trim() && !email) return 'Añade al menos un teléfono o un email.';
  return null;
}
