import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TeamStore } from '../core/data/team.store';
import { AgendaStore } from '../core/data/agenda.store';
import { AuthService } from '../core/auth/auth.service';
import { Absence, AbsenceType, BookingResponse, ConflictBooking, TimeOff } from '../core/api/models';
import { message } from '../core/data/resource';
import { addDays, dayKey, hhmm, longDate, shortDate, toDate } from '../core/util/dates';
import { plural } from '../core/util/format';
import { PnEmptyComponent, PnSegmentedComponent, SegmentOption } from '../ui/controls';
import { PnDialogComponent } from '../ui/dialog.component';
import { ConfirmService } from '../ui/confirm.service';
import { ToastService } from '../ui/toast.service';

const TYPE_LABEL: Record<AbsenceType, string> = {
  VACATION: 'Vacaciones',
  PERSONAL: 'Asuntos personales',
  SICK_LEAVE: 'Baja médica',
  OTHER: 'Otro',
};

const TYPES = Object.entries(TYPE_LABEL).map(([id, label]) => ({ id: id as AbsenceType, label }));

/**
 * One line of the screen. The owner's day off (`/timeoff`) is read as one more
 * absence — `Absence.fromTimeOff` in the app — and `ownerDay` is all that
 * tells it apart: it decides which endpoint deletes it, because the two
 * tables do not share ids.
 */
type Entry = Absence & { ownerDay?: boolean };

function fromTimeOff(day: TimeOff, businessId: number): Entry {
  return {
    id: day.id,
    workerId: day.actorId,
    // Who it is comes from `ownerDay`, not from this field: the screen says «Yo».
    workerName: '',
    businessId,
    type: 'OTHER',
    startDate: day.startDate,
    endDate: day.endDate,
    reason: day.reason,
    // Neither typed nor decided by anybody; APPROVED because those days are blocked.
    status: 'APPROVED',
    decidedByName: null,
    decidedAt: null,
    decisionNote: null,
    conflictingBookingsCount: 0,
    ownerDay: true,
  };
}

/**
 * `/panel/equipo/ausencias` — `business_absences_screen.dart` and, inside it,
 * `conflict_resolver_screen.dart` and `create_direct_absence_sheet.dart`.
 *
 * Approving is not one click when there are appointments in the way: the
 * resolver makes you deal with each of them first, either by moving it to
 * somebody free or by cancelling it. Only when none are left does the approve
 * button come alive — the same rule as the app, because it is what keeps a
 * customer from being silently dropped.
 *
 * The owner's own days off live here too, as «Yo»: it is how an owner with a
 * team takes holidays. None of this closes the shop — that is
 * `/panel/ajustes/cierres`.
 */
