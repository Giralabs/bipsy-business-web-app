import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TeamStore } from '../core/data/team.store';
import { ClockEntry } from '../core/api/models';
import { MONTHS, dayKey, fromInstant, hhmm, longDate, relativeDay } from '../core/util/dates';
import { PnAvatarComponent, PnEmptyComponent } from '../ui/controls';

interface DayGroup {
  key: string;
  label: string;
  entries: ClockEntry[];
  minutes: number;
}

/**
 * `/panel/equipo/fichajes` — `business_timeclock_screen.dart`.
 *
 * Who is clocked in right now, then the days one under the other with what
 * each person worked. The app shows a month calendar and one day at a time;
 * a desk can show the whole month as a list, which is what gets copied into a
 * payroll.
 */
@Component({
  selector: 'app-panel-fichajes',
  standalone: true,
  imports: [RouterLink, PnAvatarComponent, PnEmptyComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './fichajes.component.html',
  styleUrl: './fichajes.component.css',
})
export class FichajesComponent {
  readonly team = inject(TeamStore);

  readonly hhmm = hhmm;
  /** Clock times are real instants (UTC), not shop wall-clock times. */
  readonly toDate = fromInstant;

  readonly now = signal(new Date());

  readonly monthLabel = computed(() => {
    const month = this.team.clockMonth();
    const label = `${MONTHS[month.getMonth()]} ${month.getFullYear()}`;
    return label.charAt(0).toUpperCase() + label.slice(1);
  });

  readonly isCurrentMonth = computed(() => {
    const month = this.team.clockMonth();
    const today = new Date();
    return month.getFullYear() === today.getFullYear() && month.getMonth() === today.getMonth();
  });

  constructor() {
    void this.team.activeClocks.load();
    void this.team.clockHistory.load();
    const timer = setInterval(() => this.now.set(new Date()), 30_000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  stepMonth(direction: -1 | 1): void {
    const month = this.team.clockMonth();
    void this.team.showClockMonth(new Date(month.getFullYear(), month.getMonth() + direction, 1));
  }

  /** Live counter of an open shift, «3 h 12 min». */
  elapsed(from: string): string {
    const minutes = Math.max(0, Math.round((this.now().getTime() - fromInstant(from).getTime()) / 60_000));
    const hours = Math.floor(minutes / 60);
    return hours > 0 ? `${hours} h ${minutes % 60} min` : `${minutes} min`;
  }

  readonly days = computed<DayGroup[]>(() => {
    const groups = new Map<string, ClockEntry[]>();
    for (const entry of this.team.clockHistory.value()) {
      const key = dayKey(fromInstant(entry.checkInAt));
      groups.set(key, [...(groups.get(key) ?? []), entry]);
    }
    return [...groups.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, entries]) => ({
        key,
        label: relativeDay(new Date(`${key}T00:00:00`)),
        entries: entries.sort((a, b) => a.checkInAt.localeCompare(b.checkInAt)),
        minutes: entries.reduce((sum, entry) => sum + this.minutesOf(entry), 0),
      }));
  });

  /** Hours per person over everything loaded — the payroll question. */
  readonly totals = computed(() => {
    const perWorker = new Map<string, number>();
    for (const entry of this.team.clockHistory.value()) {
      const name = entry.workerName ?? this.team.byId(entry.workerId)?.name ?? 'Sin nombre';
      perWorker.set(name, (perWorker.get(name) ?? 0) + this.minutesOf(entry));
    }
    return [...perWorker.entries()]
      .map(([name, minutes]) => ({ name, label: this.hoursLabel(minutes) }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  });

  minutesOf(entry: ClockEntry): number {
    const end = entry.checkOutAt ? fromInstant(entry.checkOutAt) : this.now();
    return Math.max(0, Math.round((end.getTime() - fromInstant(entry.checkInAt).getTime()) / 60_000));
  }

  hoursLabel(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
  }

  nameOf(entry: ClockEntry): string {
    return entry.workerName ?? this.team.byId(entry.workerId)?.name ?? 'Sin nombre';
  }

  dayTitle(key: string): string {
    return longDate(new Date(`${key}T00:00:00`));
  }
}
