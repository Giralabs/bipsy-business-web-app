import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AgendaGridComponent, GridColumn, GridSpot } from './agenda-grid.component';
import { BookingDialogComponent } from './booking-dialog.component';
import { CreateBookingDialogComponent } from './create-booking-dialog.component';
import { WaitlistPanelComponent } from './waitlist-panel.component';
import { AgendaStore } from '../core/data/agenda.store';
import { AuthService } from '../core/auth/auth.service';
import { TeamStore } from '../core/data/team.store';
import { WaitlistStore } from '../core/data/waitlist.store';
import { AgendaState, BookingResponse } from '../core/api/models';
import {
  LEGEND,
  STATE_LOOK,
  durationMinutes,
  isAtHome,
  isForSomeoneElse,
  stateOf,
  whoAttends,
} from '../core/agenda/booking-state';
import {
  MONTHS,
  WEEKDAYS,
  addDays,
  dayKey,
  hhmm,
  isSameDay,
  isToday,
  isoWeekday,
  longDate,
  parseHhmm,
  relativeDay,
  startOfDay,
  startOfWeek,
  toDate,
} from '../core/util/dates';
import { duration as durationText, plural } from '../core/util/format';
import { PnEmptyComponent, PnSegmentedComponent, SegmentOption } from '../ui/controls';
import { PnDialogComponent } from '../ui/dialog.component';

type View = 'semana' | 'dia' | 'lista' | 'pendientes' | 'espera';

/** What «Dar cita» opens with: the day being looked at and, from the grid, the spot clicked. */
interface NewBookingSeed {
  day: Date;
  time: string | null;
  workerId: number | null;
}

/**
 * `/panel/agenda` — the screen the shop lives in.
 *
 * The app offers three tabs (Hoy · Pendientes · Agenda) plus the waiting list.
 * Here the same content gets the room a desk has: a real week grid, a day
 * split by worker, and the list the app shows, all fed by the one call the API
 * offers (`GET /bookings/me/business`, no date range) and filtered in memory.
 */
