import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Absence, AbsenceType } from '../core/api/models';
import { MyWorkStore } from '../core/data/my-work.store';
import { message } from '../core/data/resource';
import { dayKey, longDate } from '../core/util/dates';
import { PnEmptyComponent } from '../ui/controls';
import { PnDialogComponent } from '../ui/dialog.component';
import { PnDateComponent } from '../ui/date.component';
import { PnSelectComponent } from '../ui/select.component';
import { ConfirmService } from '../ui/confirm.service';
import { ToastService } from '../ui/toast.service';

const TYPES: { id: AbsenceType; label: string; icon: string }[] = [
  { id: 'VACATION', label: 'Vacaciones', icon: 'beach_access' },
  { id: 'PERSONAL', label: 'Asuntos personales', icon: 'person' },
  { id: 'SICK_LEAVE', label: 'Baja médica', icon: 'medical_services' },
  { id: 'OTHER', label: 'Otro', icon: 'more_horiz' },
];

const STATUS: Record<Absence['status'], { label: string; tone: string }> = {
  PENDING: { label: 'Pendiente', tone: 'warn' },
  APPROVED: { label: 'Aprobada', tone: 'success' },
  REJECTED: { label: 'Rechazada', tone: 'danger' },
};

/**
 * `/panel/mis-ausencias` — `my_absences_screen.dart` y la hoja
 * `request_absence_sheet.dart`.
 *
 * Se solicitan aquí y las decide el negocio. Mientras está pendiente, una
 * solicitud se puede retirar; una vez decidida, queda como historial con el
 * motivo que haya dado el negocio.
 */
