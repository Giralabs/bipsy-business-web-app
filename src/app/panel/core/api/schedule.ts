import { ScheduleEntry, WeekdayName } from './models';

/**
 * El horario en la frontera con la API.
 *
 * El backend habla `java.time`: `dayOfWeek` por nombre («MONDAY») y las horas
 * como «09:00:00». El panel pinta 1 = lunes … 7 = domingo y «09:00», igual que
 * `ScheduleEntryResponse.fromJson` en `gipsi_api`. Todo lo que entra o sale de
 * `/schedules/me` y `/workers/{id}/schedule` pasa por aquí.
 *
 * Mandar el número no vale: Jackson lee un entero como la POSICIÓN del enum
 * (0 = MONDAY), así que un «1» guardaba el lunes como martes.
 */
const NAMES: WeekdayName[] = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

interface RawEntry {
  id?: number;
  dayOfWeek: number | string;
  startTime: string;
  endTime: string;
}

function dayToInt(value: number | string): number {
  if (typeof value === 'number') return value;
  const index = NAMES.indexOf(value.toUpperCase() as WeekdayName);
  return index >= 0 ? index + 1 : 1;
}

const hhmm = (value: string): string => (value ?? '').slice(0, 5);

export function scheduleFromApi(raw: RawEntry[] | null | undefined): ScheduleEntry[] {
  return (raw ?? []).map((entry) => ({
    id: entry.id,
    dayOfWeek: dayToInt(entry.dayOfWeek),
    startTime: hhmm(entry.startTime),
    endTime: hhmm(entry.endTime),
  }));
}

export function scheduleToApi(entries: ScheduleEntry[]): { entries: RawEntry[] } {
  return {
    entries: entries.map((entry) => ({
      dayOfWeek: NAMES[entry.dayOfWeek - 1],
      startTime: `${hhmm(entry.startTime)}:00`,
      endTime: `${hhmm(entry.endTime)}:00`,
    })),
  };
}
