import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Api } from '../core/api/api';
import { AuthService } from '../core/auth/auth.service';
import { message } from '../core/data/resource';
import { ToastService } from '../ui/toast.service';

/**
 * The limits of `core/cancellation_policy.dart`, which mirror the backend's
 * `Business.MAX_CANCELLATION_*` plus a CHECK in the database. They are here
 * and not inlined because the same numbers bound the control and the payload.
 */
export const CANCELLATION_LIMITS = {
  maxFeePercent: 50,
  minWindowHours: 3,
  maxWindowHours: 24,
  /** Hard cap of the charge, in euros, whatever the percentage works out to. */
  maxFeeEuros: 100,
  defaultFeePercent: 50,
  defaultWindowHours: 24,
} as const;

/** The price the app uses to show what the rule means in money. */
const EXAMPLE_SERVICE_EUROS = 30;

const clampFee = (value: number) => Math.min(Math.max(value, 0), CANCELLATION_LIMITS.maxFeePercent);
const clampWindow = (value: number) =>
  Math.min(Math.max(value, CANCELLATION_LIMITS.minWindowHours), CANCELLATION_LIMITS.maxWindowHours);

/**
 * `/panel/ajustes/cancelaciones` — `cancellation_policy_screen.dart`.
 *
 * Two numbers only: how much is charged to whoever cancels late, and what
 * counts as late. Both are sliders and not boxes, on purpose and for the same
 * reason as the app: typing let people save 90 % or 40 h, which the server
 * then refused, so the impossible value was only found out on saving.
 *
 * Nothing is charged at all without «Pedir tarjeta al reservar», which lives
 * in Funcionalidades; when it is off the screen says so and saves a 0.
 */