@Component({
  selector: 'app-panel-agenda',
  standalone: true,
  imports: [
    AgendaGridComponent,
    BookingDialogComponent,
    CreateBookingDialogComponent,
    WaitlistPanelComponent,
    PnSegmentedComponent,
    PnEmptyComponent,
    PnDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './agenda.component.html',
  styleUrl: './agenda.component.css',
})
export class AgendaComponent {
  readonly agenda = inject(AgendaStore);
  readonly auth = inject(AuthService);
  readonly team = inject(TeamStore);
  readonly waitlist = inject(WaitlistStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly hhmm = hhmm;
  readonly toDate = toDate;
  readonly relativeDay = relativeDay;
  readonly longDate = longDate;
  readonly look = STATE_LOOK;
  readonly legend = LEGEND;
  readonly who = whoAttends;
  readonly atHome = isAtHome;
  readonly forSomeoneElse = isForSomeoneElse;

  readonly view = signal<View>('semana');
  readonly picked = signal<BookingResponse | null>(null);
  readonly legendOpen = signal(false);
  /** «Dar cita» open, and what it starts from. Owner only: `/businesses/me/**` is BUSINESS. */
  readonly giving = signal<NewBookingSeed | null>(null);

  constructor() {
    void this.agenda.load();
    // Un trabajador solo ve sus citas: sin columnas por persona. La lista de
    // espera sí, si el dueño le deja gestionarla (`WaitlistStore.enabled`).
    if (this.auth.isBusiness()) void this.team.load();
    void this.waitlist.load();

    const params = this.route.snapshot.queryParamMap;
    const view = params.get('vista') as View | null;
    if (view && (view !== 'espera' || this.waitlist.enabled())) this.view.set(view);
    const day = params.get('dia');
    if (day) this.agenda.selectedDay.set(startOfDay(new Date(`${day}T00:00:00`)));
  }

  readonly tabs = computed<SegmentOption[]>(() => {
    const options: SegmentOption[] = [
      { id: 'semana', label: 'Semana' },
      { id: 'dia', label: 'Día' },
      { id: 'lista', label: 'Lista' },
      { id: 'pendientes', label: 'Pendientes', badge: this.agenda.pendingCount() },
    ];
    if (this.waitlist.enabled()) options.push({ id: 'espera', label: 'Espera' });
    return options;
  });

  readonly day = this.agenda.selectedDay;

  readonly weekStart = computed(() => startOfWeek(this.day()));

  /** «15 – 21 de septiembre» or, across months, «29 sep – 5 oct». */
  readonly rangeLabel = computed(() => {
    if (this.view() !== 'semana') return longDate(this.day());
    const from = this.weekStart();
    const to = addDays(from, 6);
    if (from.getMonth() === to.getMonth()) {
      return `${from.getDate()} – ${to.getDate()} de ${MONTHS[from.getMonth()]}`;
    }
    return `${from.getDate()} ${MONTHS[from.getMonth()].slice(0, 3)} – ${to.getDate()} ${MONTHS[to.getMonth()].slice(0, 3)}`;
  });

  /** Week view: one column per day, Monday first. */
  readonly weekColumns = computed<GridColumn[]>(() => {
    const start = this.weekStart();
    return Array.from({ length: 7 }, (_, index) => {
      const date = addDays(start, index);
      return {
        id: dayKey(date),
        title: WEEKDAYS[index].slice(0, 3),
        subtitle: String(date.getDate()),
        highlight: isToday(date),
        open: this.openOf(date),
        bookings: this.agenda.ofDay(date).filter((booking) => booking.status !== 'CANCELED'),
      } satisfies GridColumn;
    });
  });

  /** Day view: one column per worker, or a single one for a solo business. */
  readonly dayColumns = computed<GridColumn[]>(() => {
    const date = this.day();
    const open = this.openOf(date);
    const bookings = this.agenda.ofDay(date).filter((booking) => booking.status !== 'CANCELED');
    const workers = this.team.all();

    if (this.auth.isWorker() || this.auth.isAutonomous() || workers.length === 0) {
      return [
        {
          id: 'todos',
          title: 'Tu agenda',
          subtitle: relativeDay(date),
          highlight: isToday(date),
          open,
          bookings,
        },
      ];
    }

    const columns: GridColumn[] = workers.map((worker) => ({
      id: String(worker.id),
      title: worker.name.split(' ')[0],
      subtitle: plural(
        bookings.filter((booking) => booking.workerId === worker.id).length,
        'cita',
        'citas',
      ),
      open,
      bookings: bookings.filter((booking) => booking.workerId === worker.id),
    }));

    // Nobody assigned yet still has to be visible, or the day lies.
    const orphans = bookings.filter((booking) => !workers.some((w) => w.id === booking.workerId));
    if (orphans.length > 0) {
      columns.push({
        id: 'sin-asignar',
        title: 'Sin asignar',
        subtitle: plural(orphans.length, 'cita', 'citas'),
        open,
        bookings: orphans,
      });
    }
    return columns;
  });

  readonly dayList = this.agenda.ofSelectedDay;
  readonly pending = this.agenda.pending;

  readonly dayHours = computed(() => {
    const entries = this.agenda.hoursOf(isoWeekday(this.day()));
    if (entries.length === 0) return 'Cerrado';
    return entries.map((entry) => `${entry.startTime} – ${entry.endTime}`).join(' · ');
  });

  private openOf(date: Date): { from: number; to: number }[] {
    return this.agenda
      .hoursOf(isoWeekday(date))
      .map((entry) => ({ from: parseHhmm(entry.startTime), to: parseHhmm(entry.endTime) }));
  }

  setView(view: string): void {
    this.view.set(view as View);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { vista: view },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  step(direction: -1 | 1): void {
    const size = this.view() === 'semana' ? 7 : 1;
    this.agenda.selectedDay.set(addDays(this.day(), direction * size));
  }

  goToday(): void {
    this.agenda.selectedDay.set(startOfDay(new Date()));
  }

  get showsToday(): boolean {
    return this.view() === 'semana'
      ? isSameDay(this.weekStart(), startOfWeek(new Date()))
      : isToday(this.day());
  }

  open(booking: BookingResponse): void {
    this.picked.set(booking);
  }

  close(): void {
    this.picked.set(null);
  }

  /**
   * From the header: the day being looked at, already chosen. In «Pendientes»
   * and «Espera» there is no day on screen, so it is today.
   */
  give(): void {
    const view = this.view();
    const onADay = view === 'semana' || view === 'dia' || view === 'lista';
    this.giving.set({ day: onADay ? this.day() : startOfDay(new Date()), time: null, workerId: null });
  }

  /** From an empty spot of the grid: its day, its time and, in the day view, its worker. */
  giveAt(spot: GridSpot): void {
    if (!this.auth.isBusiness()) return;
    const week = this.view() === 'semana';
    const day = week ? startOfDay(new Date(`${spot.columnId}T00:00:00`)) : this.day();
    const start = new Date(day);
    start.setMinutes(spot.minute);
    // A spot that is already gone is a click on the paper, not a request.
    if (start < new Date()) return;
    const workerId = week ? NaN : Number(spot.columnId);
    this.giving.set({
      day,
      time: hhmm(start),
      workerId: Number.isInteger(workerId) ? workerId : null,
    });
  }

  /** To the day of the appointment, so it is seen where it landed. */
  onGiven(day: Date): void {
    this.giving.set(null);
    this.agenda.selectedDay.set(startOfDay(day));
    if (this.view() === 'pendientes' || this.view() === 'espera') this.setView('dia');
  }

  stateOf(booking: BookingResponse): AgendaState {
    return stateOf(booking);
  }

  lengthOf(booking: BookingResponse): string {
    return durationText(durationMinutes(booking));
  }

  count(n: number, one: string, many: string): string {
    return plural(n, one, many);
  }
}
