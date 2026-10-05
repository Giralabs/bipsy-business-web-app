import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api } from '../core/api/api';
import {
  PageResponse,
  PayoutAccount,
  PayoutBalance,
  PayoutOwnerPrefill,
  PayoutPayment,
  VerificationLink,
} from '../core/api/models';
import { message, resource } from '../core/data/resource';
import { fromInstant } from '../core/util/dates';
import { money } from '../core/util/format';
import { PnErrorComponent } from '../ui/controls';
import { ToastService } from '../ui/toast.service';
import { PayoutsFormComponent } from './payouts-form.component';
import { PayoutRefundDialogComponent, ddmmyyyy } from './payout-refund-dialog.component';

const PAGE_SIZE = 20;

/**
 * `/panel/ajustes/cobros` — `payouts_screen.dart`.
 *
 * The account the business charges ITS customers with (Stripe Connect). Not
 * to be confused with the subscription, where the business pays us.
 *
 * - No account yet (`NOT_STARTED`) → our own activation form, no redirect.
 * - Account open → its state, what Stripe could not verify (`issues[]`) with
 *   «Comprobar de nuevo» (`POST /refresh`), and once it can collect, the
 *   balance and the list of charges with the refund dialog.
 *
 * Dos salidas cuando la cuenta no llega a cobrar, en el mismo orden que la app:
 *
 *  - **Revisar mis datos** (`GET|PUT /details`) va primero porque resuelve más:
 *    el rechazo más común es una errata en el nombre o en la fecha, y eso se
 *    arregla escribiendo bien, sin fotos ni salir del panel.
 *  - **La verificación de Stripe** (`POST /verification-link`) es hasta donde
 *    llega el alta propia: una foto del DNI o una revisión de riesgo no se
 *    pueden mandar por la API. Se abre en otra pestaña y el enlace se pide
 *    justo antes, porque caduca en minutos y solo sirve una vez.
 */
