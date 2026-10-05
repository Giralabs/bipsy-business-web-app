import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AuthService } from '../core/auth/auth.service';
import { InicioComponent } from './inicio.component';
import { InicioTrabajadorComponent } from '../trabajador/inicio-trabajador.component';

/**
 * `/panel`: el inicio del dueño o el del trabajador.
 *
 * Son pantallas distintas porque leen endpoints distintos —las del dueño
 * contestan 403 a un trabajador—, y cada una se descarga solo cuando hace
 * falta.
 */
@Component({
  selector: 'app-home-switch',
  standalone: true,
  imports: [InicioComponent, InicioTrabajadorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (auth.isWorker()) {
      @defer (on immediate) { <app-inicio-trabajador /> }
    } @else {
      @defer (on immediate) { <app-panel-inicio /> }
    }
  `,
})
export class HomeSwitchComponent {
  readonly auth = inject(AuthService);
}
