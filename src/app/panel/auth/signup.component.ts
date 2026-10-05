import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthLayoutComponent } from './auth-layout.component';
import { Api } from '../core/api/api';
import { AuthService } from '../core/auth/auth.service';
import { PendingSocial, hidesEmail } from '../core/auth/pending-social';
import {
  SocialAuth,
  SocialIdentity,
  SocialProvider,
  SocialSignInCancelled,
  SocialSignInUnavailable,
  providerLabel,
} from '../core/auth/social-auth.service';
import { CategoryRef, ResolvedAddress } from '../core/api/models';
import { PnAddressSearchComponent } from '../ui/address-search.component';
import { scheduleToApi } from '../core/api/schedule';
import { message } from '../core/data/resource';
import { TRIAL_DAYS } from '../../data/site.data';
import { CoachService } from '../onboarding/coach.service';

type Step = 1 | 2 | 3 | 4 | 5;

/**
 * `/registro` — the five-step sign-up of the app
 * (`features/auth/signup/step1..step5`), in the app's order: e-mail, business
 * data (this creates the account), e-mail verification, location, set-up.
 *
 * The verification is the business one, by LINK: `RegisterBusinessRequest`
 * takes no `signupToken` (the six-digit `/auth/signup/*-code` flow belongs to
 * customers), so the account is created unverified and the server e-mails a
 * link. Step 3 waits for it exactly like `step3_verify_screen.dart`: resend
 * with `/auth/resend-verification` and move on only when `/me` confirms it.
 *
 * Step 5 is the one that matters commercially: it asks how many people work
 * there, the first service, the opening hours and the booking rules, and only
 * then calls `PUT /businesses/me/onboarding`, which is what ends the sign-up
 * and starts the guided tour.
 */
