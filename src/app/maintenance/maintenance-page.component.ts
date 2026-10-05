import { ChangeDetectionStrategy, Component, OnDestroy, inject, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { StatusPageComponent } from '../components/status-page/status-page.component';
import { noindex } from '../shared/noindex';
import { MaintenanceService } from './maintenance.service';

const TITLE = 'En mantenimiento · Bipsy Business';

/**
 * The only thing on screen while the web is closed for maintenance. The root
 * component puts it in place of the whole site, whatever the URL.
 *
 * There is no link back into the site: there is nowhere to go. It leaves by
 * itself when a check says the maintenance is over.
 */
@Component({
  selector: 'app-maintenance-page',
  standalone: true,
  imports: [StatusPageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-status-page
      standalone
      bip="MB-17"
      pose="con chaleco reflectante y una llave inglesa, con el pulgar arriba"
      icon="construction"
      eyebrow="En mantenimiento"
      heading="Volvemos enseguida"
      lead="Estamos poniendo a punto la web de Bipsy Business. No hace falta que hagas nada: volverá a abrirse sola en cuanto terminemos."
      [message]="state.message()"
      note="Mientras tanto, la app Bipsy Negocio de tu móvil sigue funcionando con normalidad."
    >
      <button actions type="button" class="btn btn--primary btn--lg" [disabled]="state.checking()" (click)="retry()">
        <span class="material-symbols-rounded" [class.is-spinning]="state.checking()">refresh</span>
        Reintentar
      </button>

      @if (feedback(); as text) {
        <p class="feedback" role="status">{{ text }}</p>
      }
    </app-status-page>
  `,
  styles: [
    `
      :host { display: block; }
      .btn:disabled { cursor: default; opacity: 0.7; }
      .is-spinning { animation: spin-slow 900ms linear infinite; }
      .feedback { margin-top: 16px; font-size: 0.9375rem; font-weight: 600; color: var(--clr-text-2); }
    `,
  ],
})
export class MaintenancePageComponent implements OnDestroy {
  readonly state = inject(MaintenanceService);
  private readonly title = inject(Title);
  private readonly previousTitle = this.title.getTitle();

  /** What «Reintentar» found, when the page is still here after it. */
  readonly feedback = signal<string | null>(null);

  constructor() {
    noindex();
    this.title.setTitle(TITLE);
  }

  async retry(): Promise<void> {
    this.feedback.set(null);
    await this.state.check();
    // Maintenance over: this component is already on its way out.
    if (!this.state.blocked()) return;
    this.feedback.set(
      this.state.lastCheckFailed()
        ? 'No hemos podido comprobarlo. Vuelve a intentarlo en un momento.'
        : 'Seguimos trabajando en ello. Vuelve a probar en unos minutos.',
    );
  }

  ngOnDestroy(): void {
    // Back to the title of the page underneath, unless the router has already
    // set the one of the page it was waiting to open.
    if (this.title.getTitle() === TITLE) this.title.setTitle(this.previousTitle);
  }
}
