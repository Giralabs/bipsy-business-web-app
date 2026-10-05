import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Api } from '../core/api/api';
import { BookingResponse, Closure, TimeOff } from '../core/api/models';
import { AgendaStore } from '../core/data/agenda.store';
import { message, resource } from '../core/data/resource';
import { TeamStore } from '../core/data/team.store';
import { MONTHS, addDays, dayKey, hhmm, shortDate, toDate } from '../core/util/dates';
import { PnEmptyComponent, PnErrorComponent } from '../ui/controls';
import { ConfirmService } from '../ui/confirm.service';
import { PnDialogComponent } from '../ui/dialog.component';
import { ToastService } from '../ui/toast.service';

/**
 * `/panel/ajustes/cierres` — `absences/business_closures_screen.dart`
 * (`/profile/closures` in the app), with `closure_providers.dart` inside.
 *
 * The days the SHOP does not open: a bank holiday, building work, the week in
 * August. It is not an absence — that belongs to one person and blocks only
 * their slots; this blocks everybody at once. It took the place of the owner's
 * «Mis ausencias» (`/panel/ajustes/tiempo-libre`), which only took the owner
 * out while the team kept taking bookings with the door shut.
 *
 * And here the server DOES cancel. Everywhere else, taking availability away
 * over appointments already given is refused and their owner decides; with the
 * shop closed there is nobody left to hand them to, so they are cancelled and
 * refunded. That cannot be undone, which is why the list is shown first and
 * closing over appointments asks again.
 */
