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
import {
  CheckoutResponse,
  PortalResponse,
  SubscriptionConfig,
  SubscriptionPlan,
  SubscriptionStatus,
} from '../core/api/models';
import { AuthService } from '../core/auth/auth.service';
import { message } from '../core/data/resource';
import { fromInstant } from '../core/util/dates';
import { money } from '../core/util/format';
import { PnDialogComponent } from '../ui/dialog.component';
import { dayMonth, offerTerm, visibleOffer } from './plan-terms';

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
 * Paying the plan from the browser: card, SEPA bank account, Apple Pay and
 * Google Pay, all through Stripe's Payment Element.
 *
 * The backend opens the subscription in Stripe (with the free month, the
 * offer, or starting the day a gift ends) and hands over a SetupIntent that
 * takes `card` and `sepa_debit` (`POST /subscriptions/checkout {channel:
 * 'WEB'}`). Apple Pay and Google Pay come in as `card`: the Payment Element
 * shows them on its own where the browser and the registered domain allow it.
 * The method is saved with `stripe.confirmSetup` and the contract is closed with
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
   * Stripe's customer portal (change the payment method, invoices). Leaves the
   * panel: Stripe sends the browser back to Mi plan when done.
   */
  async openPortal(): Promise<void> {
    const { url } = await this.api.post<PortalResponse>('/subscriptions/portal');
    window.location.href = url;
  }

  /**
   * Back from a redirect: Stripe puts the SetupIntent in the URL. Returns
   * the new status when it closed a contract (null if there was nothing to
   * settle), and cleans the address bar.
   */
  async settleRedirect(): Promise<SubscriptionStatus | null> {
    const params = new URLSearchParams(location.search);
    const secret = params.get(RETURN_PARAM);
    if (!secret) return null;
    history.replaceState({}, '', location.pathname);
    const config = await this.config();
    if (!config.publishableKey) return null;
    const stripe = await this.load(config.publishableKey);
    const result = await stripe.retrieveSetupIntent(secret);
    const method = paymentMethodOf(result);
    if (!method) throw new Error(result.error?.message ?? 'El banco no ha autorizado el método de pago.');
    return this.confirm(method);
  }
}

/**
 * A SetupIntent that saved its method. `processing` counts too: a bank debit
 * can stay there for a moment, and the mandate is already signed.
 */
const SAVED_STATES = ['succeeded', 'processing'];

