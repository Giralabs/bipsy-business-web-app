import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Api } from '../core/api/api';
import { AuthService } from '../core/auth/auth.service';
import { BusinessProfile, OnlinePaymentMode, PayoutAccount } from '../core/api/models';
import { message } from '../core/data/resource';
import { ConfirmService } from '../ui/confirm.service';
import { PnSwitchComponent } from '../ui/controls';
import { ToastService } from '../ui/toast.service';

/**
 * `/panel/ajustes/funcionalidades` — `features_screen.dart`.
 *
 * «Enciende solo lo que uses. Lo apagado desaparece de la app y de tu ficha.»
 * Each switch saves on its own, optimistically, and rolls back with a notice
 * if the server says no — the app does exactly this.
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

        <div class="pn-col-6">
          <div class="pn-group">
            <p class="pn-group__head">Cobros</p>
            <div class="pn-group__body">
              <a class="pn-row" routerLink="/panel/ajustes/cobros">
                <span class="material-symbols-rounded pn-row__icon">account_balance</span>
                <span class="pn-row__main">
                  <span class="pn-row__title">Cuenta de cobros</span>
                  <span class="pn-row__sub">Hace falta para cobrar por la app o pedir tarjeta.</span>
                </span>
                <span class="pn-row__value">{{ payoutLabel() }}</span>
                <span class="material-symbols-rounded pn-row__chev">arrow_forward_ios</span>
              </a>

              <div class="pn-row">
                <span class="material-symbols-rounded pn-row__icon">credit_card</span>
                <span class="pn-row__main">
                  <span class="pn-row__title">Pedir tarjeta al reservar</span>
                  <span class="pn-row__sub">
                    Te protege de los plantones: si no viene, se le cobra la tarifa que tengas puesta.
                  </span>
                </span>
                <!-- Lo que se pinta es lo que está EN VIGOR, no lo que eligió:
                     un interruptor encendido dice «esto ya funciona», y sin
                     cuenta de cobros no funciona nada de este bloque. Sin
                     cobros tampoco se deja encender — lo que se guardaría no
                     haría nada. -->
                <pn-switch [checked]="requiresCard()" [disabled]="!canCollect()" label="Pedir tarjeta"
                           (toggle)="setRequiresCard($event)" />
              </div>

              <!-- La confianza automática va PEGADA a la tarjeta y no en
                   Cancelaciones: allí se decide cuánto y hasta cuándo se
                   cobra, y esto es A QUIÉN se le pide la tarjeta. Solo se ve
                   si se está pidiendo: sin tarjeta no hay nada que dejar de
                   pedir. -->
              @if (requiresCard()) {
                <div class="pn-row">
                  <span class="material-symbols-rounded pn-row__icon">workspace_premium</span>
                  <span class="pn-row__main">
                    <span class="pn-row__title">Clientes de confianza</span>
                    <span class="pn-row__sub">Detecta a tus clientes de confianza automáticamente.</span>
                  </span>
                  <pn-switch [checked]="value('autoTrustEnabled')" label="Clientes de confianza"
                             (toggle)="set('autoTrustEnabled', $event)" />
                </div>
              }

              <!-- cancellation_policy_screen.dart: en la app también cuelga
                   de Funcionalidades, no del menú de Perfil. Solo con la
                   tarjeta en vigor: sin ella no hay nada que cobrar. -->
              @if (requiresCard()) {
                <a class="pn-row" routerLink="/panel/ajustes/cancelaciones">
                  <span class="material-symbols-rounded pn-row__icon">event_busy</span>
                  <span class="pn-row__main">
                    <span class="pn-row__title">Cancelaciones</span>
                    <span class="pn-row__sub">Cuánto se cobra a quien cancela a última hora, y qué es «a última hora».</span>
                  </span>
                  <span class="pn-row__value">{{ cancellationLabel() }}</span>
                  <span class="material-symbols-rounded pn-row__chev">arrow_forward_ios</span>
                </a>
              }
            </div>
            <!-- Con dos filas apagadas hay que decir por qué, o parecen rotas. -->
            @if (!canCollect()) {
              <p class="pn-group__foot">{{ payoutsNotice() }}</p>
            }
          </div>

          <div class="pn-group">
            <p class="pn-group__head">Pago de la cita</p>
            <div class="pn-group__body">
              @for (option of paymentModes; track option.id) {
                <button type="button" class="pn-row" [disabled]="!canCollect() && option.id !== 'OFF'"
                        (click)="setPaymentMode(option.id)">
                  <span class="pn-row__main">
                    <span class="pn-row__title">{{ option.title }}</span>
                    <span class="pn-row__sub">{{ option.sub }}</span>
                  </span>
                  @if (paymentMode() === option.id) {
                    <span class="material-symbols-rounded pn-row__icon">check</span>
                  }
                </button>
              }
            </div>
            @if (!canCollect()) {
              <p class="pn-group__foot">{{ payoutsNotice() }}</p>
            }
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
  private readonly confirm = inject(ConfirmService);
  private readonly router = inject(Router);

  readonly saving = signal(false);

  /**
   * The payouts account decides more than its own row: without it there is
   * nowhere for a cancellation fee or an in-app payment to land, so both are
   * held back until it can collect (`features_screen.dart`).
   */
  readonly payouts = signal<PayoutAccount | null>(null);

  /**
   * Si la cuenta puede cobrar AHORA MISMO.
   *
   * Mientras la cuenta carga manda `payoutsReady` del perfil, que ya está en
   * memoria desde el arranque. Sin ese apaño el bloque salía apagado un
   * segundo —el tiempo de preguntarle a Stripe— y luego se encendía: quien lo
   * tiene todo bien veía parpadear sus ajustes cada vez que entraba.
   */
  readonly canCollect = computed(() => {
    const account = this.payouts();
    if (account) return account.chargesEnabled && account.payoutsEnabled;
    return this.auth.profile()?.payoutsReady === true;
  });

  /**
   * Lo que está en vigor: lo que el dueño eligió Y que se pueda cobrar.
   *
   * `requiresCardIntent` es su decisión y no se toca; `requiresCard` del
   * perfil ya viene resuelto por el servidor, pero se recalcula aquí para que
   * el interruptor siga al estado de la cuenta sin esperar a otro `/me`.
   */
  readonly requiresCard = computed(
    () => this.auth.profile()?.requiresCardIntent === true && this.canCollect(),
  );

  /** El modo elegido, o «no se paga por la app» mientras no se pueda cobrar. */
  readonly paymentMode = computed<OnlinePaymentMode>(() =>
    this.canCollect() ? (this.auth.profile()?.onlinePaymentMode ?? 'OFF') : 'OFF',
  );

  /**
   * Por qué está apagado el bloque. Son dos situaciones distintas: no haber
   * empezado el alta, y estar esperando a que Stripe verifique.
   */
  readonly payoutsNotice = computed(() => {
    const account = this.payouts();
    return account != null && account.state !== 'NOT_STARTED'
      ? 'Estamos verificando tu cuenta. En cuanto esté lista podrás pedir tarjeta y cobrar la cita, y lo que elegiste al darte de alta se activa solo.'
      : 'Activa los cobros para acceder a las funcionalidades de pago y tarjetas.';
  });

  /** `teamEnabled` is the app's flag; `autonomous` is its old opposite. */
  readonly hasTeam = computed(() => {
    const profile = this.auth.profile();
    if (profile?.teamEnabled != null) return profile.teamEnabled;
    return !this.auth.isAutonomous();
  });

  constructor() {
    void this.loadPayouts();
  }

  private async loadPayouts(): Promise<void> {
    try {
      this.payouts.set(await this.api.get<PayoutAccount>('/businesses/me/payouts'));
    } catch {
      this.payouts.set(null);
    }
  }

  payoutLabel(): string {
    const account = this.payouts();
    // Nada mientras no se sabe: es mejor callarse que decir «sin activar» de
    // algo que quizá lo está.
    if (!account) return '';
    if (this.canCollect()) return 'Activo';
    if (account.state === 'IN_REVIEW') return 'En revisión';
    return 'Sin activar';
  }

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

  /** «Configúrala y vuelve a encender esto», with a way to go there. */
  private async needsPayouts(text: string): Promise<void> {
    const answer = await this.confirm.ask({
      title: 'Primero, la cuenta de cobros',
      message: text,
      confirmLabel: 'Ir a cobros',
      cancelLabel: 'Más tarde',
    });
    if (answer.ok) void this.router.navigateByUrl('/panel/ajustes/cobros');
  }

  readonly paymentModes: { id: OnlinePaymentMode; title: string; sub: string }[] = [
    { id: 'OFF', title: 'No se paga por la app', sub: 'Se cobra en el mostrador, como siempre.' },
    { id: 'OPTIONAL', title: 'Puede pagar por la app', sub: 'El cliente elige si paga al reservar.' },
    {
      id: 'REQUIRED',
      title: 'Tiene que pagar para reservar',
      sub: 'El hueco se le guarda 15 minutos mientras paga.',
    },
  ];

  value(key: keyof BusinessProfile): boolean {
    return this.auth.profile()?.[key] === true;
  }

  /** «30 % · 24 h», or nothing when no card is asked and nothing is charged. */
  cancellationLabel(): string {
    const profile = this.auth.profile();
    if (!profile || !this.requiresCard()) return 'Sin penalización';
    return `${profile.cancellationFeePercent ?? 0} % · ${profile.cancellationWindowHours ?? 0} h`;
  }

  /**
   * Pedir tarjeta: se lee `requiresCardIntent` y se guarda como `requiresCard`.
   *
   * Los dos nombres existen porque son dos cosas: lo que el dueño eligió y lo
   * que está en vigor. `/businesses/me/settings` sigue llamándolo
   * `requiresCard`, y es el servidor quien decide si llega a aplicarse.
   */
  async setRequiresCard(on: boolean): Promise<void> {
    // El interruptor ya sale apagado sin cuenta de cobros; esto es el cinturón.
    if (on && !this.canCollect()) return;
    const before = this.auth.profile()?.requiresCardIntent;
    this.auth.patchProfile({ requiresCardIntent: on, requiresCard: on });
    try {
      await this.api.put('/businesses/me/settings', { requiresCard: on });
    } catch {
      this.auth.patchProfile({ requiresCardIntent: before, requiresCard: before === true });
      this.toasts.error('No se ha podido cambiar.');
    }
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

  async setPaymentMode(mode: OnlinePaymentMode): Promise<void> {
    const before = this.auth.profile()?.onlinePaymentMode;
    // Leaving OFF is what needs the account; coming back to OFF never does.
    if (mode !== 'OFF' && !this.canCollect()) {
      await this.needsPayouts(
        'Para cobrar por la app necesitas tu cuenta de cobros activa: es donde entra el dinero de tus clientes.',
      );
      return;
    }
    this.auth.patchProfile({ onlinePaymentMode: mode });
    try {
      await this.api.put('/businesses/me/settings', { onlinePaymentMode: mode });
    } catch (cause) {
      this.auth.patchProfile({ onlinePaymentMode: before });
      // The server can refuse a mode for a reason worth reading.
      this.toasts.error(message(cause) || 'No se ha podido cambiar.');
    }
  }
}
