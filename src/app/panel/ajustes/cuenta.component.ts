import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Api } from '../core/api/api';
import { AuthService } from '../core/auth/auth.service';
import {
  SocialAuth,
  SocialProvider,
  SocialSignInCancelled,
  SocialSignInUnavailable,
  providerLabel,
} from '../core/auth/social-auth.service';
import { message } from '../core/data/resource';
import { ConfirmService } from '../ui/confirm.service';
import { ToastService } from '../ui/toast.service';

/**
 * `/panel/ajustes/cuenta` — `change_password_screen.dart` plus the security
 * rows of the profile screen.
 *
 * Revoking every session is the panic button of a shared computer: it is the
 * reason a shop can safely use the panel on the till.
 */
@Component({
  selector: 'app-panel-cuenta',
  standalone: true,
  imports: [FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="pn-main">
      <a class="pn-btn pn-btn--text pn-btn--sm back" [routerLink]="auth.isWorker() ? '/panel/mi-perfil' : '/panel/ajustes'">
        <span class="material-symbols-rounded">arrow_back</span>{{ auth.isWorker() ? 'Mi perfil' : 'Ajustes' }}
      </a>

      <div class="pn-head">
        <div class="pn-head__text">
          <p class="pn-head__greet">{{ auth.user()?.email }}</p>
          <h1>Tu cuenta</h1>
        </div>
      </div>

      <div class="pn-grid">
        <section class="pn-card pn-col-6">
          <div class="pn-block__head">
            <span class="material-symbols-rounded">lock</span>
            <h2>Cambiar contraseña</h2>
          </div>

          <label class="pn-field">
            <span class="pn-field__label">Contraseña actual</span>
            <input class="pn-input" type="password" name="current" autocomplete="current-password"
                   [(ngModel)]="current" />
          </label>
          <label class="pn-field">
            <span class="pn-field__label">Nueva contraseña</span>
            <input class="pn-input" type="password" name="next" autocomplete="new-password"
                   placeholder="Mínimo 8 caracteres" [(ngModel)]="next" />
          </label>

          <button type="button" class="pn-btn pn-btn--primary pn-btn--block"
                  [disabled]="busy()" (click)="changePassword()">
            Guardar contraseña
          </button>
        </section>

        <section class="pn-card pn-col-6">
          <div class="pn-block__head">
            <span class="material-symbols-rounded">devices</span>
            <h2>Sesiones</h2>
          </div>

          <p class="pn-dim body">
            Si has entrado en un ordenador que no es tuyo, cierra todas las sesiones abiertas. Tendrás que
            volver a entrar aquí y en el móvil.
          </p>

          <button type="button" class="pn-btn pn-btn--danger pn-btn--block" (click)="revokeAll()">
            Cerrar sesión en todos los dispositivos
          </button>
        </section>

        <!-- linked_accounts_screen.dart, sin Instagram: no es una forma de
             entrar, es de dónde salen las fotos, y vive en el portfolio.
             Apple sí está: desde que el panel pasa por Firebase Auth, el
             navegador puede obtener su idToken igual que el de Google. -->
        <section class="pn-card pn-col-6">
          <div class="pn-block__head">
            <span class="material-symbols-rounded">link</span>
            <h2>Cuentas vinculadas</h2>
          </div>

          <div class="pn-group__body">
            <div class="pn-row">
              <span class="material-symbols-rounded pn-row__icon">account_circle</span>
              <span class="pn-row__main">
                <span class="pn-row__title">Google</span>
                <span class="pn-row__sub">
                  @if (auth.user()?.googleLinked) {
                    Ya puedes entrar con el botón de Google.
                  } @else {
                    Tiene que ser el mismo correo que el de tu cuenta.
                  }
                </span>
              </span>
              @if (auth.user()?.googleLinked) {
                <span class="pn-status pn-status--success">Vinculada</span>
              }
            </div>

            @if (appleAvailable) {
              <div class="pn-row">
                <span class="material-symbols-rounded pn-row__icon">account_circle</span>
                <span class="pn-row__main">
                  <span class="pn-row__title">Apple</span>
                  <span class="pn-row__sub">
                    @if (auth.user()?.appleLinked) {
                      Ya puedes entrar con el botón de Apple.
                    } @else {
                      Vale aunque ocultes tu correo: Apple no tiene que coincidir con el de tu cuenta.
                    }
                  </span>
                </span>
                @if (auth.user()?.appleLinked) {
                  <span class="pn-status pn-status--success">Vinculada</span>
                }
              </div>
            }
          </div>

          <div class="link-actions">
            @if (auth.user()?.googleLinked) {
              <button type="button" class="pn-btn pn-btn--secondary pn-btn--block" [disabled]="linking() !== null"
                      (click)="unlink('google')">
                Desvincular Google
              </button>
            } @else {
              <button type="button" class="pn-btn pn-btn--primary pn-btn--block" [disabled]="linking() !== null"
                      (click)="link('google')">
                @if (linking() === 'google') { <span class="pn-spinner"></span> } @else { Vincular Google }
              </button>
            }

            @if (appleAvailable) {
              @if (auth.user()?.appleLinked) {
                <button type="button" class="pn-btn pn-btn--secondary pn-btn--block" [disabled]="linking() !== null"
                        (click)="unlink('apple')">
                  Desvincular Apple
                </button>
              } @else {
                <button type="button" class="pn-btn pn-btn--primary pn-btn--block" [disabled]="linking() !== null"
                        (click)="link('apple')">
                  @if (linking() === 'apple') { <span class="pn-spinner"></span> } @else { Vincular Apple }
                </button>
              }
            }
          </div>

          @if (linkError(); as text) {
            <p class="pn-field__error" role="alert">{{ text }}</p>
          }
        </section>

        <section class="pn-card pn-col-6">
          <div class="pn-block__head">
            <span class="material-symbols-rounded">mail</span>
            <h2>Correo</h2>
          </div>
          <div class="pn-group__body">
            <div class="pn-row">
              <span class="pn-row__main"><span class="pn-row__title">{{ auth.user()?.email }}</span></span>
              <span class="pn-status" [class.pn-status--success]="auth.emailVerified()"
                    [class.pn-status--warn]="!auth.emailVerified()">
                {{ auth.emailVerified() ? 'Verificado' : 'Sin verificar' }}
              </span>
            </div>
          </div>
        </section>
      </div>
    </main>
  `,
  styles: [
    `
      :host { display: block; }
      .back { margin: 0 0 14px -12px; text-decoration: none; }
      .body { font-size: 0.9375rem; line-height: 1.6; margin-bottom: 16px; }
      .link-actions { display: flex; flex-direction: column; gap: 10px; margin-top: 12px; }
    `,
  ],
})
export class CuentaComponent {
  readonly auth = inject(AuthService);
  private readonly api = inject(Api);
  private readonly confirm = inject(ConfirmService);
  private readonly toasts = inject(ToastService);
  private readonly social = inject(SocialAuth);

  current = '';
  next = '';
  readonly busy = signal(false);
  /** Qué proveedor se está vinculando o desvinculando. Null si ninguno. */
  readonly linking = signal<SocialProvider | null>(null);
  readonly linkError = signal<string | null>(null);

  readonly appleAvailable = this.social.appleAvailable;

  /**
   * Abre la ventana del proveedor y manda el idToken de Firebase.
   *
   * Un botón normal vale: a diferencia de Google Identity Services, el popup de
   * Firebase se lanza desde el gesto del usuario, así que el navegador no lo
   * bloquea y no hace falta que el botón lo pinte Google.
   */
  async link(provider: SocialProvider): Promise<void> {
    if (this.linking()) return;
    this.linking.set(provider);
    this.linkError.set(null);
    try {
      const identity = await this.social.obtainIdentity(provider);
      await this.api.post(`/me/link/${provider}`, { idToken: identity.idToken });
      await this.auth.refreshMe();
      this.toasts.show(`${providerLabel(provider)} vinculado`);
    } catch (cause) {
      if (cause instanceof SocialSignInCancelled) return;
      // El backend rechaza una cuenta de Google con otro correo (400). Con
      // Apple no exige que coincida: quien oculta el suyo entra con un relay.
      this.linkError.set(
        cause instanceof SocialSignInUnavailable
          ? cause.message
          : message(cause) || 'No se ha podido vincular.',
      );
    } finally {
      this.linking.set(null);
    }
  }

  async unlink(provider: SocialProvider): Promise<void> {
    const label = providerLabel(provider);
    // Without a password of their own, unlinking would lock them out.
    if (this.auth.user()?.hasPassword !== true && !this.hasOtherProvider(provider)) {
      this.linkError.set(
        `Es tu única forma de entrar: sin una contraseña propia, desvincular ${label} te dejaría fuera de tu cuenta.`,
      );
      return;
    }
    const answer = await this.confirm.ask({
      title: `Desvincular ${label}`,
      message: `Dejarás de poder entrar con ${label}. Seguirás accediendo con las otras formas que tengas.`,
      confirmLabel: 'Desvincular',
      destructive: true,
    });
    if (!answer.ok) return;
    this.linking.set(provider);
    try {
      await this.api.delete(`/me/link/${provider}`);
      await this.auth.refreshMe();
      this.toasts.show(`${label} desvinculado`);
    } catch (cause) {
      this.linkError.set(message(cause) || 'No se ha podido desvincular.');
    } finally {
      this.linking.set(null);
    }
  }

  /** Si le queda el otro proveedor para entrar cuando no tiene contraseña. */
  private hasOtherProvider(provider: SocialProvider): boolean {
    const user = this.auth.user();
    return provider === 'google' ? user?.appleLinked === true : user?.googleLinked === true;
  }

  async changePassword(): Promise<void> {
    if (this.next.length < 8) {
      this.toasts.error('La nueva contraseña necesita al menos ocho caracteres.');
      return;
    }
    this.busy.set(true);
    try {
      await this.api.post('/me/change-password', {
        currentPassword: this.current,
        newPassword: this.next,
      });
      this.current = '';
      this.next = '';
      this.toasts.show('Contraseña cambiada');
    } catch {
      this.toasts.error('No ha podido ser. Comprueba la contraseña actual.');
    } finally {
      this.busy.set(false);
    }
  }

  async revokeAll(): Promise<void> {
    const answer = await this.confirm.ask({
      title: 'Cerrar todas las sesiones',
      message: 'Se cierra también esta. Tendrás que volver a entrar.',
      confirmLabel: 'Cerrar todas',
      destructive: true,
    });
    if (!answer.ok) return;
    try {
      await this.api.post('/me/revoke-all-sessions');
      await this.auth.logout();
      location.assign('/acceder');
    } catch {
      this.toasts.error('No se ha podido.');
    }
  }
}
