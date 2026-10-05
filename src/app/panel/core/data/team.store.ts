import { Injectable, computed, inject, signal } from '@angular/core';
import { Api } from '../api/api';
import {
  Absence,
  ActiveWorkerClock,
  AvailableWorker,
  ClockEntry,
  ConflictBooking,
  PendingInvitation,
  BookingResponse,
  ScheduleEntry,
  TeamWorker,
  TimeOff,
} from '../api/models';
import { scheduleFromApi, scheduleToApi } from '../api/schedule';
import { AuthService } from '../auth/auth.service';
import { dayKey } from '../util/dates';
import { resource } from './resource';

function firstOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/**
 * The team and everything hanging off a worker: invitations, absences and the
 * time clock. Three Riverpod files in the app (`team_providers.dart`,
 * `absences_providers.dart`, `timeclock_providers.dart`) live together here
 * because in a desktop panel they share one screen.
 */
@Injectable({ providedIn: 'root' })
export class TeamStore {
  private readonly api = inject(Api);
  private readonly auth = inject(AuthService);

  readonly workers = resource<TeamWorker[]>(
    () => this.api.get<TeamWorker[]>(`/businesses/${this.auth.businessId() ?? 0}/workers`),
    [],
  );

  readonly invitations = resource<PendingInvitation[]>(
    () => this.api.get<PendingInvitation[]>('/invitations/pending'),
    [],
  );

  readonly absences = resource<Absence[]>(() => this.api.get<Absence[]>('/absences/business'), []);

  /**
   * The owner's own days off (`myTimeOffProvider`). A different table and a
   * different endpoint from the team's absences because nobody approves them,
   * so the ids of the two do not share numbering: they are kept apart here and
   * only meet on screen.
   *
   * A business whose owner does not attend gets 403 — it has no agenda of its
   * own to block. That is a right answer, not a failure, so it reads as empty.
   */
  readonly timeOff = resource<TimeOff[]>(async () => {
    try {
      return await this.api.get<TimeOff[]>('/timeoff/me');
    } catch (cause) {
      if ((cause as { status?: number }).status === 403) return [];
      throw cause;
    }
  }, []);

  readonly activeClocks = resource<ActiveWorkerClock[]>(
    () => this.api.get<ActiveWorkerClock[]>('/timeclock/business/active'),
    [],
  );

  /** First day of the month the time-clock log is showing. */
  readonly clockMonth = signal(firstOfMonth(new Date()));

  /**
   * `from` and `to` are required (`@RequestParam LocalDate`): without them the
   * backend answers 400. The app asks month by month, and so does this.
   */
  readonly clockHistory = resource<ClockEntry[]>(() => {
    const from = this.clockMonth();
    const to = new Date(from.getFullYear(), from.getMonth() + 1, 0);
    return this.api.get<ClockEntry[]>('/timeclock/business/history', {
      from: dayKey(from),
      to: dayKey(to),
    });
  }, []);

  showClockMonth(month: Date): Promise<void> {
    this.clockMonth.set(firstOfMonth(month));
    return this.clockHistory.reload();
  }

  readonly all = this.workers.value;

  /**
   * `/businesses/{id}/workers` lists everyone who attends: the staff and,
   * first, the owner when `ownerPerforms` — with the BUSINESS id, which is how
   * the app tells them apart (`TeamWorker.isOwner`). To book, the owner is one
   * more professional; what they are not is staff: nobody invites them, sets
   * their permissions or deletes their account from Equipo.
   */
  readonly owner = computed(() => this.all().find((w) => w.id === this.auth.businessId()) ?? null);
  /** `teamWorkersProvider`: the team without the owner. */
  readonly staff = computed(() => this.all().filter((w) => w.id !== this.auth.businessId()));

  /**
   * Working alone there is no team at all and the server answers 409 to every
   * team endpoint, so nothing is asked for. `teamEnabled` is the app's flag;
   * `autonomous` is the panel's older opposite and the fallback.
   */
  readonly enabled = computed(() => {
    const profile = this.auth.profile();
    if (profile?.teamEnabled != null) return profile.teamEnabled;
    return !this.auth.isAutonomous();
  });

