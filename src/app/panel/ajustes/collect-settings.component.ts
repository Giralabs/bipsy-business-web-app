import { ChangeDetectionStrategy, Component, Input, OnDestroy, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api } from '../core/api/api';
import { BusinessProfile, OnlinePaymentMode } from '../core/api/models';
import { AuthService } from '../core/auth/auth.service';
import { message } from '../core/data/resource';
import { PnSwitchComponent } from '../ui/controls';
import { ToastService } from '../ui/toast.service';

/** The three states of «Pago al reservar», in the order they cycle. */
const PAYMENT_MODES: OnlinePaymentMode[] = ['OFF', 'OPTIONAL', 'REQUIRED'];

/** Three clicks to get back to the start must be ONE save, and the row must not lock in between. */
const MODE_SAVE_DELAY_MS = 600;

const MODE_SHORT: Record<OnlinePaymentMode, string> = {
  OFF: 'No',
  OPTIONAL: 'Opcional',
  REQUIRED: 'Obligatorio',
};

const MODE_HELP: Record<OnlinePaymentMode, string> = {
  OFF: 'El cliente no paga al reservar',
  OPTIONAL: 'El cliente decide',
  REQUIRED: 'Para reservar tienen que pagar',
};

/**
 * «Cómo cobras», inside Cobros — `profile/widgets/collect_settings.dart`.
 *
 * The order tells the money in the order it happens: charging when it ends and
 * charging on booking first, both are charging for the service; below them the
 * card, which is the DEPOSIT behind a penalty; its fee hangs off it and «trusted
 * customers» closes, because that is not how much but to whom.
 *
 * The switches paint the owner's INTENT crossed with [ready], never what is in
 * force: if Stripe fell over, reading the latter would turn them off and wipe a
 * decision the owner did take.
 */
