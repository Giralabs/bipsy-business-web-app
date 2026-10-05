import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Injectable,
  Input,
  OnDestroy,
  Output,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { Api } from '../core/api/api';
import { CheckoutResponse, SubscriptionConfig, SubscriptionPlan, SubscriptionStatus } from '../core/api/models';
import { AuthService } from '../core/auth/auth.service';
import { message } from '../core/data/resource';
import { fromInstant, longDate } from '../core/util/dates';
import { money } from '../core/util/format';
import { PnDialogComponent } from '../ui/dialog.component';

/* Just the bits of Stripe.js v3 the panel uses. */
interface StripeElement { mount(el: HTMLElement): void; destroy(): void; on(ev: string, cb: (e: { complete?: boolean }) => void): void }
interface StripeElements { create(type: 'payment', options?: object): StripeElement; submit(): Promise<{ error?: { message?: string } }> }
interface SetupIntentResult {
  error?: { message?: string };
  setupIntent?: { status: string; payment_method: string | { id: string } | null };
}
interface StripeJs {
  elements(options: object): StripeElements;
  confirmSetup(options: object): Promise<SetupIntentResult>;
  retrieveSetupIntent(clientSecret: string): Promise<SetupIntentResult>;
}
declare global {
  interface Window { Stripe?: (key: string, options?: object) => StripeJs }
}

/** Where the browser comes back if a card needs a redirect (3-D Secure, banks…). */
export const RETURN_PARAM = 'setup_intent_client_secret';

/**
 * Card payments for the plan, from the browser.
 *
 * The backend opens the subscription in Stripe with its trial and hands over
 * a SetupIntent (`POST /subscriptions/checkout {channel: 'WEB'}`); the card is
 * saved with Stripe's Payment Element and the contract is closed with
 * `POST /subscriptions/confirm {paymentMethodId}` — the same two steps the
 * card flow of the app had. `channel: 'WEB'` is what makes the backend use
 * Stripe even when the live gateway for the phone is the app stores.
 */
@Injectable({ providedIn: 'root' })
export class StripeCheckoutService {
  private readonly api = inject(Api);
  private readonly auth = inject(AuthService);
  private stripe: Promise<StripeJs> | null = null;
  private key: string | null = null;

  async config(): Promise<SubscriptionConfig> {
    return this.api.get<SubscriptionConfig>('/subscriptions/config', { channel: 'WEB' });
  }

  /** Loads Stripe.js once. It has to come from js.stripe.com (PCI). */
  load(publishableKey: string): Promise<StripeJs> {
    if (this.stripe && this.key === publishableKey) return this.stripe;
    this.key = publishableKey;
    this.stripe = new Promise<StripeJs>((resolve, reject) => {
      const ready = () => (window.Stripe ? resolve(window.Stripe(publishableKey, { locale: 'es' })) : reject());
      if (window.Stripe) return ready();
      const script = document.createElement('script');
      script.src = 'https://js.stripe.com/v3/';
      script.onload = ready;
      script.onerror = () => {
        this.stripe = null;
        reject(new Error('No se ha podido cargar el formulario de pago. Revisa tu conexión.'));
      };
      document.head.appendChild(script);
    });
    return this.stripe;
  }

  start(planCode: string): Promise<CheckoutResponse> {
    return this.api.post<CheckoutResponse>('/subscriptions/checkout', { planCode, channel: 'WEB' });
  }

  async confirm(paymentMethodId: string): Promise<SubscriptionStatus> {
    const status = await this.api.post<SubscriptionStatus>('/subscriptions/confirm', { paymentMethodId });
    await this.auth.refreshMe();
    return status;
  }

  /**
   * Back from a redirect: Stripe puts the SetupIntent in the URL. Returns
   * true when it closed a contract, and cleans the address bar.
   */
  async settleRedirect(): Promise<boolean> {
    const params = new URLSearchParams(location.search);
    const secret = params.get(RETURN_PARAM);
    if (!secret) return false;
    history.replaceState({}, '', location.pathname);
    const config = await this.config();
    if (!config.publishableKey) return false;
    const stripe = await this.load(config.publishableKey);
    const result = await stripe.retrieveSetupIntent(secret);
    const method = paymentMethodOf(result);
    if (!method) throw new Error(result.error?.message ?? 'El banco no ha autorizado la tarjeta.');
    await this.confirm(method);
    return true;
  }
}

