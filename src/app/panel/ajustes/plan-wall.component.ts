import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api } from '../core/api/api';
import { AuthService } from '../core/auth/auth.service';
import { SubscriptionPlan } from '../core/api/models';
import { message, resource } from '../core/data/resource';
import { money } from '../core/util/format';
import { ToastService } from '../ui/toast.service';
import { StripeCheckoutComponent, StripeCheckoutService } from './stripe-checkout';

/**
 * `/panel/plan` — el muro de `plan_selection_screen.dart`.
 *
 * Lo decide el servidor (`profile.subscription.blocked`) y la guardia manda
 * aquí todo lo demás. Se paga con tarjeta, con Stripe, sin salir de la página.
 */
@Component({
  selector: 'app-panel-plan-wall',
  standalone: true,
  imports: [RouterLink, StripeCheckoutComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="pn-main wall">
      <img class="wall__mark theme-dark-only"
           src="assets_bipsy_business/Combination Marks/combinationmark_vertical_dark_nobackground_trim.webp" alt="" />
      <img class="wall__mark theme-light-only"
           src="assets_bipsy_business/Combination Marks/combinationmark_vertical_light_nobackground_trim.webp" alt="" />

      @if (auth.isWorker()) {
        <!-- _WorkerBlockedView: el plan lo paga el negocio, no el trabajador. -->
        <h1>El plan de tu negocio no está activo</h1>
        <p class="wall__lead">
          Mientras {{ auth.businessName() || 'tu negocio' }} no renueve su plan no puedes ver tu agenda ni
          fichar. Avisa a tu responsable; en cuanto lo active, vuelves a entrar.
        </p>
        <div class="wall__actions">
          <a class="pn-btn pn-btn--text" routerLink="/panel/soporte">Hablar con soporte</a>
          <button type="button" class="pn-btn pn-btn--secondary" (click)="recheck()">Volver a comprobar</button>
        </div>
      } @else {
      <h1>Tu plan no está activo</h1>
      <p class="wall__lead">
        Para seguir usando tu agenda, tus clientes y tu equipo hace falta un plan al día. Elige uno y
        vuelves a entrar en un minuto.
      </p>

      <div class="wall__plans">
        @for (plan of plans(); track plan.code) {
          <section class="pn-card wall__plan">
            <h2>{{ plan.name }}</h2>
            <p class="wall__price pn-tabular">{{ money(plan.priceCents) }}<span>/mes</span></p>
            <ul>
              @for (feature of plan.features; track feature.code) {
                <li><span class="material-symbols-rounded fill">check_circle</span>{{ feature.name }}</li>
              }
            </ul>
            <button type="button" class="pn-btn pn-btn--primary pn-btn--block wall__cta"
                    [disabled]="busy() !== null" (click)="choose(plan)">
              @if (busy() === plan.code) {
                <span class="pn-spinner"></span>
              } @else {
                Activar {{ plan.name }}
              }
            </button>
          </section>
        }
      </div>

      <p class="wall__safe">
        <span class="material-symbols-rounded">lock</span>
        Pago seguro con Stripe. Bipsy no ve ni guarda tu tarjeta.
      </p>

      <div class="wall__actions">
        <a class="pn-btn pn-btn--text" routerLink="/panel/soporte">Hablar con soporte</a>
        <button type="button" class="pn-btn pn-btn--secondary" (click)="recheck()">Ya lo he activado</button>
      </div>
      }
    </main>

    @if (paying(); as plan) {
      <app-stripe-checkout [plan]="plan" (closed)="onPaid($event)" />
    }
  `,
  styles: [
    `
      :host { display: block; }
      .wall { max-width: 940px; text-align: center; padding-top: 40px; }
      .wall__mark { height: 92px; width: auto; margin: 0 auto 26px; }
      .wall h1 {
        font-family: var(--ff-display);
        font-size: clamp(2rem, 3.4vw, 2.75rem);
        font-weight: 800;
        letter-spacing: -1.4px;
      }
      .wall__lead { margin: 16px auto 34px; max-width: 52ch; font-size: 1.0625rem; color: var(--clr-text-2); line-height: 1.6; }
      .wall__plans { display: grid; grid-template-columns: repeat(auto-fit, minmax(270px, 1fr)); gap: var(--pn-gap); }
      .wall__plan { display: flex; flex-direction: column; text-align: left; padding: 28px; }
      .wall__plan h2 { font-family: var(--ff-display); font-size: 1.375rem; font-weight: 800; letter-spacing: -0.5px; }
      .wall__price { margin: 8px 0 18px; font-family: var(--ff-display); font-size: 2.25rem; font-weight: 800; letter-spacing: -1.4px; }
      .wall__price span { font-size: 0.9375rem; font-weight: 600; color: var(--clr-text-3); letter-spacing: 0; }
      .wall__plan ul { display: grid; gap: 10px; }
      .wall__plan li { display: flex; gap: 10px; align-items: center; font-size: 0.9375rem; }
      .wall__plan .material-symbols-rounded { font-size: 20px; color: var(--clr-success); }
      .wall__cta { margin-top: 24px; }
      .wall__safe {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        margin-top: 26px;
        font-size: 0.875rem;
        color: var(--clr-text-3);
      }
      .wall__safe .material-symbols-rounded { font-size: 17px; }
      .wall__actions { display: flex; justify-content: center; gap: 10px; margin-top: 18px; }
      .wall__actions .pn-btn { text-decoration: none; }
    `,
  ],
})
export class PlanWallComponent {
  private readonly api = inject(Api);
  readonly auth = inject(AuthService);
  private readonly toasts = inject(ToastService);
  readonly money = money;

  private readonly checkout = inject(StripeCheckoutService);

  /**
   * The blocking paywall offers the whole catalogue on sale — never the free
   * plan, which is not sold: Bipsy grants it from the admin panel.
   */
  private readonly catalogue = resource<SubscriptionPlan[]>(
    () => this.api.get<SubscriptionPlan[]>('/subscriptions/plans'),
    [],
  );
  readonly plans = computed(() => this.catalogue.value().filter((plan) => plan.selectable));
  readonly busy = signal<string | null>(null);
  readonly paying = signal<SubscriptionPlan | null>(null);

  constructor() {
    if (this.auth.isBusiness()) {
      void this.catalogue.load();
      void this.settleReturn();
    }
  }

  /** Back from the bank's page (3-D Secure): close the contract and go in. */
  private async settleReturn(): Promise<void> {
    try {
      if (await this.checkout.settleRedirect()) location.assign('/panel');
    } catch (cause) {
      this.toasts.error(cause instanceof Error && !('status' in cause) ? cause.message : message(cause));
    }
  }

  choose(plan: SubscriptionPlan): void {
    this.paying.set(plan);
  }

  onPaid(done: boolean): void {
    this.paying.set(null);
    if (done) location.assign('/panel');
  }

  async recheck(): Promise<void> {
    await this.auth.refreshMe();
    if (!this.auth.subscriptionBlocked()) location.assign('/panel');
    else this.toasts.error('Todavía nos consta sin plan activo.');
  }
}
