import { ChangeDetectionStrategy, Component, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Title } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { NotFoundComponent } from '../pages/not-found/not-found.component';
import { NOT_FOUND_TITLE } from '../pages/not-found/not-found.title';
import { AuthLayoutComponent } from '../panel/auth/auth-layout.component';
import { ApiUnreachableError } from '../panel/core/api/api';
import { noindex } from '../shared/noindex';
import { ADMIN_TITLE } from './admin.title';
import { MaintenanceService } from './maintenance.service';

/**
 * `/admin` — the team's door during maintenance: the password that lets a
 * browser into the site while the public sees the maintenance page.
 *
 * The door only exists while there is maintenance. The rest of the time —and
 * whenever the state is unknown or the check failed— this renders the same
 * «not found» page as any address that does not exist, header and footer
 * included, so nothing gives away that there is something here.
 */
@Component({
  selector: 'app-maintenance-admin',
  standalone: true,
  imports: [AuthLayoutComponent, FormsModule, NotFoundComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin.component.html',
  styleUrls: ['../panel/auth/auth-forms.css', './admin.component.css'],
})
export class AdminComponent {
  readonly state = inject(MaintenanceService);
  private readonly router = inject(Router);
  private readonly title = inject(Title);

  password = '';

  readonly visible = signal(false);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  constructor() {
    noindex();

    // The state can change with the page open (the first check arrives, the
    // maintenance ends): the tab follows what is on screen.
    effect(() => this.title.setTitle(this.state.maintenance() ? ADMIN_TITLE : NOT_FOUND_TITLE));

    // Already inside —on arrival with a valid token, or right after
    // unlocking—: there is nothing to do at this door.
    effect(() => {
      if (this.state.bypass()) untracked(() => void this.router.navigateByUrl('/', { replaceUrl: true }));
    });
  }

  async submit(): Promise<void> {
    if (this.busy()) return;
    if (!this.password) {
      this.error.set('Escribe la contraseña.');
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    try {
      // On success the bypass flips and the effect above leaves for the home
      // page; the button keeps spinning until this screen is gone.
      await this.state.unlock(this.password);
    } catch (cause) {
      const status = (cause as { status?: number }).status;
      if (status === 404) {
        // The maintenance was switched off in the meantime: the site is open.
        await this.state.check();
        await this.router.navigateByUrl('/', { replaceUrl: true });
        return;
      }
      this.busy.set(false);
      this.error.set(
        status === 401
          ? 'Contraseña incorrecta.'
          : status === 429
            ? 'Demasiados intentos. Espera un minuto y vuelve a probar.'
            : cause instanceof ApiUnreachableError || status === 0
              ? 'No hemos podido hablar con el servidor. Comprueba tu conexión e inténtalo otra vez.'
              : 'Algo no ha ido bien. Inténtalo otra vez.',
      );
    }
  }
}