@Component({
  selector: 'app-mis-ausencias',
  standalone: true,
  imports: [FormsModule, PnEmptyComponent, PnDialogComponent, PnSelectComponent, PnDateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="pn-main">
      <div class="pn-head">
        <div class="pn-head__text">
          <p class="pn-head__greet">Vacaciones, días libres y bajas que has solicitado.</p>
          <h1>Mis ausencias</h1>
        </div>
        <div class="pn-head__actions">
          <button type="button" class="pn-btn pn-btn--primary" (click)="open()">
            <span class="material-symbols-rounded">add</span>
            Solicitar ausencia
          </button>
        </div>
      </div>

      @if (work.absences.error(); as problem) {
        <div class="pn-notice pn-notice--error">
          <span class="material-symbols-rounded">error</span>
          <div><strong>No se han podido cargar tus ausencias.</strong><span class="pn-notice__body">{{ problem }}</span></div>
        </div>
      } @else if (work.absences.loading() && !work.absences.isLoaded) {
        <div class="pn-skeleton" style="height:240px"></div>
      } @else if (list().length === 0) {
        <section class="pn-card">
          <pn-empty icon="beach_access" title="Sin solicitudes"
                    text="Cuando solicites vacaciones o días libres aparecerán aquí.">
            <button type="button" class="pn-btn pn-btn--primary" (click)="open()">Solicitar ausencia</button>
          </pn-empty>
        </section>
      } @else {
        <section class="pn-group__body">
          @for (absence of list(); track absence.id) {
            <div class="pn-row ab">
              <span class="ab__icon"><span class="material-symbols-rounded">{{ iconOf(absence) }}</span></span>
              <span class="pn-row__main">
                <span class="pn-row__title">{{ typeOf(absence) }}</span>
                <span class="pn-row__sub">{{ rangeOf(absence) }}@if (absence.reason) { · {{ absence.reason }} }</span>
                @if (absence.decisionNote) {
                  <span class="pn-row__sub ab__note">
                    {{ absence.status === 'REJECTED' ? 'Motivo del rechazo' : 'Nota' }}: {{ absence.decisionNote }}
                  </span>
                }
              </span>
              <span class="pn-status" [class]="'pn-status pn-status--' + statusOf(absence).tone">
                {{ statusOf(absence).label }}
              </span>
              @if (absence.status === 'PENDING') {
                <button type="button" class="pn-btn pn-btn--text pn-btn--sm" (click)="cancel(absence)">
                  Cancelar solicitud
                </button>
              }
            </div>
          }
        </section>
      }
    </main>

    @if (asking()) {
      <pn-dialog title="Solicitar ausencia" (closed)="asking.set(false)">
        <p class="pn-dim intro">Elige el tipo y las fechas. El negocio aprobará o rechazará tu solicitud.</p>

        <!-- The same fields, filled in the same way, as when the owner gives one
             (ausencias.component). Only where it goes and the button change. -->
        <div class="pn-fg">
          <div class="pn-fg__body">
            <label class="pn-fg__row">
              <span class="pn-fg__label">Tipo</span>
              <pn-select look="row" name="type" label="Tipo" [options]="types" valueKey="id" [(ngModel)]="type" />
            </label>
          </div>
        </div>

        <div class="pn-fg">
          <p class="pn-fg__head">Fechas</p>
          <div class="pn-fg__body">
            <label class="pn-fg__row">
              <span class="pn-fg__label">Desde</span>
              <pn-date look="row" name="from" [min]="today"
                     [ngModel]="from" (ngModelChange)="setFrom($event)" />
            </label>
            <label class="pn-fg__row">
              <span class="pn-fg__label">Hasta</span>
              <pn-date look="row" name="to" [min]="from || today" [(ngModel)]="to" />
            </label>
          </div>
        </div>

        <div class="pn-fg last">
          <p class="pn-fg__head">Motivo</p>
          <div class="pn-fg__body">
            <label class="pn-fg__row pn-fg__row--stack">
              <textarea class="pn-fg__input reason" rows="3" name="reason" maxlength="500" aria-label="Motivo"
                        placeholder="Explica brevemente si quieres" [(ngModel)]="reason"></textarea>
            </label>
          </div>
        </div>

        @if (formError(); as text) {
          <p class="pn-field__error error" role="alert">{{ text }}</p>
        }

        <ng-container dialogActions>
          <button type="button" class="pn-btn pn-btn--secondary" (click)="asking.set(false)">Cancelar</button>
          <button type="button" class="pn-btn pn-btn--primary" [disabled]="busy()" (click)="send()">
            @if (busy()) { <span class="pn-spinner"></span> } @else { Enviar solicitud }
          </button>
        </ng-container>
      </pn-dialog>
    }
  `,
  styles: [
    `
      :host { display: block; }
      .ab { align-items: center; }
      .ab__icon {
        display: grid;
        place-items: center;
        width: 42px;
        height: 42px;
        flex: none;
        border-radius: 13px;
        background: var(--pn-field);
      }
      .ab__icon .material-symbols-rounded { font-size: 21px; }
      .ab__note { color: var(--clr-text-2); }
      .intro { margin-bottom: 16px; font-size: 0.875rem; line-height: 1.6; }
      /* A select inside a grouped row: no box of its own, only its arrow. */
      .pn-fg__input.type {
        min-height: 46px;
        padding: 0 28px 0 0;
        border-radius: 0;
        background-color: transparent;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%238A958F'%3E%3Cpath d='M7 10l5 5 5-5z'/%3E%3C/svg%3E");
        background-repeat: no-repeat;
        background-position: right 0 center;
        background-size: 20px;
        box-shadow: none;
      }
      .reason { min-height: 72px; }
      .last { margin-bottom: 0; }
      .error { margin: 12px 4px 0; }
    `,
  ],
})
export class MisAusenciasComponent {
  readonly work = inject(MyWorkStore);
  private readonly confirm = inject(ConfirmService);
  private readonly toasts = inject(ToastService);

  readonly types = TYPES;
  readonly today = dayKey(new Date());

  readonly asking = signal(false);
  readonly busy = signal(false);
  readonly formError = signal<string | null>(null);

  type: AbsenceType = 'VACATION';
  from = '';
  to = '';
  reason = '';

  constructor() {
    void this.work.absences.load();
  }

  /** Pendientes primero; luego lo más reciente. */
  readonly list = computed(() =>
    [...this.work.absences.value()].sort((a, b) => {
      if ((a.status === 'PENDING') !== (b.status === 'PENDING')) return a.status === 'PENDING' ? -1 : 1;
      return b.startDate.localeCompare(a.startDate);
    }),
  );

  typeOf(absence: Absence): string {
    return TYPES.find((t) => t.id === absence.type)?.label ?? 'Ausencia';
  }

  iconOf(absence: Absence): string {
    return TYPES.find((t) => t.id === absence.type)?.icon ?? 'event_busy';
  }

  statusOf(absence: Absence) {
    return STATUS[absence.status];
  }

  rangeOf(absence: Absence): string {
    const from = longDate(new Date(`${absence.startDate}T00:00:00`));
    const to = longDate(new Date(`${absence.endDate}T00:00:00`));
    return from === to ? from : `${from} — ${to}`;
  }

  open(): void {
    this.type = 'VACATION';
    this.from = '';
    this.to = '';
    this.reason = '';
    this.formError.set(null);
    this.asking.set(true);
  }

  /**
   * Picking the start drags the end along if it had none or fell before: an
   * absence that ends before it starts does not exist, and making them correct
   * a field they did not choose is worse. From today on: what is asked for here
   * cannot be days already worked, unlike what the owner records.
   */
  setFrom(value: string): void {
    this.from = value;
    if (value && (!this.to || this.to < value)) this.to = value;
  }

  async send(): Promise<void> {
    if (!this.from) {
      this.formError.set('Elige las fechas.');
      return;
    }
    const to = this.to || this.from;
    if (to < this.from) {
      this.formError.set('La fecha de fin no puede ser anterior a la de inicio.');
      return;
    }
    this.busy.set(true);
    this.formError.set(null);
    try {
      await this.work.requestAbsence({ type: this.type, startDate: this.from, endDate: to, reason: this.reason });
      this.asking.set(false);
      this.toasts.show('Solicitud enviada');
    } catch (cause) {
      this.formError.set(`No se ha podido enviar. ${message(cause)}`);
    } finally {
      this.busy.set(false);
    }
  }

  async cancel(absence: Absence): Promise<void> {
    const answer = await this.confirm.ask({
      title: 'Cancelar solicitud',
      message: '¿Quieres cancelar esta solicitud de ausencia?',
      confirmLabel: 'Cancelar solicitud',
      cancelLabel: 'Volver',
      destructive: true,
    });
    if (!answer.ok) return;
    try {
      await this.work.cancelAbsence(absence.id);
      this.toasts.show('Solicitud cancelada');
    } catch {
      this.toasts.error('No se ha podido cancelar. La solicitud sigue enviada.');
    }
  }
}
