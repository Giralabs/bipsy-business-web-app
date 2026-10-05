import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { StatusPageComponent } from '../../components/status-page/status-page.component';
import { noindex } from '../../shared/noindex';

/**
 * Any URL the site does not know. It used to send people to the home page
 * without a word, which reads as «the link works» when it does not.
 *
 * `/admin` renders this very component when the site is not in maintenance, so
 * that door looks like any other address that does not exist.
 */
@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterLink, StatusPageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-status-page
      bip="MB-08"
      pose="con auriculares de atención al cliente, señalando el camino con la mano"
      icon="explore_off"
      eyebrow="Error 404"
      heading="Aquí no hay nada"
      lead="Esta página no existe o ha cambiado de sitio. Puede que el enlace esté mal escrito o se haya quedado antiguo."
    >
      <ng-container ngProjectAs="[actions]">
        <a routerLink="/" class="btn btn--primary btn--lg">
          <span class="material-symbols-rounded">arrow_back</span>
          Volver al inicio
        </a>
        <a routerLink="/ayuda" class="btn btn--secondary btn--lg">
          <span class="material-symbols-rounded">help</span>
          Centro de ayuda
        </a>
      </ng-container>
    </app-status-page>
  `,
  styles: [':host { display: block; }'],
})
export class NotFoundComponent {
  constructor() {
    noindex();
  }
}
