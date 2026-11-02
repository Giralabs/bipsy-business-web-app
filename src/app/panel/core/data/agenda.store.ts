import { Injectable, computed, inject, signal } from '@angular/core';
import { Api } from '../api/api';
import {
  AvailabilityResponse,
  BookingResponse,
  CollectStatus,
  CreateBookingForCustomerRequest,
  PaymentRequest,
  ScheduleEntry,
} from '../api/models';
import { scheduleFromApi } from '../api/schedule';
import { AuthService } from '../auth/auth.service';
import { isDone, stateOf } from '../agenda/booking-state';
import { dayKey, isSameDay, startOfDay, toDate } from '../util/dates';
import { resource } from './resource';

/**
 * The agenda. Mirrors `bookings_providers.dart`: one call brings every
 * appointment of the business (`GET /bookings/me/business` takes no range) and
 * every view filters that list in memory.
 *
 * The day the panel is looking at lives here too, so the week grid, the day
 * grid and the list all move together.
 */
@Injectable({ providedIn: 'root' })
export class AgendaStore {
  private readonly api = inject(Api);
  private readonly auth = inject(AuthService);

  /**
   * Un trabajador solo ve sus citas (`/bookings/me/worker`), igual que
   * `workerBookingsProvider`; el dueño ve las de todo el negocio.
   */
  readonly bookings = resource<BookingResponse[]>(
    () =>
      this.api.get<BookingResponse[]>(
        this.auth.isWorker() ? '/bookings/me/worker' : '/bookings/me/business',
      ),
    [],
  );

  /** El horario de quien entra: el del negocio o el del trabajador. */
  readonly schedule = resource<ScheduleEntry[]>(
    async () => scheduleFromApi(await this.api.get('/schedules/me')),
    [],
  );

  /** The day every view is centred on. Starts today, like the app. */
  readonly selectedDay = signal(startOfDay(new Date()));

  readonly all = this.bookings.value;

  /**
   * The agenda shows ONLY the owner's own appointments (`soloMisCitasProvider`).
   * For the owner who attends and has staff. It reloads nothing and is not kept
   * between sessions: a way of looking, not a setting.
   */
  readonly onlyMine = signal(false);

  /**
   * Whether that filter APPLIES. From the profile alone, without waiting for any
   * list: a reload must not bring the whole agenda back for a moment.
   */
  private readonly onlyMineApplies = computed(() => {
    const profile = this.auth.profile();
    return (
      this.onlyMine() && this.auth.isBusiness() && profile?.ownerPerforms === true && profile.teamEnabled !== false
    );
  });

  /**
   * What the day views paint. The owner travels with the BUSINESS id. Not applied
   * to «Pendientes», like the app: answering them is the owner's in any case.
   */
  private scoped(list: BookingResponse[]): BookingResponse[] {
    if (!this.onlyMineApplies()) return list;
    const owner = this.auth.profile()?.id;
    return list.filter((b) => b.workerId === owner);
  }

  /** Cancelled ones are hidden everywhere except when looking at one day. */
  readonly today = computed(() =>
    this.all()
      .filter((b) => b.status !== 'CANCELED' && isSameDay(toDate(b.startDateTime), new Date()))
      .sort(doneLast),
  );

  /**
   * What waits for the BUSINESS. `AWAITING_CUSTOMER` is not here on purpose:
   * there the customer is the one who has to answer, and listing it under
   * «Pendientes» would offer a «Confirmar» the server rejects.
   */
  readonly pending = computed(() => this.all().filter((b) => b.status === 'PENDING').sort(byStart));

  readonly pendingCount = computed(() => this.pending().length);

  readonly ofSelectedDay = computed(() => {
    const day = this.selectedDay();
    return this.scoped(this.all())
      .filter((b) => isSameDay(toDate(b.startDateTime), day))
      .sort(doneLast);
  });

  /** Appointments of a day, ready for the grid. Cancelled included. */
  ofDay(day: Date): BookingResponse[] {
    const key = dayKey(day);
    return this.scoped(this.all())
      .filter((b) => dayKey(toDate(b.startDateTime)) === key)
      .sort(byStart);
  }