@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [AuthLayoutComponent, FormsModule, RouterLink, PnAddressSearchComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './signup.component.html',
  styleUrl: './auth-forms.css',
})
export class SignupComponent {
  private readonly api = inject(Api);
  readonly auth = inject(AuthService);
  private readonly coach = inject(CoachService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly pending = inject(PendingSocial);
  private readonly social = inject(SocialAuth);

  readonly trialDays = TRIAL_DAYS;

  readonly step = signal<Step>(1);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly categories = signal<CategoryRef[]>([]);
  readonly resendIn = signal(0);

  readonly progress = computed(() => this.step() / 5);
  readonly stepTitle = computed(
    () =>
      ({
        1: 'Crea tu cuenta',
        2: 'Cuéntanos de tu negocio',
        3: 'Verifica tu correo',
        4: '¿Dónde trabajas?',
        5: 'Lo último y a trabajar',
      })[this.step()],
  );

  // Step 1
  email = '';
  /** `email-status` said RESUMABLE: a sign-up with this e-mail was left half way. */
  readonly resumable = signal(false);
  resumePassword = '';

  // Step 1 · llegando de Google o de Apple
  //
  // Quien pulsó «Continuar con Google/Apple» en `/acceder` y no tenía cuenta
  // llega aquí con el token en la mano: ni se le vuelve a pedir el correo ni
  // hay contraseña que elegir, porque la cuenta entra por el proveedor. Es la
  // regla de `RegisterBusinessRequest`: password, googleIdToken O appleIdToken,
  // uno y sólo uno. Y como el correo llega verificado, el alta se salta también
  // el paso 3.
  readonly identity = signal<SocialIdentity | null>(null);

  /** Cuál de los dos botones está girando. Null si ninguno. */
  readonly socialBusy = signal<SocialProvider | null>(null);
  readonly googleEnabled = this.social.googleAvailable;
  readonly appleEnabled = this.social.appleAvailable;
  readonly socialEnabled = this.googleEnabled || this.appleEnabled;

  /** Con proveedor no hay contraseña que pedir ni medidor que enseñar. */
  readonly withProvider = computed(() => this.identity() !== null);

  /**
   * Apple deja ocultar el correo y entonces da una dirección de relay. Sirve
   * para reconocer la cuenta, pero no para escribirle mientras el dominio no
   * esté registrado en Apple, y además el negocio no la reconoce al verla en su
   * perfil. En ese caso el paso 1 se queda en pie para pedirle uno suyo.
   */
  readonly needsTypedEmail = computed(() => hidesEmail(this.identity()));

  readonly providerName = computed(() => {
    const provider = this.identity()?.provider;
    return provider ? providerLabel(provider) : '';
  });

  // Step 3
  /** Info (not error) line under the verification step, e.g. «correo reenviado». */
  readonly notice = signal<string | null>(null);
  /** The categories request failed: the select would be empty with no way out. */
  readonly categoriesFailed = signal(false);

  // Step 2
  businessName = '';
  phone = '';
  password = '';
  cif = '';
  categoryId: number | null = null;
  autonomous = false;
  acceptedTerms = false;
  marketingOptIn = false;

  // Step 4
  serviceMode: 'AT_BUSINESS' | 'AT_CUSTOMER' | 'BOTH' = 'AT_BUSINESS';
  address = '';
  city = '';
  province = '';
  postalCode = '';
  /** What the address search resolved; dropped as soon as the text is typed again. */
  readonly resolvedAddress = signal<ResolvedAddress | null>(null);
  /** False once `/places/*` answers 503: then the address goes by hand. */
  readonly placesUp = signal(true);

  // Step 5
  teamSize: 'SOLO' | 'SMALL' | 'MEDIUM' | 'LARGE' = 'SOLO';
  serviceName = '';
  servicePrice: number | null = null;
  serviceDuration = 30;
  opensWeekends = false;
  requiresCard = false;

  /** 0-4, the same five steps the app's meter shows. */
  readonly strength = computed(() => {
    const value = this.password;
    let score = 0;
    if (value.length >= 8) score++;
    if (/[A-Z]/.test(value)) score++;
    if (/[a-z]/.test(value)) score++;
    if (/\d/.test(value)) score++;
    if (/[^A-Za-z0-9]/.test(value)) score++;
    return score;
  });

  readonly passwordSignal = signal(0);

  constructor() {
    this.adoptPendingSocial();
    this.resume(this.route.snapshot.queryParamMap.get('paso'));
    void this.loadCategories();
  }

  /**
   * Recoge la identidad que dejó el acceso con Google o Apple cuando ese correo
   * no tenía cuenta todavía. Gemelo de `SignupController.build()`.
   *
   * Se salta el paso del correo: el proveedor ya lo ha verificado y volver a
   * pedirlo sería pedir por segunda vez algo que ya está probado. La excepción
   * es el relay de Apple, que sirve para reconocer la cuenta pero no para
   * escribirle: ahí el paso 1 se queda en pie para que escriba uno suyo.
   */
  private adoptPendingSocial(): void {
    const identity = this.pending.take();
    if (!identity) return;
    this.identity.set(identity);
    // Con suerte, un nombre con el que empezar el del negocio. Es sólo el
    // punto de partida: se puede cambiar antes de crear nada.
    this.businessName = identity.name ?? '';
    if (hidesEmail(identity)) return;
    this.email = identity.email ?? '';
    this.step.set(2);
  }

  /**
   * Paso 1 con proveedor: en vez de escribir el correo, se trae de Google o de
   * Apple ya verificado.
   *
   * Se prueba primero a ENTRAR (`/auth/{proveedor}/business`) aunque esto sea
   * el registro: quien ya tiene cuenta y se equivoca de puerta entra en la
   * suya en lugar de chocar con «ese correo ya está cogido». El 404 —no hay
   * cuenta— es el caso normal aquí, y es el que sigue con el alta.
   */
  async signUpWith(provider: SocialProvider): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.socialBusy.set(provider);
    this.error.set(null);
    // Una identidad de un intento anterior deja de valer en cuanto empieza
    // otro: si no, cancelar el segundo dejaría en pie el correo del primero.
    this.identity.set(null);

    let identity: SocialIdentity | null = null;
    try {
      identity = await this.social.obtainIdentity(provider);
      await this.auth.loginWithProvider(provider, identity.idToken);
      // Ya tenía cuenta: el guardia del panel le deja donde le toque.
      await this.router.navigateByUrl('/panel');
    } catch (cause) {
      if (cause instanceof SocialSignInCancelled) return;
      if (cause instanceof SocialSignInUnavailable) {
        this.error.set(cause.message);
        return;
      }
      if ((cause as { status?: number }).status === 404 && identity?.email) {
        this.identity.set(identity);
        this.businessName = identity.name ?? '';
        this.resumable.set(false);
        // Con el correo oculto (relay de Apple) el paso 1 se queda en pie para
        // que escriba uno suyo; con uno normal, directo a los datos.
        if (!hidesEmail(identity)) {
          this.email = identity.email;
          this.step.set(2);
        }
        return;
      }
      this.error.set(message(cause));
    } finally {
      this.busy.set(false);
      this.socialBusy.set(null);
    }
  }

