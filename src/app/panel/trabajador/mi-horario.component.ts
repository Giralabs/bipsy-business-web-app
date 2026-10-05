import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AgendaStore } from '../core/data/agenda.store';
import { WEEKDAYS, isoWeekday, parseHhmm } from '../core/util/dates';

/**
 * `/panel/mi-horario` — `my_schedule_screen.dart`: la semana de trabajo, de
 * solo lectura. El horario de un trabajador lo decide el negocio desde Equipo,
 * así que aquí se mira, no se toca.
 */
@Component({
  selector: 'app-mi-horario',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="pn-main">
      <div class="pn-head">
        <div class="pn-head__text">
          <p class="pn-head__greet">Tu horario semanal de trabajo.</p>
          <h1>Mi horario</h1>
        </div>
        <div class="pn-head__actions">
          <span class="pn-status pn-status--grey"><span class="material-symbols-rounded">lock</span>Solo lectura</span>
        </div>
      </div>

      @if (agenda.schedule.loading() && !agenda.schedule.isLoaded) {
        <div class="pn-skeleton" style="height:420px"></div>
      } @else {
        <section class="pn-card wk">
          <div class="wk__scale" aria-hidden="true">
            @for (hour of scale(); track hour) {
              <span [style.left.%]="pos(hour * 60)">{{ hour }}:00</span>
            }
          </div>

          @for (day of days(); track day.index) {
            <div class="wk__row" [class.wk__row--today]="day.index === today">
              <span class="wk__name">
                {{ day.name }}
                @if (day.index === today) { <span class="wk__today">Hoy</span> }
              </span>
              <span class="wk__track">
                @for (range of day.ranges; track range.startTime) {
                  <span class="wk__bar" [style.left.%]="pos(parse(range.startTime))"
                        [style.width.%]="pos(parse(range.endTime)) - pos(parse(range.startTime))">
                    {{ range.startTime }} – {{ range.endTime }}
                  </span>
                } @empty {
                  <span class="wk__off">Libre</span>
                }
              </span>
              <span class="wk__total pn-tabular">{{ day.total }}</span>
            </div>
          }

          <p class="wk__foot">
            <span class="material-symbols-rounded">info</span>
            <span>
              Tu horario lo gestiona el negocio. Si necesitas cambios, ponte en contacto con tu responsable.
              Para días sueltos o vacaciones, <a routerLink="/panel/mis-ausencias">solicita una ausencia</a>.
            </span>
          </p>
        </section>
      }
    </main>
  `,
  styles: [
    `
      :host { display: block; }
      .wk { padding: 26px 28px; }
      .wk__scale { position: relative; height: 20px; margin: 0 90px 6px 130px; }
      .wk__scale span {
        position: absolute;
        translate: -50% 0;
        font-size: 0.6875rem;
        font-weight: 700;
        color: var(--clr-text-3);
      }
      .wk__row { display: flex; align-items: center; gap: 0; padding: 10px 0; }
      .wk__row + .wk__row { border-top: 1px solid var(--pn-line); }
      .wk__name { width: 130px; flex: none; font-size: 0.9375rem; font-weight: 700; text-transform: capitalize; }
      .wk__today {
        margin-left: 6px;
        padding: 2px 8px;
        border-radius: var(--r-pill);
        background: var(--pn-accent);
        color: var(--pn-on-accent);
        font-size: 0.6875rem;
        font-weight: 800;
        text-transform: none;
      }
      .wk__track {
        position: relative;
        flex: 1;
        height: 38px;
        border-radius: 12px;
        background: var(--pn-field);
      }
      .wk__bar {
        position: absolute;
        top: 4px;
        bottom: 4px;
        display: grid;
        place-items: center;
        min-width: 64px;
        padding: 0 8px;
        border-radius: 9px;
        background: var(--pn-accent);
        color: var(--pn-on-accent);
        font-size: 0.75rem;
        font-weight: 800;
        white-space: nowrap;
        overflow: hidden;
        font-variant-numeric: tabular-nums;
      }
      .wk__off { position: absolute; inset: 0; display: grid; place-items: center; font-size: 0.8125rem; color: var(--clr-text-3); }
      .wk__total { width: 90px; flex: none; text-align: right; font-size: 0.875rem; font-weight: 700; color: var(--clr-text-2); }
      .wk__foot {
        display: flex;
        gap: 10px;
        margin-top: 20px;
        padding-top: 18px;
        border-top: 1px solid var(--pn-line);
        font-size: 0.875rem;
        line-height: 1.55;
        color: var(--clr-text-2);
      }
      .wk__foot .material-symbols-rounded { font-size: 19px; color: var(--clr-text-3); }
      .wk__foot a { color: var(--clr-text); font-weight: 700; }

      @media (max-width: 720px) {
        .wk { padding: 18px; }
        .wk__scale { display: none; }
        .wk__row { flex-wrap: wrap; gap: 8px; }
        .wk__name { width: auto; flex: 1; }
        .wk__track { order: 3; flex-basis: 100%; }
      }
    `,
  ],
})
export class MiHorarioComponent {
  readonly agenda = inject(AgendaStore);
  readonly today = isoWeekday(new Date());
  readonly parse = parseHhmm;

  constructor() {
    void this.agenda.schedule.load();
  }

  /** The visible window: from the earliest start to the latest end, whole hours. */
  private readonly window = computed(() => {
    const entries = this.agenda.schedule.value();
    if (entries.length === 0) return { from: 8 * 60, to: 21 * 60 };
    const from = Math.min(...entries.map((e) => parseHhmm(e.startTime)));
    const to = Math.max(...entries.map((e) => parseHhmm(e.endTime)));
    return { from: Math.floor(from / 60) * 60, to: Math.ceil(to / 60) * 60 };
  });

  readonly scale = computed(() => {
    const { from, to } = this.window();
    const step = to - from > 10 * 60 ? 2 : 1;
    const hours: number[] = [];
    for (let h = from / 60; h <= to / 60; h += step) hours.push(h);
    return hours;
  });

  pos(minute: number): number {
    const { from, to } = this.window();
    return ((minute - from) / Math.max(60, to - from)) * 100;
  }

  readonly days = computed(() =>
    WEEKDAYS.map((name, i) => {
      const ranges = this.agenda
        .hoursOf(i + 1)
        .slice()
        .sort((a, b) => a.startTime.localeCompare(b.startTime));
      const minutes = ranges.reduce((sum, r) => sum + parseHhmm(r.endTime) - parseHhmm(r.startTime), 0);
      const hours = Math.floor(minutes / 60);
      const rest = minutes % 60;
      return {
        index: i + 1,
        name,
        ranges,
        total: minutes === 0 ? '—' : rest ? `${hours} h ${rest} min` : `${hours} h`,
      };
    }),
  );
}
