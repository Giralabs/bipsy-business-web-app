import { inject } from '@angular/core';
import { CanActivateChildFn, CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/**
 * El paso del alta que este negocio tiene pendiente, o null si no hay ninguno
 * que la web sepa retomar. Gemelo de `_pendingSignupRoute` en
 * `app_router.dart`, y la ÚNICA fuente de esa decisión: los dos guardias de
 * abajo la comparten, porque en cuanto cada uno tiene su propia idea de dónde
 * pertenece la sesión se mandan el uno al otro para siempre.
 *
 * El paso lo decide el servidor y viaja en el perfil; la web no lo deduce de
 * los datos que falten, porque entonces cada pantalla tendría su propia idea
 * de cuándo está terminada el alta. Un perfil sin el campo (backend anterior a
 * V31) no secuestra la navegación.
 *
 * `SignupStep.VERIFY_EMAIL` queda fuera a propósito: de ese caso se ocupa la
 * regla de email de `panelGuard`, que lleva a /panel/verificar-email (el mismo
 * enlace que espera el paso 3 del alta). En cuanto se verifica, el servidor
 * pasa el alta a LOCATION y esta función devuelve a /registro, paso 4.
 */
function pendingSignupStep(auth: AuthService): string | null {
  if (!auth.isBusiness()) return null;
  const profile = auth.profile();
  if (!profile || profile.onboardingComplete !== false) return null;
  const route = profile.signupRoute;
  return route === '/signup/ubicacion' || route === '/signup/configuracion' ? route : null;
}

/** A dónde se manda a quien tiene el alta a medias. */
const resumeSignup = (router: Router, step: string) =>
  router.createUrlTree(['/registro'], { queryParams: { paso: step } });

/**
 * Lo que un trabajador puede abrir. El resto del panel es del dueño y el
 * backend le contestaría 403 pantalla a pantalla; mejor no llevarle ahí.
 * (La app no guarda las rutas por rol y deja que falle el servidor; aquí se
 * teclea una URL con mucha más facilidad que en un móvil.)
 */
const WORKER_PATHS = [
  '/panel/agenda',
  '/panel/mensajes',
  '/panel/fichar',
  '/panel/mi-horario',
  '/panel/mis-ausencias',
  '/panel/mi-perfil',
  '/panel/resenas',
  '/panel/ajustes/cuenta',
  '/panel/ajustes/notificaciones',
  '/panel/soporte',
  '/panel/plan',
  '/panel/verificar-email',
];

function workerMayOpen(url: string): boolean {
  const path = url.split(/[?#]/)[0];
  return path === '/panel' || path === '/panel/' || WORKER_PATHS.some((p) => path.startsWith(p));
}

/**
 * The web twin of the router `redirect` in `app_router.dart`, in the same
 * order, minus the steps that only make sense on a phone:
 *
 * 1. no session                 → /acceder
 * 2. sign-up left half way      → back to the step the server points at
 * 3. email not verified         → /panel/verificar-email
 * 4. worker without a business  → /unirse, to redeem an invitation code
 * 5. subscription blocked       → /panel/plan and nowhere else
 * 6. worker on an owner screen  → /panel
 *
 * It runs as `canActivate` AND `canActivateChild` on the shell: as the first
 * alone it only ran when entering the panel, so moving between sections
 * skipped every rule.
 */
export const panelGuard: CanActivateFn = async (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  await auth.bootstrap();

  if (auth.status() !== 'authenticated') {
    return router.createUrlTree(['/acceder'], { queryParams: { volver: state.url } });
  }

  const target = state.url;

  const pending = pendingSignupStep(auth);
  if (pending) return resumeSignup(router, pending);

  if (!auth.emailVerified() && !target.startsWith('/panel/verificar-email')) {
    return router.createUrlTree(['/panel/verificar-email']);
  }

  if (auth.needsBusiness()) return router.createUrlTree(['/unirse']);

  if (auth.subscriptionBlocked()) {
    const allowed = ['/panel/plan', '/panel/ajustes/suscripcion', '/panel/soporte'];
    if (!allowed.some((path) => target.startsWith(path))) {
      return router.createUrlTree(['/panel/plan']);
    }
  }

  if (auth.isWorker() && !workerMayOpen(target)) return router.createUrlTree(['/panel']);

  return true;
};

export const panelChildGuard: CanActivateChildFn = (route, state) => panelGuard(route, state);

/**
 * Keeps a signed-in business away from the login and sign-up pages — salvo
 * cuando el alta se quedó a medias, porque entonces su sitio ES /registro.
 *
 * Esa excepción no es cosmética. Sin ella este guardia mandaba al panel,
 * `panelGuard` veía el alta pendiente y devolvía a /registro, y vuelta a
 * empezar. Angular no corta los bucles de redirección entre guardias —
 * go_router sí, con `redirectLimit`, que es por lo que la app nunca lo
 * sufrió—, así que la promesa de `navigateByUrl` no resolvía nunca: entrar
 * dejaba el botón girando para siempre, sin un solo error en consola, y como
 * el login guarda los tokens antes de navegar, a partir del primer intento la
 * app ya no volvía a arrancar en ninguna de las dos pantallas.
 */
export const guestGuard: CanActivateFn = async (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.bootstrap();

  if (auth.status() !== 'authenticated') return true;

  const pending = pendingSignupStep(auth);
  if (!pending) return router.createUrlTree(['/panel']);

  return state.url.startsWith('/registro') ? true : resumeSignup(router, pending);
};