@Component({
  selector: 'app-panel-cobros',
  standalone: true,
  imports: [RouterLink, PnErrorComponent, PayoutsFormComponent, PayoutRefundDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="pn-main">
      <a class="pn-btn pn-btn--text pn-btn--sm back" routerLink="/panel/ajustes">
        <span class="material-symbols-rounded">arrow_back</span>Ajustes
      </a>

      <div class="pn-head">
        <div class="pn-head__text">
          <p class="pn-head__greet">Lo que cobras por la app y cuándo llega a tu cuenta</p>
          <h1>Cobros</h1>
        </div>
      </div>

      @if (account.error() && !account.isLoaded) {
        <section class="pn-card">
          <pn-error title="No hemos podido cargar tu cuenta de cobros." [text]="account.error()!"
                    (retry)="account.reload()" />
        </section>
      } @else if (!account.isLoaded) {
        <div class="pn-skeleton" style="height:220px"></div>
      } @else if (needsForm()) {
        <app-payouts-form (activated)="onActivated($event)" />
      } @else if (editing()) {
        <!-- Corregir vive dentro de Cobros y no en su propia ruta: se vuelve
             aquí en cuanto se guarda, que es donde se ve si ha servido. -->
        <button type="button" class="pn-btn pn-btn--text pn-btn--sm back" (click)="editing.set(null)">
          <span class="material-symbols-rounded">arrow_back</span>Cobros
        </button>
        <h2 class="edit-title">Mis datos y cuenta bancaria</h2>
        <app-payouts-form [prefill]="editing()" (saved)="onDetailsSaved()" />
      } @else {
        <div class="pn-grid">
          <div class="pn-col-7">
            <!-- The state, tinted: this is not one more surface, it says where the account stands. -->
            <section class="state" [class.state--ready]="canCollect()">
              <span class="material-symbols-rounded">{{ canCollect() ? 'verified' : 'hourglass_top' }}</span>
              <div>
                <h2>{{ canCollect() ? 'Ya puedes cobrar con tarjeta' : 'Casi listo' }}</h2>
                <p>
                  {{ canCollect()
                    ? 'El dinero de cada cobro va directo a tu cuenta bancaria. Bipsy no se queda nada.'
                    : 'Todavía no puedes cobrar con tarjeta.' }}
                </p>
              </div>
              <span class="pn-status" [class]="'pn-status pn-status--' + tone()">{{ label() }}</span>
            </section>

            <!-- What Stripe could not verify. Without this the owner has an account that does not collect and no idea why. -->
            @for (issue of account.value().issues; track $index) {
              <div class="issue">
                <span class="material-symbols-rounded">error</span>
                <span>{{ issue.message }}</span>
              </div>
            }

            @if (!canCollect()) {
              <p class="pn-dim body">
                {{ account.value().issues.length === 0
                  ? 'Stripe está comprobando tus datos. Suele tardar poco y te avisamos en cuanto puedas cobrar. No tienes que hacer nada.'
                  : 'En cuanto lo tengas resuelto, comprueba aquí mismo.' }}
              </p>
              @if (account.value().issues.length > 0) {
                <p class="pn-dim body small">
                  Si no sabes cómo resolverlo,
                  <a routerLink="/panel/soporte">escríbenos</a> y lo miramos contigo.
                </p>
              }

              <!-- Con avisos pendientes lo primero es resolverlos; sin ellos no
                   hay nada que hacer salvo esperar, y un «completar
                   verificación» en grande haría creer que falta un paso suyo. -->
              <div class="fixes">
                @if (account.value().issues.length > 0) {
                  <button type="button" class="pn-btn pn-btn--primary" [disabled]="opening()" (click)="verify()">
                    @if (opening()) { <span class="pn-spinner"></span> } @else {
                      <span class="material-symbols-rounded">verified_user</span>Enviar lo que falta
                    }
                  </button>
                  <button type="button" class="pn-btn pn-btn--secondary" [disabled]="loadingDetails()" (click)="editDetails()">
                    @if (loadingDetails()) { <span class="pn-spinner"></span> } @else {
                      <span class="material-symbols-rounded">edit</span>Revisar mis datos
                    }
                  </button>
                  <button type="button" class="pn-btn pn-btn--text" [disabled]="checking()" (click)="check()">
                    @if (checking()) { <span class="pn-spinner"></span> Comprobando… } @else {
                      <span class="material-symbols-rounded">refresh</span>Comprobar de nuevo
                    }
                  </button>
                } @else {
                  <button type="button" class="pn-btn pn-btn--secondary" [disabled]="checking()" (click)="check()">
                    @if (checking()) { <span class="pn-spinner"></span> Comprobando… } @else {
                      <span class="material-symbols-rounded">refresh</span>Comprobar de nuevo
                    }
                  </button>
                }
              </div>

              @if (account.value().issues.length === 0) {
                <p class="pn-dim body small">
                  Si prefieres no esperar, puedes enviar ya tu documento de identidad y adelantar la
                  comprobación.
                </p>
                <div class="fixes">
                  <button type="button" class="pn-btn pn-btn--text" [disabled]="opening()" (click)="verify()">
                    @if (opening()) { <span class="pn-spinner"></span> } @else {
                      <span class="material-symbols-rounded">verified_user</span>Enviar mis datos ahora
                    }
                  </button>
                  <button type="button" class="pn-btn pn-btn--text" [disabled]="loadingDetails()" (click)="editDetails()">
                    @if (loadingDetails()) { <span class="pn-spinner"></span> } @else {
                      <span class="material-symbols-rounded">edit</span>Revisar mis datos
                    }
                  </button>
                </div>
              }

              @if (detailsError(); as text) {
                <p class="pn-field__error" role="alert">{{ text }}</p>
              }
            }

            @if (canCollect()) {
              <!-- Cambiar de banco es lo que más se toca de aquí, y hasta ahora
                   solo se llegaba a este formulario con la cuenta rota. Va antes
                   del saldo: es un ajuste, y debajo de la lista de cobros nadie
                   lo encontraría. -->
              <button type="button" class="pn-row details" [disabled]="loadingDetails()" (click)="editDetails()">
                <span class="material-symbols-rounded pn-row__icon">account_balance</span>
                <span class="pn-row__main">
                  <span class="pn-row__title">Mis datos y cuenta bancaria</span>
                  <span class="pn-row__sub">Nombre, domicilio y dónde se te ingresa el dinero.</span>
                </span>
                @if (loadingDetails()) {
                  <span class="pn-spinner"></span>
                } @else {
                  <span class="material-symbols-rounded pn-row__chev">arrow_forward_ios</span>
                }
              </button>
              @if (detailsError(); as text) {
                <p class="pn-field__error" role="alert">{{ text }}</p>
              }

              <!-- Failed charges are listed on purpose: money that did not arrive is exactly what the owner wants to see. -->
              <div class="pn-group payments">
                <p class="pn-group__head">Últimos cobros</p>
                @if (paymentsError() && payments().length === 0) {
                  <p class="pn-dim body">{{ paymentsError() }}</p>
                } @else if (!paymentsLoaded()) {
                  <div class="pn-skeleton" style="height:140px"></div>
                } @else if (payments().length === 0) {
                  <p class="pn-dim body">Todavía no has cobrado nada con tarjeta.</p>
                } @else {
                  <div class="pn-group__body">
                    @for (p of payments(); track p.id) {
                      <button type="button" class="pn-row pay" [disabled]="p.refundableCents <= 0"
                              [attr.title]="p.refundableCents > 0 ? 'Devolver' : null" (click)="refunding.set(p)">
                        <span class="material-symbols-rounded pay__icon"
                              [class.pay__icon--bad]="p.status === 'FAILED'"
                              [class.pay__icon--ok]="p.status !== 'FAILED' && p.refundedCents === 0">
                          {{ p.status === 'FAILED' ? 'error' : p.refundedCents > 0 ? 'undo' : 'check_circle' }}
                        </span>
                        <span class="pn-row__main">
                          <span class="pn-row__title">{{ p.concept }}</span>
                          <span class="pn-row__sub">
                            {{ p.status === 'FAILED' && p.failureReason ? p.failureReason : day(p.createdAt) }}
                          </span>
                          @if (p.refundedCents > 0) {
                            <span class="pn-row__sub">
                              {{ p.refundableCents > 0 ? 'Devuelto ' + money(p.refundedCents) : 'Devuelto entero' }}
                            </span>
                          }
                        </span>
                        <!-- The big figure is what the shop KEEPS: the one it will see at the bank. -->
                        <span class="pay__amount">
                          <strong class="pn-tabular">{{ p.status === 'FAILED' ? '—' : money(p.netCents) }}</strong>
                          @if (p.status !== 'FAILED' && (p.feeCents ?? 0) > 0) {
                            <span class="pn-row__sub pn-tabular">de {{ money(p.amountCents) }}</span>
                          }
                        </span>
                        @if (p.refundableCents > 0) {
                          <span class="material-symbols-rounded pn-row__chev">arrow_forward_ios</span>
                        }
                      </button>
                    }
                  </div>
                  @if (hasMore()) {
                    <button type="button" class="pn-btn pn-btn--text more" [disabled]="loadingMore()" (click)="loadMore()">
                      @if (loadingMore()) { <span class="pn-spinner"></span> } @else { Ver cobros anteriores }
                    </button>
                  }
                }
              </div>
            }
          </div>

          @if (canCollect()) {
            <div class="pn-col-5">
              <section class="pn-card">
                <div class="pn-block__head">
                  <span class="material-symbols-rounded">savings</span>
                  <h2>Tu dinero</h2>
                </div>
                @if (balance.error()) {
                  <!-- A balance we could not read is NOT painted as zero. -->
                  <p class="pn-dim body">No hemos podido leer tu saldo ahora mismo.</p>
                } @else if (!balance.isLoaded) {
                  <div class="pn-skeleton" style="height:80px"></div>
                } @else {
                  <div class="money">
                    <div>
                      <span class="money__label">De camino</span>
                      <span class="pn-dim money__hint">Validando transacciones</span>
                    </div>
                    <strong class="pn-tabular">{{ money(balance.value().pendingCents) }}</strong>
                  </div>
                  <!-- Only when there is something: a permanent zero reads as broken. -->
                  @if (balance.value().availableCents > 0) {
                    <div class="money">
                      <div>
                        <span class="money__label">Listo para ingresar</span>
                        <span class="pn-dim money__hint">Sale hacia tu banco automáticamente</span>
                      </div>
                      <strong class="pn-tabular">{{ money(balance.value().availableCents) }}</strong>
                    </div>
                  }
                  @if (balance.value().delayDays > 0) {
                    <p class="pn-dim body small">
                      Retenemos el dinero {{ balance.value().delayDays }} días para responder en caso de que un
                      cliente reclame un uso indebido de la plataforma, pasados esos días llegará a tu banco.
                    </p>
                  }
                }
              </section>
            </div>
          }
        </div>
      }
    </main>

    @if (refunding(); as payment) {
      <app-payout-refund-dialog [payment]="payment" (closed)="onRefundClosed($event)" />
    }
  `,
  styles: [
    `
      :host { display: block; }
      .back { margin: 0 0 14px -12px; text-decoration: none; }
      .body { font-size: 0.9375rem; line-height: 1.6; margin: 14px 0; }
      .body.small { font-size: 0.8125rem; margin-top: 0; }
      .body a { color: inherit; text-decoration: underline; }
      .state {
        display: flex;
        gap: 14px;
        align-items: flex-start;
        padding: 20px;
        border-radius: var(--pn-radius-card);
        background: var(--pn-accent-soft);
      }
      .state--ready { background: color-mix(in srgb, var(--clr-success, #2e7d32) 12%, transparent); }
      .state > .material-symbols-rounded { font-size: 24px; }
      .state--ready > .material-symbols-rounded { color: var(--clr-success, #2e7d32); }
      .state > div { flex: 1; min-width: 0; }
      .state h2 { font-size: 1.0625rem; margin: 0 0 4px; }
      .state p { margin: 0; font-size: 0.875rem; line-height: 1.5; color: var(--clr-text-2); }
      .issue {
        display: flex;
        gap: 12px;
        align-items: flex-start;
        margin-top: 12px;
        padding: 16px 20px;
        border-radius: var(--pn-radius-row);
        background: color-mix(in srgb, var(--clr-danger, #c62828) 8%, transparent);
        font-size: 0.9375rem;
        line-height: 1.5;
      }
      .issue .material-symbols-rounded { color: var(--clr-danger, #c62828); font-size: 22px; }
      .fixes { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 8px; }
      .details {
        width: 100%;
        text-align: left;
        align-items: center;
        margin-top: 18px;
        border-radius: var(--pn-radius-row);
        background: var(--pn-field);
      }
      .edit-title { font-size: 1.25rem; margin-bottom: 14px; }
      .payments { margin-top: 22px; }
      .pay { width: 100%; text-align: left; align-items: center; }
      .pay:disabled { cursor: default; opacity: 1; }
      .pay__icon { font-size: 20px; color: var(--clr-text-2); }
      .pay__icon--ok { color: var(--clr-success, #2e7d32); }
      .pay__icon--bad { color: var(--clr-danger, #c62828); }
      .pay__amount { display: flex; flex-direction: column; align-items: flex-end; flex: none; }
      .more { margin-top: 8px; }
      .money { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 14px; }
      .money > div { display: flex; flex-direction: column; }
      .money__label { font-size: 0.9375rem; }
      .money__hint { font-size: 0.8125rem; }
      .money strong { font-size: 1.125rem; }
    `,
  ],
})
export class CobrosComponent {
  private readonly api = inject(Api);
  private readonly toasts = inject(ToastService);
  readonly money = money;

  readonly account = resource<PayoutAccount>(
    () => this.api.get<PayoutAccount>('/businesses/me/payouts'),
    { state: 'UNKNOWN', chargesEnabled: false, payoutsEnabled: false, detailsSubmitted: false, issues: [] },
  );

  readonly balance = resource<PayoutBalance>(
    () => this.api.get<PayoutBalance>('/businesses/me/payouts/balance'),
    { pendingCents: 0, availableCents: 0, delayDays: 0 },
  );

  // Charges, paged by hand: «Ver cobros anteriores» appends the next page.
  readonly payments = signal<PayoutPayment[]>([]);
  readonly paymentsLoaded = signal(false);
  readonly paymentsError = signal<string | null>(null);
  readonly hasMore = signal(false);
  readonly loadingMore = signal(false);
  private page = 0;

  readonly checking = signal(false);
  readonly refunding = signal<PayoutPayment | null>(null);

  /** Lo que Stripe tiene del titular, mientras se está corrigiendo. */
  readonly editing = signal<PayoutOwnerPrefill | null>(null);
  readonly loadingDetails = signal(false);
  readonly opening = signal(false);
  readonly detailsError = signal<string | null>(null);

  /** Only a business with no account at all sees the form. */
  readonly needsForm = computed(() => this.account.value().state === 'NOT_STARTED');

  /** Both are needed: an account that charges but cannot pay out piles up money that never arrives. */
  readonly canCollect = computed(() => this.account.value().chargesEnabled && this.account.value().payoutsEnabled);

  constructor() {
    void this.boot();
  }

  private async boot(): Promise<void> {
    await this.account.load();
    if (this.canCollect()) this.loadMoney();
  }

  private loadMoney(): void {
    void this.balance.reload();
    void this.loadPayments(true);
  }

  private async loadPayments(reset: boolean): Promise<void> {
    if (reset) {
      this.page = 0;
      this.paymentsError.set(null);
    }
    try {
      const page = await this.api.get<PageResponse<PayoutPayment>>('/businesses/me/payouts/payments', {
        page: this.page,
        size: PAGE_SIZE,
      });
      this.payments.set(reset ? page.content : [...this.payments(), ...page.content]);
      this.hasMore.set(!page.last);
    } catch {
      this.paymentsError.set('No hemos podido cargar tus cobros.');
    } finally {
      this.paymentsLoaded.set(true);
    }
  }

  async loadMore(): Promise<void> {
    this.loadingMore.set(true);
    this.page += 1;
    await this.loadPayments(false);
    this.loadingMore.set(false);
  }

  /** «Comprobar de nuevo»: asks Stripe again. Silent on failure — it is a check, not an action. */
  async check(): Promise<void> {
    this.checking.set(true);
    try {
      this.account.set(await this.api.post<PayoutAccount>('/businesses/me/payouts/refresh'));
    } catch {
      await this.account.reload();
    } finally {
      this.checking.set(false);
    }
    if (this.canCollect()) this.loadMoney();
  }

  async onActivated(account: PayoutAccount): Promise<void> {
    this.account.set(account);
    // Reloaded rather than trusted, so this screen and any badge read the same source.
    await this.account.reload();
    if (this.canCollect()) {
      this.toasts.show('Cobros activados');
      this.loadMoney();
    }
  }

  /**
   * Trae lo que Stripe tiene del titular y abre el formulario con ello.
   *
   * Se pregunta en cada apertura y no se guarda: no tenemos copia de los datos
   * personales del dueño, y una que se quedara aquí envejecería sola.
   */
  async editDetails(): Promise<void> {
    if (this.loadingDetails()) return;
    this.loadingDetails.set(true);
    this.detailsError.set(null);
    try {
      this.editing.set(await this.api.get<PayoutOwnerPrefill>('/businesses/me/payouts/details'));
    } catch (cause) {
      this.detailsError.set(message(cause) || 'No hemos podido cargar tus datos.');
    } finally {
      this.loadingDetails.set(false);
    }
  }

  /** Guardado: se vuelve a Cobros y se relee, que es donde se ve si ha servido. */
  async onDetailsSaved(): Promise<void> {
    this.editing.set(null);
    this.toasts.show('Datos guardados');
    await this.account.reload();
    if (this.canCollect()) this.loadMoney();
  }

  /**
   * Abre la verificación de Stripe en otra pestaña.
   *
   * En pestaña nueva y no aquí: el formulario de Stripe no funciona dentro de
   * un iframe, y además el panel se quedaría sin nada a lo que volver. La
   * llamada sale del clic para que el navegador no la tome por emergente no
   * pedida — por eso la pestaña se abre antes de esperar al enlace.
   */
  async verify(): Promise<void> {
    if (this.opening()) return;
    this.opening.set(true);
    this.detailsError.set(null);
    // Abierta YA, dentro del gesto: pedirla después del await la convierte en
    // una emergente que Safari y Firefox bloquean sin decir nada.
    const tab = window.open('', '_blank', 'noopener');
    try {
      const link = await this.api.post<VerificationLink>('/businesses/me/payouts/verification-link');
      if (tab) tab.location.href = link.url;
      else window.location.assign(link.url);
    } catch (cause) {
      tab?.close();
      this.detailsError.set(
        message(cause) || 'No hemos podido abrir la verificación. Inténtalo de nuevo en un momento.',
      );
    } finally {
      this.opening.set(false);
    }
  }

  onRefundClosed(refunded: boolean): void {
    this.refunding.set(null);
    if (!refunded) return;
    this.toasts.show('Dinero devuelto');
    this.loadMoney();
  }

  day(instant: string): string {
    return ddmmyyyy(fromInstant(instant));
  }

  readonly label = computed(
    () =>
      ({
        READY: 'Activo',
        IN_REVIEW: 'En revisión',
        PENDING: 'Faltan datos',
        NOT_STARTED: 'Sin activar',
        UNKNOWN: 'Sin activar',
      })[this.account.value().state] ?? 'Sin activar',
  );

  readonly tone = computed(
    () =>
      ({
        READY: 'success',
        IN_REVIEW: 'warn',
        PENDING: 'warn',
        NOT_STARTED: 'grey',
        UNKNOWN: 'grey',
      })[this.account.value().state] ?? 'grey',
  );
}
