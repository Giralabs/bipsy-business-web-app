import { Injectable, computed, inject, signal } from '@angular/core';
import { Api } from '../api/api';
import { AuthResponse, BusinessProfile, CategoryRef, MeResponse } from '../api/models';
import { SocialAuth, SocialProvider, businessSignInPath } from './social-auth.service';
import { TokenStorage } from './token-storage';

export type AuthStatus = 'unknown' | 'authenticated' | 'unauthenticated';

/** Lo poco que un trabajador necesita saber del negocio en el que trabaja. */
export interface EmployerSummary {
  id: number;
  name: string;
  profileImageUrl?: string | null;
  categories?: CategoryRef[];
  /** Public in `BusinessResponse`: whether the business runs a waiting list at all. */
  waitlistEnabled?: boolean;
}

/**
 * La cuenta existe, pero no es de las que entran aquí (un cliente de la app
 * Bipsy). Gemelo de `WrongRoleException` en `auth_controller.dart`.
 */
export class WrongRoleError extends Error {
  constructor() {
    super('Esta cuenta es de cliente. Para reservar, usa la app de Bipsy.');
  }
}

/**
 * The session and everything the panel derives from it — the web twin of
 * `authControllerProvider` plus the flag providers in
 * `apps/gipsi_business/lib/core/providers.dart`.
 *
 * The profile map is the source of truth for what the panel shows: a business
 * with `autonomous: true` has no team and no time clock, chat only exists with
 * `chatEnabled`, and a blocked subscription locks everything but the plan wall.
 *
 * Owners and workers sign in through the same door. For a worker `profile` is
 * their `WorkerResponse` (with `businessId`), and the business they work for
 * is read once from its public page so the panel can say whose agenda it is.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(Api);
  private readonly storage = inject(TokenStorage);
  private readonly social = inject(SocialAuth);

  readonly status = signal<AuthStatus>('unknown');
  readonly user = signal<MeResponse | null>(null);
  readonly employer = signal<EmployerSummary | null>(null);

  readonly profile = computed<BusinessProfile | null>(() => this.user()?.profile ?? null);
  readonly isBusiness = computed(() => this.user()?.role === 'BUSINESS');
  readonly isWorker = computed(() => this.user()?.role === 'WORKER');
  readonly isAutonomous = computed(() => this.profile()?.autonomous === true);

  /** El id del negocio: el propio para el dueño, el de su jefe para un trabajador. */
  readonly businessId = computed<number | null>(() => {
    const profile = this.profile();
    if (!profile) return null;
    return this.isWorker() ? (profile.businessId ?? null) : profile.id;
  });

  /** A worker that signed up but has not redeemed an invitation yet. */
  readonly needsBusiness = computed(() => this.isWorker() && this.businessId() == null);

  readonly businessName = computed(() =>
    this.isWorker()
      ? (this.employer()?.name ?? '')
      : (this.profile()?.name ?? this.user()?.name ?? ''),
  );

  /**
   * `canUseChatProvider`: an owner needs `chatEnabled`; a worker needs the
   * business to have chat on AND the owner to have let them use it.
   */
  readonly canUseChat = computed(() => {
    const profile = this.profile();
    if (!profile) return false;
    return this.isWorker()
      ? profile.businessChatEnabled === true && profile.chatEnabled === true
      : profile.chatEnabled === true;
  });
  readonly waitlistEnabled = computed(() => this.profile()?.waitlistEnabled === true);
  readonly clockInEnabled = computed(() => this.profile()?.clockInEnabled === true);
  readonly subscriptionBlocked = computed(() => this.profile()?.subscription?.blocked === true);
  readonly emailVerified = computed(() => this.user()?.emailVerified !== false);

  /** True when the plan (or super access) grants that feature code. */
  hasFeature(code: string): boolean {
    const entitlements = this.profile()?.entitlements ?? [];
    return entitlements.includes('*') || entitlements.includes(code);
  }

  /** Reads the stored session on start-up. Resolves before the guard decides. */
  async bootstrap(): Promise<void> {
    if (this.status() !== 'unknown') return;
    if (!this.storage.accessToken) {
      this.status.set('unauthenticated');
      return;
    }
    try {
      await this.refreshMe();
      this.status.set('authenticated');
    } catch {
      this.storage.clear();
      this.status.set('unauthenticated');
    }
  }

  /**
   * Correo y contraseña: el usuario dejó de existir con la V105. En qué app se
   * entra no va en el cuerpo, lo dice la cabecera de ámbito del interceptor.
   */
  async login(email: string, password: string): Promise<void> {
    await this.adopt(await this.api.post<AuthResponse>('/auth/login', { email, password }));
  }

  /**
   * Entrar con Google o con Apple.
   *
   * No crea cuentas, igual que en la app: el alta de un negocio pide
   * categoría, teléfono y aceptar los términos, que no salen de un token
   * social. Si no hay cuenta el backend responde 404, y la pantalla de acceso
   * sigue con el alta llevándose la identidad. Solo vale para dueños: el
   * backend rechaza a los trabajadores por esta puerta.
   *
   * `idToken` es el de **Firebase**, no el del proveedor: es lo que verifica
   * `FirebaseTokenVerifier` en el backend.
   */
  async loginWithProvider(provider: SocialProvider, idToken: string): Promise<void> {
    await this.adopt(await this.api.post<AuthResponse>(businessSignInPath(provider), { idToken }));
  }

  /** Atajo de siempre para Google. Ver [loginWithProvider]. */
  loginWithGoogle(idToken: string): Promise<void> {
    return this.loginWithProvider('google', idToken);
  }

  async registerBusiness(payload: Record<string, unknown>): Promise<void> {
    await this.adopt(await this.api.post<AuthResponse>('/auth/register/business', payload));
  }

  /** `/auth/accept-invitation`: crea la cuenta del trabajador ya dentro del negocio. */
  async acceptInvitation(payload: Record<string, unknown>): Promise<void> {
    await this.adopt(await this.api.post<AuthResponse>('/auth/accept-invitation', payload));
  }

  /** `/invitations/redeem/{token}`: un trabajador sin negocio se une a uno. */
  async redeemInvitation(token: string): Promise<void> {
    await this.api.post(`/invitations/redeem/${encodeURIComponent(token)}`);
    await this.refreshMe();
  }

  async refreshMe(): Promise<void> {
    const me = await this.api.get<MeResponse>('/me');
    this.user.set(me);
    await this.loadEmployer();
  }

  /** Applies a settings change locally so switches do not wait for a reload. */
  patchProfile(patch: Partial<BusinessProfile>): void {
    const current = this.user();
    if (!current?.profile) return;
    this.user.set({ ...current, profile: { ...current.profile, ...patch } });
  }

  async logout(): Promise<void> {
    const refreshToken = this.storage.refreshToken;
    this.storage.clear();
    this.user.set(null);
    this.employer.set(null);
    this.status.set('unauthenticated');
    // Cierra también la sesión de Firebase, que es la que abren Google y
    // Apple, para que la próxima vez vuelva a preguntar la cuenta. En el
    // ordenador del mostrador eso es la diferencia entre salir y no salir.
    await this.social.signOut();
    if (refreshToken) {
      try {
        await this.api.post('/auth/logout', { refreshToken });
      } catch {
        // The session is already gone on this side; the server will expire it.
      }
    }
  }

  /** Guarda la sesión y comprueba que es de las que entran aquí. */
  private async adopt(auth: AuthResponse): Promise<void> {
    this.storage.write(auth);
    await this.refreshMe();
    const role = this.user()?.role;
    if (role !== 'BUSINESS' && role !== 'WORKER') {
      await this.logout();
      throw new WrongRoleError();
    }
    this.status.set('authenticated');
  }

  private async loadEmployer(): Promise<void> {
    const id = this.isWorker() ? this.businessId() : null;
    if (id == null) {
      this.employer.set(null);
      return;
    }
    if (this.employer()?.id === id) return;
    try {
      this.employer.set(await this.api.get<EmployerSummary>(`/businesses/${id}`));
    } catch {
      // Sin el nombre del negocio el panel funciona igual; solo lo dice peor.
      this.employer.set({ id, name: '' });
    }
  }
}