  /** Volver a empezar con el correo de siempre tras elegir un proveedor. */
  dropProvider(): void {
    this.identity.set(null);
    this.email = '';
    this.businessName = '';
    this.error.set(null);
    this.step.set(1);
  }

  /**
   * Retoma un alta que se quedó a medias, en el paso que trae el guardia.
   *
   * Quien vuelve con la cuenta ya creada no puede empezar por «Crea tu
   * cuenta»: chocaría con su propio correo. Se retoman los pasos posteriores
   * a la cuenta (3, 4 y 5), que son los únicos sin botón «Atrás». El guardia
   * sólo trae 4 y 5: a quien le falta verificar lo aparca en
   * /panel/verificar-email; el 3 llega desde «retomar» del paso 1.
   */
  private resume(pending: string | null): void {
    if (pending === '/signup/verificacion') this.step.set(3);
    else if (pending === '/signup/ubicacion') this.step.set(4);
    else if (pending === '/signup/configuracion') this.step.set(5);
    if (this.step() === 3) this.startResendTimer(30);
  }

  async loadCategories(): Promise<void> {
    this.categoriesFailed.set(false);
    try {
      this.categories.set(await this.api.get<CategoryRef[]>('/categories'));
    } catch {
      // `categoryId` is mandatory, so an empty list must say so and offer a retry.
      this.categories.set([]);
      this.categoriesFailed.set(true);
    }
  }

  back(): void {
    if (this.step() > 1) this.step.set((this.step() - 1) as Step);
  }

  /**
   * Step 1 — only asks whether the e-mail is free (`email-status`), like
   * `Step1AccountScreen`: the account is created in step 2, and a sign-up
   * left half way does not block the address, it is resumed.
   */
  async checkEmail(): Promise<void> {
    // Con proveedor y un correo utilizable no hay nada que preguntar: viene
    // verificado y firmado, y la cuenta se crea en el paso 2.
    if (this.withProvider() && !this.needsTypedEmail()) {
      this.step.set(2);
      return;
    }
    const email = this.email.trim();
    if (!email) {
      this.error.set('Escribe tu correo electrónico');
      return;
    }
    if (!/^[^\s@]+@[\w-]+(\.[\w-]+)+$/.test(email)) {
      this.error.set('Ese correo no parece válido');
      return;
    }
    await this.run(async () => {
      let status: string | null = null;
      try {
        status = (await this.api.post<{ status: string }>('/auth/signup/email-status', { email })).status;
      } catch {
        // If the question fails we go on: registering validates it again.
      }
      if (status === 'TAKEN') throw new Error('Ya tienes una cuenta con este correo.');
      if (status === 'TAKEN_GOOGLE') throw new Error('Ya tienes cuenta. Entra con Google.');
      if (status === 'RESUMABLE') {
        this.resumable.set(true);
        return;
      }
      this.resumable.set(false);
      this.step.set(2);
    });
  }

  /**
   * A half-done sign-up: the password proves the account is theirs (the same
   * check `/auth/signup/resume` makes), and the server's pending step says
   * where to go back to.
   */
  async resumeSignup(): Promise<void> {
    if (!this.resumePassword) {
      this.error.set('Escribe tu contraseña.');
      return;
    }
    await this.run(async () => {
      try {
        await this.auth.login(this.email.trim(), this.resumePassword);
      } catch (cause) {
        const status = (cause as { status?: number }).status;
        if (status === 401 || status === 400) {
          throw new Error('No hemos podido retomar el registro. Revisa el correo y la contraseña.');
        }
        throw cause;
      }
      const profile = this.auth.profile();
      if (profile?.onboardingComplete !== false) {
        await this.router.navigateByUrl('/panel');
        return;
      }
      this.resumable.set(false);
      this.resume(this.auth.emailVerified() ? (profile.signupRoute ?? '/signup/ubicacion') : '/signup/verificacion');
    });
  }

