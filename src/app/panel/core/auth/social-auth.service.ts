import { Injectable } from '@angular/core';
import {
  firebaseConfig,
  isAppleSignInConfigured,
  isGoogleSignInConfigured,
} from './firebase.config';

/** Con quién se entra. Lo que cambia es el proveedor y el endpoint, nada más. */
export type SocialProvider = 'google' | 'apple';

/**
 * Lo que devuelve el proveedor una vez pasado por Firebase.
 *
 * `email` y `name` no son para el login —ahí sólo viaja el `idToken`— sino para
 * el alta: cuando el correo no tiene cuenta todavía, el registro sigue con
 * estos datos en la mano en vez de volver a pedirlos. Con Apple el nombre llega
 * **una sola vez**, la primera que se autoriza, así que o se guarda entonces o
 * ya no hay forma de recuperarlo.
 */
export interface SocialIdentity {
  provider: SocialProvider;
  idToken: string;
  email: string | null;
  name: string | null;
}

/** El usuario cerró la ventana del proveedor. No es un error que contar. */
export class SocialSignInCancelled extends Error {
  constructor() {
    super('Acceso cancelado');
    this.name = 'SocialSignInCancelled';
  }
}

/**
 * Falta configuración **nuestra** (proveedor sin activar en Firebase, dominio
 * sin autorizar, Services ID de Apple sin la Return URL).
 *
 * Se distingue del resto porque no se arregla reintentando: decir "algo ha
 * fallado" invita a volver a pulsar algo que no puede funcionar. Mismo criterio
 * que `onNotConfigured` en `login_screen.dart`.
 */
export class SocialSignInUnavailable extends Error {
  constructor(readonly provider: SocialProvider) {
    super(
      `El acceso con ${provider === 'apple' ? 'Apple' : 'Google'} no está disponible ahora mismo.`,
    );
    this.name = 'SocialSignInUnavailable';
  }
}

/** Códigos de Firebase que significan "ha cerrado la ventana". */
const CANCELLED = [
  'auth/popup-closed-by-user',
  'auth/cancelled-popup-request',
  'auth/user-cancelled',
];

/** Códigos que son configuración que falta, no un fallo del usuario. */
const NOT_CONFIGURED = [
  'auth/operation-not-allowed',
  'auth/unauthorized-domain',
  'auth/invalid-oauth-client-id',
  'auth/invalid-oauth-provider',
  'auth/auth-domain-config-required',
];

/**
 * Entrar con Google o con Apple. Gemelo en web de `packages/gipsi_auth`
 * (`google_auth.dart` y `apple_auth.dart`).
 *
 * Devuelve el ID token de **Firebase** para que lo verifique el backend
 * (`POST /auth/google/business`, `POST /auth/apple/business`). El navegador
 * nunca decide quién eres: sólo trae el token firmado.
 *
 * Sustituye a `GoogleSignIn` (Google Identity Services), que devolvía un token
 * de Google a secas: `FirebaseTokenVerifier` lo habría rechazado porque el
 * `aud` no es el del proyecto.
 *
 * El SDK se carga **en diferido**, sólo cuando alguien pulsa un botón: son unos
 * cuantos kilobytes que no tiene por qué descargarse quien entra con su
 * contraseña, que es la mayoría.
 */
@Injectable({ providedIn: 'root' })
export class SocialAuth {
  /** Si la pantalla debe ofrecer ese botón. Sin configurar, se esconde. */
  isAvailable(provider: SocialProvider): boolean {
    return provider === 'apple' ? isAppleSignInConfigured() : isGoogleSignInConfigured();
  }

  get googleAvailable(): boolean {
    return this.isAvailable('google');
  }

  get appleAvailable(): boolean {
    return this.isAvailable('apple');
  }

  /** Abre la ventana del proveedor y devuelve el ID token de Firebase. */
  async obtainIdentity(provider: SocialProvider): Promise<SocialIdentity> {
    if (!this.isAvailable(provider)) throw new SocialSignInUnavailable(provider);

    const [{ initializeApp, getApps }, auth] = await Promise.all([
      import('firebase/app'),
      import('firebase/auth'),
    ]);
    const { getAuth, GoogleAuthProvider, OAuthProvider, signInWithPopup } = auth;

    const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
    const firebaseAuth = getAuth(app);
    // La ventana del proveedor sale en el idioma del navegador y no en inglés.
    firebaseAuth.useDeviceLanguage();

    let authProvider;
    if (provider === 'apple') {
      const apple = new OAuthProvider('apple.com');
      // Los dos permisos que pide la app. El nombre sólo llega la primera vez,
      // así que hay que pedirlo desde el principio.
      apple.addScope('email');
      apple.addScope('name');
      authProvider = apple;
    } else {
      const google = new GoogleAuthProvider();
      // Sin esto entra con la última cuenta sin preguntar, y en un ordenador
      // compartido —el del mostrador— eso es entrar en la cuenta de otro.
      google.setCustomParameters({ prompt: 'select_account' });
      authProvider = google;
    }

    try {
      const credential = await signInWithPopup(firebaseAuth, authProvider);
      return {
        provider,
        idToken: await credential.user.getIdToken(),
        // En minúsculas y sin espacios, que es como lo guarda el servidor.
        email: credential.user.email?.trim().toLowerCase() ?? null,
        name: credential.user.displayName?.trim() || null,
      };
    } catch (cause) {
      const code = (cause as { code?: string }).code ?? '';
      // Cerrar la ventana es una decisión, no un fallo: la pantalla no debe
      // enseñar ningún error por esto.
      if (CANCELLED.includes(code)) throw new SocialSignInCancelled();
      if (NOT_CONFIGURED.includes(code)) {
        // El mensaje que ve el usuario no puede decir «activa el proveedor en
        // Firebase», pero sin el código de Firebase delante no hay forma de
        // saber cuál de las tres cosas falta, y son tres consolas distintas.
        console.warn(
          `[bipsy] ${providerLabel(provider)} no está configurado para la web (${code}).\n` +
            '  auth/operation-not-allowed → Firebase Console → Authentication → Sign-in method: activa el proveedor.\n' +
            `  auth/unauthorized-domain   → Authentication → Settings → Authorized domains: añade ${location.hostname}.\n` +
            '  Con Apple hace falta además un Services ID con Return URL ' +
            `https://${firebaseConfig.authDomain}/__/auth/handler`,
        );
        throw new SocialSignInUnavailable(provider);
      }
      throw cause;
    }
  }

  /**
   * Cierra la sesión de Firebase (no la del panel) al salir, para que la
   * próxima vez vuelva a preguntar la cuenta. Best-effort: que no hubiera
   * ninguna abierta no es un fallo del que haya que enterarse.
   */
  async signOut(): Promise<void> {
    try {
      const [{ getApps }, { getAuth, signOut }] = await Promise.all([
        import('firebase/app'),
        import('firebase/auth'),
      ]);
      // Sin app inicializada no hay nada que cerrar, y crearla aquí sólo para
      // eso descargaría el SDK a quien entró con contraseña.
      if (getApps().length === 0) return;
      await signOut(getAuth(getApps()[0]));
    } catch {
      // best-effort
    }
  }
}

/** El endpoint de login de negocio de cada proveedor. */
export function businessSignInPath(provider: SocialProvider): string {
  return provider === 'apple' ? '/auth/apple/business' : '/auth/google/business';
}

/** Cómo se llama al proveedor cuando hay que nombrarlo en un texto. */
export function providerLabel(provider: SocialProvider): string {
  return provider === 'apple' ? 'Apple' : 'Google';
}
