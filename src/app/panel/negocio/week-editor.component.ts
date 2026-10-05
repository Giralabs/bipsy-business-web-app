import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { ScheduleEntry } from '../core/api/models';
import { WEEKDAYS } from '../core/util/dates';

export interface Range {
  startTime: string;
  endTime: string;
}

/** Los siete días, cada uno con sus tramos. Índice 0 = lunes. */
export type Week = Range[][];

/**
 * El editor de horario semanal, compartido por el horario del negocio y el de
 * cada trabajador (`week_schedule_editor.dart` + `day_schedule_sheet.dart`).
 *
 * Las horas van de cuarto en cuarto, que es la rejilla que acepta la API, y
 * varios tramos por día son lo normal: el hueco entre dos tramos ES el
 * descanso, no hay que marcarlo aparte.
 */
@Component({
  selector: 'app-week-editor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './week-editor.component.html',
  styleUrl: './week-editor.component.css',
})
export class WeekEditorComponent {
  @Input({ required: true }) week: Week = [[], [], [], [], [], [], []];
  @Output() weekChange = new EventEmitter<Week>();

  readonly weekdays = WEEKDAYS;

  readonly times = Array.from({ length: 96 }, (_, index) => {
    const hours = String(Math.floor(index / 4)).padStart(2, '0');
    const minutes = String((index % 4) * 15).padStart(2, '0');
    return `${hours}:${minutes}`;
  });

  summary(index: number): string {
    const ranges = this.week[index];
    if (ranges.length === 0) return 'Cerrado';
    return ranges.map((range) => `${range.startTime} – ${range.endTime}`).join(' · ');
  }

  private emit(week: Week): void {
    this.weekChange.emit(week);
  }

  addRange(dayIndex: number): void {
    const week = this.week.map((day) => [...day]);
    const last = week[dayIndex].at(-1);
    week[dayIndex].push(
      last ? { startTime: last.endTime, endTime: '20:00' } : { startTime: '09:00', endTime: '14:00' },
    );
    this.emit(week);
  }

  removeRange(dayIndex: number, rangeIndex: number): void {
    const week = this.week.map((day) => [...day]);
    week[dayIndex].splice(rangeIndex, 1);
    this.emit(week);
  }

  setTime(dayIndex: number, rangeIndex: number, field: 'startTime' | 'endTime', value: string): void {
    const week = this.week.map((day) => day.map((range) => ({ ...range })));
    week[dayIndex][rangeIndex][field] = value;
    // Un fin antes de su principio no significa nada: se empuja un paso.
    const range = week[dayIndex][rangeIndex];
    if (range.endTime <= range.startTime) {
      range.endTime = this.times[Math.min(this.times.indexOf(range.startTime) + 1, this.times.length - 1)];
    }
    this.emit(week);
  }

  copyToAll(dayIndex: number): void {
    const source = this.week[dayIndex];
    this.emit(this.week.map((day, index) => (index === dayIndex ? day : source.map((r) => ({ ...r })))));
  }

  closeDay(dayIndex: number): void {
    const week = this.week.map((day) => [...day]);
    week[dayIndex] = [];
    this.emit(week);
  }
}

/** De lo que devuelve la API a la semana del editor. */
export function toWeek(entries: ScheduleEntry[]): Week {
  const week: Week = [[], [], [], [], [], [], []];
  for (const entry of entries) {
    const index = entry.dayOfWeek - 1;
    if (index >= 0 && index < 7) week[index].push({ startTime: entry.startTime, endTime: entry.endTime });
  }
  for (const day of week) day.sort((a, b) => a.startTime.localeCompare(b.startTime));
  return week;
}

/** Y de vuelta. */
export function toEntries(week: Week): ScheduleEntry[] {
  return week.flatMap((day, index) =>
    day.map((range) => ({ dayOfWeek: index + 1, startTime: range.startTime, endTime: range.endTime })),
  );
}

/** La semana que sugiere la app cuando no hay nada puesto. */
export function suggestedWeek(weekends = false): Week {
  const week: Week = [[], [], [], [], [], [], []];
  for (let day = 0; day < 5; day++) {
    week[day] = [
      { startTime: '09:00', endTime: '14:00' },
      { startTime: '16:00', endTime: '20:00' },
    ];
  }
  if (weekends) week[5] = [{ startTime: '09:00', endTime: '14:00' }];
  return week;
}
