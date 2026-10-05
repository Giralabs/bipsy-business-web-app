import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthLayoutComponent } from './auth-layout.component';
import { AuthService, WrongRoleError } from '../core/auth/auth.service';
import { PendingSocial } from '../core/auth/pending-social';
import {
  SocialAuth,
  SocialIdentity,
  SocialProvider,
  SocialSignInCancelled,
  SocialSignInUnavailable,
} from '../core/auth/social-auth.service';
import { message } from '../core/data/resource';

/**
 * `/acceder` — the web twin of `login_screen.dart`, including the notice for
 * customers who land here by mistake: this door is only for businesses and
 * their workers, the Bipsy app is somewhere else.
 *
 * Google y Apple **no crean cuentas** por aquí, igual que en la app: el alta de
 * un negocio pide categoría, teléfono y aceptar los términos, que no salen de
 * un token social. Pero no tener cuenta tampoco es un error: el servidor
 * responde 404 y se sigue al registro con la identidad ya en la mano
 * (`PendingSocial`), sin volver a pedir el correo ni una contraseña. El 409 es
 * otra cosa —ese correo es de un cliente— y ahí sí hay que pararle.
 */
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [AuthLayoutComponent, FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './login.component.html',
  styleUrl: './auth-forms.css',
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly social = inject(SocialAuth);
  private readonly pending = inject(PendingSocial);

  readonly expired = this.route.snapshot.queryParamMap.has('expirada');
  readonly changed = this.route.snapshot.queryParamMap.has('cambiada');
  readonly googleEnabled = this.social.googleAvailable;
  readonly appleEnabled = this.social.appleAvailable;
  readonly socialEnabled = this.googleEnabled || this.appleEnabled;

  email = '';
  password = '';

  readonly busy = signal(false);
  /** Cuál de los dos botones está girando. Null si ninguno. */
  readonly socialBusy = signal<SocialProvider | null>(null);
  readonly error = signal<string | null>(null);

  async signInWith(provider: SocialProvider): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.socialBusy.set(provider);
    this.error.set(null);
    // Cualquier identidad de un intento anterior deja de valer en cuanto se
    // empieza otro: si no, un segundo intento cancelado dejaría en pie el
    // correo del primero.
    this.pending.clear();

    // Fuera del try: si el servidor dice que no hay cuenta, hace falta abajo
    // para seguir con el alta.
    let identity: SocialIdentity | null = null;
    try {
      identity = await this.social.obtainIdentity(provider);
      await this.auth.loginWithProvider(provider, identity.idToken);
      await this.goOn();
    } catch (cause) {
      if (cause instanceof SocialSignInCancelled) return;
      if (cause instanceof SocialSignInUnavailable) {
        this.error.set(cause.message);
        return;
      }
      // 404: ese correo no tiene cuenta todavía. No es un fallo, es un alta
      // que empieza — y con el correo ya verificado por el proveedor.
      if ((cause as { status?: number }).status === 404 && identity?.email) {
        // El alta decide dónde empezar: con el correo oculto (relay de Apple)
        // por el paso del correo, porque hay que pedirle uno suyo; con un
        // correo normal, directo a los datos del negocio.
        this.pending.set(identity);
        await this.router.navigateByUrl('/registro');
        return;
      }
      this.error.set(cause instanceof WrongRoleError ? cause.message : message(cause));
    } finally {
      this.busy.set(false);
      this.socialBusy.set(null);
    }
  }

  async submit(): Promise<void> {
    if (this.busy()) return;
    if (!this.email.trim() || !this.password) {
      this.error.set('Escribe tu correo y tu contraseña.');
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.auth.login(this.email.trim(), this.password);
      await this.goOn();
    } catch (cause) {
      const status = (cause as { status?: number }).status;
      this.error.set(
        cause instanceof WrongRoleError
          ? cause.message
          : status === 401 || status === 400
            ? 'Correo o contraseña incorrectos.'
            : message(cause),
      );
    } finally {
      this.busy.set(false);
    }
  }

  /**
   * A donde se vuelve. Solo rutas propias: el panel, o la invitación que
   * mandó aquí a un trabajador que ya tenía cuenta.
   */
  private async goOn(): Promise<void> {
    const back = this.route.snapshot.queryParamMap.get('volver') ?? '';
    const safe = back.startsWith('/panel') || back.startsWith('/invitacion/') || back.startsWith('/unirse');
    await this.router.navigateByUrl(safe ? back : '/panel');
  }
}