@Component({
  selector: 'app-panel-cierres',
  standalone: true,
  imports: [FormsModule, RouterLink, PnEmptyComponent, PnErrorComponent, PnDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="pn-main">
      <a class="pn-btn pn-btn--text pn-btn--sm back" routerLink="/panel/ajustes">
        <span class="material-symbols-rounded">arrow_back</span>Ajustes
      </a>

      <div class="pn-head">
        <div class="pn-head__text">
          <p class="pn-head__greet">Días en que el local no abre. Nadie del equipo dará citas.</p>
          <h1>Días de cierre</h1>
        </div>
        <div class="pn-head__actions">
          <button type="button" class="pn-btn pn-btn--primary" (click)="open()">
            <span class="material-symbols-rounded">add</span>
            Cerrar unos días
          </button>
        </div>
      </div>

      @if (list.error() && !list.isLoaded) {
        <section class="pn-card">
          <pn-error [text]="list.error()!" title="No se han podido cargar tus ausencias." (retry)="list.reload()" />
        </section>
      } @else if (list.loading() && !list.isLoaded) {
        <div class="pn-skeleton" style="height:72px;margin-bottom:12px"></div>
        <div class="pn-skeleton" style="height:72px"></div>
      } @else if (list.value().length === 0) {
        <section class="pn-card">
          <pn-empty icon="event_available" title="Ningún día cerrado" text="Los días que cierres aparecerán aquí.">
            <button type="button" class="pn-btn pn-btn--primary" (click)="open()">Cerrar unos días</button>
          </pn-empty>
        </section>
      } @else {
        <section class="pn-group__body">
          @for (item of list.value(); track item.id) {
            <div class="pn-row cl" [class.cl--past]="item.endDate < today">
              <span class="cl__icon"><span class="material-symbols-rounded">event_busy</span></span>
              <span class="pn-row__main">
                <span class="pn-row__title">{{ range(item) }}</span>
                @if (item.reason?.trim()) {
                  <span class="pn-row__sub">{{ item.reason }}</span>
                }
              </span>
              @if (item.startDate <= today && item.endDate >= today) {
                <span class="pn-status pn-status--warn">Hoy</span>
              }
              <button type="button" class="pn-icon-btn pn-icon-btn--ghost" aria-label="Eliminar" title="Eliminar"
                      (click)="remove(item)">
                <span class="material-symbols-rounded">delete</span>
              </button>
            </div>
          }
        </section>
      }

      @if (team.enabled()) {
        <p class="pn-group__foot">
          Las ausencias de cada persona, también las tuyas, están en
          <a routerLink="/panel/equipo/ausencias">Ausencias del equipo</a>.
        </p>
      } @else if (daysOff().length > 0) {
        <!-- Left over from «Mis ausencias», which this screen replaced. Working
             alone there is no Equipo › Ausencias to see them in, and they still
             block the agenda: they stay here so they can be taken away. -->
        <div class="pn-group old">
          <p class="pn-group__head">Mis ausencias</p>
          <div class="pn-group__body">
            @for (item of daysOff(); track item.id) {
              <div class="pn-row cl" [class.cl--past]="item.endDate < today">
                <span class="cl__icon"><span class="material-symbols-rounded">beach_access</span></span>
                <span class="pn-row__main">
                  <span class="pn-row__title">{{ range(item) }}</span>
                  @if (item.reason) {
                    <span class="pn-row__sub">{{ item.reason }}</span>
                  }
                </span>
                <button type="button" class="pn-icon-btn pn-icon-btn--ghost" aria-label="Eliminar" title="Eliminar"
                        (click)="removeDayOff(item)">
                  <span class="material-symbols-rounded">delete</span>
                </button>
              </div>
            }
          </div>
        </div>
      }
    </main>

    @if (creating()) {
      <pn-dialog title="Cerrar unos días" (closed)="creating.set(false)">
        <p class="pn-dim intro">Días en que el local no abre. Nadie del equipo dará citas.</p>

        <div class="dates">
          <label class="pn-field">
            <span class="pn-field__label">Desde</span>
            <input class="pn-input" type="date" name="from" [min]="today" [max]="maxDay"
                   [ngModel]="from" (ngModelChange)="setFrom($event)" />
          </label>
          <label class="pn-field">
            <span class="pn-field__label">Hasta</span>
            <input class="pn-input" type="date" name="to" [min]="from || today" [max]="maxDay"
                   [ngModel]="to" (ngModelChange)="setTo($event)" />
          </label>
        </div>

        <label class="pn-field">
          <span class="pn-field__label">Motivo (opcional)</span>
          <input class="pn-input" name="reason" maxlength="255" placeholder="Vacaciones, formación, baja..."
                 [(ngModel)]="reason" />
        </label>

        @if (checking()) {
          <p class="checking"><span class="pn-spinner"></span>Mirando qué citas hay...</p>
        }

        @if (affected().length > 0) {
          <div class="pn-notice pn-notice--warn">
            <span class="material-symbols-rounded">warning</span>
            <div>
              <strong>{{ affectedTitle() }}</strong>
              <span class="pn-notice__body">
                Se les avisará y se les devolverá lo que hubieran pagado. Cancelar no se puede deshacer.
              </span>
            </div>
          </div>
          <div class="hits">
            @for (booking of affected(); track booking.id) {
              <div class="hit">
                <span class="hit__when pn-tabular">
                  {{ shortDate(toDate(booking.startDateTime)) }} · {{ hhmm(toDate(booking.startDateTime)) }}
                </span>
                <span class="hit__who">{{ booking.serviceName }} · {{ booking.customerName }}</span>
              </div>
            }
          </div>
        }

        @if (checkError(); as text) {
          <p class="pn-field__error" role="alert">
            {{ text }}
            <button type="button" class="pn-btn pn-btn--text pn-btn--sm" (click)="check()">Reintentar</button>
          </p>
        }
        @if (formError(); as text) {
          <p class="pn-field__error" role="alert">{{ text }}</p>
        }

        <ng-container dialogActions>
          <button type="button" class="pn-btn pn-btn--secondary" [disabled]="busy()" (click)="creating.set(false)">
            Cancelar
          </button>
          <button type="button" class="pn-btn" [class.pn-btn--primary]="affected().length === 0"
                  [class.pn-btn--danger]="affected().length > 0"
                  [disabled]="busy() || checking() || !!checkError()" (click)="save()">
            @if (busy()) { <span class="pn-spinner"></span> } @else { Cerrar esos días }
          </button>
        </ng-container>
      </pn-dialog>
    }
  `,
  styles: [
    `
      :host { display: block; }
      .back { margin: 0 0 14px -12px; text-decoration: none; }
      .cl { align-items: center; }
      .cl--past { opacity: 0.6; }
      .cl__icon {
        display: grid;
        place-items: center;
        width: 42px;
        height: 42px;
        flex: none;
        border-radius: 13px;
        background: var(--pn-field);
      }
      .cl__icon .material-symbols-rounded { font-size: 21px; }
      .old { margin-top: 28px; }
      .intro { margin-bottom: 18px; line-height: 1.55; }
      .dates { display: grid; grid-template-columns: 1fr 1fr; gap: 0 12px; }
      .checking {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        margin-bottom: 12px;
        font-size: 0.8125rem;
        color: var(--clr-text-2);
      }
      .hits { margin-top: 10px; }
      .hit { padding: 12px 14px; margin-bottom: 8px; border-radius: var(--pn-radius-row); background: var(--pn-field); }
      .hit__when { display: block; font-size: 0.875rem; font-weight: 600; }
      .hit__who {
        display: block;
        margin-top: 2px;
        overflow: hidden;
        font-size: 0.8125rem;
        color: var(--clr-text-2);
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      @media (max-width: 520px) { .dates { grid-template-columns: 1fr; } }
    `,
  ],
})
export class CierresComponent {
  private readonly api = inject(Api);
  readonly team = inject(TeamStore);
  private readonly agenda = inject(AgendaStore);
  private readonly confirm = inject(ConfirmService);
  private readonly toasts = inject(ToastService);

  readonly shortDate = shortDate;
  readonly hhmm = hhmm;
  readonly toDate = toDate;

  readonly today = dayKey(new Date());
  /** Two years ahead, the same window the app's calendar offers. */
  readonly maxDay = dayKey(addDays(new Date(), 365 * 2));

  /** Most recent first: the order `myClosuresProvider` gets from the server. */
  readonly list = resource<Closure[]>(() => this.api.get<Closure[]>('/businesses/me/closures'), []);

  /** Most recent first, like `myTimeOffProvider`. */
  readonly daysOff = computed(() =>
    [...this.team.timeOff.value()].sort((a, b) => b.startDate.localeCompare(a.startDate)),
  );

  readonly creating = signal(false);
  readonly busy = signal(false);
  readonly formError = signal<string | null>(null);

  /** The appointments that closing those days would cancel. Empty with no dates. */
  readonly affected = signal<BookingResponse[]>([]);
  readonly checking = signal(false);
  readonly checkError = signal<string | null>(null);
  private checkRun = 0;

  readonly affectedTitle = computed(() => {
    const count = this.affected().length;
    return count === 1 ? 'Se cancelará 1 cita' : `Se cancelarán ${count} citas`;
  });

  from = '';
  to = '';
  reason = '';

  constructor() {
    void this.list.load();
    if (!this.team.enabled()) void this.team.timeOff.load();
  }

  range(item: { startDate: string; endDate: string }): string {
    const from = shortLong(item.startDate);
    return item.startDate === item.endDate ? from : `${from} – ${shortLong(item.endDate)}`;
  }

  open(): void {
    this.from = '';
    this.to = '';
    this.reason = '';
    this.checkRun++;
    this.affected.set([]);
    this.checking.set(false);
    this.checkError.set(null);
    this.formError.set(null);
    this.creating.set(true);
  }

  /**
   * The start day drags the end day along: with none, or with one before it,
   * it becomes the same day. A period that ends before it starts does not
   * exist. Same as the absence dialog.
   */
  setFrom(day: string): void {
    this.from = day;
    if (day && (!this.to || this.to < day)) this.to = day;
    void this.check();
  }

  setTo(day: string): void {
    this.to = day;
    void this.check();
  }

  /**
   * Asked BEFORE the button can be pressed: who is about to lose their
   * appointment has to be on screen first. Unlike the app's sheet, a failed
   * check keeps the button off — the POST does not refuse, it cancels, and
   * closing blind is the one thing this screen exists to prevent.
   */
  async check(): Promise<void> {
    const run = ++this.checkRun;
    this.affected.set([]);
    this.checkError.set(null);
    this.formError.set(null);
    if (!this.from || !this.to || this.to < this.from) {
      this.checking.set(false);
      return;
    }
    this.checking.set(true);
    try {
      const list = await this.api.get<BookingResponse[]>('/businesses/me/closures/affected', {
        startDate: this.from,
        endDate: this.to,
      });
      if (run === this.checkRun) this.affected.set(list);
    } catch (cause) {
      if (run === this.checkRun) this.checkError.set(message(cause));
    } finally {
      if (run === this.checkRun) this.checking.set(false);
    }
  }

  async save(): Promise<void> {
    if (!this.from || !this.to) {
      this.formError.set('Elige las fechas.');
      return;
    }
    if (this.to < this.from) {
      this.formError.set('La fecha de fin no puede ser anterior a la de inicio.');
      return;
    }
    const cancels = this.affected().length;
    if (cancels > 0) {
      const answer = await this.confirm.ask({
        title: this.affectedTitle(),
        message: 'Se les avisará y se les devolverá lo que hubieran pagado. Cancelar no se puede deshacer.',
        confirmLabel: 'Cerrar esos días',
        destructive: true,
      });
      if (!answer.ok) return;
    }
    this.busy.set(true);
    this.formError.set(null);
    const reason = this.reason.trim();
    try {
      await this.api.post<Closure>('/businesses/me/closures', {
        startDate: this.from,
        endDate: this.to,
        ...(reason ? { reason } : {}),
      });
      await this.list.reload();
      this.creating.set(false);
      // The agenda in memory still shows what the server has just cancelled.
      if (cancels > 0 && this.agenda.bookings.isLoaded) void this.agenda.bookings.reload();
    } catch (cause) {
      const text = message(cause);
      this.formError.set(text === 'Algo no ha ido bien.' ? 'No se ha podido cerrar' : text);
    } finally {
      this.busy.set(false);
    }
  }

  /** Reopens: the slots come back, the cancelled appointments do not. */
  async remove(item: Closure): Promise<void> {
    const answer = await this.confirm.ask({
      title: 'Eliminar ausencia',
      message: `¿Eliminar el periodo "${this.range(item)}"? Volverás a estar disponible para citas en esas fechas.`,
      confirmLabel: 'Eliminar',
      destructive: true,
    });
    if (!answer.ok) return;
    try {
      await this.api.delete(`/businesses/me/closures/${item.id}`);
      await this.list.reload();
    } catch {
      this.toasts.error('No se ha podido eliminar. La ausencia sigue ahí. Vuelve a intentarlo.');
    }
  }

  async removeDayOff(item: TimeOff): Promise<void> {
    const answer = await this.confirm.ask({
      title: 'Eliminar ausencia',
      message: `¿Eliminar el periodo "${this.range(item)}"? Volverás a estar disponible para citas en esas fechas.`,
      confirmLabel: 'Eliminar',
      destructive: true,
    });
    if (!answer.ok) return;
    try {
      await this.team.deleteTimeOff(item.id);
    } catch {
      this.toasts.error('No se ha podido eliminar. La ausencia sigue ahí. Vuelve a intentarlo.');
    }
  }
}

/** «3 mar 2026» — the app's `d MMM y`. */
function shortLong(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return `${d} ${MONTHS[m - 1].slice(0, 3)} ${y}`;
}