  /** Step 2 — this is where the account is actually created. */
  async createAccount(): Promise<void> {
    // `RegisterBusinessRequest.categoryId` is @NotNull (V22): asked first, as in the app.
    if (this.categoryId == null) {
      this.error.set('Elige a qué se dedica tu negocio.');
      return;
    }
    const identity = this.identity();
    if (!this.businessName.trim() || !this.phone.trim()) {
      this.error.set('Rellena el nombre y el teléfono.');
      return;
    }
    // Con proveedor no hay contraseña: la cuenta entra por él.
    if (!identity && !this.password) {
      this.error.set('Elige una contraseña para tu cuenta.');
      return;
    }
    if (!this.acceptedTerms) {
      this.error.set('Tienes que aceptar los términos para continuar.');
      return;
    }
    await this.run(async () => {
      await this.auth.registerBusiness({
        name: this.businessName.trim(),
        email: this.email.trim(),
        // `RegisterBusinessRequest`: password, googleIdToken O appleIdToken,
        // uno y sólo uno. Mandar los dos hace que el servidor rechace el alta.
        ...(identity
          ? { [identity.provider === 'apple' ? 'appleIdToken' : 'googleIdToken']: identity.idToken }
          : { password: this.password }),
        phone: this.phone.trim(),
        cif: this.cif.trim() || null,
        autonomous: this.autonomous,
        categoryId: this.categoryId,
        acceptedTerms: true,
        marketingOptIn: this.marketingOptIn,
      });
      // The server has just e-mailed the link: the countdown starts now, so
      // «reenviar» is not offered before the first one had time to arrive.
      this.notice.set(null);
      this.startResendTimer(30);
      this.step.set(this.auth.emailVerified() ? 4 : 3);
    });
  }

