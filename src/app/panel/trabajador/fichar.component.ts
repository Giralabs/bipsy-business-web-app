import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { ClockEntry } from '../core/api/models';
import { MyWorkStore } from '../core/data/my-work.store';
import { message } from '../core/data/resource';
import { dayKey, fromInstant, hhmm, longDate, relativeDay } from '../core/util/dates';
import { plural } from '../core/util/format';
import { PnEmptyComponent } from '../ui/controls';
import { ConfirmService } from '../ui/confirm.service';
import { ToastService } from '../ui/toast.service';

interface DayGroup {
  key: string;
  label: string;
  date: string;
  entries: ClockEntry[];
  minutes: number;
}

function minutesLabel(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/**
 * `/panel/fichar` — `timeclock_screen.dart`.
 *
 * Un solo botón grande que cambia según el turno: «Fichar entrada» o «Fichar
 * salida», con el cronómetro corriendo mientras dura. Debajo, lo trabajado
 * hoy y en el mes, y el registro día a día. Los fichajes son instantes reales
 * (UTC), por eso todo pasa por `fromInstant`.
 */
@Component({
  selector: 'app-fichar',
  standalone: true,
  imports: [PnEmptyComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="pn-main">
      <div class="pn-head">
        <div class="pn-head__text">
          <p class="pn-head__greet">{{ todayLabel }}</p>
          <h1>Fichar</h1>
        </div>
      </div>

      <section class="clock" [class.clock--on]="work.clockedIn()">
        <div class="clock__state">
          <span class="clock__dot" aria-hidden="true"></span>
          {{ work.clockedIn() ? 'Turno en curso' : 'Fuera de turno' }}
        </div>

        @if (work.openClock.loading() && !work.openClock.isLoaded) {
          <div class="pn-skeleton clock__skeleton"></div>
        } @else if (work.openClock.value()) {
          <p class="clock__timer pn-tabular" aria-live="off">{{ running(work.openClock.value()!.checkInAt) }}</p>
          <p class="clock__since">Entrada a las {{ hhmm(toDate(work.openClock.value()!.checkInAt)) }}</p>
        } @else {
          <p class="clock__timer clock__timer--idle pn-tabular">{{ nowLabel() }}</p>
          <p class="clock__since">
            @if (todayMinutes() > 0) {
              Hoy llevas {{ minutes(todayMinutes()) }}
            } @else {
              Todavía no has fichado hoy
            }
          </p>
        }

        @if (work.openClock.error(); as problem) {
          <p class="pn-field__error">No se ha podido cargar el estado del fichaje. {{ problem }}</p>
        }

        <button type="button" class="pn-btn pn-btn--lg clock__cta"
                [class.pn-btn--primary]="!work.clockedIn()" [class.pn-btn--danger]="work.clockedIn()"
                [disabled]="busy() || !work.openClock.isLoaded" (click)="toggle()">
          @if (busy()) {
            <span class="pn-spinner"></span>
          } @else {
            <span class="material-symbols-rounded">{{ work.clockedIn() ? 'logout' : 'login' }}</span>
            {{ work.clockedIn() ? 'Fichar salida' : 'Fichar entrada' }}
          }
        </button>
      </section>

      <div class="pn-grid sum">
        <div class="pn-card pn-col-4 pn-kpi">
          <span class="pn-kpi__value pn-tabular">{{ minutes(todayMinutes()) }}</span>
          <span class="pn-kpi__label">HOY</span>
        </div>
        <div class="pn-card pn-col-4 pn-kpi">
          <span class="pn-kpi__value pn-tabular">{{ minutes(weekMinutes()) }}</span>
          <span class="pn-kpi__label">ESTA SEMANA</span>
        </div>
        <div class="pn-card pn-col-4 pn-kpi">
          <span class="pn-kpi__value pn-tabular">{{ minutes(monthMinutes()) }}</span>
          <span class="pn-kpi__label">ESTE MES · {{ monthDays() }}</span>
        </div>
      </div>

      <section class="pn-card">
        <div class="pn-block__head">
          <span class="material-symbols-rounded">history</span>
          <h2>Registro de fichajes</h2>
        </div>

        @if (work.clockHistory.error(); as problem) {
          <p class="pn-field__error">No se pudieron cargar los fichajes. {{ problem }}</p>
        } @else if (days().length === 0) {
          <pn-empty icon="history_toggle_off" title="Sin jornadas registradas"
                    text="Aquí aparecerán tus fichajes anteriores." />
        } @else {
          @for (day of days(); track day.key) {
            <div class="day">
              <div class="day__head">
                <span class="day__label">{{ day.label }}</span>
                <span class="day__date pn-muted">{{ day.date }}</span>
                <span class="day__total pn-tabular">{{ minutes(day.minutes) }}</span>
              </div>
              @for (entry of day.entries; track entry.id) {
                <div class="entry">
                  <span class="material-symbols-rounded entry__icon">schedule</span>
                  <span class="entry__times pn-tabular">
                    {{ hhmm(toDate(entry.checkInAt)) }} →
                    @if (entry.checkOutAt) { {{ hhmm(toDate(entry.checkOutAt)) }} } @else { <em>en curso</em> }
                  </span>
                  <span class="entry__dur pn-tabular">{{ minutes(minutesOf(entry)) }}</span>
                </div>
              }
            </div>
          }
        }
      </section>
    </main>
  `,
  styles: [
    `
      :host { display: block; }

      .clock {
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        padding: 40px 24px 34px;
        border-radius: var(--pn-radius-card);
        background: var(--pn-card);
        box-shadow: var(--pn-rim);
        overflow: hidden;
        isolation: isolate;
      }
      /* Una luz verde que respira detrás del cronómetro mientras dura el turno. */
      .clock::before {
        content: '';
        position: absolute;
        inset: -40% 20% auto;
        height: 120%;
        z-index: -1;
        border-radius: 50%;
        background: radial-gradient(closest-side, rgba(95, 185, 138, 0.22), transparent);
        opacity: 0;
        transition: opacity var(--dur-slow) ease;
      }
      .clock--on::before { opacity: 1; animation: glow 4s ease-in-out infinite; }
      @keyframes glow { 50% { transform: scale(1.08); opacity: 0.7; } }

      .clock__state {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 7px 14px;
        border-radius: var(--r-pill);
        background: var(--pn-field);
        font-size: 0.8125rem;
        font-weight: 800;
      }
      .clock__dot { width: 8px; height: 8px; border-radius: 50%; background: var(--clr-text-3); }
      .clock--on .clock__dot { background: var(--clr-success); box-shadow: 0 0 0 4px rgba(95, 185, 138, 0.25); }

      .clock__timer {
        margin-top: 22px;
        font-family: var(--ff-display);
        font-size: clamp(3.5rem, 9vw, 6rem);
        font-weight: 800;
        letter-spacing: -3px;
        line-height: 1;
      }
      .clock__timer--idle { color: var(--clr-text-3); }
      .clock__since { margin-top: 12px; font-size: 0.9375rem; color: var(--clr-text-2); }
      .clock__skeleton { width: 280px; height: 96px; margin-top: 22px; }
      .clock__cta { margin-top: 28px; min-width: 260px; }

      .sum { margin: var(--pn-gap) 0; }
      .sum .pn-kpi__value { font-size: clamp(1.625rem, 2.4vw, 2.125rem); }

      .day + .day { margin-top: 18px; padding-top: 14px; border-top: 1px solid var(--pn-line); }
      .day__head { display: flex; align-items: baseline; gap: 10px; padding: 4px 0 8px; }
      .day__label { font-size: 0.9375rem; font-weight: 700; }
      .day__date { font-size: 0.8125rem; }
      .day__total { margin-left: auto; font-size: 0.875rem; font-weight: 700; }
      .entry { display: flex; align-items: center; gap: 12px; padding: 8px 12px; border-radius: var(--pn-radius-row); }
      .entry:nth-child(odd) { background: var(--pn-field); }
      .entry__icon { font-size: 18px; color: var(--clr-text-3); }
      .entry__times { flex: 1; font-size: 0.875rem; color: var(--clr-text-2); }
      .entry__times em { font-style: normal; color: var(--clr-success); font-weight: 700; }
      .entry__dur { font-size: 0.875rem; font-weight: 700; }

      @media (prefers-reduced-motion: reduce) { .clock--on::before { animation: none; } }
    `,
  ],
})
export class FicharComponent {
  readonly work = inject(MyWorkStore);
  private readonly toasts = inject(ToastService);
  private readonly confirm = inject(ConfirmService);

  readonly hhmm = hhmm;
  readonly toDate = fromInstant;
  readonly minutes = minutesLabel;
  readonly todayLabel = longDate(new Date());

  readonly now = signal(new Date());
  readonly busy = signal(false);

  constructor() {
    void this.work.openClock.load();
    void this.work.clockHistory.load();
    const timer = setInterval(() => this.now.set(new Date()), 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  readonly nowLabel = computed(() => hhmm(this.now()));

  /** «02:14:09» — el turno abierto, al segundo. */
  running(from: string): string {
    const seconds = Math.max(0, Math.floor((this.now().getTime() - fromInstant(from).getTime()) / 1000));
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor((seconds % 3600) / 60))}:${pad(seconds % 60)}`;
  }

  minutesOf(entry: ClockEntry): number {
    const end = entry.checkOutAt ? fromInstant(entry.checkOutAt) : this.now();
    return Math.max(0, Math.round((end.getTime() - fromInstant(entry.checkInAt).getTime()) / 60_000));
  }

  /** The history plus the open shift, which the history may not list yet. */
  private readonly entries = computed(() => {
    const history = this.work.clockHistory.value();
    const open = this.work.openClock.value();
    return open && !history.some((entry) => entry.id === open.id) ? [open, ...history] : history;
  });

  private sumSince(from: Date): number {
    return this.entries()
      .filter((entry) => fromInstant(entry.checkInAt) >= from)
      .reduce((sum, entry) => sum + this.minutesOf(entry), 0);
  }

  readonly todayMinutes = computed(() => {
    const start = new Date(this.now());
    start.setHours(0, 0, 0, 0);
    return this.sumSince(start);
  });

  readonly weekMinutes = computed(() => {
    const start = new Date(this.now());
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    return this.sumSince(start);
  });

  private readonly monthStart = computed(() => {
    const now = this.now();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  readonly monthMinutes = computed(() => this.sumSince(this.monthStart()));

  readonly monthDays = computed(() => {
    const start = this.monthStart();
    const days = new Set(
      this.entries()
        .filter((entry) => fromInstant(entry.checkInAt) >= start)
        .map((entry) => dayKey(fromInstant(entry.checkInAt))),
    );
    return plural(days.size, 'jornada', 'jornadas').toUpperCase();
  });

  readonly days = computed<DayGroup[]>(() => {
    const groups = new Map<string, ClockEntry[]>();
    for (const entry of this.entries()) {
      const key = dayKey(fromInstant(entry.checkInAt));
      groups.set(key, [...(groups.get(key) ?? []), entry]);
    }
    return [...groups.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 31)
      .map(([key, entries]) => {
        const date = new Date(`${key}T00:00:00`);
        const label = relativeDay(date);
        return {
          key,
          label,
          // «Hoy · Martes 22 de septiembre», but never the same date twice.
          date: label === longDate(date) ? '' : longDate(date),
          entries: [...entries].sort((a, b) => a.checkInAt.localeCompare(b.checkInAt)),
          minutes: entries.reduce((sum, entry) => sum + this.minutesOf(entry), 0),
        };
      });
  });

  async toggle(): Promise<void> {
    if (this.busy()) return;
    const leaving = this.work.clockedIn();
    if (leaving) {
      const answer = await this.confirm.ask({
        title: '¿Fichar salida?',
        message: `Cierras un turno de ${minutesLabel(this.minutesOf(this.work.openClock.value()!))}.`,
        confirmLabel: 'Fichar salida',
      });
      if (!answer.ok) return;
    }
    this.busy.set(true);
    try {
      if (leaving) await this.work.checkOut();
      else await this.work.checkIn();
      this.toasts.show(leaving ? 'Salida fichada' : 'Entrada fichada');
    } catch (cause) {
      this.toasts.error(`No se ha podido fichar. ${message(cause)}`);
    } finally {
      this.busy.set(false);
    }
  }
}
