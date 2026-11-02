import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthLayoutComponent } from './auth-layout.component';
import { Api } from '../core/api/api';
import { AuthService } from '../core/auth/auth.service';
import { newPasswordError } from '../core/auth/password-policy';
import { PendingSocial } from '../core/auth/pending-social';
import {
  SocialAuth,
  SocialIdentity,
  SocialProvider,
  SocialSignInCancelled,
  SocialSignInUnavailable,
  providerLabel,
} from '../core/auth/social-auth.service';
import { message } from '../core/data/resource';
import { PnPasswordRulesComponent } from '../ui/password-rules.component';

interface Invitation {
  id: number;
  businessId: number;
  businessName: string;
  email: string | null;
  token: string;
  expiresAt: string;
  used: boolean;
}

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * `/invitacion/:token` and `/equipo/:token` — `accept_invitation_screen.dart`.
 *
 * Primero se lee la invitación (`GET /invitations/token/{token}`, público) para
 * decir de qué negocio es. Luego, según quién esté mirando:
 *
 * - sin sesión: el formulario de alta (`POST /auth/accept-invitation`), con
 *   contraseña o con Google/Apple, que crea la cuenta ya dentro del negocio y
 *   entra;
 * - un trabajador con sesión y sin negocio: un botón que la canjea
 *   (`POST /invitations/redeem/{token}`).
 *
 * Si la cuenta ya existe (409) no se inventa nada: se le manda a entrar y,
 * con la sesión abierta, vuelve aquí a canjearla.
 */
