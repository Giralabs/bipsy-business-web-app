import { ChangeDetectionStrategy, Component, Input, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TeamStore } from '../core/data/team.store';
import { message } from '../core/data/resource';
import { ToastService } from '../ui/toast.service';
import { Week, WeekEditorComponent, toEntries, toWeek } from '../negocio/week-editor.component';

/**
 * `/panel/equipo/:id/horario` — `worker_schedule_screen.dart`.
 *
 * El horario de un trabajador vive dentro del horario del negocio: si el
 * negocio cierra a las 20:00, poner aquí las 21:00 no abre nada. Se dice en la
 * pantalla para que nadie lo descubra a base de pruebas.
 */
@Component({
  selector: 'app-panel-horario-trabajador',
  standalone: true,
  imports: [RouterLink, WeekEditorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="pn-main">
      <div class="pn-head">
        <div class="pn-head__text">
          <p class="pn-head__greet">Cuándo trabaja</p>
          <h1>{{ name() }}</h1>
        </div>
        <div class="pn-head__actions">
          @if (dirty()) {
            <span class="pn-status pn-status--warn">Sin guardar</span>
          }
          <a class="pn-btn pn-btn--secondary" routerLink="/panel/equipo">Volver al equipo</a>
          <button type="button" class="pn-btn pn-btn--primary" [disabled]="busy() || !dirty()"
                  (click)="save()">
            @if (busy()) { <span class="pn-spinner"></span> } @else { Guardar cambios }
          </button>
        </div>
      </div>

      <div class="pn-notice pn-notice--info note">
        <span class="material-symbols-rounded">info</span>
        <div>
          <strong>Dentro del horario del negocio</strong>
          <span class="pn-notice__body">
            Solo se puede reservar en las horas en que abre el negocio Y trabaja esta persona. Si
            dejas un día vacío, ese día no recibe citas.
          </span>
        </div>
      </div>

      @if (!loading() && isEmpty()) {
        <div class="pn-notice pn-notice--warn note">
          <span class="material-symbols-rounded">event_busy</span>
          <div>
            <strong>Abre al menos un día.</strong>
            <span class="pn-notice__body">
              Un horario con todos los días cerrados no se puede guardar. Si va a faltar unos días,
              apúntalo en Ausencias; si ya no trabaja aquí, quítalo del equipo.
            </span>
          </div>
        </div>
      }

      <section class="pn-card">
        @if (loading()) {
          <div class="pn-skeleton" style="height:320px"></div>
        } @else {
          <app-week-editor [week]="week()" (weekChange)="onChange($event)" />
        }
      </section>
    </main>
  `,
  styles: [
    `
      :host { display: block; }
      .note { margin-bottom: 20px; }
    `,
  ],
})
export class HorarioTrabajadorComponent implements OnInit {
  @Input() id = '';

  private readonly team = inject(TeamStore);
  private readonly toasts = inject(ToastService);

  readonly week = signal<Week>([[], [], [], [], [], [], []]);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly dirty = signal(false);
  readonly name = signal('Trabajador');

  async ngOnInit(): Promise<void> {
    await this.team.load();
    this.name.set(this.team.byId(Number(this.id))?.name ?? 'Trabajador');
    try {
      this.week.set(toWeek(await this.team.workerSchedule(Number(this.id))));
    } catch {
      this.toasts.error('No hemos podido cargar su horario.');
    } finally {
      this.loading.set(false);
    }
  }

  onChange(week: Week): void {
    this.week.set(week);
    this.dirty.set(true);
  }

  readonly isEmpty = computed(() => this.week().every((day) => day.length === 0));

  async save(): Promise<void> {
    // `ReplaceScheduleRequest.entries` is @NotEmpty: all days closed is a 400.
    // Stopped here with the app's sentence (`scheduleNeedsOneDay`).
    if (this.isEmpty()) {
      this.toasts.error('Abre al menos un día.');
      return;
    }
    this.busy.set(true);
    try {
      await this.team.saveWorkerSchedule(Number(this.id), toEntries(this.week()));
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
