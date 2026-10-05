import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../core/api/api';
import {
  AvailabilitySlot,
  BusinessCustomer,
  SaveCustomerRequest,
  ServiceResponse,
  TeamWorker,
} from '../core/api/models';
import { AuthService } from '../core/auth/auth.service';
import { AgendaStore } from '../core/data/agenda.store';
import { ServicesStore } from '../core/data/services.store';
import { TeamStore } from '../core/data/team.store';
import { addDays, dayKey, parseHhmm, startOfDay } from '../core/util/dates';
import { PnAvatarComponent } from '../ui/controls';
import { PnDialogComponent } from '../ui/dialog.component';
import { ToastService } from '../ui/toast.service';

interface SlotGroup {
  title: string;
  slots: AvailabilitySlot[];
}

type Loading = 'idle' | 'loading' | 'ready' | 'failed';

const CUSTOMERS = '/businesses/me/customers';

/**
 * «Dar cita»: the owner gives an appointment from the agenda. Twin of
 * `create_booking_screen.dart`, with its two pickers (`customer_picker_sheet`,
 * `slot_picker_sheet`) folded in.
 *
 * The app needs a whole screen because every field opens a sheet of its own.
 * On a desk the same fields fit in ONE dialog: the phone book is a search box
 * with its list, «Nuevo cliente» swaps that list for three inputs in place, and
 * the free times are laid out under the day instead of behind another layer.
 *
 * What comes out depends on who it is for, and the card decides:
 *
 *  - **With a Bipsy account**: born waiting for the customer to accept, slot
 *    held and ten minutes running. That is where the card and the policy
 *    consent are collected — two things the business cannot give for them.
 *  - **Only an email**: born CONFIRMED and sent by email.
 *  - **Neither**: cannot be given. The row is dimmed and says what is missing.
 *
 * Only appointments AT THE VENUE: an at-home one needs the customer's address
 * with coordinates, which is the customer's to give. Services that are at-home
 * only are left out of the select.
 */
