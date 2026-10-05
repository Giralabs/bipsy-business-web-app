/**
 * A dónde habla el panel.
 *
 * La app Flutter lee la misma URL de `--dart-define=API_URL`
 * (`apps/gipsi_business/lib/core/env.dart`); esto es su gemelo en web.
 *
 * `window.__BIPSY_API__` permite apuntar una compilación ya hecha a otra API
 * (pruebas, preproducción) metiendo una línea en `index.html`, sin volver a
 * compilar. Si no está, se usa producción.
 */
declare global {
  interface Window {
    __BIPSY_API__?: string;
  }
}

// For now the backend is not deployed anywhere: it runs on the machine of
// whoever opens the site, so the deployed build talks to localhost too. Swap
// for the public URL the day it is hosted (or set `window.__BIPSY_API__`).
const PROD_API = 'http://localhost:8080';
const DEV_API = 'http://localhost:8080';

/**
 * Navegando en localhost se habla con la API local.
 *
 * El panel apuntaba siempre a producción, y en desarrollo eso significa que
 * entrar se queda cargando para siempre cuando esa API no está despierta —
 * sin error, sólo el botón girando—, además de que los usuarios sembrados en
 * la base local no existen allí. `window.__BIPSY_API__` sigue mandando sobre
 * las dos, así que para probar una compilación local contra producción basta
 * con la misma línea de siempre en `index.html`.
 */
const onLocalhost = typeof location !== 'undefined'
  && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);

export const API_URL =
  (typeof window !== 'undefined' && window.__BIPSY_API__) || (onLocalhost ? DEV_API : PROD_API);

// En local se dice a dónde se está hablando. Cuando algo no entra, lo
// primero que hay que descartar es que el panel esté llamando a otra API, y
// mirarlo en la consola cuesta dos segundos.
if (onLocalhost && typeof console !== 'undefined') {
  console.info(`[bipsy] API: ${API_URL}`);
}
