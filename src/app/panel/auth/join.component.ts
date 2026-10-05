import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthLayoutComponent } from './auth-layout.component';
import { AuthService } from '../core/auth/auth.service';
import { message } from '../core/data/resource';

/**
 * `/unirse` — la puerta de los trabajadores, con el código de 6 cifras que
 * les da su negocio. Junta dos pantallas de la app:
 *
 * - `enter_invitation_code_screen.dart`: sin sesión, el código lleva a
 *   `/invitacion/:código`, que enseña de qué negocio es y crea la cuenta.
 * - `waiting_invitation_screen.dart`: un trabajador con cuenta pero sin
 *   negocio (se registró en la app sin código) no puede hacer nada más hasta
 *   canjear uno, así que la guardia le trae aquí y el código se canjea sin
 *   salir de la página.
 */
@Component({
  selector: 'app-join',
  standalone: true,
  imports: [AuthLayoutComponent, FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-auth-layout bip="MB-05" claim="Tu agenda, tu fichaje y tus ausencias, en un sitio.">
      @if (waiting()) {
        <h1 class="auth-title">Únete a tu negocio</h1>
        <p class="auth-lead">
          Hola{{ firstName() ? ', ' + firstName() : '' }}. Tu cuenta ya está creada, pero todavía no
          trabajas en ningún negocio. Pide a tu responsable el código de invitación y escríbelo aquí.
        </p>
      } @else {
        <h1 class="auth-title">Únete a tu equipo</h1>
        <p class="auth-lead">
          Escribe el código de 6 cifras que te ha pasado tu negocio. Te enseñamos de quién es antes de
          crear nada.
        </p>
      }

      <form (ngSubmit)="submit()">
        <label class="pn-field">
          <span class="pn-field__label">Código de invitación</span>
          <input class="auth-code" name="code" inputmode="numeric" autocomplete="one-time-code"
                 maxlength="6" placeholder="······" [ngModel]="code()" (ngModelChange)="onCode($event)" />
        </label>

        @if (error(); as text) {
          <p class="pn-field__error auth-error" role="alert">{{ text }}</p>
        }

        <button type="submit" class="pn-btn pn-btn--primary pn-btn--lg pn-btn--block"
                [disabled]="busy() || code().length !== 6">
          @if (busy()) { <span class="pn-spinner"></span> } @else { {{ waiting() ? 'Unirme' : 'Continuar' }} }
        </button>
      </form>

      @if (waiting()) {
        <p class="auth-foot">
          ¿No es tu cuenta? <a href="#" (click)="logout($event)">Cerrar sesión</a>
        </p>
      } @else {
        <p class="auth-foot">¿Ya tienes cuenta de trabajador? <a routerLink="/acceder">Inicia sesión</a></p>
        <p class="auth-hint">
          ¿Eres el dueño del negocio? <a routerLink="/registro">Crea tu negocio</a> y, desde Equipo, invita a
          tu gente.
        </p>
      }
    </app-auth-layout>
  `,
  styleUrl: './auth-forms.css',
})
export class JoinComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly code = signal(inject(ActivatedRoute).snapshot.queryParamMap.get('codigo') ?? '');
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly waiting = signal(false);
  readonly firstName = signal('');

  constructor() {
    void this.init();
  }

  private async init(): Promise<void> {
    await this.auth.bootstrap();
    if (this.auth.status() !== 'authenticated') return;
    // Con sesión y ya dentro de un negocio, aquí no hay nada que hacer.
    if (!this.auth.needsBusiness()) {
      await this.router.navigateByUrl('/panel');
      return;
    }
    this.waiting.set(true);
    this.firstName.set((this.auth.user()?.name ?? '').split(' ')[0]);
  }

  onCode(value: string): void {
    this.code.set(value.replace(/\D/g, '').slice(0, 6));
    this.error.set(null);
  }

  async submit(): Promise<void> {
    const code = this.code();
    if (code.length !== 6 || this.busy()) return;
    if (!this.waiting()) {
      await this.router.navigate(['/invitacion', code]);
      return;
    }
    this.busy.set(true);
    try {
      await this.auth.redeemInvitation(code);
      await this.router.navigateByUrl('/panel');
    } catch (cause) {
      const status = (cause as { status?: number }).status;
      this.error.set(
        status === 404 || status === 400 || status === 409
          ? 'Ese código no vale: puede que haya caducado o que ya se haya usado. Pide otro.'
          : message(cause),
      );
    } finally {
      this.busy.set(false);
    }
  }

  async logout(event: Event): Promise<void> {
    event.preventDefault();
    await this.auth.logout();
    location.assign('/acceder');
  }
}