function paymentMethodOf(result: SetupIntentResult): string | null {
  const pm = result.setupIntent?.payment_method;
  if (result.setupIntent?.status !== 'succeeded' || !pm) return null;
  return typeof pm === 'string' ? pm : pm.id;
}

/**
 * The card dialog: plan summary, the Payment Element and one button.
 *
 * Opening it already opens the subscription (and marks the trial as used), so
 * it is only shown after the owner picked a plan. Abandoning it is harmless:
 * the next attempt discards the unfinished one and gives the trial back.
 */
@Component({
  selector: 'app-stripe-checkout',
  standalone: true,
  imports: [PnDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <pn-dialog [title]="done() ? '¡Listo!' : 'Contratar ' + plan.name" (closed)="closed.emit(done())">
      @if (done()) {
        <div class="sc-done">
          <span class="material-symbols-rounded fill">check_circle</span>
          <p class="sc-done__title">Ya tienes {{ plan.name }}</p>
          <p class="pn-dim">
            @if (trialEnds()) {
              No se te cobra nada hasta el {{ trialEnds() }}. Puedes cancelar antes desde Mi plan.
            } @else {
              Tu plan está activo. Las facturas llegarán a tu correo.
            }
          </p>
        </div>
      } @else {
        <div class="sc-plan">
          <div>
            <p class="sc-plan__name">{{ plan.name }}</p>
            <p class="pn-dim sc-plan__line">
              @if (trialEnds()) { Gratis hasta el {{ trialEnds() }}, después } {{ money(plan.priceCents) }} al mes
            </p>
          </div>
          <p class="sc-plan__price pn-tabular">{{ money(plan.priceCents) }}<span>/mes</span></p>
        </div>

        @if (loading()) {
          <div class="pn-skeleton" style="height:190px"></div>
        }
        <div #mount class="sc-element" [class.sc-element--hidden]="loading()"></div>

        @if (error(); as text) {
          <p class="pn-field__error" role="alert">{{ text }}</p>
        }
        <p class="sc-safe">
          <span class="material-symbols-rounded">lock</span>
          Pago seguro con Stripe. Bipsy no ve ni guarda tu tarjeta.
        </p>
      }

      <ng-container dialogActions>
        @if (done()) {
          <button type="button" class="pn-btn pn-btn--primary" (click)="closed.emit(true)">Empezar</button>
        } @else {
          <button type="button" class="pn-btn pn-btn--secondary" (click)="closed.emit(false)">Cancelar</button>
          <button type="button" class="pn-btn pn-btn--primary" [disabled]="busy() || loading() || !ready()" (click)="pay()">
            @if (busy()) { <span class="pn-spinner"></span> } @else { {{ trialEnds() ? 'Empezar la prueba' : 'Pagar y activar' }} }
          </button>
        }
      </ng-container>
    </pn-dialog>
  `,
  styles: [
    `
      .sc-plan {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        margin-bottom: 18px;
        padding: 16px 18px;
        border-radius: var(--pn-radius-row);
        background: var(--pn-field);
      }
      .sc-plan__name { font-family: var(--ff-display); font-size: 1.125rem; font-weight: 800; }
      .sc-plan__line { margin-top: 2px; font-size: 0.8125rem; }
      .sc-plan__price { font-family: var(--ff-display); font-size: 1.5rem; font-weight: 800; white-space: nowrap; }
      .sc-plan__price span { font-size: 0.8125rem; font-weight: 600; color: var(--clr-text-3); }
      .sc-element { min-height: 190px; }
      .sc-element--hidden { position: absolute; opacity: 0; pointer-events: none; }
      .sc-safe { display: flex; align-items: center; gap: 8px; margin-top: 16px; font-size: 0.8125rem; color: var(--clr-text-3); }
      .sc-safe .material-symbols-rounded { font-size: 17px; }
      .sc-done { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 10px 0 6px; }
      .sc-done > .material-symbols-rounded { font-size: 56px; color: var(--clr-success); }
      .sc-done__title { margin: 12px 0 6px; font-family: var(--ff-display); font-size: 1.375rem; font-weight: 800; }
    `,
  ],
})
export class StripeCheckoutComponent implements AfterViewInit, OnDestroy {
  @Input({ required: true }) plan!: SubscriptionPlan;
  /** Emits true when the plan got contracted. */
  @Output() closed = new EventEmitter<boolean>();
  @ViewChild('mount') private mountEl?: ElementRef<HTMLElement>;

  private readonly service = inject(StripeCheckoutService);
  readonly money = money;

  readonly loading = signal(true);
  readonly ready = signal(false);
  readonly busy = signal(false);
  readonly done = signal(false);
  readonly error = signal<string | null>(null);
  readonly trialEnds = signal<string | null>(null);

  private stripe?: StripeJs;
  private elements?: StripeElements;
  private element?: StripeElement;

  async ngAfterViewInit(): Promise<void> {
    try {
      const config = await this.service.config();
      if (!config.enabled || !config.publishableKey) {
        throw new Error('Ahora mismo no se pueden contratar planes con tarjeta. Escríbenos y lo vemos.');
      }
      const [stripe, checkout] = await Promise.all([
        this.service.load(config.publishableKey),
        this.service.start(this.plan.code),
      ]);
      if (!checkout.clientSecret) throw new Error('No se ha podido preparar el pago. Inténtalo en unos minutos.');
      if (checkout.trialEndsAt) this.trialEnds.set(longDate(fromInstant(checkout.trialEndsAt)).toLowerCase());

      this.stripe = stripe;
      this.elements = stripe.elements({
        clientSecret: checkout.clientSecret,
        appearance: appearance(),
        fonts: [{ cssSrc: 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700&display=swap' }],
      });
      this.element = this.elements.create('payment', { layout: 'tabs' });
      this.element.on('change', (event) => this.ready.set(event.complete === true));
      this.element.on('ready', () => this.loading.set(false));
      if (this.mountEl) this.element.mount(this.mountEl.nativeElement);
    } catch (cause) {
      this.loading.set(false);
      this.error.set(cause instanceof Error && !('status' in cause) ? cause.message : message(cause));
    }
  }

  async pay(): Promise<void> {
    if (!this.stripe || !this.elements || this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      const submitted = await this.elements.submit();
      if (submitted.error) throw new Error(submitted.error.message);
      const result = await this.stripe.confirmSetup({
        elements: this.elements,
        redirect: 'if_required',
        confirmParams: { return_url: `${location.origin}${location.pathname}` },
      });
      const method = paymentMethodOf(result);
      if (!method) throw new Error(result.error?.message ?? 'No se ha podido guardar la tarjeta.');
      await this.service.confirm(method);
      this.done.set(true);
    } catch (cause) {
      this.error.set(cause instanceof Error && !('status' in cause) ? cause.message : message(cause));
    } finally {
      this.busy.set(false);
    }
  }

  ngOnDestroy(): void {
    this.element?.destroy();
  }
}

/** Stripe's form in the panel's own colours, light or dark. */
function appearance(): object {
  const dark = matchMedia('(prefers-color-scheme: dark)').matches;
  return {
    theme: dark ? 'night' : 'stripe',
    variables: {
      colorPrimary: dark ? '#ECEFF1' : '#262B31',
      colorBackground: dark ? '#2B3137' : '#EFF2F0',
      colorText: dark ? '#F5F7F6' : '#1A2529',
      colorDanger: dark ? '#FF8A80' : '#D70015',
      fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
      borderRadius: '14px',
      spacingUnit: '4px',
    },
    rules: { '.Input': { border: 'none', boxShadow: 'none' }, '.Tab': { border: 'none' } },
  };
}
