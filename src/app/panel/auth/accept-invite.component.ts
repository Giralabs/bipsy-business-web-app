import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthLayoutComponent } from './auth-layout.component';
import { Api } from '../core/api/api';
import { AuthService } from '../core/auth/auth.service';
import { message } from '../core/data/resource';

interface Invitation {
  id: number;
  businessId: number;
  businessName: string;
  email: string | null;
  token: string;
  expiresAt: string;
  used: boolean;
}

/**
 * `/invitacion/:token` — `accept_invitation_screen.dart`.
 *
 * Primero se lee la invitación (`GET /invitations/token/{token}`, público) para
 * decir de qué negocio es. Luego, según quién esté mirando:
 *
 * - sin sesión: el formulario de alta (`POST /auth/accept-invitation`), que
 *   crea la cuenta ya dentro del negocio y entra;
 * - un trabajador con sesión y sin negocio: un botón que la canjea
 *   (`POST /invitations/redeem/{token}`).
 *
 * Si la cuenta ya existe (409) no se inventa nada: se le manda a entrar y,
 * con la sesión abierta, vuelve aquí a canjearla.
 */
@Component({
  selector: 'app-accept-invite',
  standalone: true,
  imports: [AuthLayoutComponent, FormsModule, RouterLink],
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
        <a class="pn-btn pn-btn--primary pn-btn--lg pn-btn--block" routerLink="/unirse">Probar con otro código</a>
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
            Con ella verás tus citas, tu horario y tus ausencias, aquí y en la app Bipsy Negocio.
          </p>

          <form (ngSubmit)="register()">
            <label class="pn-field">
              <span class="pn-field__label">Nombre y apellidos</span>
              <input class="pn-input" name="name" autocomplete="name" [(ngModel)]="name" />
            </label>
            <label class="pn-field">
              <span class="pn-field__label">Correo</span>
              <input class="pn-input" type="email" name="email" autocomplete="email" [(ngModel)]="email" />
            </label>
            <label class="pn-field">
              <span class="pn-field__label">Teléfono</span>
              <input class="pn-input" type="tel" name="phone" autocomplete="tel" [(ngModel)]="phone" />
            </label>
            <label class="pn-field">
              <span class="pn-field__label">Contraseña</span>
              <input class="pn-input" type="password" name="password" autocomplete="new-password"
                     placeholder="Mínimo 8 caracteres" [(ngModel)]="password" />
            </label>

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
    `,
  ],
})
export class AcceptInviteComponent {
  readonly auth = inject(AuthService);
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly token = inject(ActivatedRoute).snapshot.paramMap.get('token') ?? '';

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
        this.email = inv.email ?? '';
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
  }

  async register(): Promise<void> {
    if (this.busy()) return;
    if (!this.name.trim() || !this.email.trim() || !this.phone.trim()) {
      this.error.set('Rellena todos los campos.');
      return;
    }
    if (this.password.length < 8) {
      this.error.set('La contraseña necesita al menos ocho caracteres.');
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    this.exists.set(false);
    try {
      await this.auth.acceptInvitation({
        token: this.token,
        name: this.name.trim(),
        email: this.email.trim(),
        password: this.password,
        phone: this.phone.trim(),
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
