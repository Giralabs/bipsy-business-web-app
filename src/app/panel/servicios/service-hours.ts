import { ServiceTimeWindow, SlotGrid, WeekdayName } from '../core/api/models';

/**
 * «Solo a ciertas horas»: the rules of `features/services/service_hours.dart`
 * and `core/time_ranges.dart`, with no UI attached.
 *
 * What it is: besides the opening hours of the shop, a service can be limited
 * to some bands per weekday. No bands at all = offered whenever the shop is
 * open. With bands, **a day without any band is a day the service is not
 * offered**, which is why the editor says so out loud.
 *
 * Every time here is `HH:mm`. The wire format is `HH:mm:ss`, so it is trimmed
 * on the way in and padded on the way out — same as the app's `hhmm()`.
 */

/** Monday first, as the week is read in Spain. */
export const WEEK: WeekdayName[] = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
];

export const DAY_LABEL: Record<WeekdayName, string> = {
  MONDAY: 'Lunes',
  TUESDAY: 'Martes',
  WEDNESDAY: 'Miércoles',
  THURSDAY: 'Jueves',
  FRIDAY: 'Viernes',
  SATURDAY: 'Sábado',
  SUNDAY: 'Domingo',
};

export interface Band {
  start: string;
  end: string;
}

/** `09:00:00` → `09:00`; anything shorter is left alone. */
export function hhmm(time: string): string {
  return time.length >= 5 ? time.slice(0, 5) : time;
}

/** `09:00` → `09:00:00`, which is what the backend's `LocalTime` expects. */
export function hhmmss(time: string): string {
  return time.length === 5 ? `${time}:00` : time;
}

export function toMinutes(time: string): number {
  const [hours, minutes] = hhmm(time).split(':').map(Number);
  return hours * 60 + minutes;
}

export function fromMinutes(total: number): string {
  // Never crosses midnight: the app tops it at 23:59 and so does this.
  const capped = Math.min(Math.max(total, 0), 23 * 60 + 59);
  const hours = Math.floor(capped / 60);
  return `${String(hours).padStart(2, '0')}:${String(capped % 60).padStart(2, '0')}`;
}

export function addMinutes(time: string, minutes: number): string {
  return fromMinutes(toMinutes(time) + minutes);
}

/** The grid as it comes, already trimmed to `HH:mm` and sorted. */
export function startOptions(grid: string[]): string[] {
  return [...grid].map(hhmm).sort((a, b) => toMinutes(a) - toMinutes(b));
}

/**
 * The ends that can follow `start`: every grid time strictly after it, plus
 * closing time — which is NOT in the grid, because the grid holds the times a
 * booking can *begin*.
 */
export function endOptions(grid: string[], start: string, slotMinutes: number): string[] {
  const starts = startOptions(grid);
  if (starts.length === 0) return [];
  const after = starts.filter((time) => toMinutes(time) > toMinutes(start));
  const closing = addMinutes(starts[starts.length - 1], slotMinutes);
  return after.includes(closing) ? after : [...after, closing];
}

/**
 * Bands that overlap **or merely touch** become one (09:00–14:00 plus
 * 14:00–20:00 is 09:00–20:00), and the result comes out sorted. Run on every
 * save so the server never sees two bands that are really the same one.
 */
export function mergeBands(bands: Band[]): Band[] {
  const sorted = [...bands].sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
  const out: Band[] = [];
  for (const band of sorted) {
    const last = out[out.length - 1];
    if (last && toMinutes(band.start) <= toMinutes(last.end)) {
      if (toMinutes(band.end) > toMinutes(last.end)) last.end = band.end;
    } else {
      out.push({ ...band });
    }
  }
  return out;
}

/** «09:00 – 14:00 · 16:00 – 20:00», with the app's long dash and middot. */
export function bandsSummary(bands: Band[]): string {
  return bands.map((band) => `${band.start} – ${band.end}`).join(' · ');
}

/** The whole opening stretch of a day, which is what a new band starts as. */
export function wholeDay(grid: string[], slotMinutes: number): Band | null {
  const starts = startOptions(grid);
  if (starts.length === 0) return null;
  return { start: starts[0], end: addMinutes(starts[starts.length - 1], slotMinutes) };
}

export type BandsByDay = Partial<Record<WeekdayName, Band[]>>;

/** Groups the flat list the API speaks into one list per weekday. */
export function groupWindows(windows: ServiceTimeWindow[] | undefined): BandsByDay {
  const out: BandsByDay = {};
  for (const window of windows ?? []) {
    const day = window.dayOfWeek;
    if (!WEEK.includes(day)) continue;
    (out[day] ??= []).push({ start: hhmm(window.startTime), end: hhmm(window.endTime) });
  }
  for (const day of WEEK) if (out[day]) out[day] = mergeBands(out[day]!);
  return out;
}

/** Back to the flat list, in week order, ready for `timeWindows`. */
export function flattenBands(bands: BandsByDay): ServiceTimeWindow[] {
  const out: ServiceTimeWindow[] = [];
  for (const day of WEEK) {
    for (const band of mergeBands(bands[day] ?? [])) {
      out.push({ dayOfWeek: day, startTime: hhmmss(band.start), endTime: hhmmss(band.end) });
    }
  }
  return out;
}

/** The days the shop actually opens, straight from the slot grid. */
export function openDays(grid: SlotGrid): WeekdayName[] {
  return WEEK.filter((day) => (grid[day]?.length ?? 0) > 0);
}