  /** Opening hours of a weekday (1 = Monday), as [fromMinute, toMinute]. */
  hoursOf(weekday: number): ScheduleEntry[] {
    return this.schedule.value().filter((entry) => entry.dayOfWeek === weekday);
  }

  readonly states = computed(() => new Map(this.all().map((b) => [b.id, stateOf(b)])));

  async load(): Promise<void> {
    await Promise.all([this.bookings.load(), this.schedule.load()]);
  }

  async confirm(id: number): Promise<void> {
    await this.api.put(`/bookings/${id}/confirm`);
    await this.bookings.reload();
  }

  async cancel(id: number, reason: string): Promise<void> {
    await this.api.put(`/bookings/${id}/cancel`, { reason });
    await this.bookings.reload();
  }

  async markNoShow(id: number): Promise<void> {
    await this.api.put(`/bookings/${id}/no-show`);
    await this.bookings.reload();
  }

  async reassign(id: number, workerId: number): Promise<void> {
    await this.api.put(`/bookings/${id}/reassign`, { workerId });
    await this.bookings.reload();
  }

  availableWorkers(id: number): Promise<{ id: number; name: string }[]> {
    return this.api.get(`/bookings/${id}/available-workers`);
  }

  // ----- cobrar ------------------------------------------------------------
  // `/businesses/me/bookings/{id}/…` opens to workers too (V116): whoever serves
  // an appointment collects it. Only what stamps a change reloads the agenda.

  collectStatus(id: number): Promise<CollectStatus> {
    return this.api.get<CollectStatus>(`/businesses/me/bookings/${id}/collect`);
  }

  /** Idempotent on the server: two clicks give the SAME request and one notice. */
  requestPayment(id: number): Promise<PaymentRequest> {
    return this.api.post<PaymentRequest>(`/businesses/me/bookings/${id}/payment-request`);
  }

  cancelPaymentRequest(id: number): Promise<CollectStatus> {
    return this.api.delete<CollectStatus>(`/businesses/me/bookings/${id}/payment-request`);
  }

  /** Moves no money and creates no charge: a seal so nobody asks for it again. */
  settleOffline(id: number): Promise<CollectStatus> {
    return this.api.post<CollectStatus>(`/businesses/me/bookings/${id}/settle-offline`);
  }

  undoSettleOffline(id: number): Promise<CollectStatus> {
    return this.api.delete<CollectStatus>(`/businesses/me/bookings/${id}/settle-offline`);
  }

  // ----- dar cita ----------------------------------------------------------

  /**
   * The free slots of a day, as the server works them out. The SAME endpoint
   * the customer app books with (`businessAvailabilityProvider`): a count of
   * its own here would offer times the booking then rejects. No `workerId`
   * means «anyone»: each slot says who can take it.
   */
  availability(serviceId: number, day: Date, workerId: number | null): Promise<AvailabilityResponse> {
    return this.api.get<AvailabilityResponse>(`/services/${serviceId}/availability`, {
      date: dayKey(day),
      workerId,
    });
  }

  /**
   * Gives an appointment to someone of the phone book: the owner, or a worker
   * with the front desk permission, whose appointment is his own whatever
   * `workerId` says (`BusinessBookingService`). With a Bipsy account it is born `AWAITING_CUSTOMER`, slot held and ten minutes
   * running; with only an email it is born `CONFIRMED` and sent by email.
   */
  async createForCustomer(request: CreateBookingForCustomerRequest): Promise<BookingResponse> {
    const created = await this.api.post<BookingResponse>('/businesses/me/bookings', request);
    await this.bookings.reload();
    return created;
  }
}

function byStart(a: BookingResponse, b: BookingResponse): number {
  return a.startDateTime.localeCompare(b.startDateTime);
}

/**
 * `cobradasAlFinal`: what happened and is collected goes to the bottom, the rest
 * by time. A day's list is what is left to do. Only the lists: in a grid an
 * appointment's place IS its time.
 */
function doneLast(a: BookingResponse, b: BookingResponse): number {
  const aDone = isDone(a);
  return aDone !== isDone(b) ? (aDone ? 1 : -1) : byStart(a, b);
}
