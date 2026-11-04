import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api } from '../core/api/api';
import { AuthService } from '../core/auth/auth.service';
import { SubscriptionPlan, SubscriptionStatus } from '../core/api/models';
import { PlansStore } from '../core/data/plans.store';
import { message } from '../core/data/resource';
import { money } from '../core/util/format';
import { ConfirmService } from '../ui/confirm.service';
import { ToastService } from '../ui/toast.service';
import { PlanOptionComponent } from './plan-option.component';
import {
  diamondOf,
  managedWithStripe,
  methodExpiry,
  methodLabel,
  planSummary,
  storeName,
} from './plan-terms';
import { StripeCheckoutComponent, StripeCheckoutService } from './stripe-checkout';

/** Where «Ver otros planes» scrolls to. */
const PLANS_ANCHOR = 'planes';

/**
 * `/panel/ajustes/suscripcion` — `subscription_screen.dart`.
 *
 * Contratar, cambiar de plan, cancelar, reactivar y, durante un regalo,
 * dejar guardado el método de pago se hacen aquí mismo, con Stripe. El método
 * de pago y las facturas se gestionan en el portal de Stripe. Lo contratado en
 * el móvil (tiendas) se gestiona allí: aquí solo se dice.
 *
 * Solo salen los planes que se venden (/subscriptions/plans): el plan
 * gratis no se contrata, lo regala Bipsy desde el panel de administración.
 */
