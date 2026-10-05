import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Api } from '../core/api/api';
import { ReferralCode } from '../core/api/models';
import { SetupStore } from '../core/data/setup.store';
import { ConfirmService } from '../ui/confirm.service';
import { ToastService } from '../ui/toast.service';

/**
 * `/panel/negocio/codigo` — `referral_screen.dart`.
 *
 * Choosing the code cannot be undone, so it asks twice. That is a product
 * rule, not a UI whim: the code ends up printed on cards and stuck to
 * mirrors.
 */
@Component({
  selector: 'app-panel-codigo',
  standalone: true,
  imports: [FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="pn-main">
      <a class="pn-btn pn-btn--text pn-btn--sm back" routerLink="/panel/negocio">
        <span class="material-symbols-rounded">arrow_back</span>Tu ficha
      </a>

      <div class="pn-head">
        <div class="pn-head__text">
          <p class="pn-head__greet">Tus clientes lo usan al crear su cuenta</p>
          <h1>Código de invitación</h1>
        </div>
      </div>

      <div class="pn-grid">
        <section class="pn-card pn-col-6">
          @if (setup.referralSet()) {
            <p class="pn-dim intro">Este es tu código. Los clientes que lo usen cuentan como invitados por ti.</p>
            <p class="code">{{ setup.referral.value().code }}</p>
            <button type="button" class="pn-btn pn-btn--secondary pn-btn--block" (click)="copy()">
              <span class="material-symbols-rounded">content_copy</span>Copiar
            </button>
          } @else {
            <p class="pn-dim intro">
              Elige un código corto y fácil de decir en voz alta. Bipsy lo tiene en cuenta para ofertas y
              recompensas. <b>Una vez elegido no se puede cambiar.</b>
            </p>

            <label class="pn-field">
              <span class="pn-field__label">Tu código</span>
              <input class="pn-input code-input" type="text" name="code" maxlength="20"
                     placeholder="NOMADA" [(ngModel)]="draft" />
              <span class="pn-field__hint">Solo letras y números, entre 4 y 20 caracteres.</span>
            </label>

            <button type="button" class="pn-btn pn-btn--primary pn-btn--block"
                    [disabled]="busy()" (click)="save()">
              Elegir este código
            </button>
          }
        </section>

        <section class="pn-card pn-col-6">
          <div class="pn-block__head">
            <span class="material-symbols-rounded">info</span>
            <h2>Para qué sirve</h2>
          </div>
          <p class="pn-dim intro">
            Cuando alguien se hace cuenta en Bipsy con tu código, queda registrado que viene de tu negocio.
            Eso nos dice qué negocios traen gente nueva a la plataforma, y es lo que miramos para las
            ofertas y las recompensas.
          </p>
          <p class="pn-dim intro">
            Lo puedes poner en tu ficha, en el ticket o en el espejo. Cuanto más corto, mejor.
          </p>
        </section>
      </div>
    </main>
  `,
  styles: [
    `
      :host { display: block; }
      .back { margin: 0 0 14px -12px; text-decoration: none; }
      .intro { font-size: 0.9375rem; line-height: 1.6; margin-bottom: 16px; }
      .code {
        margin: 24px 0;
        font-family: var(--ff-display);
        font-size: 2.5rem;
        font-weight: 800;
        letter-spacing: 4px;
        text-align: center;
      }
      .code-input { text-transform: uppercase; letter-spacing: 3px; font-weight: 700; }
    `,
  ],
})
export class CodigoComponent {
  readonly setup = inject(SetupStore);
  private readonly api = inject(Api);
  private readonly confirm = inject(ConfirmService);
  private readonly toasts = inject(ToastService);

  draft = '';
  readonly busy = signal(false);

  constructor() {
    void this.setup.referral.load();
  }

  async save(): Promise<void> {
    const code = this.draft.trim().toUpperCase();
    // Same rule as `ReferralService.VALID`.
    if (!/^[A-Z0-9]{4,20}$/.test(code)) {
      this.toasts.error('Entre 4 y 20 letras o números, sin espacios.');
      return;
    }
    const answer = await this.confirm.ask({
      title: `¿Te quedas con ${code}?`,
      message: 'No se puede cambiar después.',
      confirmLabel: 'Sí, es este',
    });
    if (!answer.ok) return;

    this.busy.set(true);
    try {
      this.setup.referral.set(await this.api.post<ReferralCode>('/businesses/me/referral', { code }));
      this.toasts.show('Código elegido');
    } catch (cause) {
      const status = (cause as { status?: number }).status;
      this.toasts.error(
        status === 409
          ? 'Ese código ya está cogido. Prueba con otro.'
          : 'Ese código no vale. Prueba con otro.',
      );
    } finally {
      this.busy.set(false);
    }
  }

  async copy(): Promise<void> {
    const code = this.setup.referral.value().code;
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      this.toasts.show('Código copiado');
    } catch {
      this.toasts.error('Cópialo a mano: ' + code);
    }
  }
}
