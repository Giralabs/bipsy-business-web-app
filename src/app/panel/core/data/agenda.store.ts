import { Injectable, computed, inject, signal } from '@angular/core';
import { Api } from '../api/api';
import {
  AvailabilityResponse,
  BookingResponse,
  CreateBookingForCustomerRequest,
  ScheduleEntry,
} from '../api/models';
import { scheduleFromApi } from '../api/schedule';
import { AuthService } from '../auth/auth.service';
import { stateOf } from '../agenda/booking-state';
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

  /** Cancelled ones are hidden everywhere except when looking at one day. */
  readonly today = computed(() =>
    this.all()
      .filter((b) => b.status !== 'CANCELED' && isSameDay(toDate(b.startDateTime), new Date()))
      .sort(byStart),
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
    return this.all()
      .filter((b) => isSameDay(toDate(b.startDateTime), day))
      .sort(byStart);
  });

  /** Appointments of a day, ready for the grid. Cancelled included. */
  ofDay(day: Date): BookingResponse[] {
    const key = dayKey(day);
    return this.all()
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
   * Gives an appointment to someone of the phone book (owner only). With a
   * Bipsy account it is born `AWAITING_CUSTOMER`, slot held and ten minutes
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
