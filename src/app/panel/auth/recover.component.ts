import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthLayoutComponent } from './auth-layout.component';
import { Api } from '../core/api/api';
import { message } from '../core/data/resource';

/**
 * `/recuperar-contrasena` — the three phases of `recover_password_screen.dart`:
 * ask for the e-mail, type the six digits, choose a new password.
 *
 * The first call answers 204 whether or not the account exists, so the copy
 * never says «that e-mail is not registered»: it would be a way to find out
 * who has an account.
 */
@Component({
  selector: 'app-recover',
  standalone: true,
  imports: [AuthLayoutComponent, FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './recover.component.html',
  styleUrl: './auth-forms.css',
})
export class RecoverComponent {
  private readonly api = inject(Api);
  private readonly router = inject(Router);

  readonly phase = signal<1 | 2 | 3>(1);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  email = '';
  code = '';
  password = '';
  private resetToken = '';

  readonly title = computed(
    () =>
      ({
        1: '¿Has perdido la contraseña?',
        2: 'Mira tu correo',
        3: 'Elige una nueva',
      })[this.phase()],
  );

  async requestCode(): Promise<void> {
    if (!/^\S+@\S+\.\S+$/.test(this.email)) {
      this.error.set('Escribe un correo válido.');
      return;
    }
    await this.run(async () => {
      await this.api.post('/auth/password/forgot', { email: this.email.trim() });
      this.phase.set(2);
    });
  }

  async verify(): Promise<void> {
    await this.run(async () => {
      const result = await this.api.post<{ resetToken: string }>('/auth/password/verify-code', {
        email: this.email.trim(),
        code: this.code.trim(),
      });
      this.resetToken = result.resetToken;
      this.phase.set(3);
    });
  }

  /** Changing the password closes every session, so we send them to log in. */
  async reset(): Promise<void> {
    if (this.password.length < 8) {
      this.error.set('La contraseña necesita al menos ocho caracteres.');
      return;
    }
    await this.run(async () => {
      await this.api.post('/auth/password/reset', {
        resetToken: this.resetToken,
        newPassword: this.password,
      });
      await this.router.navigate(['/acceder'], { queryParams: { cambiada: 1 } });
    });
  }

  private async run(action: () => Promise<void>): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      await action();
    } catch (cause) {
      this.error.set(message(cause));
    } finally {
      this.busy.set(false);
    }
  }
}
