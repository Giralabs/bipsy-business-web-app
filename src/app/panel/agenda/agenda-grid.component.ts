import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  Output,
  computed,
  signal,
} from '@angular/core';
import { BookingResponse } from '../core/api/models';
import { STATE_LOOK, isAtHome, isForSomeoneElse, stateOf, whoAttends } from '../core/agenda/booking-state';
import { hhmm, minutesOfDay, toDate } from '../core/util/dates';

export interface GridColumn {
  id: string;
  title: string;
  subtitle?: string;
  /** Marks the column as today, so the header lights up. */
  highlight?: boolean;
  /** Open ranges in minutes; whatever falls outside is painted as closed. */
  open: { from: number; to: number }[];
  bookings: BookingResponse[];
}

interface Placed {
  booking: BookingResponse;
  top: number;
  height: number;
  lane: number;
  lanes: number;
  state: string;
  color: string;
  icon: string;
  label: string;
  time: string;
  /** Who shows up, which may not be who booked. */
  who: string;
  atHome: boolean;
  forOther: boolean;
  /** Tan baja que solo cabe una línea: hora y nombre. */
  tight: boolean;
}

/** An empty spot of the grid that was clicked: which column and at what minute of the day. */
export interface GridSpot {
  columnId: string;
  minute: number;
}

/**
 * The hour grid the agenda is built on: one column per day (week view) or one
 * per worker (day view), and every appointment drawn at its real height.
 *
 * The app has no such grid — a phone only fits a list — so this is the one
 * screen of the panel designed from scratch rather than ported. What it does
 * keep is the language: the colour stripe of each state, the same seven states
 * and the same words.
 *
 * Two appointments at the same time (two chairs) split the column into lanes
 * instead of stacking, because a barbershop reads «who is busy» from the
 * width.
 */
@Component({
  selector: 'app-agenda-grid',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './agenda-grid.component.html',
  styleUrl: './agenda-grid.component.css',
})
export class AgendaGridComponent implements OnDestroy {
  @Input({ required: true }) set columns(value: GridColumn[]) {
    this.cols.set(value);
  }
  /**
   * Píxeles por minuto. A 1.5 una cita de media hora mide 45px, que es lo
   * mínimo para que quepan la hora y el nombre sin apretarlos.
   */
  @Input() scale = 1.5;
  /** Whether clicking an empty spot means something (the owner giving an appointment). */
  @Input() pickable = false;
  /** What a click on an empty spot is rounded down to. */
  @Input() slotMinutes = 15;
  @Output() picked = new EventEmitter<BookingResponse>();
  @Output() spotPicked = new EventEmitter<GridSpot>();

  readonly cols = signal<GridColumn[]>([]);
  readonly now = signal(new Date());

  private readonly ticker = setInterval(() => this.now.set(new Date()), 60_000);

  /** The window of hours to paint: the opening hours, widened by the bookings. */
  readonly bounds = computed(() => {
    let from = 24 * 60;
    let to = 0;
    for (const column of this.cols()) {
      for (const range of column.open) {
        from = Math.min(from, range.from);
        to = Math.max(to, range.to);
      }
      for (const booking of column.bookings) {
        from = Math.min(from, minutesOfDay(toDate(booking.startDateTime)));
        to = Math.max(to, minutesOfDay(toDate(booking.endDateTime)));
      }
    }
    if (from >= to) {
      from = 9 * 60;
      to = 21 * 60;
    }
    // Round out to whole hours and leave a little air at both ends.
    return { from: Math.max(0, Math.floor(from / 60) * 60 - 30), to: Math.min(24 * 60, Math.ceil(to / 60) * 60 + 30) };
  });

  readonly hours = computed(() => {
    const { from, to } = this.bounds();
    const out: number[] = [];
    for (let minute = Math.ceil(from / 60) * 60; minute <= to; minute += 60) out.push(minute);
    return out;
  });

  readonly height = computed(() => (this.bounds().to - this.bounds().from) * this.scale);

  readonly placed = computed(() => this.cols().map((column) => this.place(column)));

  /** Closed stripes of a column, as boxes to paint behind the appointments. */
  closedBands(column: GridColumn): { top: number; height: number }[] {
    const { from, to } = this.bounds();
    if (column.open.length === 0) return [{ top: 0, height: this.height() }];
    const ranges = [...column.open].sort((a, b) => a.from - b.from);
    const bands: { top: number; height: number }[] = [];
    let cursor = from;
    for (const range of ranges) {
      if (range.from > cursor) bands.push(this.band(cursor, Math.min(range.from, to)));
      cursor = Math.max(cursor, range.to);
    }
    if (cursor < to) bands.push(this.band(cursor, to));
    return bands.filter((band) => band.height > 1);
  }

  private band(fromMinute: number, toMinute: number): { top: number; height: number } {
    return {
      top: (fromMinute - this.bounds().from) * this.scale,
      height: (toMinute - fromMinute) * this.scale,
    };
  }

  topOf(minute: number): number {
    return (minute - this.bounds().from) * this.scale;
  }

  labelOf(minute: number): string {
    return `${String(Math.floor(minute / 60)).padStart(2, '0')}:00`;
  }

  /** The red line, only while the clock is inside the painted window. */
  readonly nowTop = computed(() => {
    const minute = minutesOfDay(this.now());
    const { from, to } = this.bounds();
    return minute >= from && minute <= to ? (minute - from) * this.scale : null;
  });

  private place(column: GridColumn): Placed[] {
    const sorted = [...column.bookings].sort((a, b) => a.startDateTime.localeCompare(b.startDateTime));
    const laneEnds: number[] = [];
    const rows = sorted.map((booking) => {
      const start = minutesOfDay(toDate(booking.startDateTime));
      const end = minutesOfDay(toDate(booking.endDateTime));
      let lane = laneEnds.findIndex((endsAt) => endsAt <= start);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(end);
      } else {
        laneEnds[lane] = end;
      }
      const state = stateOf(booking);
      const look = STATE_LOOK[state];
      // 30px es la tarjeta más baja donde la hora y el nombre siguen cabiendo.
      const height = Math.max(30, (end - start) * this.scale - 4);
      return {
        booking,
        top: (start - this.bounds().from) * this.scale,
        height,
        lane,
        lanes: 1,
        state,
        color: look.color,
        icon: look.icon,
        label: look.label,
        time: hhmm(toDate(booking.startDateTime)),
        who: whoAttends(booking),
        atHome: isAtHome(booking),
        forOther: isForSomeoneElse(booking),
        tight: height < 52,
      };
    });
    const lanes = Math.max(1, laneEnds.length);
    return rows.map((row) => ({ ...row, lanes }));
  }

  /** A click on the paper of a column, not on an appointment. */
  onColumnClick(column: GridColumn, event: MouseEvent): void {
    if (!this.pickable || (event.target as HTMLElement).closest('.ev')) return;
    const top = (event.currentTarget as HTMLElement).getBoundingClientRect().top;
    const step = Math.max(5, this.slotMinutes);
    const minute = this.bounds().from + (event.clientY - top) / this.scale;
    this.spotPicked.emit({ columnId: column.id, minute: Math.floor(minute / step) * step });
  }

  ngOnDestroy(): void {
    clearInterval(this.ticker);
  }
}
