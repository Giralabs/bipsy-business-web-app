import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api } from '../core/api/api';
import { AuthService } from '../core/auth/auth.service';
import { BusinessProfile } from '../core/api/models';
import { message } from '../core/data/resource';
import { PnSwitchComponent } from '../ui/controls';
import { ToastService } from '../ui/toast.service';

/**
 * `/panel/ajustes/funcionalidades` — `features_screen.dart`.
 *
 * «Enciende solo lo que uses. Lo apagado desaparece de la app y de tu ficha.»
 * Each switch saves on its own, optimistically, and rolls back with a notice
 * if the server says no — the app does exactly this.
 *
 * How the business charges moved to Cobros (`collect-settings.component.ts`),
 * next to the account it depends on. «Marcar como pagadas al terminar» stays
 * here because it works WITHOUT a payouts account: in Cobros it would not even
 * be visible until signing up.
 */
@Component({
  selector: 'app-panel-funcionalidades',
  standalone: true,
  imports: [RouterLink, PnSwitchComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="pn-main">
      <a class="pn-btn pn-btn--text pn-btn--sm back" routerLink="/panel/ajustes">
        <span class="material-symbols-rounded">arrow_back</span>Ajustes
      </a>

      <div class="pn-head">
        <div class="pn-head__text">
          <p class="pn-head__greet">Enciende solo lo que uses. Lo apagado desaparece de tu ficha.</p>
          <h1>Funcionalidades</h1>
        </div>
      </div>

      <div class="pn-grid">
        <div class="pn-col-6">
          <div class="pn-group">
            <p class="pn-group__head">Tus citas</p>
            <div class="pn-group__body">
              <div class="pn-row">
                <span class="material-symbols-rounded pn-row__icon">task_alt</span>
                <span class="pn-row__main">
                  <span class="pn-row__title">Marcar como pagadas al terminar</span>
                  <span class="pn-row__sub">
                    {{ chargesByApp()
                      ? 'No se puede con «Pago por app».'
                      : 'Para quien cobra en el mostrador y no quiere ir marcándolas una a una.' }}
                  </span>
                </span>
                <pn-switch [checked]="value('autoSettleEnabled') && !chargesByApp()"
                           [disabled]="chargesByApp() || savingAutoSettle()"
                           label="Marcar como pagadas al terminar"
                           (toggle)="setAutoSettle($event)" />
              </div>
            </div>
            <p class="pn-group__foot">
              En cuanto una cita termina, queda marcada como pagada y ni tú ni tu equipo tenéis que hacer nada.
            </p>
          </div>

          <div class="pn-group">
            <p class="pn-group__head">Con tus clientes</p>
            <div class="pn-group__body">
              <div class="pn-row">
                <span class="material-symbols-rounded pn-row__icon">forum</span>
                <span class="pn-row__main">
                  <span class="pn-row__title">Recibir mensajes</span>
                  <span class="pn-row__sub">Tus clientes podrán escribirte desde su app.</span>
                </span>
                <pn-switch [checked]="value('chatEnabled')" label="Recibir mensajes"
                           (toggle)="set('chatEnabled', $event)" />
              </div>

              <div class="pn-row">
                <span class="material-symbols-rounded pn-row__icon">hourglass_top</span>
                <span class="pn-row__main">
                  <span class="pn-row__title">Lista de espera</span>
                  <span class="pn-row__sub">
                    Quien no encuentre hueco se apunta, y le avisamos cuando alguien cancela.
                  </span>
                </span>
                <pn-switch [checked]="value('waitlistEnabled')" label="Lista de espera"
                           (toggle)="set('waitlistEnabled', $event)" />
              </div>

              @if (value('waitlistEnabled')) {
                <a class="pn-row" routerLink="/panel/agenda" [queryParams]="{ vista: 'espera' }">
                  <span class="material-symbols-rounded pn-row__icon">tune</span>
                  <span class="pn-row__main"><span class="pn-row__title">Cómo se reparten los huecos</span></span>
                  <span class="pn-row__value">
                    {{ auth.profile()?.waitlistNotifyMode === 'BROADCAST' ? 'A todos' : 'En orden' }}
                  </span>
                  <span class="material-symbols-rounded pn-row__chev">arrow_forward_ios</span>
                </a>
              }
            </div>
          </div>
        </div>

        <div class="pn-col-6">
          <div class="pn-group">
            <p class="pn-group__head">Equipo</p>
            <div class="pn-group__body">
              <!-- El interruptor entre «trabajo solo» y «tengo equipo». Sin él
                   no había forma de salir del modo autónomo desde la web. -->
              <div class="pn-row">
                <span class="material-symbols-rounded pn-row__icon">groups</span>
                <span class="pn-row__main">
                  <span class="pn-row__title">Trabajar con más gente</span>
                </span>
                <pn-switch [checked]="hasTeam()" label="Trabajar con más gente"
                           (toggle)="setTeam($event)" />
              </div>

              @if (hasTeam()) {
                <div class="pn-row">
                  <span class="material-symbols-rounded pn-row__icon">timer</span>
                  <span class="pn-row__main">
                    <span class="pn-row__title">Fichaje</span>
                    <span class="pn-row__sub">Fichan entrada y salida en la app.</span>
                  </span>
                  <pn-switch [checked]="value('clockInEnabled')" label="Fichaje"
                             (toggle)="set('clockInEnabled', $event)" />
                </div>
              }
            </div>
            <p class="pn-group__foot">
              @if (hasTeam()) {
                Para volver a trabajar solo, quita antes a tu equipo y las invitaciones que hayas enviado.
              } @else {
                Aparecen el equipo, las invitaciones, las ausencias y el fichaje. Tú puedes seguir prestando
                servicios o simplemente usar la app para gestionar a los trabajadores.
              }
            </p>
          </div>
        </div>
      </div>
    </main>
  `,
  styles: [
    `
      :host { display: block; }
      .back { margin: 0 0 14px -12px; text-decoration: none; }
    `,
  ],
})
export class FuncionalidadesComponent {
  readonly auth = inject(AuthService);
  private readonly api = inject(Api);
  private readonly toasts = inject(ToastService);

  readonly savingAutoSettle = signal(false);

  /**
   * The two ways of closing an appointment cancel each other, so each one blocks
   * the other. The owner's INTENT and not what is in force: with the latter, a
   * half-verified account could turn both on and land in the forbidden
   * combination the moment Stripe verified it.
   */
  readonly chargesByApp = computed(() => this.auth.profile()?.paymentRequestIntent === true);

  /** `teamEnabled` is the app's flag; `autonomous` is its old opposite. */
  readonly hasTeam = computed(() => {
    const profile = this.auth.profile();
    if (profile?.teamEnabled != null) return profile.teamEnabled;
    return !this.auth.isAutonomous();
  });

  /**
   * Working alone or with a team is not an ordinary switch: the server
   * refuses to go back to solo while there are workers or live invitations,
   * and its message is the one worth reading.
   */
  async setTeam(on: boolean): Promise<void> {
    const before = this.hasTeam();
    this.auth.patchProfile({ teamEnabled: on, autonomous: !on });
    try {
      await this.api.put('/businesses/me/settings', { teamEnabled: on });
      await this.auth.refreshMe();
    } catch (cause) {
      this.auth.patchProfile({ teamEnabled: before, autonomous: !before });
      this.toasts.error(message(cause) || 'No se ha podido cambiar.');
    }
  }

  value(key: keyof BusinessProfile): boolean {
    return this.auth.profile()?.[key] === true;
  }

  async set(key: keyof BusinessProfile, on: boolean): Promise<void> {
    const before = this.auth.profile()?.[key];
    this.auth.patchProfile({ [key]: on } as Partial<BusinessProfile>);
    try {
      await this.api.put('/businesses/me/settings', { [key]: on });
      if (key === 'waitlistEnabled' && on) {
        this.toasts.show('Lista de espera activada');
      }
    } catch {
      this.auth.patchProfile({ [key]: before } as Partial<BusinessProfile>);
      this.toasts.error('No se ha podido cambiar.');
    }
  }

  /** The server refuses the combination too, so its reason is shown if it ever gets that far. */
  async setAutoSettle(on: boolean): Promise<void> {
    if (this.chargesByApp() || this.savingAutoSettle()) return;
    const before = this.auth.profile()?.autoSettleEnabled;
    this.savingAutoSettle.set(true);
    this.auth.patchProfile({ autoSettleEnabled: on });
    try {
      await this.api.put('/businesses/me/settings', { autoSettleEnabled: on });
    } catch (cause) {
      this.auth.patchProfile({ autoSettleEnabled: before });
      this.toasts.error(message(cause) || 'No se ha podido cambiar.');
    } finally {
      this.savingAutoSettle.set(false);
    }
  }
}