  readonly available = computed(() => this.all().filter((w) => w.available));
  readonly count = computed(() => this.staff().length);
  readonly pendingAbsences = computed(() => this.absences.value().filter((a) => a.status === 'PENDING'));
  readonly clockedInNow = computed(() => this.activeClocks.value().length);

  async load(): Promise<void> {
    await Promise.all([this.workers.load(), this.invitations.load()]);
  }

  byId(id: number): TeamWorker | undefined {
    return this.all().find((worker) => worker.id === id);
  }

  async updateSettings(id: number, patch: Partial<TeamWorker>): Promise<void> {
    const before = this.all();
    this.workers.set(before.map((w) => (w.id === id ? { ...w, ...patch } : w)));
    try {
      await this.api.put(`/workers/${id}/settings`, patch);
    } catch (cause) {
      this.workers.set(before);
      throw cause;
    }
  }

  /**
   * «Eliminar trabajador», as `worker_settings_screen.dart` means it:
   * `DELETE /workers/{id}/account` deletes the account and cancels their
   * bookings. `DELETE /workers/{id}` only unlinks and the app wires it
   * nowhere, so the panel does not offer two doors that read the same.
   */
  async unlink(id: number): Promise<void> {
    await this.api.delete(`/workers/${id}/account`);
    await this.workers.reload();
  }

  async invite(email: string | null): Promise<PendingInvitation> {
    const created = await this.api.post<PendingInvitation>('/invitations', { email });
    await this.invitations.reload();
    return created;
  }

  async revokeInvitation(id: number): Promise<void> {
    await this.api.delete(`/invitations/${id}`);
    await this.invitations.reload();
  }

  async workerSchedule(id: number): Promise<ScheduleEntry[]> {
    return scheduleFromApi(await this.api.get(`/workers/${id}/schedule`));
  }

  saveWorkerSchedule(id: number, entries: ScheduleEntry[]): Promise<unknown> {
    return this.api.put(`/workers/${id}/schedule`, scheduleToApi(entries));
  }

  // ----- absences --------------------------------------------------------

  async approveAbsence(id: number, note?: string): Promise<void> {
    await this.api.put(`/absences/${id}/approve`, { note: note ?? null });
    await this.absences.reload();
  }

  async rejectAbsence(id: number, note: string): Promise<void> {
    await this.api.put(`/absences/${id}/reject`, { note });
    await this.absences.reload();
  }

  conflicts(id: number): Promise<ConflictBooking[]> {
    return this.api.get<ConflictBooking[]>(`/absences/${id}/conflicts`);
  }

  freeWorkersFor(bookingId: number): Promise<AvailableWorker[]> {
    return this.api.get<AvailableWorker[]>(`/bookings/${bookingId}/available-workers`);
  }

  async createDirectAbsence(payload: Record<string, unknown>): Promise<void> {
    await this.api.post('/absences/direct', payload);
    await this.absences.reload();
  }

  /**
   * Removes an absence in ANY state — the only way to undo an approved one.
   * It gives the days back, NOT the appointments: whatever was cancelled to
   * approve it stays cancelled, and the caller has to have said so first.
   */
  async deleteAbsence(id: number): Promise<void> {
    await this.api.delete(`/absences/${id}`);
    await this.absences.reload();
  }

  // ----- the owner's days off --------------------------------------------

  /**
   * The appointments that would stop that period from being blocked. Asked
   * before saving: the POST refuses them anyway, but an error after filling
   * everything in reads as something broken, when the thing to do is to go
   * and move appointments.
   */
  timeOffConflicts(startDate: string, endDate: string): Promise<BookingResponse[]> {
    return this.api.get<BookingResponse[]>('/timeoff/conflicts', { startDate, endDate });
  }

  async createTimeOff(startDate: string, endDate: string, reason: string): Promise<void> {
    await this.api.post('/timeoff', { startDate, endDate, ...(reason ? { reason } : {}) });
    await this.timeOff.reload();
  }

  async deleteTimeOff(id: number): Promise<void> {
    await this.api.delete(`/timeoff/${id}`);
    await this.timeOff.reload();
  }
}
