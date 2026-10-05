import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api } from '../core/api/api';
import { AuthService } from '../core/auth/auth.service';
import { SubscriptionPlan, SubscriptionStatus } from '../core/api/models';
import { resource, message } from '../core/data/resource';
import { fromInstant, longDate } from '../core/util/dates';
import { money } from '../core/util/format';
import { ConfirmService } from '../ui/confirm.service';
import { ToastService } from '../ui/toast.service';
import { StripeCheckoutComponent, StripeCheckoutService } from './stripe-checkout';

/**
 * `/panel/ajustes/suscripcion` — `subscription_screen.dart`.
 *
 * Contratar, cambiar de plan, cancelar y reactivar se hacen aquí mismo.
 * Contratar abre el pago con tarjeta de Stripe (StripeCheckoutComponent);
 * lo contratado en el móvil (tiendas) se sigue gestionando allí, y el backend
 * lo dice con su propio mensaje si se intenta cambiar desde aquí.
 *
 * Solo salen los planes que se venden (/subscriptions/plans): el plan
 * gratis no se contrata, lo regala Bipsy desde el panel de administración.
 */
@Component({
  selector: 'app-panel-suscripcion',
  standalone: true,
  imports: [RouterLink, StripeCheckoutComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './suscripcion.component.html',
  styleUrl: './suscripcion.component.css',
})
export class SuscripcionComponent {
  private readonly api = inject(Api);
  private readonly auth = inject(AuthService);
  private readonly confirm = inject(ConfirmService);
  private readonly toasts = inject(ToastService);

  readonly money = money;
  readonly longDate = longDate;
  // Subscription dates are instants (UTC, with a `Z`).
  readonly fromInstant = fromInstant;

  private readonly checkout = inject(StripeCheckoutService);

  private readonly catalogue = resource<SubscriptionPlan[]>(
    () => this.api.get<SubscriptionPlan[]>('/subscriptions/plans'),
    [],
  );
  readonly busy = signal<string | null>(null);
  /** The plan whose card dialog is open. */
  readonly paying = signal<SubscriptionPlan | null>(null);

  /**
   * What is on sale for this business: selectable plans only, narrowed to
   * offeredPlanCodes while it has something live (the server's rule, same
   * as _offered in plan_selection_screen.dart).
   */
  readonly plans = computed(() => {
    const selectable = this.catalogue.value().filter((plan) => plan.selectable);
    const offered = this.status()?.offeredPlanCodes ?? [];
    const current = this.current();
    const shown = offered.length
      ? selectable.filter((plan) => offered.includes(plan.code) || plan.code === current)
      : selectable;
    return shown.length ? shown : selectable;
  });

  constructor() {
    void this.catalogue.load();
    void this.settleReturn();
  }

  readonly status = computed(() => this.auth.profile()?.subscription ?? null);
  readonly current = computed(() => this.status()?.planCode ?? null);

  readonly stateLabel = computed(
    () =>
      ({
        WELCOME_TRIAL: 'Prueba de bienvenida',
        TRIAL: 'En prueba',
        ACTIVE: 'Activo',
        PAST_DUE: 'Pago pendiente',
        CANCELED: 'Cancelado',
        EXPIRED: 'Caducado',
        UNKNOWN: 'Sin plan',
      })[this.status()?.state ?? 'UNKNOWN'],
  );

  readonly tone = computed(() => {
    const state = this.status()?.state;
    if (state === 'ACTIVE') return 'success';
    if (state === 'TRIAL' || state === 'WELCOME_TRIAL') return 'accent';
    if (state === 'PAST_DUE') return 'warn';
    return 'grey';
  });

  /**
   * Back from a card that needed the bank's page (3-D Secure): Stripe returns
   * with the SetupIntent in the URL and the contract is closed here.
   */
  private async settleReturn(): Promise<void> {
    try {
      if (await this.checkout.settleRedirect()) this.toasts.show('Plan activado');
    } catch (cause) {
      this.toasts.error(cause instanceof Error && !('status' in cause) ? cause.message : message(cause));
    }
  }

  /**
   * Contratar o cambiar de plan.
   *
   * Con una suscripción ya contratada (`canChangePlan`) es un cambio: el
   * backend prorratea y devuelve el estado nuevo. Si no, se abre el pago con
   * tarjeta. Si lo contratado vino de la tienda del móvil, el backend contesta
   * que se cambia desde allí y se enseña tal cual.
   */
  async choose(plan: SubscriptionPlan): Promise<void> {
    if (!this.status()?.canChangePlan) {
      this.paying.set(plan);
      return;
    }
    if (plan.code === this.current()) return;
    const answer = await this.confirm.ask({
      title: `Cambiar a ${plan.name}`,
      message: `Pagarás ${money(plan.priceCents)} al mes. Lo que quede del periodo actual se prorratea en la próxima factura.`,
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

  onPaid(done: boolean): void {
    this.paying.set(null);
    if (done) this.toasts.show('Plan activado');
  }

  async cancel(): Promise<void> {
    const answer = await this.confirm.ask({
      title: 'Cancelar la suscripción',
      message:
        'Seguirás teniendo el plan hasta el final del periodo que ya has pagado. Después dejarás de poder usar la agenda.',
      confirmLabel: 'Cancelar el plan',
      cancelLabel: 'Seguir con él',
      destructive: true,
    });
    if (!answer.ok) return;
    this.busy.set('cancel');
    try {
      await this.api.post('/subscriptions/cancel');
      await this.auth.refreshMe();
      this.toasts.show('Se cancelará al final del periodo');
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