  /** Step 3 — `POST /auth/resend-verification`, with the server's cooldown. */
  async resend(): Promise<void> {
    if (this.resendIn() > 0 || this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    this.notice.set(null);
    try {
      await this.api.post('/auth/resend-verification');
      this.notice.set('Te hemos enviado un correo nuevo. Revisa también el spam.');
      this.startResendTimer(30);
    } catch (cause) {
      const status = (cause as { status?: number }).status;
      const detail = (cause as { error?: { message?: string } }).error?.message;
      if (status === 429) {
        // «Espera 18 segundos…»: the server is the source of truth for the wait.
        const seconds = Number(/(\d+)/.exec(detail ?? '')?.[1] ?? 30);
        this.startResendTimer(seconds);
      }
      this.error.set(detail || 'No se pudo reenviar el correo. Inténtalo de nuevo.');
    } finally {
      this.busy.set(false);
    }
  }

  /** Step 3 — moves on only when `/me` says the address is verified. */
  async checkVerified(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    this.notice.set(null);
    try {
      await this.auth.refreshMe();
      if (this.auth.emailVerified()) {
        const route = this.auth.profile()?.signupRoute;
        this.step.set(route === '/signup/configuracion' ? 5 : 4);
      } else {
        this.error.set('Todavía no nos consta verificado. Abre el enlace del correo y vuelve a intentarlo.');
      }
    } catch {
      this.error.set('No se pudo comprobar. Revisa tu conexión.');
    } finally {
      this.busy.set(false);
    }
  }

  private resendTimer: ReturnType<typeof setInterval> | null = null;

  private startResendTimer(seconds: number): void {
    if (this.resendTimer) clearInterval(this.resendTimer);
    this.resendIn.set(seconds);
    this.resendTimer = setInterval(() => {
      this.resendIn.set(this.resendIn() - 1);
      if (this.resendIn() <= 0 && this.resendTimer) {
        clearInterval(this.resendTimer);
        this.resendTimer = null;
      }
    }, 1000);
  }

  /** Step 4 — the address search chose one: keep its city, province and point. */
  onAddressResolved(address: ResolvedAddress): void {
    this.resolvedAddress.set(address);
    this.error.set(null);
  }

  /** «41004 · Sevilla · Sevilla» under the chosen street. */
  addressZone(address: ResolvedAddress): string {
    return [address.postalCode, address.city, address.province].filter((part) => !!part).join(' · ');
  }

  /**
   * Step 4 — where the work happens, as `step4_location_screen.dart._save()`.
   *
   * With a venue the address must come from the suggestions (that is what
   * brings the point on the map); if the backend has no Places key the field
   * is plain text and city / postal code are typed by hand. Only the street
   * and number are sent as `address`: Google's full text already carries
   * city and country, and the public page would read «Sevilla, España,
   * Sevilla».
   */
  async saveLocation(): Promise<void> {
    const hasVenue = this.serviceMode !== 'AT_CUSTOMER';
    const resolved = this.resolvedAddress();
    if (hasVenue && !this.address.trim()) {
      this.error.set('Escribe la dirección de tu local.');
      return;
    }
    if (hasVenue && this.placesUp() && !resolved) {
      this.error.set('Elige tu dirección de la lista de sugerencias.');
      return;
    }
    await this.run(async () => {
      const street = resolved?.address?.trim() || this.address.trim();
      const city = resolved?.city ?? (this.city.trim() || null);
      const province = resolved?.province ?? (this.province.trim() || null);
      const postalCode = resolved?.postalCode ?? (this.postalCode.trim() || null);
      await this.api.put('/businesses/me/location', {
        serviceMode: this.serviceMode,
        // For a backend older than V82, which only reads the boolean.
        worksAtHome: !hasVenue,
        ...(hasVenue ? { address: street } : {}),
        ...(city ? { city } : {}),
        ...(province ? { province } : {}),
        ...(hasVenue && postalCode ? { postalCode } : {}),
        ...(hasVenue && resolved?.placeId ? { placeId: resolved.placeId } : {}),
        ...(hasVenue && resolved?.latitude != null && resolved.longitude != null
          ? { latitude: resolved.latitude, longitude: resolved.longitude }
          : {}),
      });
      // The guard reads the pending step from the profile: without this it
      // still believes the location is missing.
      await this.auth.refreshMe();
      this.step.set(5);
    });
  }

  /** Step 4 — switching mode drops the address searched with the other one. */
  setServiceMode(mode: 'AT_BUSINESS' | 'AT_CUSTOMER' | 'BOTH'): void {
    if (mode === this.serviceMode) return;
    const wasCustomer = this.serviceMode === 'AT_CUSTOMER';
    this.serviceMode = mode;
    if (wasCustomer || mode === 'AT_CUSTOMER') {
      this.address = '';
      this.resolvedAddress.set(null);
    }
  }

  /**
   * Step 5 — team size, the first service, a sensible week and the booking
   * rules. Anything left blank can be filled later from the checklist, so
   * nothing here blocks finishing.
   */
  async finish(): Promise<void> {
    await this.run(async () => {
      if (this.serviceName.trim() && this.servicePrice != null) {
        await this.api.post('/services', {
          name: this.serviceName.trim(),
          price: this.servicePrice,
          duration: this.serviceDuration,
        });
      }

      const weekdays = [1, 2, 3, 4, 5, ...(this.opensWeekends ? [6] : [])];
      await this.api.put(
        '/schedules/me',
        scheduleToApi(
          weekdays.flatMap((day) => [
            { dayOfWeek: day, startTime: '09:00', endTime: '14:00' },
            ...(day === 6 ? [] : [{ dayOfWeek: day, startTime: '16:00', endTime: '20:00' }]),
          ]),
        ),
      );

      // `autonomous` is a setting; `teamSize` is not (BusinessSettingsRequest has no such field).
      await this.api.put('/businesses/me/settings', { autonomous: this.teamSize === 'SOLO' });

      // UpdateOnboardingRequest(teamSize, requiresCard, cancellationFeePercent,
      // cancellationWindowHours): this call is also what marks the sign-up as
      // done. Without a card there is nothing to charge, so the fee goes to 0,
      // like `Step5SetupScreen._finish()`; the window keeps its default.
      await this.api.put('/businesses/me/onboarding', {
        teamSize: this.teamSize,
        requiresCard: this.requiresCard,
        ...(this.requiresCard ? {} : { cancellationFeePercent: 0 }),
      });
      await this.auth.refreshMe();

      // Same as `Step5SetupScreen._finish()`: finishing the sign-up is what
      // starts the guided tour.
      this.coach.start();
      await this.router.navigateByUrl('/panel');
    });
  }

  private async run(action: () => Promise<void>): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      await action();
    } catch (cause) {
      this.error.set(cause instanceof Error ? cause.message : message(cause));
    } finally {
      this.busy.set(false);
    }
  }
}
