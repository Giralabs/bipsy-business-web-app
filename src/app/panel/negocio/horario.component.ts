import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Api } from '../core/api/api';
import { scheduleToApi } from '../core/api/schedule';
import { AgendaStore } from '../core/data/agenda.store';
import { message } from '../core/data/resource';
import { ToastService } from '../ui/toast.service';
import {
  Week,
  WeekEditorComponent,
  suggestedWeek,
  toEntries,
  toWeek,
} from './week-editor.component';

/**
 * `/panel/negocio/horario` — el horario del negocio
 * (`onboarding_schedule_screen.dart`).
 *
 * Nada se manda hasta «Guardar», así que se puede trastear sin miedo; mientras
 * haya cambios sin guardar se avisa en la cabecera.
 */
@Component({
  selector: 'app-panel-horario',
  standalone: true,
  imports: [WeekEditorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="pn-main">
      <div class="pn-head">
        <div class="pn-head__text">
          <p class="pn-head__greet">Los clientes solo pueden reservar en los tramos que abras</p>
          <h1>Horario</h1>
        </div>
        <div class="pn-head__actions">
          @if (dirty()) {
            <span class="pn-status pn-status--warn">Sin guardar</span>
          }
          <button type="button" class="pn-btn pn-btn--primary" [disabled]="busy() || !dirty()"
                  (click)="save()">
            @if (busy()) { <span class="pn-spinner"></span> } @else { Guardar cambios }
          </button>
        </div>
      </div>

      @if (isEmpty()) {
        <div class="pn-notice pn-notice--warn empty">
          <span class="material-symbols-rounded">schedule</span>
          <div>
            <strong>Todavía no abres ningún día</strong>
            <span class="pn-notice__body">
              Mientras el horario esté vacío nadie puede reservarte, y para guardarlo hay que abrir al
              menos un día.
              <button type="button" class="pn-btn pn-btn--text pn-btn--sm" (click)="suggest()">
                Poner de lunes a viernes, 9-14 y 16-20
              </button>
            </span>
          </div>
        </div>
      }

      <section class="pn-card">
        <app-week-editor [week]="week()" (weekChange)="onChange($event)" />

        <p class="foot pn-muted">
          El hueco entre dos tramos es el descanso: no hay que marcarlo aparte. Las vacaciones y los
          días sueltos van en Ausencias.
        </p>
      </section>
    </main>
  `,
  styles: [
    `
      :host { display: block; }
      .empty { margin-bottom: 20px; }
      .empty .pn-btn { display: block; margin-top: 6px; margin-left: -12px; }
      .foot {
        margin-top: 20px;
        padding-top: 18px;
        border-top: 1px solid var(--pn-line);
        font-size: 0.875rem;
        line-height: 1.55;
      }
    `,
  ],
})
export class HorarioComponent {
  private readonly api = inject(Api);
  private readonly agenda = inject(AgendaStore);
  private readonly toasts = inject(ToastService);

  readonly week = signal<Week>([[], [], [], [], [], [], []]);
  readonly busy = signal(false);
  readonly dirty = signal(false);

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    await this.agenda.schedule.load();
    this.week.set(toWeek(this.agenda.schedule.value()));
  }

  readonly isEmpty = computed(() => this.week().every((day) => day.length === 0));

  onChange(week: Week): void {
    this.week.set(week);
    this.dirty.set(true);
  }

  suggest(): void {
    this.week.set(suggestedWeek());
    this.dirty.set(true);
  }

  async save(): Promise<void> {
    // `ReplaceScheduleRequest.entries` is @NotEmpty: a week with every day
    // closed is a 400, so it is stopped here with the app's own sentence
    // (`scheduleNeedsOneDay` in `schedule_editor_screen.dart`). The notice
    // above the editor already explains why and offers a sensible week.
    if (this.isEmpty()) {
      this.toasts.error('Abre al menos un día.');
      return;
    }
    this.busy.set(true);
    try {
      await this.api.put('/schedules/me', scheduleToApi(toEntries(this.week())));
      await this.agenda.schedule.reload();
      this.dirty.set(false);
      this.toasts.show('Horario guardado');
    } catch (cause) {
      const status = (cause as { status?: number }).status;
      const detail = (cause as { error?: { message?: string } }).error?.message;
      this.toasts.error(
        status === 400 ? detail || 'Revisa los tramos: hay alguno que no vale.' : message(cause),
      );
    } finally {
      this.busy.set(false);
    }
  }
}
