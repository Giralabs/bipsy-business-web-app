import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PnEmptyComponent } from '../ui/controls';

/**
 * An address under `/panel` that is not a section. It stays inside the shell —
 * the sidebar is the way out — instead of bouncing to the panel's home without
 * a word, which is what the wildcard used to do.
 *
 * Only an owner gets here: `panelGuard` sends a worker back to `/panel` from
 * anything that is not on their list, unknown addresses included.
 */
@Component({
  selector: 'app-panel-not-found',
  standalone: true,
  imports: [RouterLink, PnEmptyComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="pn-main">
      <section class="pn-card nf">
        <pn-empty icon="explore_off" title="Esta página no existe"
                  text="Puede que el enlace esté mal escrito o que esta sección haya cambiado de sitio. Tus datos siguen donde los dejaste.">
          <a class="pn-btn pn-btn--primary" routerLink="/panel">
            <span class="material-symbols-rounded">arrow_back</span>
            Volver al inicio
          </a>
        </pn-empty>
      </section>
    </main>
  `,
  styles: [
    `
      :host { display: block; }
      /* Tall enough to read as the page, not as an empty widget on it. */
      .nf { display: grid; place-items: center; min-height: min(520px, 70vh); margin-top: 18px; }
    `,
  ],
})
export class PanelNotFoundComponent {}