@Component({
  selector: 'app-create-booking-dialog',
  standalone: true,
  imports: [FormsModule, PnDialogComponent, PnAvatarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './create-booking-dialog.component.html',
  styleUrl: './create-booking-dialog.component.css',
})
export class CreateBookingDialogComponent implements OnInit {
  /** The day the agenda was looking at: giving an appointment is nearly always for that day. */
  @Input() day: Date = new Date();
  /** `HH:mm` of the empty spot that was clicked, if any. Chosen only if it is really free. */
  @Input() time: string | null = null;
  /** The column that was clicked in the day view, if it was a worker's. */
  @Input() workerId: number | null = null;
  @Output() closed = new EventEmitter<void>();
  /** The day of the appointment just given, so the agenda can jump there. */
  @Output() created = new EventEmitter<Date>();

  private readonly api = inject(Api);
  private readonly agenda = inject(AgendaStore);
  private readonly auth = inject(AuthService);
  private readonly toasts = inject(ToastService);
  readonly services = inject(ServicesStore);
  readonly team = inject(TeamStore);

  // ----- who ---------------------------------------------------------------

  /**
   * The whole phone book, asked for here and filtered in memory like
   * `customerPickerListProvider`: the picker must not inherit the filters the
   * Clientes screen happens to have on.
   */
  readonly customers = signal<BusinessCustomer[]>([]);
  readonly customersState = signal<Loading>('loading');
  readonly query = signal('');
  readonly customer = signal<BusinessCustomer | null>(null);
  /** What was just said about the chosen (or just created) card, under the section. */
  readonly customerNotice = signal<string | null>(null);
  /** A card just created with neither account nor email: offered an invitation. */
  readonly unreachable = signal<BusinessCustomer | null>(null);

  readonly adding = signal(false);
  readonly savingCustomer = signal(false);
  readonly customerError = signal<string | null>(null);
  newCustomer = { name: '', phone: '', email: '' };

  readonly matches = computed(() => {
    const term = plain(this.query().trim());
    const all = this.customers();
    if (!term) return all;
    const digits = term.replace(/\D/g, '');
    return all.filter(
      (person) =>
        plain(person.name).includes(term) ||
        plain(person.email ?? '').includes(term) ||
        (digits.length > 0 && (person.phone ?? '').replace(/\D/g, '').includes(digits)),
    );
  });

  // ----- what and when -----------------------------------------------------

  readonly serviceId = signal<number | null>(null);
  readonly pickedWorkerId = signal<number | null>(null);
  readonly dayValue = signal(dayKey(new Date()));
  readonly slot = signal<AvailabilitySlot | null>(null);
  readonly slots = signal<AvailabilitySlot[]>([]);
  readonly slotsState = signal<Loading>('idle');
  notes = '';

  readonly minDay = dayKey(new Date());
  readonly maxDay = dayKey(addDays(new Date(), 365));

  /** Whatever can be given at the venue: only the at-home-only ones are left out. */
  readonly givable = computed(() =>
    this.services.all().filter((service) => service.active && service.serviceMode !== 'AT_CUSTOMER'),
  );

  readonly noLocalServices = computed(
    () => this.services.all().length > 0 && this.givable().length === 0,
  );

  readonly service = computed<ServiceResponse | null>(
    () => this.givable().find((service) => service.id === this.serviceId()) ?? null,
  );

  /** Whoever performs the chosen service; everyone until one is chosen. */
  readonly professionals = computed<TeamWorker[]>(() => {
    const service = this.service();
    const all = this.team.all();
    return service ? all.filter((worker) => service.workerIds.includes(worker.id)) : all;
  });

  /** Morning, afternoon and evening: the way people think of a time. */
  readonly slotGroups = computed<SlotGroup[]>(() => {
    const slots = this.slots();
    const groups: SlotGroup[] = [
      { title: 'Mañana', slots: slots.filter((s) => parseHhmm(s.start) < 14 * 60) },
      {
        title: 'Tarde',
        slots: slots.filter((s) => parseHhmm(s.start) >= 14 * 60 && parseHhmm(s.start) < 20 * 60),
      },
      { title: 'Noche', slots: slots.filter((s) => parseHhmm(s.start) >= 20 * 60) },
    ];
    return groups.filter((group) => group.slots.length > 0);
  });

  // ----- sending -----------------------------------------------------------

  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  /** Decides the notice and the button: with no one chosen yet, the common case. */
  readonly byEmail = computed(() => {
    const customer = this.customer();
    return customer != null && customer.linkedCustomerId == null;
  });

  readonly complete = computed(
    () => this.customer() != null && this.service() != null && this.slot() != null,
  );

  private slotsRequest = 0;
  private wantedTime: string | null = null;

  constructor() {
    // Changing the service, the professional or the day changes the free
    // slots — and throws away the chosen time, which may no longer exist.
    effect(() => {
      const serviceId = this.service()?.id ?? null;
      const day = this.dayValue();
      const workerId = this.pickedWorkerId();
      untracked(() => void this.loadSlots(serviceId, day, workerId));
    });
  }

  ngOnInit(): void {
    const today = startOfDay(new Date());
    const asked = startOfDay(this.day);
    const past = asked < today;
    this.dayValue.set(dayKey(past ? today : asked));
    this.wantedTime = past ? null : this.time;
    this.pickedWorkerId.set(this.workerId);

    void this.services.load();
    void this.loadCustomers();
  }

  // ----- customer ----------------------------------------------------------

  hasAccount(person: BusinessCustomer): boolean {
    return person.linkedCustomerId != null;
  }

  hasEmail(person: BusinessCustomer): boolean {
    return (person.email ?? '').trim().length > 0;
  }

  /** An account or an email: the two ways of telling someone they have an appointment. */
  reachable(person: BusinessCustomer): boolean {
    return this.hasAccount(person) || this.hasEmail(person);
  }

  subtitleOf(person: BusinessCustomer): string {
    if (this.hasAccount(person)) return person.email ?? person.phone ?? '';
    return this.hasEmail(person)
      ? `Sin app · se le avisa a ${person.email}`
      : 'Sin correo ni cuenta: no se le puede avisar';
  }

  pick(person: BusinessCustomer): void {
    if (!this.reachable(person)) return;
    this.customer.set(person);
    this.error.set(null);
    this.unreachable.set(null);
    this.customerNotice.set(this.hasAccount(person) ? null : willEmail(person));
  }

  /** Back to the list, to choose someone else. */
  clearCustomer(): void {
    this.customer.set(null);
    this.customerNotice.set(null);
    this.unreachable.set(null);
  }

  startAdding(): void {
    this.newCustomer = { name: this.query().trim(), phone: '', email: '' };
    this.customerError.set(null);
    this.adding.set(true);
  }

  /**
   * Creates the card without leaving. The server links it to a Bipsy account
   * by email or phone, so someone who already uses Bipsy is usable at once.
   */
  async saveNewCustomer(): Promise<void> {
    const name = this.newCustomer.name.trim();
    if (!name) {
      this.customerError.set('Escribe al menos el nombre.');
      return;
    }
    if (this.savingCustomer()) return;
    this.savingCustomer.set(true);
    this.customerError.set(null);
    try {
      const payload: SaveCustomerRequest = {
        name,
        phone: this.newCustomer.phone.trim() || null,
        email: this.newCustomer.email.trim() || null,
      };
      const created = await this.api.post<BusinessCustomer>(CUSTOMERS, payload);
      this.customers.update((list) => [created, ...list.filter((person) => person.id !== created.id)]);
      this.adding.set(false);
      this.query.set('');

      if (this.reachable(created)) {
        this.pick(created);
        return;
      }
      // Neither account nor email: in the phone book, but there is no way of
      // telling them. Said with its way out rather than letting it be chosen.
      this.customer.set(null);
      this.unreachable.set(created);
      this.customerNotice.set(
        `${created.name} ya está en tu agenda, pero no tiene correo ni cuenta de Bipsy, así que no hay forma de avisarle. Añádele un correo en su ficha o invítale a la app.`,
      );
    } catch (cause) {
      this.customerError.set(serverMessage(cause) || 'No se ha podido guardar.');
    } finally {
      this.savingCustomer.set(false);
    }
  }

  /** Stamps that this person was invited to Bipsy, like the app's row does. */
  async invite(person: BusinessCustomer): Promise<void> {
    try {
      const updated = await this.api.post<BusinessCustomer>(`${CUSTOMERS}/${person.id}/invite`);
      this.customers.update((list) => list.map((item) => (item.id === person.id ? updated : item)));
      const text = `Hemos marcado que invitaste a ${person.name}`;
      if (this.unreachable()?.id === person.id) {
        this.unreachable.set(null);
        this.customerNotice.set(text);
      } else {
        this.toasts.show(text);
      }
    } catch (cause) {
      this.toasts.error(serverMessage(cause) || 'No se ha podido. Inténtalo otra vez.');
    }
  }

  private async loadCustomers(): Promise<void> {
    this.customersState.set('loading');
    try {
      this.customers.set(await this.api.get<BusinessCustomer[]>(CUSTOMERS));
      this.customersState.set('ready');
    } catch {
      this.customersState.set('failed');
    }
  }

  // ----- the appointment ---------------------------------------------------

  serviceLabel(service: ServiceResponse): string {
    return `${service.name} · ${service.duration} min`;
  }

  /** The owner comes in the team list under the business's own id. */
  workerLabel(worker: TeamWorker): string {
    return worker.id === this.auth.businessId() ? 'Yo' : worker.name;
  }

  setService(id: number | null): void {
    this.serviceId.set(id);
    this.error.set(null);
    // Whoever was chosen may not perform this one.
    const worker = this.pickedWorkerId();
    if (worker != null && !this.professionals().some((item) => item.id === worker)) {
      this.pickedWorkerId.set(null);
    }
  }

  setDay(value: string): void {
    if (!value) return;
    // The time clicked on the grid belonged to the day that was clicked.
    this.wantedTime = null;
    this.dayValue.set(value);
  }

  pickSlot(slot: AvailabilitySlot): void {
    this.slot.set(slot);
    this.error.set(null);
  }

  private async loadSlots(serviceId: number | null, day: string, workerId: number | null): Promise<void> {
    const request = ++this.slotsRequest;
    this.slot.set(null);
    if (serviceId == null) {
      this.slots.set([]);
      this.slotsState.set('idle');
      return;
    }
    this.slotsState.set('loading');
    try {
      const response = await this.agenda.availability(serviceId, new Date(`${day}T00:00:00`), workerId);
      if (request !== this.slotsRequest) return;
      // Only the free ones: a taken slot is not an option. The times come as
      // `HH:mm:ss` and are shown — and sent back — as `HH:mm`.
      const free = response.slots
        .filter((slot) => slot.available)
        .map((slot) => ({ ...slot, start: slot.start.slice(0, 5), end: slot.end.slice(0, 5) }));
      this.slots.set(free);
      this.slotsState.set('ready');
      const wanted = this.wantedTime;
      this.wantedTime = null;
      if (wanted) this.slot.set(free.find((slot) => slot.start === wanted) ?? null);
    } catch {
      if (request !== this.slotsRequest) return;
      this.slots.set([]);
      this.slotsState.set('failed');
    }
  }

  // ----- submit ------------------------------------------------------------

  async submit(): Promise<void> {
    const customer = this.customer();
    const service = this.service();
    const slot = this.slot();
    if (!customer || !service || !slot || this.busy()) return;

    const day = this.dayValue();
    this.busy.set(true);
    this.error.set(null);
    try {
      const created = await this.agenda.createForCustomer({
        businessCustomerId: customer.id,
        serviceId: service.id,
        // With «anyone», the professional comes from the slot itself: the
        // server says in each one who can take it.
        workerId: this.pickedWorkerId() ?? slot.availableWorkerIds?.[0] ?? null,
        // No zone and no seconds: a wall-clock time of the shop (`LocalDateTime`).
        startDateTime: `${day}T${slot.start}:00`,
        notes: this.notes.trim() || null,
        // Always explicit: with a service that does both, the server does not
        // decide for anyone and answers 400 without it.
        servicePlace: 'AT_BUSINESS',
      });
      this.toasts.show(
        created.status === 'AWAITING_CUSTOMER'
          ? 'Enviada. El cliente tiene 10 minutos para confirmarla.'
          : 'Cita enviada por correo',
      );
      this.created.emit(new Date(`${day}T00:00:00`));
    } catch (cause) {
      this.error.set(serverMessage(cause) || 'No se ha podido dar la cita');
      // The usual reason is that the slot is gone: show what is left.
      void this.loadSlots(service.id, day, this.pickedWorkerId());
    } finally {
      this.busy.set(false);
    }
  }
}

function willEmail(person: BusinessCustomer): string {
  return `No tiene la app, así que la cita le llegará a ${person.email}. Queda reservada desde que la envíes.`;
}

/** Lower case and without accents, so «Lucia» finds «Lucía». */
function plain(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

function serverMessage(cause: unknown): string {
  return (cause as { error?: { message?: string } }).error?.message ?? '';
}
