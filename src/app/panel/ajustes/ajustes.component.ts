import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';
import { CustomersStore } from '../core/data/customers.store';
import { CoachService } from '../onboarding/coach.service';

/**
 * `/panel/ajustes` — the hub of `profile_screen.dart`, minus the identity card
 * (that lives in the avatar menu here) and minus the checklist (that lives on
 * the home board). Same groups and the same order, so anyone who knows the app
 * finds things where they expect.
 */
@Component({
  selector: 'app-panel-ajustes',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="pn-main">
      <div class="pn-head">
        <div class="pn-head__text">
          <p class="pn-head__greet">{{ auth.businessName() }}</p>
          <h1>Ajustes</h1>
        </div>
      </div>

      <div class="pn-grid">
        <div class="pn-col-6">
          <div class="pn-group">
            <p class="pn-group__head">Mi negocio</p>
            <div class="pn-group__body">
              <a class="pn-row" routerLink="/panel/negocio">
                <span class="material-symbols-rounded pn-row__icon">storefront</span>
                <span class="pn-row__main">
                  <span class="pn-row__title">Tu ficha</span>
                  <span class="pn-row__sub">Nombre, fotos, descripción y horario.</span>
                </span>
                <span class="material-symbols-rounded pn-row__chev">arrow_forward_ios</span>
              </a>
              <a class="pn-row" routerLink="/panel/ajustes/reservas">
                <span class="material-symbols-rounded pn-row__icon">event_available</span>
                <span class="pn-row__main">
                  <span class="pn-row__title">Reservas</span>
                  <span class="pn-row__sub">Con cuánta antelación, cada cuánto y cuántas por cliente.</span>
                </span>
                <span class="material-symbols-rounded pn-row__chev">arrow_forward_ios</span>
              </a>
              <!-- Next to Reservas: both say when there is a slot. The weekly
                   schedule is for «we close on Sundays»; this, for «we do not
                   open on 6 December». It belongs to the BUSINESS, so it shows
                   whether the owner attends or not. -->
              <a class="pn-row" routerLink="/panel/ajustes/cierres">
                <span class="material-symbols-rounded pn-row__icon">event_busy</span>
                <span class="pn-row__main">
                  <span class="pn-row__title">Días de cierre</span>
                  <span class="pn-row__sub">Días en que el local no abre. Nadie del equipo dará citas.</span>
                </span>
                <span class="material-symbols-rounded pn-row__chev">arrow_forward_ios</span>
              </a>
              <a class="pn-row" routerLink="/panel/ajustes/funcionalidades">
                <span class="material-symbols-rounded pn-row__icon">tune</span>
                <span class="pn-row__main">
                  <span class="pn-row__title">Funcionalidades</span>
                  <span class="pn-row__sub">Enciende solo lo que uses.</span>
                </span>
                <span class="material-symbols-rounded pn-row__chev">arrow_forward_ios</span>
              </a>
              <a class="pn-row" routerLink="/panel/ajustes/cobros">
                <span class="material-symbols-rounded pn-row__icon">payments</span>
                <span class="pn-row__main"><span class="pn-row__title">Cobros</span></span>
                <span class="material-symbols-rounded pn-row__chev">arrow_forward_ios</span>
              </a>
              <a class="pn-row" routerLink="/panel/ajustes/suscripcion">
                <span class="material-symbols-rounded pn-row__icon">workspace_premium</span>
                <span class="pn-row__main"><span class="pn-row__title">Mi plan</span></span>
                <span class="pn-row__value">{{ planName() }}</span>
                <span class="material-symbols-rounded pn-row__chev">arrow_forward_ios</span>
              </a>
            </div>
          </div>

          <div class="pn-group">
            <p class="pn-group__head">Clientes</p>
            <div class="pn-group__body">
              <a class="pn-row" routerLink="/panel/resenas">
                <span class="material-symbols-rounded pn-row__icon">star</span>
                <span class="pn-row__main"><span class="pn-row__title">Reseñas recibidas</span></span>
                <span class="material-symbols-rounded pn-row__chev">arrow_forward_ios</span>
              </a>
              <a class="pn-row" routerLink="/panel/clientes/vetados">
                <span class="material-symbols-rounded pn-row__icon">block</span>
                <span class="pn-row__main"><span class="pn-row__title">Clientes vetados</span></span>
                <span class="pn-row__value">{{ customers.banned().length }}</span>
                <span class="material-symbols-rounded pn-row__chev">arrow_forward_ios</span>
              </a>
              <a class="pn-row" routerLink="/panel/negocio/codigo">
                <span class="material-symbols-rounded pn-row__icon">card_giftcard</span>
                <span class="pn-row__main"><span class="pn-row__title">Código de invitación</span></span>
                <span class="material-symbols-rounded pn-row__chev">arrow_forward_ios</span>
              </a>
            </div>
          </div>
        </div>

        <div class="pn-col-6">
          <div class="pn-group">
            <p class="pn-group__head">Seguridad</p>
            <div class="pn-group__body">
              <a class="pn-row" routerLink="/panel/ajustes/cuenta">
                <span class="material-symbols-rounded pn-row__icon">lock</span>
                <span class="pn-row__main">
                  <span class="pn-row__title">Tu cuenta</span>
                  <span class="pn-row__sub">Contraseña y sesiones abiertas.</span>
                </span>
                <span class="material-symbols-rounded pn-row__chev">arrow_forward_ios</span>
              </a>
            </div>
          </div>

          <div class="pn-group">
            <p class="pn-group__head">General</p>
            <div class="pn-group__body">
              <a class="pn-row" routerLink="/panel/ajustes/notificaciones">
                <span class="material-symbols-rounded pn-row__icon">notifications</span>
                <span class="pn-row__main">
                  <span class="pn-row__title">Notificaciones</span>
                  <span class="pn-row__sub">Qué te avisamos en este ordenador.</span>
                </span>
                <span class="material-symbols-rounded pn-row__chev">arrow_forward_ios</span>
              </a>
              <button type="button" class="pn-row" (click)="coach.start('business')">
                <span class="material-symbols-rounded pn-row__icon">school</span>
                <span class="pn-row__main"><span class="pn-row__title">Ver el tutorial otra vez</span></span>
              </button>
              @if (isQuality()) {
                <button type="button" class="pn-row" (click)="coach.start('quality')">
                  <span class="material-symbols-rounded pn-row__icon">auto_awesome</span>
                  <span class="pn-row__main"><span class="pn-row__title">Ver el tutorial de Quality</span></span>
                </button>
              }
              <a class="pn-row" routerLink="/panel/soporte">
                <span class="material-symbols-rounded pn-row__icon">support_agent</span>
                <span class="pn-row__main"><span class="pn-row__title">Soporte</span></span>
                <span class="material-symbols-rounded pn-row__chev">arrow_forward_ios</span>
              </a>
              <a class="pn-row" routerLink="/ayuda">
                <span class="material-symbols-rounded pn-row__icon">help</span>
                <span class="pn-row__main"><span class="pn-row__title">Centro de ayuda</span></span>
                <span class="material-symbols-rounded pn-row__chev">arrow_forward_ios</span>
              </a>
              <a class="pn-row" routerLink="/legal/aviso-legal">
                <span class="material-symbols-rounded pn-row__icon">gavel</span>
                <span class="pn-row__main"><span class="pn-row__title">Acerca de Bipsy y legales</span></span>
                <span class="material-symbols-rounded pn-row__chev">arrow_forward_ios</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </main>
  `,
  styles: [`:host { display: block; }`],
})
export class AjustesComponent {
  readonly auth = inject(AuthService);
  readonly coach = inject(CoachService);
  readonly customers = inject(CustomersStore);

  constructor() {
    void this.customers.load();
  }

  planName(): string {
    return this.auth.profile()?.subscription?.planName ?? '—';
  }

  isQuality(): boolean {
    return this.auth.hasFeature('UNIQUE_ANIMATIONS');
  }
}