@Component({
  selector: 'app-panel-cancelaciones',
  standalone: true,
  imports: [FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="pn-main">
      <a class="pn-btn pn-btn--text pn-btn--sm back" routerLink="/panel/ajustes/funcionalidades">
        <span class="material-symbols-rounded">arrow_back</span>Funcionalidades
      </a>

      <div class="pn-head">
        <div class="pn-head__text">
          <p class="pn-head__greet">
            @if (requiresCard()) {
              Decide si pides tarjeta para reservar y cuánto se cobra a quien cancela o cambia la cita a
              última hora.
            } @else {
              Lo que se cobra a quien cancela o cambia la cita a última hora
            }
          </p>
          <h1>Cancelaciones</h1>
        </div>
        <div class="pn-head__actions">
          <button type="button" class="pn-btn pn-btn--primary" [disabled]="busy()" (click)="save()">
            @if (busy()) { <span class="pn-spinner"></span> } @else { Guardar }
          </button>
        </div>
      </div>

      @if (!requiresCard()) {
        <div class="pn-notice">
          <span class="material-symbols-rounded">info</span>
          <div>
            <span class="pn-notice__body">
              No estás pidiendo tarjeta, así que no se cobra ninguna penalización. Se enciende en
              <a routerLink="/panel/ajustes/funcionalidades">Funcionalidades</a>.
            </span>
          </div>
        </div>
      }

      <div class="pn-grid">
        <div class="pn-col-6">
          <div class="pn-group">
            <p class="pn-group__head">La penalización</p>
            <div class="pn-group__body">
              <div class="cn-row">
                <span class="cn-row__head">
                  <span class="pn-row__title">Tarifa</span>
                  <span class="cn-row__value pn-tabular">{{ fee }} %</span>
                </span>
                <input
                  class="cn-slider"
                  type="range"
                  name="fee"
                  min="0"
                  [max]="limits.maxFeePercent"
                  step="5"
                  aria-label="Tarifa"
                  [disabled]="!requiresCard() || busy()"
                  [(ngModel)]="fee"
                />
              </div>

              <div class="cn-row">
                <span class="cn-row__head">
                  <span class="pn-row__title">Si avisa con menos de</span>
                  <span class="cn-row__value pn-tabular">{{ window }} h</span>
                </span>
                <input
                  class="cn-slider"
                  type="range"
                  name="window"
                  [min]="limits.minWindowHours"
                  [max]="limits.maxWindowHours"
                  step="1"
                  aria-label="Antelación"
                  [disabled]="!requiresCard() || busy()"
                  [(ngModel)]="window"
                />
              </div>
            </div>
          </div>
        </div>

        @if (requiresCard()) {
          <div class="pn-col-6">
            <div class="pn-group">
              <p class="pn-group__head">Cómo queda</p>
              <div class="pn-group__body">
                <p class="cn-example">{{ example() }}</p>
              </div>
            </div>
          </div>
        }
      </div>

      @if (error(); as text) {
        <p class="pn-field__error" role="alert">{{ text }}</p>
      }
    </main>
  `,
  styles: [
    `
      :host { display: block; }
      .back { margin: 0 0 14px -12px; text-decoration: none; }
      .cn-row { display: flex; flex-direction: column; gap: 8px; padding: 14px 0; }
      .cn-row__head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
      .cn-row__value { font-weight: 800; color: var(--clr-text-1); }
      .cn-slider { width: 100%; accent-color: var(--clr-text-1); }
      .cn-slider:disabled { opacity: 0.45; }
      .cn-example { margin: 0; line-height: 1.55; }
    `,
  ],
})
export class CancelacionesComponent {
  private readonly api = inject(Api);
  private readonly auth = inject(AuthService);
  private readonly toasts = inject(ToastService);

  readonly limits = CANCELLATION_LIMITS;
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  /**
   * La intención del dueño, no lo que está en vigor.
   *
   * Esta pantalla configura SU política, y mientras Stripe verifica la cuenta
   * sigue siendo la suya aunque todavía no se aplique. Leer `requiresCard` —el
   * efectivo— le vaciaría los ajustes y le diría que no pide tarjeta a quien
   * sí la pidió.
   */
  readonly requiresCard = computed(() => this.auth.profile()?.requiresCardIntent === true);

  /**
   * A stored 0 becomes the recommended 50, as in the app: a business that had
   * the fee at nothing is one that never set it, and 0 is a useless start.
   */
  fee = clampFee(this.auth.profile()?.cancellationFeePercent || CANCELLATION_LIMITS.defaultFeePercent);
  window = clampWindow(this.auth.profile()?.cancellationWindowHours ?? CANCELLATION_LIMITS.defaultWindowHours);

  readonly example = computed(() => {
    const fee = Number(this.fee);
    if (fee === 0) {
      return 'Con la tarifa al 0 % no se cobra nada, aunque el cliente cancele un minuto antes.';
    }
    const raw = (EXAMPLE_SERVICE_EUROS * fee) / 100;
    const capped = Math.min(raw, CANCELLATION_LIMITS.maxFeeEuros).toFixed(2).replace('.', ',');
    return (
      `En un servicio de ${EXAMPLE_SERVICE_EUROS} €, quien cancele o cambie la cita faltando menos de ` +
      `${this.window} h pagará ${capped} €. Nunca se cobra más de ${CANCELLATION_LIMITS.maxFeeEuros} €.`
    );
  });

  async save(): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    // Without a card there is nothing to charge, so the fee goes as 0 even if
    // the slider still shows the old number — same as `cancellation_policy_screen`.
    const patch = {
      // `requiresCard` es como lo llama el endpoint; lo que se guarda es la
      // intención, y el servidor decide si llega a aplicarse.
      requiresCard: this.requiresCard(),
      cancellationFeePercent: this.requiresCard() ? clampFee(Number(this.fee)) : 0,
      cancellationWindowHours: clampWindow(Number(this.window)),
    };
    try {
      await this.api.put('/businesses/me/settings', patch);
      this.auth.patchProfile({ ...patch, requiresCardIntent: this.requiresCard() });
      this.toasts.show('Guardado');
    } catch (cause) {
      this.error.set(message(cause));
    } finally {
      this.busy.set(false);
    }
  }
}
