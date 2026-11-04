import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';
import { SubscriptionPlan } from '../core/api/models';
import { PlansStore } from '../core/data/plans.store';
import { message } from '../core/data/resource';
import { money } from '../core/util/format';
import { ToastService } from '../ui/toast.service';
import { PlanOptionComponent } from './plan-option.component';
import { PLAN_CODES, wallLead, wallTitle } from './plan-terms';
import { StripeCheckoutComponent, StripeCheckoutService } from './stripe-checkout';

/**
 * `/panel/plan` — el muro de `plan_selection_screen.dart`.
 *
 * Lo decide el servidor (`profile.subscription.blocked`) y la guardia manda
 * aquí todo lo demás. Se paga con Stripe (tarjeta, cuenta bancaria SEPA,
 * Apple Pay o Google Pay) sin salir de la página. El título dice qué se acabó
 * (`endedAccess`) y el mes gratis y la oferta solo salen en el primer plan.
 */
@Component({
  selector: 'app-panel-plan-wall',
  standalone: true,
  imports: [RouterLink, StripeCheckoutComponent, PlanOptionComponent],
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
      <h1>{{ title() }}</h1>
      <p class="wall__lead">{{ lead() }}</p>

      <div class="wall__plans">
        @for (plan of plans(); track plan.code) {
          <app-plan-option
            [plan]="plan"
            [status]="status()"
            [cta]="ctaFor(plan)"
            [highlighted]="plan.code === recommended"
            [secondary]="plan.code !== recommended"
            [busy]="busy() === plan.code"
            [disabled]="busy() !== null"
            (choose)="choose($event)" />
        }
      </div>

      <p class="wall__safe">
        <span class="material-symbols-rounded">lock</span>
        Tarjeta, cuenta bancaria, Apple Pay o Google Pay. Pago seguro con Stripe: Bipsy no ve ni guarda tus datos de pago.
      </p>

      <div class="wall__actions">
        <a class="pn-btn pn-btn--text" routerLink="/panel/soporte">Hablar con soporte</a>
        <button type="button" class="pn-btn pn-btn--secondary" (click)="recheck()">Ya lo he activado</button>
      </div>
      }
    </main>

    @if (paying(); as plan) {
      <app-stripe-checkout [plan]="plan" [status]="status()" (closed)="onPaid($event)" />
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
      .wall__safe {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        margin-top: 26px;
        font-size: 0.875rem;
        color: var(--clr-text-3);
      }
      .wall__safe .material-symbols-rounded { font-size: 17px; }
      .wall__actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; margin-top: 18px; }
      .wall__actions .pn-btn { text-decoration: none; }
      @media (max-width: 480px) { .wall__plans { grid-template-columns: 1fr; } }
    `,
  ],
})
export class PlanWallComponent {
  readonly auth = inject(AuthService);
  private readonly toasts = inject(ToastService);
  private readonly store = inject(PlansStore);
  private readonly checkout = inject(StripeCheckoutService);

  /** The design's highlighted plan. */
  readonly recommended = PLAN_CODES.QUALITY;

  /**
   * The blocking paywall offers the whole catalogue on sale — never the free
   * plan, which is not sold: Bipsy grants it from the admin panel.
   */
  readonly plans = this.store.selectable;
  readonly status = computed(() => this.auth.profile()?.subscription ?? null);
  readonly busy = signal<string | null>(null);
  readonly paying = signal<SubscriptionPlan | null>(null);
  /** Courtesy days, for «se han acabado tus 3 días de prueba». */
  private readonly welcomeDays = signal<number | null>(null);

  readonly title = computed(() => wallTitle(this.status(), this.welcomeDays()));
  readonly lead = computed(() => wallLead(this.status()));

  constructor() {
    if (this.auth.isBusiness()) {
      void this.store.load();
      void this.settleReturn();
      void this.loadWelcomeDays();
    }
  }

  private async loadWelcomeDays(): Promise<void> {
    try {
      this.welcomeDays.set((await this.checkout.config()).welcomeTrialDays || null);
    } catch {
      // The title falls back to «tus días de cortesía»: nothing else depends on it.
      this.welcomeDays.set(null);
    }
  }

  ctaFor(plan: SubscriptionPlan): string {
    return this.status()?.trialAvailable && (plan.trialMonths ?? 0) > 0
      ? 'Empezar mes gratis'
      : `Suscribirme por ${money(plan.priceCents)}`;
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
