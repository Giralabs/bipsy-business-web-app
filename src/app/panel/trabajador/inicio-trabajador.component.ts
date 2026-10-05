import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AgendaState, BookingResponse } from '../core/api/models';
import { STATE_LOOK, isAtHome, stateOf, whoAttends } from '../core/agenda/booking-state';
import { AuthService } from '../core/auth/auth.service';
import { AgendaStore } from '../core/data/agenda.store';
import { MyWorkStore } from '../core/data/my-work.store';
import { message } from '../core/data/resource';
import { fromInstant, hhmm, isoWeekday, longDate, relativeDay, toDate } from '../core/util/dates';
import { plural } from '../core/util/format';
import { PnEmptyComponent, PnSwitchComponent } from '../ui/controls';
import { PnDeskHeroComponent } from '../ui/desk-hero.component';
import { ToastService } from '../ui/toast.service';

/**
 * `/panel` para un trabajador — `worker_home.dart`, con sitio de escritorio:
 * su día, lo que tiene por confirmar, el fichaje a un clic y si está
 * disponible para que le reserven. Todo sale de endpoints de trabajador
 * (`/bookings/me/worker`, `/timeclock/me/open`, `/absences/me`).
 */
@Component({
  selector: 'app-inicio-trabajador',
  standalone: true,
  imports: [RouterLink, PnEmptyComponent, PnSwitchComponent, PnDeskHeroComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="pn-main">
      <pn-desk-hero [greet]="greeting() + ' · ' + todayLabel" [title]="firstName()" [line]="summary()">
        @if (auth.businessName()) {
          <span class="pn-count wk-biz">
            <span class="material-symbols-rounded">storefront</span>{{ auth.businessName() }}
          </span>
        }
        @if (agenda.pendingCount() > 0) {
          <a class="pn-count pn-count--warn" routerLink="/panel/agenda" [queryParams]="{ vista: 'pendientes' }">
            <span class="material-symbols-rounded">notifications_active</span>
            {{ count(agenda.pendingCount(), 'por confirmar', 'por confirmar') }}
          </a>
        }
      </pn-desk-hero>

      @if (auth.profile()?.available === false) {
        <div class="pn-notice pn-notice--warn wk-off">
          <span class="material-symbols-rounded">do_not_disturb_on</span>
          <div>
            <strong>No estás disponible</strong>
            <span class="pn-notice__body">Mientras lo tengas así no te entrarán reservas nuevas.</span>
          </div>
          <button type="button" class="pn-btn pn-btn--secondary pn-btn--sm" (click)="setAvailable(true)">
            Volver a estar disponible
          </button>
        </div>
      }

      <div class="pn-grid">
        <div class="pn-col-8 wk-col">
        <!-- ----- HOY ----- -->
        <section class="pn-card pn-block">
          <div class="pn-block__head">
            <span class="material-symbols-rounded">today</span>
            <h2>Tus citas de hoy</h2>
            <a class="pn-block__more pn-btn pn-btn--text pn-btn--sm" routerLink="/panel/agenda">Abrir mi agenda</a>
          </div>

          @if (agenda.bookings.loading() && !agenda.bookings.isLoaded) {
            <div class="pn-skeleton" style="height:180px"></div>
          } @else if (today().length === 0) {
            <pn-empty icon="event_available" title="Hoy no tienes citas"
                      text="Las reservas que te asignen aparecerán aquí solas." />
          } @else {
            @for (booking of today(); track booking.id) {
              <a class="wk-next" routerLink="/panel/agenda" [class.wk-next--past]="isPast(booking)">
                <span class="wk-next__bar" [style.background]="look[state(booking)].color"></span>
                <span class="wk-next__time pn-tabular">{{ hhmm(toDate(booking.startDateTime)) }}</span>
                <span class="wk-next__main">
                  <span class="wk-next__name">{{ who(booking) }}</span>
                  <span class="wk-next__service">
                    {{ booking.serviceName }}@if (atHome(booking)) { · A domicilio }
                  </span>
                </span>
                <span class="wk-next__state">{{ look[state(booking)].label }}</span>
              </a>
            }
          }
        </section>

        <!-- ----- POR CONFIRMAR ----- -->
        @if (agenda.pending().length > 0) {
          <section class="pn-card pn-block">
            <div class="pn-block__head">
              <span class="material-symbols-rounded">notifications_active</span>
              <h2>Por confirmar</h2>
            </div>
            @for (booking of agenda.pending().slice(0, 5); track booking.id) {
              <div class="wk-pending">
                <div class="wk-pending__main">
                  <p class="wk-pending__name">{{ who(booking) }}</p>
                  <p class="wk-pending__meta">
                    {{ relativeDay(toDate(booking.startDateTime)) }} · {{ hhmm(toDate(booking.startDateTime)) }}
                    · {{ booking.serviceName }}
                  </p>
                </div>
                <button type="button" class="pn-btn pn-btn--primary pn-btn--sm" (click)="confirm(booking)">
                  Confirmar
                </button>
              </div>
            }
          </section>
        }

        <!-- ----- PRÓXIMOS DÍAS ----- -->
        <section class="pn-card pn-block">
          <div class="pn-block__head">
            <span class="material-symbols-rounded">date_range</span>
            <h2>Próximos días</h2>
          </div>
          @if (upcoming().length === 0) {
            <p class="pn-dim">Nada más en la agenda por ahora.</p>
          } @else {
            @for (booking of upcoming(); track booking.id) {
              <div class="wk-up">
                <span class="wk-up__day">{{ relativeDay(toDate(booking.startDateTime)) }}</span>
                <span class="wk-up__time pn-tabular">{{ hhmm(toDate(booking.startDateTime)) }}</span>
                <span class="wk-up__main">{{ who(booking) }} · {{ booking.serviceName }}</span>
              </div>
            }
          }
        </section>
        </div>

        <!-- ----- FICHAJE ----- -->
        <div class="pn-col-4 wk-side">
          @if (auth.clockInEnabled()) {
            <section class="pn-card wk-clock" [class.wk-clock--on]="work.clockedIn()">
              <span class="wk-clock__state">
                <span class="wk-clock__dot"></span>
                {{ work.clockedIn() ? 'Turno en curso' : 'Fuera de turno' }}
              </span>
              @if (work.openClock.value(); as open) {
                <p class="wk-clock__time pn-tabular">{{ elapsed(open.checkInAt) }}</p>
                <p class="wk-clock__since">Entrada a las {{ hhmm(fromInstant(open.checkInAt)) }}</p>
              } @else {
                <p class="wk-clock__time wk-clock__time--idle pn-tabular">{{ hhmm(now()) }}</p>
                <p class="wk-clock__since">Ficha al empezar tu turno</p>
              }
              <button type="button" class="pn-btn pn-btn--block"
                      [class.pn-btn--primary]="!work.clockedIn()" [class.pn-btn--danger]="work.clockedIn()"
                      [disabled]="busy() || !work.openClock.isLoaded" (click)="toggleClock()">
                @if (busy()) {
                  <span class="pn-spinner"></span>
                } @else {
                  <span class="material-symbols-rounded">{{ work.clockedIn() ? 'logout' : 'login' }}</span>
                  {{ work.clockedIn() ? 'Fichar salida' : 'Fichar entrada' }}
                }
              </button>
              <a class="wk-clock__link" routerLink="/panel/fichar">Ver mi registro</a>
            </section>
          }

          <section class="pn-card wk-prefs">
            <div class="pn-row">
              <span class="pn-row__main">
                <span class="pn-row__title">Disponible para reservas</span>
                <span class="pn-row__sub">Si lo apagas, no te entran citas nuevas.</span>
              </span>
              <pn-switch [checked]="auth.profile()?.available !== false" label="Disponible para reservas"
                         (toggle)="setAvailable($event)" />
            </div>
            <a class="pn-row" routerLink="/panel/mis-ausencias">
              <span class="pn-row__main">
                <span class="pn-row__title">Mis ausencias</span>
                <span class="pn-row__sub">
                  @if (work.pendingAbsences().length > 0) {
                    {{ count(work.pendingAbsences().length, 'solicitud pendiente', 'solicitudes pendientes') }}
                  } @else {
                    Pide vacaciones o un día libre
                  }
                </span>
              </span>
              <span class="material-symbols-rounded pn-row__chev">arrow_forward_ios</span>
            </a>
            <a class="pn-row" routerLink="/panel/mi-horario">
              <span class="pn-row__main">
                <span class="pn-row__title">Mi horario</span>
                <span class="pn-row__sub">{{ todayHours() }}</span>
              </span>
              <span class="material-symbols-rounded pn-row__chev">arrow_forward_ios</span>
            </a>
          </section>
        </div>
      </div>
    </main>
  `,
  styles: [
    `
      :host { display: block; }
      .wk-biz { background: var(--pn-field); color: var(--clr-text-2); cursor: default; }
      .wk-off { align-items: center; margin-bottom: var(--pn-gap); }
      .wk-off > div { flex: 1; }

      .wk-next {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 11px 10px;
        margin: 0 -10px;
        border-radius: 14px;
        color: inherit;
        text-decoration: none;
        transition: background-color var(--dur-fast) ease;
      }
      .wk-next:hover { background: var(--pn-field); }
      .wk-next--past { opacity: 0.55; }
      .wk-next__bar { width: 4px; height: 34px; border-radius: 2px; flex: none; }
      .wk-next__time { width: 52px; flex: none; font-size: 1rem; font-weight: 800; }
      .wk-next__main { flex: 1; min-width: 0; }
      .wk-next__name { display: block; font-size: 0.9375rem; font-weight: 700; }
      .wk-next__service { display: block; font-size: 0.8125rem; color: var(--clr-text-3); }
      .wk-next__state { font-size: 0.75rem; font-weight: 700; color: var(--clr-text-3); }

      .wk-col, .wk-side { display: flex; flex-direction: column; gap: var(--pn-gap); }

      .wk-clock { display: flex; flex-direction: column; align-items: center; text-align: center; position: relative; overflow: hidden; }
      .wk-clock::before {
        content: '';
        position: absolute;
        inset: -30% 0 auto;
        height: 100%;
        background: radial-gradient(closest-side, rgba(95, 185, 138, 0.2), transparent);
        opacity: 0;
        transition: opacity var(--dur-slow) ease;
        pointer-events: none;
      }
      .wk-clock--on::before { opacity: 1; }
      .wk-clock__state {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 6px 12px;
        border-radius: var(--r-pill);
        background: var(--pn-field);
        font-size: 0.75rem;
        font-weight: 800;
      }
      .wk-clock__dot { width: 7px; height: 7px; border-radius: 50%; background: var(--clr-text-3); }
      .wk-clock--on .wk-clock__dot { background: var(--clr-success); box-shadow: 0 0 0 4px rgba(95, 185, 138, 0.25); }
      .wk-clock__time {
        position: relative;
        margin-top: 14px;
        font-family: var(--ff-display);
        font-size: 2.75rem;
        font-weight: 800;
        letter-spacing: -1.6px;
        line-height: 1;
      }
      .wk-clock__time--idle { color: var(--clr-text-3); }
      .wk-clock__since { margin: 8px 0 18px; font-size: 0.875rem; color: var(--clr-text-2); }
      .wk-clock__link { margin-top: 12px; font-size: 0.8125rem; font-weight: 700; color: var(--clr-text-2); }

      .wk-prefs { padding: 6px 0; overflow: hidden; }

      .wk-pending { display: flex; align-items: center; gap: 14px; padding: 12px 0; }
      .wk-pending + .wk-pending { border-top: 1px solid var(--pn-line); }
      .wk-pending__main { flex: 1; min-width: 0; }
      .wk-pending__name { font-size: 0.9375rem; font-weight: 700; }
      .wk-pending__meta { margin-top: 3px; font-size: 0.8125rem; color: var(--clr-text-3); }

      .wk-up { display: flex; align-items: baseline; gap: 12px; padding: 9px 0; font-size: 0.875rem; }
      .wk-up + .wk-up { border-top: 1px solid var(--pn-line); }
      .wk-up__day { width: 150px; flex: none; font-weight: 700; }
      .wk-up__time { width: 48px; flex: none; color: var(--clr-text-2); font-weight: 700; }
      .wk-up__main { flex: 1; min-width: 0; color: var(--clr-text-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      @media (max-width: 560px) { .wk-up__day { width: 90px; } }
    `,
  ],
})
export class InicioTrabajadorComponent {
  readonly auth = inject(AuthService);
  readonly agenda = inject(AgendaStore);
  readonly work = inject(MyWorkStore);
  private readonly toasts = inject(ToastService);

  readonly hhmm = hhmm;
  readonly toDate = toDate;
  readonly fromInstant = fromInstant;
  readonly relativeDay = relativeDay;
  readonly look = STATE_LOOK;
  /** Who shows up, which may not be the account that booked. */
  readonly who = whoAttends;
  readonly atHome = isAtHome;
  readonly todayLabel = longDate(new Date());

  readonly now = signal(new Date());
  readonly busy = signal(false);

  constructor() {
    void this.agenda.load();
    void this.work.absences.load();
    if (this.auth.clockInEnabled()) void this.work.openClock.load();
    const timer = setInterval(() => this.now.set(new Date()), 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  readonly firstName = computed(() => (this.auth.user()?.name ?? '').split(' ')[0] || 'Hola');

  readonly greeting = computed(() => {
    const hour = this.now().getHours();
    if (hour < 6) return 'Buenas noches';
    if (hour < 14) return 'Buenos días';
    if (hour < 21) return 'Buenas tardes';
    return 'Buenas noches';
  });

  readonly today = this.agenda.today;

  readonly summary = computed(() => {
    const left = this.today().filter((b) => !this.isPast(b)).length;
    if (this.today().length === 0) return 'Hoy no tienes citas asignadas.';
    if (left === 0) return `Has terminado: ${plural(this.today().length, 'cita', 'citas')} hoy.`;
    return `Te ${left === 1 ? 'queda 1 cita' : `quedan ${left} citas`} hoy.`;
  });

  readonly upcoming = computed(() => {
    const tomorrow = new Date();
    tomorrow.setHours(24, 0, 0, 0);
    return this.agenda
      .all()
      .filter((b) => b.status !== 'CANCELED' && toDate(b.startDateTime) >= tomorrow)
      .sort((a, b) => a.startDateTime.localeCompare(b.startDateTime))
      .slice(0, 6);
  });

  readonly todayHours = computed(() => {
    const entries = this.agenda.hoursOf(isoWeekday(new Date()));
    if (entries.length === 0) return 'Hoy no trabajas';
    return 'Hoy ' + entries.map((e) => `${e.startTime}–${e.endTime}`).join(' · ');
  });

  state(booking: BookingResponse): AgendaState {
    return stateOf(booking);
  }

  isPast(booking: BookingResponse): boolean {
    return toDate(booking.endDateTime) < this.now();
  }

  count(n: number, one: string, many: string): string {
    return plural(n, one, many);
  }

  elapsed(from: string): string {
    const seconds = Math.max(0, Math.floor((this.now().getTime() - fromInstant(from).getTime()) / 1000));
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor((seconds % 3600) / 60))}:${pad(seconds % 60)}`;
  }

  async toggleClock(): Promise<void> {
    if (this.busy()) return;
    const leaving = this.work.clockedIn();
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

  async setAvailable(value: boolean): Promise<void> {
    try {
      await this.work.updateSettings({ available: value });
      this.toasts.show(value ? 'Vuelves a estar disponible' : 'Ya no te entran reservas nuevas');
    } catch {
      this.toasts.error('No se ha podido guardar. Inténtalo otra vez.');
    }
  }

  async confirm(booking: BookingResponse): Promise<void> {
    try {
      await this.agenda.confirm(booking.id);
      this.toasts.show('Cita confirmada');
    } catch {
      this.toasts.error('No se ha podido confirmar la reserva.');
    }
  }
}