function paymentMethodOf(result: SetupIntentResult): string | null {
  const pm = result.setupIntent?.payment_method;
  if (!SAVED_STATES.includes(result.setupIntent?.status ?? '') || !pm) return null;
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
    <pn-dialog [title]="title()" (closed)="closed.emit(done())">
      @if (done()) {
        <div class="sc-done">
          <span class="material-symbols-rounded fill">check_circle</span>
          <p class="sc-done__title">{{ saving ? 'Método de pago guardado' : 'Ya tienes ' + plan.name }}</p>
          <p class="pn-dim">
            @if (saving && firstCharge()) {
              Seguirás con {{ plan.name }} cuando acabe el regalo. El primer cobro será el {{ firstCharge() }}.
            } @else if (freeUntil()) {
              No se te cobra nada hasta el {{ freeUntil() }}. Puedes cancelar antes desde Mi plan.
            } @else {
              Tu plan está activo. Las facturas llegarán a tu correo.
            }
          </p>
        </div>
      } @else {
        <div class="sc-plan">
          <div>
            <p class="sc-plan__name">{{ plan.name }}</p>
            @if (offer; as o) {
              <p class="pn-dim sc-plan__line">{{ o.label }} · {{ offerTerm(o, !!freeUntil()) }}</p>
            } @else if (freeUntil()) {
              <p class="pn-dim sc-plan__line">1.er mes gratis</p>
            }
          </div>
          <p class="sc-plan__price pn-tabular">
            @if (offer; as o) {
              <s>{{ money(plan.priceCents) }}</s> {{ money(o.priceCents) }}
            } @else {
              {{ money(plan.priceCents) }}
            }<span>/mes</span>
          </p>
        </div>

        @if (loading()) {
          <div class="pn-skeleton" style="height:190px"></div>
        }
        <div #mount class="sc-element" [class.sc-element--hidden]="loading()"></div>

        @if (firstCharge(); as when) {
          <p class="sc-note">
            No se cobra nada hoy. El primer cobro será el {{ when }}.
            @if (!saving) { Puedes cancelar antes desde Mi plan. }
          </p>
        } @else if (!loading() && !error()) {
          <p class="sc-note">Se cobra hoy y cada mes por adelantado.</p>
        }

        @if (error(); as text) {
          <p class="pn-field__error" role="alert">{{ text }}</p>
        }
        <p class="sc-safe">
          <span class="material-symbols-rounded">lock</span>
          Pago seguro con Stripe. Bipsy no ve ni guarda tus datos de pago.
        </p>
      }

      <ng-container dialogActions>
        @if (done()) {
          <button type="button" class="pn-btn pn-btn--primary" (click)="closed.emit(true)">{{ saving ? 'Hecho' : 'Empezar' }}</button>
        } @else {
          <button type="button" class="pn-btn pn-btn--secondary" (click)="closed.emit(false)">Cancelar</button>
          <button type="button" class="pn-btn pn-btn--primary" [disabled]="busy() || loading() || !ready()" (click)="pay()">
            @if (busy()) { <span class="pn-spinner"></span> } @else { {{ actionLabel() }} }
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
      .sc-plan__price s { font-size: 0.9375rem; font-weight: 600; color: var(--clr-text-3); }
      .sc-note { margin-top: 14px; font-size: 0.8125rem; color: var(--clr-text-2); line-height: 1.5; }
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
  /** The business's status, for the offer: only on the first plan. */
  @Input() status: SubscriptionStatus | null = null;
  /**
   * `save` during a gift: nothing is bought, the method is kept and the plan
   * starts (first charge) the day the gift ends. The backend decides that on
   * its own from the same checkout call; this only changes the words.
   */
  @Input() mode: 'buy' | 'save' = 'buy';
  /** Emits true when the plan got contracted (or the method saved). */
  @Output() closed = new EventEmitter<boolean>();
  @ViewChild('mount') private mountEl?: ElementRef<HTMLElement>;

  private readonly service = inject(StripeCheckoutService);
  readonly money = money;
  readonly offerTerm = offerTerm;

  readonly loading = signal(true);
  readonly ready = signal(false);
  readonly busy = signal(false);
  readonly done = signal(false);
  readonly error = signal<string | null>(null);
  /** «4 de diciembre» while the free month lasts, from the checkout's answer. */
  readonly freeUntil = signal<string | null>(null);
  /** When the first charge happens, if not today. */
  readonly firstCharge = signal<string | null>(null);

  get saving(): boolean {
    return this.mode === 'save';
  }

  get offer() {
    return this.saving ? null : visibleOffer(this.plan, this.status);
  }

  title(): string {
    if (this.done()) return '¡Listo!';
    return this.saving ? 'Guardar método de pago' : `Contratar ${this.plan.name}`;
  }

  actionLabel(): string {
    if (this.saving) return 'Guardar método de pago';
    return this.freeUntil() ? 'Guardar y empezar' : 'Pagar y activar';
  }

  private stripe?: StripeJs;
  private elements?: StripeElements;
  private element?: StripeElement;

  async ngAfterViewInit(): Promise<void> {
    try {
      const config = await this.service.config();
      if (!config.enabled || !config.publishableKey) {
        throw new Error('Ahora mismo no se pueden contratar planes desde la web. Escríbenos y lo vemos.');
      }
      const [stripe, checkout] = await Promise.all([
        this.service.load(config.publishableKey),
        this.service.start(this.plan.code),
      ]);
      if (!checkout.clientSecret) throw new Error('No se ha podido preparar el pago. Inténtalo en unos minutos.');
      const now = new Date();
      if (checkout.trialEndsAt) this.freeUntil.set(dayMonth(fromInstant(checkout.trialEndsAt), now));
      if (checkout.firstChargeAt && fromInstant(checkout.firstChargeAt).getTime() > now.getTime()) {
        this.firstCharge.set(dayMonth(fromInstant(checkout.firstChargeAt), now));
      }

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
      if (!method) throw new Error(result.error?.message ?? 'No se ha podido guardar el método de pago.');
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
