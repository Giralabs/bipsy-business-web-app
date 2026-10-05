/**
 * Configuración web de Firebase (proyecto `gipsi-6806c`).
 *
 * Son los mismos valores que `DefaultFirebaseOptions.web` en la app de cliente
 * y que `src/environments/firebase.config.ts` de la web de Bipsy: **Firebase
 * Auth es del proyecto, no de la app**, así que el panel emite tokens con esta
 * misma configuración aunque `apps/gipsi_business` no tenga registrada una app
 * web propia.
 *
 * **No son secretos**: la `apiKey` de Firebase identifica el proyecto, no
 * autoriza nada; quien protege la cuenta son las reglas del proyecto y la lista
 * de dominios autorizados.
 *
 * Hace falta porque el backend verifica un ID token de **Firebase**
 * (`FirebaseTokenVerifier` comprueba firma, emisor y `aud` contra el
 * `project-id`, y `SocialIdentityService` lee de quién viene en el claim
 * `firebase.sign_in_provider`). El panel entraba por Google Identity Services,
 * que devuelve un token de Google a secas: ese token NO pasa esa validación,
 * así que `/auth/google/business` lo habría rechazado.
 *
 * ⚠️ Para que funcione en un dominio nuevo hay que añadirlo en
 * **Firebase Console → Authentication → Settings → Authorized domains**.
 * `localhost` ya viene autorizado de serie.
 *
 * `window.__BIPSY_FIREBASE_AUTH_DOMAIN__` permite apuntar una compilación ya
 * hecha a otro dominio de retorno metiendo una línea en `index.html`, igual que
 * `__BIPSY_API__`.
 */
declare global {
  interface Window {
    __BIPSY_FIREBASE_AUTH_DOMAIN__?: string;
  }
}

/**
 * Dónde VUELVE el proveedor tras la ventana emergente.
 *
 * No es lo mismo que tener el dominio en «Authorized domains»: esa lista dice
 * desde qué webs se puede ARRANCAR el acceso; esto dice a dónde vuelve, y es lo
 * que se lee en «Ir a …» cuando Google pide elegir cuenta. Para cambiarlo a un
 * dominio propio, ese dominio tiene que reescribir `/__/auth/*` hacia Firebase
 * (`curl -I https://<dominio>/__/auth/handler` debe dar 200 o 302).
 */
const AUTH_DOMAIN = 'gipsi-6806c.firebaseapp.com';

export const firebaseConfig = {
  apiKey: 'AIzaSyCZth_-nuG-bp2X4LlqB6vJsHmSCqmytzw',
  authDomain:
    (typeof window !== 'undefined' && window.__BIPSY_FIREBASE_AUTH_DOMAIN__) || AUTH_DOMAIN,
  projectId: 'gipsi-6806c',
  storageBucket: 'gipsi-6806c.firebasestorage.app',
  messagingSenderId: '933645516812',
  appId: '1:933645516812:web:c66ddc95f50a2508ef2e29',
};

/**
 * Si se puede ofrecer el botón de Google.
 *
 * Se comprueba en vez de darlo por hecho para que un despliegue sin configurar
 * esconda la opción en lugar de enseñar un botón que siempre falla — el mismo
 * criterio que ya usaba `GOOGLE_ENABLED`.
 */
export function isGoogleSignInConfigured(): boolean {
  return firebaseConfig.apiKey.length > 0 && firebaseConfig.projectId.length > 0;
}

/**
 * Si se puede ofrecer el botón de Apple.
 *
 * En la app de negocio Apple **solo sale en iOS** (en Android iría por una
 * ventana web, que es un flujo peor). En un navegador esa distinción no existe:
 * el flujo es la misma ventana emergente para todos, así que se ofrece siempre.
 *
 * ⚠️ En el navegador Apple no va por la hoja del sistema sino por su OAuth web,
 * y eso pide configuración aparte de la de las apps:
 *
 *  1. **Apple Developer → Identifiers → Services IDs**: un Services ID con
 *     *Sign in with Apple* activado.
 *  2. En ese Services ID, «Return URLs» tiene que incluir
 *     `https://gipsi-6806c.firebaseapp.com/__/auth/handler`.
 *  3. **Firebase Console → Authentication → Sign-in method → Apple**: el
 *     proveedor activado con ese Services ID y la clave `.p8` (Key ID + Team
 *     ID).
 *
 * Sin los tres pasos Firebase responde `auth/operation-not-allowed`, y el
 * servicio lo cuenta como "no disponible" en vez de como un fallo del usuario.
 *
 * El Services ID se agrupa bajo el App ID de la app de cliente
 * (`com.gipsi.gipsi`) para que Apple emita **el mismo identificador de
 * usuario** que en el móvil. Con otro grupo, quien ya entró con Apple desde el
 * iPhone llegaría aquí como alguien distinto y se encontraría una cuenta
 * vacía.
 *
 * El gemelo de esta constante está en
 * `bipsy-web-app/src/environments/firebase.config.ts`: los dos leen el mismo
 * proyecto de Firebase, así que van a la vez. Ponerla a `false` esconde el
 * botón, que es lo que hay que hacer si algún día se cae la configuración:
 * mejor sin opción que con una que siempre falla.
 */
export const appleSignInEnabled = true;

export function isAppleSignInConfigured(): boolean {
  return appleSignInEnabled && isGoogleSignInConfigured();
}