@Component({
  selector: 'app-panel-ausencias',
  standalone: true,
  imports: [FormsModule, RouterLink, PnEmptyComponent, PnSegmentedComponent, PnDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ausencias.component.html',
  styleUrl: './ausencias.component.css',
})
export class AusenciasComponent {
  readonly team = inject(TeamStore);
  private readonly agenda = inject(AgendaStore);
  private readonly auth = inject(AuthService);
  private readonly confirm = inject(ConfirmService);
  private readonly toasts = inject(ToastService);

  readonly longDate = longDate;
  readonly shortDate = shortDate;
  readonly hhmm = hhmm;
  readonly toDate = toDate;
  readonly types = TYPES;

  readonly tab = signal('pendientes');
  readonly resolving = signal<Absence | null>(null);
  readonly conflicts = signal<ConflictBooking[]>([]);
  readonly candidates = signal<Record<number, { id: number; name: string }[]>>({});
  readonly busy = signal(false);

  // ----- «Registrar ausencia» ----------------------------------------------

  readonly creating = signal(false);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);
  /** The owner's appointments in the way of their own day off. */
  readonly inTheWay = signal<BookingResponse[]>([]);
  readonly checking = signal(false);
  private checkRun = 0;

  /** A year back, to write down what already happened; two ahead, like the app's calendar. */
  readonly minDay = dayKey(addDays(new Date(), -365));
  readonly maxDay = dayKey(addDays(new Date(), 365 * 2));

  /** A signal, unlike the other fields: the form changes shape with who is picked. */
  readonly workerId = signal<number | null>(null);
  type: AbsenceType = 'VACATION';
  from = '';
  to = '';
  reason = '';

  constructor() {
    if (!this.team.enabled()) return;
    void this.team.absences.load();
    void this.team.load();
    // Without an owner who attends the server answers 403: not even asked.
    if (this.auth.profile()?.ownerPerforms) void this.team.timeOff.load();
  }

  readonly tabs = computed<SegmentOption[]>(() => [
    { id: 'pendientes', label: 'Pendientes', badge: this.team.pendingAbsences().length },
    { id: 'historial', label: 'Historial' },
  ]);

  /**
   * What is already settled: the team's approved and rejected ones and the
   * owner's days off, most recent first — the order the backend gives.
   */
  private readonly history = computed<Entry[]>(() => {
    const businessId = this.auth.businessId() ?? 0;
    const resolved: Entry[] = this.team.absences.value().filter((absence) => absence.status !== 'PENDING');
    const mine = this.team.timeOff.value().map((day) => fromTimeOff(day, businessId));
    return [...resolved, ...mine].sort((a, b) => b.startDate.localeCompare(a.startDate));
  });

  readonly shown = computed<Entry[]>(() =>
    this.tab() === 'pendientes' ? this.team.pendingAbsences() : this.history(),
  );

  /** The owner first and the rest by name: it is the owner who reads the list. */
  readonly professionals = computed(() => {
    const staff = [...this.team.staff()].sort((a, b) => a.name.localeCompare(b.name, 'es'));
    const owner = this.team.owner();
    return owner ? [owner, ...staff] : staff;
  });

  readonly forOwner = computed(() => this.workerId() != null && this.workerId() === this.team.owner()?.id);

  trackOf(entry: Entry): string {
    return `${entry.ownerDay ? 'o' : 'w'}${entry.id}`;
  }

  whoOf(entry: Entry): string {
    return entry.ownerDay ? 'Yo' : entry.workerName;
  }

  /** The owner's day off has no type — nobody asks for it —, so it is named by what it is. */
  typeOf(entry: Entry): string {
    return entry.ownerDay ? 'Día libre' : TYPE_LABEL[entry.type];
  }

  rangeOf(absence: Absence): string {
    const from = longDate(new Date(`${absence.startDate}T00:00:00`));
    const to = longDate(new Date(`${absence.endDate}T00:00:00`));
    return from === to ? from : `${from} — ${to}`;
  }

  count(n: number, one: string, many: string): string {
    return plural(n, one, many);
  }

  async start(absence: Absence): Promise<void> {
    if (absence.conflictingBookingsCount === 0) {
      await this.approve(absence);
      return;
    }
    this.resolving.set(absence);
    await this.loadConflicts(absence);
  }

  private async loadConflicts(absence: Absence): Promise<void> {
    try {
      const list = await this.team.conflicts(absence.id);
      this.conflicts.set(list);
      const map: Record<number, { id: number; name: string }[]> = {};
      for (const conflict of list) {
        map[conflict.id] = await this.team.freeWorkersFor(conflict.id).catch(() => []);
      }
      this.candidates.set(map);
    } catch {
      this.toasts.error('No hemos podido ver las citas que chocan.');
    }
  }

  async reassign(conflict: ConflictBooking, workerId: number): Promise<void> {
    try {
      await this.agenda.reassign(conflict.id, workerId);
      this.conflicts.set(this.conflicts().filter((item) => item.id !== conflict.id));
      this.toasts.show('Cita reasignada');
    } catch {
      this.toasts.error('No se ha podido reasignar.');
    }
  }

  async cancelConflict(conflict: ConflictBooking): Promise<void> {
    const answer = await this.confirm.ask({
      title: 'Cancelar cita',
      message: `Se avisará a ${conflict.customerName} de que su cita se cancela.`,
      confirmLabel: 'Cancelar la cita',
      destructive: true,
      reason: { label: 'Por qué cancelas', placeholder: 'Opcional' },
    });
    if (!answer.ok) return;
    try {
      await this.agenda.cancel(conflict.id, answer.reason);
      this.conflicts.set(this.conflicts().filter((item) => item.id !== conflict.id));
    } catch {
      this.toasts.error('No se ha podido cancelar.');
    }
  }

  async approve(absence: Absence): Promise<void> {
    this.busy.set(true);
    try {
      await this.team.approveAbsence(absence.id);
      this.resolving.set(null);
      this.toasts.show('Ausencia aprobada');
    } catch {
      this.toasts.error('No se ha podido aprobar.');
    } finally {
      this.busy.set(false);
    }
  }

  async reject(absence: Absence): Promise<void> {
    const answer = await this.confirm.ask({
      title: 'Rechazar ausencia',
      message: `${absence.workerName} recibirá el aviso con tu motivo.`,
      confirmLabel: 'Rechazar',
      destructive: true,
      reason: { label: 'Motivo', placeholder: 'Se lo enseñamos tal cual' },
    });
    if (!answer.ok) return;
    try {
      await this.team.rejectAbsence(absence.id, answer.reason);
      this.toasts.show('Ausencia rechazada');
    } catch {
      this.toasts.error('No se ha podido rechazar.');
    }
  }

  /**
   * Removes a settled absence. The app does it by swiping the card; here it
   * is a button, and the question is the same. Removing a rejected one only
   * tidies the list; removing one that blocks days gives those slots back, and
   * the appointments cancelled to approve it do not return — not the same
   * thing, so not the same warning.
   */
  async remove(entry: Entry): Promise<void> {
    const answer = await this.confirm.ask({
      title: '¿Quitar esta ausencia?',
      message:
        entry.status === 'REJECTED'
          ? 'Desaparecerá del historial. No cambia nada en la agenda.'
          : 'Esos días volverán a ofrecer citas. Las que se cancelaran para poder aprobarla no vuelven.',
      confirmLabel: 'Quitar',
      destructive: true,
    });
    if (!answer.ok) return;
    try {
      // Two tables, two endpoints: the id of a day off means nothing in /absences.
      if (entry.ownerDay) await this.team.deleteTimeOff(entry.id);
      else await this.team.deleteAbsence(entry.id);
    } catch (cause) {
      const text = message(cause);
      this.toasts.error(
        `No se ha podido quitar. ${text === 'Algo no ha ido bien.' ? 'Vuelve a intentarlo en un momento.' : text}`,
      );
    }
  }

  // ----- «Registrar ausencia» ----------------------------------------------

  open(): void {
    this.workerId.set(null);
    this.type = 'VACATION';
    this.from = '';
    this.to = '';
    this.reason = '';
    this.formError.set(null);
    this.inTheWay.set([]);
    this.creating.set(true);
  }

  pick(id: number | null): void {
    this.workerId.set(id);
    void this.check();
  }

  /**
   * The start day drags the end day along: with none, or with one before it,
   * it becomes the same day. A period that ends before it starts does not
   * exist, and a field in red makes the user fix what they never chose.
   */
  setFrom(day: string): void {
    this.from = day;
    if (day && (!this.to || this.to < day)) this.to = day;
    void this.check();
  }

  setTo(day: string): void {
    this.to = day;
    void this.check();
  }

  /**
   * Only for the owner's own days: a worker's absence has no way to ask before
   * it exists, so there the server's refusal is what is shown. If this fails
   * nothing is blocked — the POST checks again, and the server is who decides.
   */
  private async check(): Promise<void> {
    const run = ++this.checkRun;
    this.inTheWay.set([]);
    if (!this.forOwner() || !this.from || !this.to || this.to < this.from) {
      this.checking.set(false);
      return;
    }
    this.checking.set(true);
    try {
      const list = await this.team.timeOffConflicts(this.from, this.to);
      if (run === this.checkRun) this.inTheWay.set(list);
    } catch {
      // Left empty on purpose: see above.
    } finally {
      if (run === this.checkRun) this.checking.set(false);
    }
  }

  async save(): Promise<void> {
    const workerId = this.workerId();
    if (workerId == null) {
      this.formError.set('Selecciona un trabajador.');
      return;
    }
    if (!this.from || !this.to) {
      this.formError.set('Elige las fechas.');
      return;
    }
    if (this.to < this.from) {
      this.formError.set('La fecha de fin no puede ser anterior a la de inicio.');
      return;
    }
    this.saving.set(true);
    this.formError.set(null);
    const reason = this.reason.trim();
    try {
      if (this.forOwner()) {
        // Theirs is not an absence somebody approves: it is their day off.
        await this.team.createTimeOff(this.from, this.to, reason);
      } else {
        await this.team.createDirectAbsence({
          workerId,
          type: this.type,
          startDate: this.from,
          endDate: this.to,
          ...(reason ? { reason } : {}),
        });
      }
      this.creating.set(false);
      // It is born approved, so it lands in the other tab.
      this.tab.set('historial');
      this.toasts.show('Ausencia registrada');
    } catch (cause) {
      const text = message(cause);
      this.formError.set(text === 'Algo no ha ido bien.' ? 'No se ha podido registrar.' : text);
    } finally {
      this.saving.set(false);
    }
  }
}
