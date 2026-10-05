import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';
import { SlotGrid, WeekdayName } from '../core/api/models';
import { PnSwitchComponent } from '../ui/controls';
import {
  Band,
  BandsByDay,
  DAY_LABEL,
  WEEK,
  bandsSummary,
  endOptions,
  mergeBands,
  openDays,
  startOptions,
  toMinutes,
  wholeDay,
} from './service-hours';

/**
 * «Solo a ciertas horas», the web twin of `service_hours_selector.dart` plus
 * `service_day_hours_sheet.dart`.
 *
 * The app needs two screens for this: a list of days, and a sheet per day with
 * a wheel per time. On a desk the seven days fit at once, so a day is edited
 * where it is read and there is no sheet inside a dialog — which would be the
 * third layer of modal in a row.
 *
 * The times on offer are not free text: they are the shop's own slot grid
 * (`GET /businesses/me/slot-grid`), because a band that starts at a time the
 * shop never offers is a band that does nothing.
 */
@Component({
  selector: 'pn-service-hours',
  standalone: true,
  imports: [PnSwitchComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="sh">
      <div class="sh__head">
        <span class="sh__main">
          <span class="sh__title">Solo a ciertas horas</span>
          <span class="sh__sub">
            @if (enabled) {
              Elige, día a día, en qué horas se puede reservar este servicio.
            } @else {
              Para las citas que solo quieres a un momento concreto del día.
            }
          </span>
        </span>
        <pn-switch [checked]="enabled" label="Solo a ciertas horas" (toggle)="enabledChange.emit($event)" />
      </div>

      @if (enabled) {
        @if (!hasGrid()) {
          <p class="sh__warn">No se han podido cargar tus horas.</p>
        } @else {
          <div class="sh__days">
            @for (day of week; track day) {
              <div class="sh__day" [class.sh__day--closed]="isClosed(day)">
                <div class="sh__day-head">
                  <span class="sh__day-name">{{ label(day) }}</span>
                  @if (isClosed(day)) {
                    <span class="sh__day-value">Cerrado</span>
                  } @else if (bandsOf(day).length === 0) {
                    <span class="sh__day-value sh__day-value--none">Sin horas</span>
                  } @else {
                    <span class="sh__day-value">{{ summary(day) }}</span>
                  }
                </div>

                @if (!isClosed(day)) {
                  @for (band of bandsOf(day); track $index) {
                    <div class="sh__band">
                      <select
                        class="pn-select"
                        [attr.aria-label]="'Hora de inicio, ' + label(day)"
                        [value]="band.start"
                        (change)="setStart(day, $index, asValue($event))"
                      >
                        @for (time of starts(day); track time) {
                          <option [value]="time" [selected]="time === band.start">{{ time }}</option>
                        }
                      </select>
                      <span class="sh__dash">–</span>
                      <select
                        class="pn-select"
                        [attr.aria-label]="'Hora de fin, ' + label(day)"
                        [value]="band.end"
                        (change)="setEnd(day, $index, asValue($event))"
                      >
                        @for (time of ends(day, band); track time) {
                          <option [value]="time" [selected]="time === band.end">{{ time }}</option>
                        }
                      </select>
                      <button
                        type="button"
                        class="pn-btn pn-btn--text pn-btn--sm"
                        [attr.aria-label]="'Quitar franja'"
                        (click)="removeBand(day, $index)"
                      >
                        <span class="material-symbols-rounded">close</span>
                      </button>
                    </div>
                  }

                  <div class="sh__day-actions">
                    <button type="button" class="pn-btn pn-btn--text pn-btn--sm" (click)="addBand(day)">
                      <span class="material-symbols-rounded">add</span>Añadir franja
                    </button>
                    @if (bandsOf(day).length > 0) {
                      <button type="button" class="pn-btn pn-btn--text pn-btn--sm" (click)="applyToAll(day)">
                        Poner estas franjas todos los días
                      </button>
                    }
                  </div>

                  @if (bandsOf(day).length === 0) {
                    <p class="sh__note">Sin franjas, este servicio no se ofrece ese día.</p>
                  }
                }
              </div>
            }
          </div>

          <p class="sh__foot">Los días sin franjas no se ofrecen.</p>
        }
      }
    </div>
  `,
  styles: [
    `
      :host { display: block; }
      .sh__head { display: flex; align-items: center; gap: 16px; padding: 12px 0; }
      .sh__main { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
      .sh__title { font-weight: 650; }
      .sh__sub, .sh__foot, .sh__note { font-size: 0.8125rem; color: var(--clr-text-3); }
      .sh__warn { font-size: 0.8125rem; color: var(--clr-warn-text, var(--clr-text-3)); }
      .sh__days { display: flex; flex-direction: column; gap: 4px; margin-top: 4px; }
      .sh__day { padding: 10px 0; border-top: 1px solid var(--clr-line, rgba(128,128,128,.18)); }
      .sh__day--closed { opacity: 0.55; }
      .sh__day-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
      .sh__day-name { font-weight: 600; }
      .sh__day-value { font-size: 0.8125rem; color: var(--clr-text-3); }
      .sh__day-value--none { font-style: italic; }
      .sh__band { display: flex; align-items: center; gap: 8px; margin-top: 8px; }
      .sh__band .pn-select { width: 110px; }
      .sh__dash { color: var(--clr-text-3); }
      .sh__day-actions { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
      .sh__note { margin: 6px 0 0; }
      .sh__foot { margin: 10px 0 0; }
    `,
  ],
})
export class PnServiceHoursComponent {
  /** The shop's start times per weekday, from `/businesses/me/slot-grid`. */
  @Input() grid: SlotGrid = {};
  @Input() slotMinutes = 15;
  @Input() enabled = false;
  @Input() bands: BandsByDay = {};

  @Output() enabledChange = new EventEmitter<boolean>();
  @Output() bandsChange = new EventEmitter<BandsByDay>();

  readonly week = WEEK;

  /** Recomputed on every read: the inputs are replaced, never mutated. */
  private readonly version = signal(0);

  readonly hasGrid = computed(() => {
    this.version();
    return openDays(this.grid).length > 0;
  });

  label(day: WeekdayName): string {
    return DAY_LABEL[day];
  }

  isClosed(day: WeekdayName): boolean {
    return (this.grid[day]?.length ?? 0) === 0;
  }

  bandsOf(day: WeekdayName): Band[] {
    return this.bands[day] ?? [];
  }

  summary(day: WeekdayName): string {
    return bandsSummary(this.bandsOf(day));
  }

  starts(day: WeekdayName): string[] {
    return startOptions(this.grid[day] ?? []);
  }

  ends(day: WeekdayName, band: Band): string[] {
    const options = endOptions(this.grid[day] ?? [], band.start, this.slotMinutes);
    // The stored end may predate a change of the grid; keep it selectable so
    // the value on screen is the value that will be saved.
    return options.includes(band.end) ? options : [...options, band.end].sort((a, b) => toMinutes(a) - toMinutes(b));
  }

  asValue(event: Event): string {
    return (event.target as HTMLSelectElement).value;
  }

  addBand(day: WeekdayName): void {
    const whole = wholeDay(this.grid[day] ?? [], this.slotMinutes);
    if (!whole) return;
    this.emit(day, [...this.bandsOf(day), whole]);
  }

  removeBand(day: WeekdayName, index: number): void {
    this.emit(
      day,
      this.bandsOf(day).filter((_, position) => position !== index),
    );
  }

  /** Pushing the start past the end drags the end to the first one that fits. */
  setStart(day: WeekdayName, index: number, start: string): void {
    const next = this.bandsOf(day).map((band, position) => {
      if (position !== index) return band;
      const ends = endOptions(this.grid[day] ?? [], start, this.slotMinutes);
      const end = toMinutes(band.end) > toMinutes(start) ? band.end : (ends[0] ?? band.end);
      return { start, end };
    });
    this.emit(day, next);
  }

  /** Pulling the end below the start drags the start down with it. */
  setEnd(day: WeekdayName, index: number, end: string): void {
    const starts = this.starts(day);
    const next = this.bandsOf(day).map((band, position) => {
      if (position !== index) return band;
      if (toMinutes(band.start) < toMinutes(end)) return { start: band.start, end };
      const before = starts.filter((time) => toMinutes(time) < toMinutes(end));
      return { start: before[before.length - 1] ?? band.start, end };
    });
    this.emit(day, next);
  }

  /** Copies this day's bands onto every day the shop opens, as the app does. */
  applyToAll(day: WeekdayName): void {
    const source = mergeBands(this.bandsOf(day));
    const next: BandsByDay = { ...this.bands };
    for (const other of openDays(this.grid)) next[other] = source.map((band) => ({ ...band }));
    this.bands = next;
    this.version.update((value) => value + 1);
    this.bandsChange.emit(next);
  }

  private emit(day: WeekdayName, bands: Band[]): void {
    const next: BandsByDay = { ...this.bands, [day]: mergeBands(bands) };
    this.bands = next;
    this.version.update((value) => value + 1);
    this.bandsChange.emit(next);
  }
}