@Component({
  selector: 'app-panel-suscripcion',
  standalone: true,
  imports: [RouterLink, StripeCheckoutComponent, PlanOptionComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './suscripcion.component.html',
  styleUrl: './suscripcion.component.css',
})
export class SuscripcionComponent {
  private readonly api = inject(Api);
  private readonly auth = inject(AuthService);
  private readonly confirm = inject(ConfirmService);
  private readonly toasts = inject(ToastService);
  private readonly store = inject(PlansStore);
  private readonly checkout = inject(StripeCheckoutService);

  readonly methodLabel = methodLabel;
  readonly methodExpiry = methodExpiry;
  readonly plansAnchor = PLANS_ANCHOR;

  readonly busy = signal<string | null>(null);
  /** The plan whose payment dialog is open, and whether it buys or only saves the method. */
  readonly paying = signal<{ plan: SubscriptionPlan; mode: 'buy' | 'save' } | null>(null);

  readonly status = computed(() => this.auth.profile()?.subscription ?? null);
  readonly current = computed(() => this.status()?.planCode ?? null);
  readonly summary = computed(() => {
    const status = this.status();
    return status ? planSummary(status, new Date()) : null;
  });
  readonly diamond = computed(() => diamondOf(this.current()));

  /** App Store / Google Play: managed from the phone's store, never from here. */
  readonly storeBilled = computed(() => storeName(this.status()));
  readonly withStripe = computed(() => managedWithStripe(this.status()));
  readonly isGift = computed(() => this.status()?.gift === true);
  /** The gifted plan, which is what «Guardar método de pago» keeps after the gift. */
  readonly giftPlan = computed(() => this.store.selectable().find((plan) => plan.code === this.current()) ?? null);

  /**
   * What is on sale for this business: selectable plans only, narrowed to
   * offeredPlanCodes while it has something live (the server's rule, same
   * as _offered in plan_selection_screen.dart).
   */
  readonly plans = computed(() => {
    const selectable = this.store.selectable();
    const offered = this.status()?.offeredPlanCodes ?? [];
    const current = this.current();
    const shown = offered.length
      ? selectable.filter((plan) => offered.includes(plan.code) || plan.code === current)
      : selectable;
    return shown.length ? shown : selectable;
  });

  constructor() {
    void this.store.load();
    void this.settleReturn();
  }

  /** The pill next to a plan's name. */
  badgeFor(plan: SubscriptionPlan): string | null {
    const status = this.status();
    if (status?.scheduled?.planCode === plan.code) return 'Al acabar el regalo';
    return plan.code === this.current() ? 'Tu plan' : null;
  }

  /** The button of each plan; null hides it (nothing to do with that plan from here). */
  ctaFor(plan: SubscriptionPlan): string | null {
    const status = this.status();
    if (this.storeBilled()) return null;
    if (status?.gift) {
      if (status.scheduled?.planCode === plan.code) return null;
      if (!status.scheduled && plan.code === this.current()) return 'Guardar método de pago';
      return `Seguir después con ${plan.name}`;
    }
    if (status?.canChangePlan) return plan.code === this.current() ? null : `Cambiar a ${plan.name}`;
    return status?.trialAvailable && (plan.trialMonths ?? 0) > 0
      ? 'Empezar mes gratis'
      : `Suscribirme por ${money(plan.priceCents)}`;
  }

  /**
   * Back from a method that needed the bank's page (3-D Secure, SEPA…): Stripe
   * returns with the SetupIntent in the URL and the contract is closed here.
   */
  private async settleReturn(): Promise<void> {
    try {
      const status = await this.checkout.settleRedirect();
      if (status) this.toasts.show(status.scheduled ? 'Método de pago guardado' : 'Plan activado');
    } catch (cause) {
      this.toasts.error(cause instanceof Error && !('status' in cause) ? cause.message : message(cause));
    }
  }

  /**
   * Choosing a plan means four different things:
   *  - during a gift with nothing ready: save the method, the plan starts when the gift ends;
   *  - during a gift with a plan ready, or with a contracted subscription: change plan;
   *  - otherwise: contract it (free month and offer if it is the first plan).
   * The backend decides the money in every case; this only picks the call.
   */
  async choose(plan: SubscriptionPlan): Promise<void> {
    const status = this.status();
    if (status?.gift && !status.scheduled) {
      this.paying.set({ plan, mode: 'save' });
      return;
    }
    if (!status?.canChangePlan) {
      this.paying.set({ plan, mode: 'buy' });
      return;
    }
    if (plan.code === this.current() && !status.gift) return;
    await this.changePlan(plan, status);
  }

  private async changePlan(plan: SubscriptionPlan, status: SubscriptionStatus): Promise<void> {
    const answer = await this.confirm.ask({
      title: `Cambiar a ${plan.name}`,
      message: this.changeMessage(plan, status),
      confirmLabel: 'Cambiar de plan',
    });
    if (!answer.ok) return;
    this.busy.set(plan.code);
    try {
      await this.api.post<SubscriptionStatus>('/subscriptions/change-plan', { planCode: plan.code });
      await this.auth.refreshMe();
      this.toasts.show('Plan actualizado');
    } catch (cause) {
      this.toasts.error(message(cause));
    } finally {
      this.busy.set(null);
    }
  }

  private changeMessage(plan: SubscriptionPlan, status: SubscriptionStatus): string {
    const price = `${money(plan.priceCents)} al mes`;
    const base = status.gift
      ? `Cuando acabe el regalo seguirás con ${plan.name}, a ${price}.`
      : `Pagarás ${price}. Lo que quede del periodo actual se prorratea en la próxima factura.`;
    const currentLimit = this.store.selectable().find((p) => p.code === this.current())?.portfolioLimit ?? 0;
    return plan.portfolioLimit < currentLimit
      ? `${base} Las fotos que pasen de ${plan.portfolioLimit} se guardan sin verse.`
      : base;
  }

  onPaid(done: boolean): void {
    const mode = this.paying()?.mode;
    this.paying.set(null);
    if (done) this.toasts.show(mode === 'save' ? 'Método de pago guardado' : 'Plan activado');
  }

  /** Stripe's customer portal: change the payment method or see the invoices. */
  async openPortal(): Promise<void> {
    this.busy.set('portal');
    try {
      await this.checkout.openPortal();
    } catch (cause) {
      this.toasts.error(message(cause));
      this.busy.set(null);
    }
  }

  scrollToPlans(): void {
    document.getElementById(PLANS_ANCHOR)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async cancel(): Promise<void> {
    const status = this.status();
    const gift = status?.gift === true;
    const answer = await this.confirm.ask(
      gift
        ? {
            title: 'No seguir al acabar el regalo',
            message: 'No se te cobrará nada. Cuando acabe el regalo tendrás que elegir un plan para seguir usando Bipsy.',
            confirmLabel: 'No seguir',
            cancelLabel: 'Seguir después',
            destructive: true,
          }
        : {
            title: 'Cancelar la suscripción',
            message:
              'Seguirás teniendo el plan hasta el final del periodo, también si estás en el mes gratis. Después dejarás de poder usar la agenda.',
            confirmLabel: 'Cancelar el plan',
            cancelLabel: 'Seguir con él',
            destructive: true,
          },
    );
    if (!answer.ok) return;
    this.busy.set('cancel');
    try {
      await this.api.post('/subscriptions/cancel');
      await this.auth.refreshMe();
      this.toasts.show(gift ? 'No se te cobrará al acabar el regalo' : 'Se cancelará al final del periodo');
    } catch (cause) {
      this.toasts.error(message(cause));
    } finally {
      this.busy.set(null);
    }
  }

  async resume(): Promise<void> {
    this.busy.set('resume');
    try {
      await this.api.post('/subscriptions/resume');
      await this.auth.refreshMe();
      this.toasts.show('Suscripción reactivada');
    } catch (cause) {
      this.toasts.error(message(cause));
    } finally {
      this.busy.set(null);
    }
  }
}