@Component({
  selector: 'app-accept-invite',
  standalone: true,
  imports: [AuthLayoutComponent, FormsModule, RouterLink, PnPasswordRulesComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-auth-layout bip="MB-05" claim="Bienvenido al equipo.">
      @if (loading()) {
        <div class="pn-skeleton" style="height:36px;width:70%"></div>
        <div class="pn-skeleton" style="height:18px;margin-top:16px"></div>
        <div class="pn-skeleton" style="height:220px;margin-top:28px"></div>
      } @else if (problem()) {
        <h1 class="auth-title">Esta invitación no vale</h1>
        <p class="auth-lead">{{ problem() }}</p>
        <a class="pn-btn pn-btn--primary pn-btn--lg pn-btn--block" routerLink="/unirse"
           [queryParams]="emailGiven ? { email: email } : {}" (click)="keepIdentity()">Probar con otro código</a>
        <p class="auth-foot"><a routerLink="/acceder">Volver a iniciar sesión</a></p>
      }
      @if (!loading() && !problem() && invitation(); as inv) {
        <p class="inv-tag">
          <span class="material-symbols-rounded">storefront</span>
          Invitación de {{ inv.businessName }}
        </p>

        @if (signedWorker()) {
          <h1 class="auth-title">Únete a {{ inv.businessName }}</h1>
          <p class="auth-lead">
            Entrarás con tu cuenta de siempre ({{ auth.user()?.email }}). A partir de ahí verás tus citas y,
            si tu negocio lo usa, podrás fichar.
          </p>
          @if (error(); as text) {
            <p class="pn-field__error auth-error" role="alert">{{ text }}</p>
          }
          <button type="button" class="pn-btn pn-btn--primary pn-btn--lg pn-btn--block" [disabled]="busy()"
                  (click)="redeem()">
            @if (busy()) { <span class="pn-spinner"></span> } @else { Unirme a {{ inv.businessName }} }
          </button>
        } @else if (signedOther()) {
          <h1 class="auth-title">Esta invitación es para un trabajador</h1>
          <p class="auth-lead">
            Has entrado con la cuenta de un negocio. Cierra sesión y abre el enlace otra vez para crear la cuenta
            de trabajador.
          </p>
          <button type="button" class="pn-btn pn-btn--secondary pn-btn--lg pn-btn--block" (click)="logout()">
            Cerrar sesión
          </button>
        } @else {
          <h1 class="auth-title">Crea tu cuenta de trabajador</h1>
          <p class="auth-lead">
            Con ella verás tus citas, tu horario y tus ausencias, aquí y en la app Bipsy Business.
          </p>

          <form (ngSubmit)="register()">
            <label class="pn-field">
              <span class="pn-field__label">Nombre y apellidos</span>
              <input class="pn-input" name="name" autocomplete="name" [(ngModel)]="name" />
            </label>
            <!-- With a provider the e-mail is theirs, and if it was typed earlier
                 in the sign-up it is already given: neither is asked again. -->
            @if (!identity() && !emailGiven) {
              <label class="pn-field">
                <span class="pn-field__label">Correo</span>
                <input class="pn-input" type="email" name="email" autocomplete="email" [(ngModel)]="email" />
              </label>
            }
            <label class="pn-field">
              <span class="pn-field__label">Teléfono</span>
              <input class="pn-input" type="tel" name="phone" autocomplete="tel" [(ngModel)]="phone" />
            </label>
            @if (identity(); as who) {
              <div class="pn-group__body inv-account">
                <div class="pn-row">
                  <span class="material-symbols-rounded pn-row__icon inv-verified">verified</span>
                  <span class="pn-row__main"><span class="pn-row__title">{{ providerName(who.provider) }}</span></span>
                  @if (who.email) { <span class="pn-dim">{{ who.email }}</span> }
                </div>
              </div>
              <button type="button" class="pn-btn pn-btn--text auth-link" (click)="dropProvider()">
                Prefiero usar otro correo
              </button>
            } @else {
              <label class="pn-field">
                <span class="pn-field__label">Contraseña</span>
                <input class="pn-input" type="password" name="password" autocomplete="new-password"
                       [(ngModel)]="password" />
                <pn-password-rules [password]="password" />
              </label>
            }

            @if (error(); as text) {
              <p class="pn-field__error auth-error" role="alert">{{ text }}</p>
            }
            @if (exists()) {
              <a class="pn-btn pn-btn--secondary pn-btn--block inv-login" routerLink="/acceder"
                 [queryParams]="{ volver: '/invitacion/' + inv.token }">
                Entrar con mi cuenta y unirme
              </a>
            }

            <button type="submit" class="pn-btn pn-btn--primary pn-btn--lg pn-btn--block" [disabled]="busy()">
              @if (busy()) { <span class="pn-spinner"></span> } @else { Crear cuenta y entrar }
            </button>
          </form>

          @if (!identity() && (googleEnabled || appleEnabled)) {
            <div class="auth-divider"><span>o</span></div>
            <div class="auth-social">
              @if (googleEnabled) {
                <button type="button" class="social-btn social-btn--google" [disabled]="busy()" (click)="useProvider('google')">
                  @if (socialBusy() === 'google') {
                    <span class="pn-spinner"></span>
                  } @else {
                    <svg class="social-btn__logo" viewBox="0 0 48 48" aria-hidden="true">
                      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24s.92 7.54 2.56 10.78l7.97-6.19z"/>
                      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                    </svg>
                    Continuar con Google
                  }
                </button>
              }
              @if (appleEnabled) {
                <button type="button" class="social-btn social-btn--apple" [disabled]="busy()" (click)="useProvider('apple')">
                  @if (socialBusy() === 'apple') {
                    <span class="pn-spinner"></span>
                  } @else {
                    <svg class="social-btn__logo social-btn__logo--apple" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M17.05 12.54c-.03-2.6 2.12-3.85 2.22-3.91-1.21-1.77-3.09-2.01-3.76-2.04-1.6-.16-3.12.94-3.93.94-.81 0-2.06-.92-3.39-.9-1.74.03-3.35 1.01-4.25 2.57-1.81 3.14-.46 7.79 1.3 10.34.86 1.25 1.88 2.65 3.23 2.6 1.3-.05 1.79-.84 3.36-.84 1.57 0 2.01.84 3.38.81 1.4-.02 2.28-1.27 3.13-2.53.99-1.45 1.4-2.86 1.42-2.93-.03-.01-2.72-1.04-2.75-4.13M14.5 4.76c.71-.87 1.19-2.07 1.06-3.27-1.02.04-2.27.69-3.01 1.55-.66.76-1.24 1.99-1.08 3.16 1.14.09 2.31-.58 3.03-1.44"/>
                    </svg>
                    Continuar con Apple
                  }
                </button>
              }
            </div>
          }

          <p class="auth-foot">
            ¿Ya tienes cuenta?
            <a routerLink="/acceder" [queryParams]="{ volver: '/invitacion/' + inv.token }">Entra y únete</a>
          </p>
        }
      }
    </app-auth-layout>
  `,
  styleUrl: './auth-forms.css',
  styles: [
    `
      .inv-tag {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 18px;
        padding: 8px 14px 8px 11px;
        border-radius: var(--r-pill);
        background: var(--pn-field);
        font-size: 0.8125rem;
        font-weight: 800;
      }
      .inv-tag .material-symbols-rounded { font-size: 18px; }
      .inv-login { margin-bottom: 12px; text-decoration: none; }
      .inv-account { margin-bottom: 8px; }
      .inv-verified { color: var(--clr-success); }
    `,
  ],
})
export class AcceptInviteComponent {
  readonly auth = inject(AuthService);
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly social = inject(SocialAuth);
  private readonly route = inject(ActivatedRoute).snapshot;
  private readonly token = this.route.paramMap.get('token') ?? '';

  readonly googleEnabled = this.social.googleAvailable;
  readonly appleEnabled = this.social.appleAvailable;
  /** The provider account the worker signs up with, if any. No password then. */
  private readonly pending = inject(PendingSocial);
  readonly identity = signal<SocialIdentity | null>(this.pending.take());
  readonly socialBusy = signal<SocialProvider | null>(null);
  /** The sign-up already asked for it: validated here, as the field stays hidden. */
  readonly emailGiven = EMAIL.test(this.route.queryParamMap.get('email')?.trim() ?? '');

  readonly loading = signal(true);
  readonly invitation = signal<Invitation | null>(null);
  readonly problem = signal<string | null>(null);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly exists = signal(false);

  readonly signedWorker = computed(() => this.auth.status() === 'authenticated' && this.auth.isWorker());
  readonly signedOther = computed(() => this.auth.status() === 'authenticated' && !this.auth.isWorker());

  name = '';
  email = '';
  phone = '';
  password = '';

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    await this.auth.bootstrap();
    // Ya dentro de un negocio: la invitación sobra.
    if (this.auth.status() === 'authenticated' && this.auth.isWorker() && !this.auth.needsBusiness()) {
      await this.router.navigateByUrl('/panel');
      return;
    }
    try {
      const inv = await this.api.get<Invitation>(`/invitations/token/${encodeURIComponent(this.token)}`);
      if (inv.used) {
        this.problem.set('Este código ya se ha usado. Pide a tu negocio uno nuevo desde Equipo.');
      } else if (inv.expiresAt && new Date(inv.expiresAt) < new Date()) {
        this.problem.set('Este código ha caducado. Pide a tu negocio uno nuevo desde Equipo.');
      } else {
        this.invitation.set(inv);
        this.email = this.emailGiven
          ? (this.route.queryParamMap.get('email')?.trim() ?? '')
          : (inv.email ?? '');
        if (!this.name) this.name = this.identity()?.name ?? '';
      }
    } catch (cause) {
      const status = (cause as { status?: number }).status;
      this.problem.set(
        status === 404 || status === 400
          ? 'No encontramos ninguna invitación con ese código. Revisa que esté bien escrito.'
          : message(cause),
      );
    } finally {
      this.loading.set(false);
    }
    // A bad code never reaches the assignment above, and the retry link needs it.
    this.email ||= this.route.queryParamMap.get('email')?.trim() ?? '';
  }

  /** A mistyped code must not cost them the provider account they came with. */
  keepIdentity(): void {
    this.pending.set(this.identity());
  }

  async register(): Promise<void> {
    if (this.busy()) return;
    const identity = this.identity();
    if (!this.name.trim() || !this.phone.trim() || (!identity && !this.email.trim())) {
      this.error.set('Rellena todos los campos.');
      return;
    }
    const invalid = identity ? null : newPasswordError(this.password);
    if (invalid) {
      this.error.set(invalid);
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    this.exists.set(false);
    try {
      await this.auth.acceptInvitation({
        token: this.token,
        name: this.name.trim(),
        phone: this.phone.trim(),
        // Either a password with its e-mail or a provider's token: the token
        // already carries the e-mail.
        ...(identity
          ? { [identity.provider === 'apple' ? 'appleIdToken' : 'googleIdToken']: identity.idToken }
          : { email: this.email.trim(), password: this.password }),
      });
      await this.router.navigateByUrl('/panel');
    } catch (cause) {
      const status = (cause as { status?: number }).status;
      if (status === 409) {
        this.exists.set(true);
        this.error.set('Ya hay una cuenta con ese correo. Entra con ella y te unimos.');
      } else {
        this.error.set(message(cause));
      }
    } finally {
      this.busy.set(false);
    }
  }

  /** `_useProvider`: fills in the name and takes the place of e-mail and password. */
  async useProvider(provider: SocialProvider): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.socialBusy.set(provider);
    this.error.set(null);
    this.exists.set(false);
    try {
      const identity = await this.social.obtainIdentity(provider);
      this.identity.set(identity);
      if (!this.name.trim()) this.name = identity.name ?? '';
    } catch (cause) {
      if (cause instanceof SocialSignInCancelled) return;
      this.error.set(cause instanceof SocialSignInUnavailable ? cause.message : message(cause));
    } finally {
      this.busy.set(false);
      this.socialBusy.set(null);
    }
  }

  dropProvider(): void {
    this.identity.set(null);
    this.error.set(null);
    this.exists.set(false);
  }

  providerName(provider: SocialProvider): string {
    return providerLabel(provider);
  }

  async redeem(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.auth.redeemInvitation(this.token);
      await this.router.navigateByUrl('/panel');
    } catch (cause) {
      this.error.set(message(cause));
    } finally {
      this.busy.set(false);
    }
  }

  async logout(): Promise<void> {
    await this.auth.logout();
    location.reload();
  }
}
