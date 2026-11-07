import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthLayoutComponent } from './auth-layout.component';
import { AuthService, WrongRoleError, deletionPending } from '../core/auth/auth.service';
import { PendingSocial } from '../core/auth/pending-social';
import {
  SocialAuth,
  SocialIdentity,
  SocialProvider,
  SocialSignInCancelled,
  SocialSignInUnavailable,
} from '../core/auth/social-auth.service';
import { message } from '../core/data/resource';
import { ToastService } from '../ui/toast.service';

/** El negocio en baja: cuándo se borra y cómo repetir el acceso reactivándolo. */
interface PendingDeletion {
  deletesAt: Date | null;
  reactivate: () => Promise<void>;
}

/**
 * Días de calendario hasta el borrado: hoy es 0 y mañana 1, sea la hora que
 * sea. Por fechas y no por horas, igual que `daysUntilDeletion` en la app: con
 * horas, «el 16 de noviembre» podía salir junto a «en 8 días» siendo hoy el 7.
 */
export function daysUntilDeletion(deletesAt: Date, now = new Date()): number {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = new Date(deletesAt.getFullYear(), deletesAt.getMonth(), deletesAt.getDate());
  return Math.max(0, Math.round((day.getTime() - today.getTime()) / 86_400_000));
}

/**
 * `/acceder` — the web twin of `login_screen.dart`, including the notice for
 * customers who land here by mistake: this door is only for businesses and
 * their workers, the Bipsy app is somewhere else.
 *
 * Google y Apple **no crean cuentas** por aquí, igual que en la app: el alta de
 * un negocio pide categoría, teléfono y aceptar los términos, que no salen de
 * un token social. Pero no tener cuenta tampoco es un error: el servidor
 * responde 404 y se sigue al registro con la identidad ya en la mano
 * (`PendingSocial`), sin volver a pedir el correo ni una contraseña.
 *
 * Entran los dos roles de esta puerta, dueño y trabajador: el servidor resuelve
 * la cuenta por ámbito y es el rol devuelto lo que decide a dónde va (backend
 * 4532ed4).
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
  private readonly toasts = inject(ToastService);

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
  /** El negocio tiene la baja pedida y se está preguntando qué hacer. */
  readonly pendingDeletion = signal<PendingDeletion | null>(null);

  constructor() {
    // Para que la ventana de Google o Apple se abra al primer clic.
    this.social.warmUp();
  }

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
      const idToken = identity?.idToken;
      if (this.askIfPending(cause, () => this.auth.loginWithProvider(provider, idToken!, true))) {
        return;
      }
      if (cause instanceof SocialSignInUnavailable) {
        this.error.set(cause.message);
        return;
      }
      // 404: ese correo no tiene cuenta todavía. No es un fallo, es un alta
      // que empieza — y con el correo ya verificado por el proveedor.
      if ((cause as { status?: number }).status === 404 && identity) {
        // El alta decide dónde empezar: con el correo oculto (relay de Apple) o
        // sin ninguno, por el paso del correo, porque hay que pedirle uno suyo;
        // con un correo normal, directo a los datos del negocio.
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
      const email = this.email.trim();
      const password = this.password;
      if (this.askIfPending(cause, () => this.auth.login(email, password, true))) return;
      const status = (cause as { status?: number }).status;
      this.error.set(
        cause instanceof WrongRoleError
          ? cause.message
          : status === 401 || status === 400
            ? 'Correo o contraseña incorrectos.'
            : status === 429
              ? 'Demasiados intentos. Espera un momento.'
              : message(cause),
      );
    } finally {
      this.busy.set(false);
    }
  }

  /** El texto de la pregunta: cuánto queda y qué no vuelve. */
  deletionText(pending: PendingDeletion): string {
    const tail = '¿Quieres reactivarlo? Las citas que se cancelaron no se recuperan.';
    if (!pending.deletesAt) return `Se borrará pronto. ${tail}`;
    const days = daysUntilDeletion(pending.deletesAt);
    const when = days === 0 ? 'Se borra hoy' : days === 1 ? 'Se borra mañana' : `Se borra en ${days} días`;
    const date = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long' }).format(pending.deletesAt);
    return `${when}, el ${date}. ${tail}`;
  }

  /** Repite el acceso pidiendo reactivar el negocio. */
  async reactivate(): Promise<void> {
    const pending = this.pendingDeletion();
    if (!pending || this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      await pending.reactivate();
      this.pendingDeletion.set(null);
      this.toasts.show('Negocio reactivado. Vuelve a aceptar reservas.');
      await this.goOn();
    } catch (cause) {
      this.error.set(message(cause));
    } finally {
      this.busy.set(false);
    }
  }

  /** «Salir»: el negocio sigue en baja y no se llegó a abrir sesión. */
  leave(): void {
    this.pendingDeletion.set(null);
    this.password = '';
  }

  /**
   * Si el fallo es un negocio en baja, se pregunta en vez de pintar un error.
   * [retry] es el mismo acceso, pidiendo reactivar.
   */
  private askIfPending(cause: unknown, retry: () => Promise<void>): boolean {
    const pending = deletionPending(cause);
    if (!pending) return false;
    this.pendingDeletion.set({ deletesAt: pending.deletesAt, reactivate: retry });
    return true;
  }

  /**
   * A donde se vuelve. Solo rutas propias: el panel, o la invitación que
   * mandó aquí a un trabajador que ya tenía cuenta.
   */
  private async goOn(): Promise<void> {
    const back = this.route.snapshot.queryParamMap.get('volver') ?? '';
    const safe =
      back.startsWith('/panel') ||
      back.startsWith('/invitacion/') ||
      back.startsWith('/equipo/') ||
      back.startsWith('/unirse');
    await this.router.navigateByUrl(safe ? back : '/panel');
  }
}