@Component({
  selector: 'app-collect-settings',
  standalone: true,
  imports: [RouterLink, PnSwitchComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="pn-group how">
      <p class="pn-group__head">Cómo cobras</p>
      <div class="pn-group__body">
        <div class="pn-row">
          <span class="material-symbols-rounded pn-row__icon">payments</span>
          <span class="pn-row__main">
            <span class="pn-row__title">Pago por app</span>
            <span class="pn-row__sub">
              {{ settlesAlone() ? 'No se puede con el marcado automático.' : 'Cobra al cliente al terminar.' }}
            </span>
          </span>
          <pn-switch [checked]="chargesByApp()" label="Pago por app"
                     [disabled]="!isReady() || settlesAlone() || saving().has('paymentRequestIntent')"
                     (toggle)="setChargesByApp($event)" />
        </div>

        <!-- Rota en el sitio: tres estados cortos, y lo que significa cada uno se
             lee debajo. Sin galón porque no abre nada. -->
        <button type="button" class="pn-row cycle" [disabled]="!isReady()" (click)="cycleMode()">
          <span class="material-symbols-rounded pn-row__icon">event_available</span>
          <span class="pn-row__main">
            <span class="pn-row__title">Pago al reservar</span>
            <span class="pn-row__sub">{{ modeHelp() }}</span>
          </span>
          <span class="pn-row__value cycle__value">{{ modeShort() }}</span>
        </button>

        <div class="pn-row">
          <span class="material-symbols-rounded pn-row__icon">credit_card</span>
          <span class="pn-row__main">
            <span class="pn-row__title">Pedir tarjeta al reservar</span>
            <span class="pn-row__sub">Cobra si el cliente falta sin aviso</span>
          </span>
          <pn-switch [checked]="requiresCard()" label="Pedir tarjeta al reservar"
                     [disabled]="!isReady() || saving().has('requiresCardIntent')"
                     (toggle)="setRequiresCard($event)" />
        </div>

        @if (requiresCard()) {
          <a class="pn-row" routerLink="/panel/ajustes/cancelaciones">
            <span class="material-symbols-rounded pn-row__icon">event_busy</span>
            <span class="pn-row__main"><span class="pn-row__title">Tarifa y plazo</span></span>
            <span class="pn-row__value">{{ cancellationLabel() }}</span>
            <span class="material-symbols-rounded pn-row__chev">arrow_forward_ios</span>
          </a>

          <div class="pn-row">
            <span class="material-symbols-rounded pn-row__icon">workspace_premium</span>
            <span class="pn-row__main"><span class="pn-row__title">Clientes de confianza</span></span>
            <pn-switch [checked]="auth.profile()?.autoTrustEnabled === true" label="Clientes de confianza"
                       [disabled]="saving().has('autoTrustEnabled')"
                       (toggle)="setAutoTrust($event)" />
          </div>
        }
      </div>

      <!-- Nunca las dos cosas: sin cuenta, por qué está todo apagado; con ella, qué
           es ser de confianza, que no cabe en su fila. -->
      @if (!isReady()) {
        <p class="pn-group__foot">
          Estamos verificando tu cuenta. En cuanto esté lista podrás pedir tarjeta y cobrar la cita, y lo que
          elegiste al darte de alta se activa solo.
        </p>
      } @else if (requiresCard()) {
        <p class="pn-group__foot">
          Deja de pedir la tarjeta a quien ya ha cumplido cinco citas seguidas sin faltar. Si falta sin avisar,
          se le vuelve a pedir. Puedes marcar desde la lista de clientes quiénes son de confianza.
        </p>
      }
    </div>
  `,
  styles: [
    `
      :host { display: block; }
      .how { margin-top: 22px; }
      .cycle { width: 100%; text-align: left; align-items: center; }
      .cycle:disabled { cursor: default; opacity: 0.55; }
      .cycle__value { flex: none; font-weight: 700; color: var(--clr-text); }
    `,
  ],
})
export class CollectSettingsComponent implements OnDestroy {
  readonly auth = inject(AuthService);
  private readonly api = inject(Api);
  private readonly toasts = inject(ToastService);

  /** The Stripe account can really collect. Off, everything here stays visible and disabled. */
  @Input({ required: true }) set ready(value: boolean) {
    this.isReady.set(value);
  }
  readonly isReady = signal(false);

  /** Settings on their way to the server: their switch does not answer meanwhile. */
  readonly saving = signal<ReadonlySet<keyof BusinessProfile>>(new Set());

  /** The mode chosen while it is unsent or in flight, so the row never blinks back. */
  private readonly optimisticMode = signal<OnlinePaymentMode | null>(null);
  private modeTimer: ReturnType<typeof setTimeout> | null = null;

  readonly settlesAlone = computed(() => this.auth.profile()?.autoSettleEnabled === true);
  readonly chargesByApp = computed(
    () => this.auth.profile()?.paymentRequestIntent === true && this.isReady() && !this.settlesAlone(),
  );
  readonly requiresCard = computed(() => this.auth.profile()?.requiresCardIntent === true && this.isReady());

  private readonly mode = computed<OnlinePaymentMode>(
    () => this.optimisticMode() ?? this.auth.profile()?.onlinePaymentMode ?? 'OFF',
  );
  readonly modeShort = computed(() => MODE_SHORT[this.mode()]);
  readonly modeHelp = computed(() => MODE_HELP[this.mode()]);

  /** «30 % · 24 h»: what is being charged, seen without opening the screen. */
  readonly cancellationLabel = computed(() => {
    const profile = this.auth.profile();
    return `${profile?.cancellationFeePercent ?? 0} % · ${profile?.cancellationWindowHours ?? 0} h`;
  });

  // What the owner sees on leaving has to be what stays saved.
  ngOnDestroy(): void {
    if (this.modeTimer === null) return;
    clearTimeout(this.modeTimer);
    this.modeTimer = null;
    void this.saveMode(this.mode());
  }

  /** Field names differ: the profile paints the intent, the settings endpoint takes the plain name. */
  setChargesByApp(on: boolean): Promise<void> {
    return this.save('paymentRequestIntent', on, { paymentRequestEnabled: on });
  }

  setRequiresCard(on: boolean): Promise<void> {
    return this.save('requiresCardIntent', on, { requiresCard: on });
  }

  setAutoTrust(on: boolean): Promise<void> {
    return this.save('autoTrustEnabled', on, { autoTrustEnabled: on });
  }

  cycleMode(): void {
    const next = PAYMENT_MODES[(PAYMENT_MODES.indexOf(this.mode()) + 1) % PAYMENT_MODES.length];
    this.optimisticMode.set(next);
    if (this.modeTimer !== null) clearTimeout(this.modeTimer);
    this.modeTimer = setTimeout(() => {
      this.modeTimer = null;
      void this.saveMode(next);
    }, MODE_SAVE_DELAY_MS);
  }

  private async saveMode(mode: OnlinePaymentMode): Promise<void> {
    try {
      await this.api.put('/businesses/me/settings', { onlinePaymentMode: mode });
      this.auth.patchProfile({ onlinePaymentMode: mode });
      await this.auth.refreshMe().catch(() => undefined);
    } catch (cause) {
      // The row goes back on its own; the toast tells why, which is what cannot be seen.
      this.toasts.error(message(cause) || 'No se ha podido guardar.');
    } finally {
      // A click made while this was in flight owns the row now.
      if (this.modeTimer === null && this.optimisticMode() === mode) this.optimisticMode.set(null);
    }
  }

  private async save(
    field: 'paymentRequestIntent' | 'requiresCardIntent' | 'autoTrustEnabled',
    value: boolean,
    body: Record<string, boolean>,
  ): Promise<void> {
    const before = this.auth.profile()?.[field];
    this.saving.update((set) => new Set(set).add(field));
    this.auth.patchProfile({ [field]: value });
    try {
      await this.api.put('/businesses/me/settings', body);
    } catch (cause) {
      this.auth.patchProfile({ [field]: before });
      // Here the server's reason is the point: it refuses this combination too.
      this.toasts.error(message(cause) || 'No se ha podido cambiar.');
      return;
    } finally {
      this.saving.update((set) => {
        const next = new Set(set);
        next.delete(field);
        return next;
      });
    }
    // Brings back what is in force too (`requiresCard`, `paymentRequestEnabled`).
    await this.auth.refreshMe().catch(() => undefined);
  }
}
