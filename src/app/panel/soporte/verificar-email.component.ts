import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Api } from '../core/api/api';
import { AuthService } from '../core/auth/auth.service';
import { ToastService } from '../ui/toast.service';

/**
 * `/panel/verificar-email` — `email_pending_screen_business.dart`.
 *
 * The guard parks everybody here until the address is verified, because an
 * unverified shop cannot receive the booking notices, which is the whole
 * point of the product.
 */
@Component({
  selector: 'app-panel-verificar-email',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="pn-main verify">
      <span class="material-symbols-rounded verify__icon">mark_email_unread</span>
      <h1>Verifica tu correo</h1>
      <p class="verify__lead">
        Te hemos enviado un correo a <b>{{ auth.user()?.email }}</b>. Ábrelo y pulsa el enlace para
        confirmar que es tuyo. Sin eso no podemos avisarte cuando entre una reserva.
      </p>

      <div class="verify__actions">
        <button type="button" class="pn-btn pn-btn--secondary" [disabled]="busy()" (click)="resend()">
          Reenviar el correo
        </button>
        <button type="button" class="pn-btn pn-btn--primary" [disabled]="busy()" (click)="recheck()">
          Ya lo he verificado
        </button>
      </div>

      <p class="verify__hint pn-muted">
        Mira también en spam. Si el correo está mal escrito, escríbenos y lo cambiamos.
      </p>
    </main>
  `,
  styles: [
    `
      :host { display: block; }
      .verify { max-width: 560px; text-align: center; padding-top: 64px; }
      .verify__icon { font-size: 56px; color: var(--clr-text-3); }
      .verify h1 { margin-top: 18px; font-family: var(--ff-display); font-size: 2rem; font-weight: 800; letter-spacing: -1px; }
      .verify__lead { margin: 12px auto 28px; font-size: 1rem; color: var(--clr-text-2); line-height: 1.6; }
      .verify__actions { display: flex; justify-content: center; gap: 10px; }
      .verify__hint { margin-top: 24px; font-size: 0.8125rem; line-height: 1.55; }
    `,
  ],
})
export class VerificarEmailComponent {
  readonly auth = inject(AuthService);
  private readonly api = inject(Api);
  private readonly toasts = inject(ToastService);

  readonly busy = signal(false);

  async resend(): Promise<void> {
    this.busy.set(true);
    try {
      await this.api.post('/auth/resend-verification');
      this.toasts.show('Correo reenviado');
    } catch {
      this.toasts.error('No se ha podido reenviar.');
    } finally {
      this.busy.set(false);
    }
  }

  async recheck(): Promise<void> {
    this.busy.set(true);
    try {
      await this.auth.refreshMe();
      if (this.auth.emailVerified()) location.assign('/panel');
      else this.toasts.error('Todavía no nos consta verificado.');
    } finally {
      this.busy.set(false);
    }
  }
}
