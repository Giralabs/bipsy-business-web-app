/**
 * Dates, in Spanish and without surprises.
 *
 * The API speaks ISO-8601 **without a zone** (`2026-09-18T10:30:00`). Handing
 * that to `new Date()` is right here — the browser reads it as local time,
 * which is exactly what "half past ten at the shop" means — but only if nobody
 * ever appends a `Z`. Every conversion goes through `toDate`/`toIso` so that
 * rule lives in one place.
 */

export const WEEKDAYS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
export const WEEKDAYS_SHORT = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
export const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

export function toDate(value: string): Date {
  return new Date(value.endsWith('Z') ? value.slice(0, -1) : value);
}

/**
 * A real instant (`java.time.Instant`, «…T08:30:00Z»), like the time clock
 * sends. Unlike the wall-clock times of an appointment, here the `Z` means
 * UTC and has to be honoured: dropping it put every clock-in two hours early
 * in Spanish summer time.
 */
export function fromInstant(value: string): Date {
  return new Date(value);
}

export function toIso(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:00`
  );
}

/** `yyyy-MM-dd`, the key the panel groups appointments by. */
export function dayKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function startOfDay(date: Date): Date {
  const out = new Date(date);
  out.setHours(0, 0, 0, 0);
  return out;
}

/** Monday, because the week starts on Monday here. */
export function startOfWeek(date: Date): Date {
  const out = startOfDay(date);
  const weekday = (out.getDay() + 6) % 7;
  out.setDate(out.getDate() - weekday);
  return out;
}

export function addDays(date: Date, days: number): Date {
  const out = new Date(date);
  out.setDate(out.getDate() + days);
  return out;
}

export function isSameDay(a: Date, b: Date): boolean {
  return dayKey(a) === dayKey(b);
}

export function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

/** 1 = Monday … 7 = Sunday, the numbering the schedule endpoint uses. */
export function isoWeekday(date: Date): number {
  return ((date.getDay() + 6) % 7) + 1;
}

export function hhmm(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Minutes since midnight — how the agenda grid places a card. */
export function minutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

export function parseHhmm(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

/**
 * Only the first letter goes up. CSS `text-transform: capitalize` would raise
 * the «de» too, and «Lunes 3 De Marzo» is not Spanish.
 */
function capFirst(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** «Lunes 3 de marzo» */
export function longDate(date: Date): string {
  return capFirst(`${WEEKDAYS[(date.getDay() + 6) % 7]} ${date.getDate()} de ${MONTHS[date.getMonth()]}`);
}

/** «lunes 3 de marzo, 10:30» — the subtitle of an appointment sheet. */
export function longDateTime(date: Date): string {
  return `${longDate(date)}, ${hhmm(date)}`;
}

/** «3 mar» */
export function shortDate(date: Date): string {
  return `${date.getDate()} ${MONTHS[date.getMonth()].slice(0, 3)}`;
}

/** «Hoy», «Ayer», «Mañana» or the long date, for headers that repeat. */
export function relativeDay(date: Date): string {
  const today = startOfDay(new Date());
  const diff = Math.round((startOfDay(date).getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return 'Hoy';
  if (diff === -1) return 'Ayer';
  if (diff === 1) return 'Mañana';
  return longDate(date);
}

/** «Lunes», for a column header. */
export function weekdayName(date: Date): string {
  return capFirst(WEEKDAYS[(date.getDay() + 6) % 7]);
}

/** «hace 5 min», «hace 2 h», «ayer», «3 mar» — for chat and activity lists. */
export function ago(value: string): string {
  const minutes = Math.round((Date.now() - toDate(value).getTime()) / 60_000);
  if (minutes < 1) return 'ahora';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const date = toDate(value);
  const days = Math.round(hours / 24);
  if (days === 1) return 'ayer';
  if (days < 7) return WEEKDAYS[(date.getDay() + 6) % 7];
  return shortDate(date);
}
