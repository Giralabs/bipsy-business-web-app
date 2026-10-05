import { Injectable, signal } from '@angular/core';
import { SocialIdentity } from './social-auth.service';

/** El dominio que da Apple cuando se oculta el correo. */
const APPLE_RELAY_DOMAIN = '@privaterelay.appleid.com';

/**
 * La identidad de Google o Apple que se queda esperando entre `/acceder` y
 * `/registro`. Gemelo en web de `features/auth/pending_social.dart`.
 *
 * Existe porque entrar con un proveedor y no tener cuenta **no es un error**:
 * el backend responde 404 («crea una cuenta primero») y desde ahí se sigue con
 * el alta sin volver a pedir el correo ni una contraseña. Ese salto cruza dos
 * rutas, así que el token no puede vivir en el estado de ninguna de las dos.
 *
 * Lo limpia quien lo consume: el alta al crear la cuenta, y la pantalla de
 * acceso al empezar otro intento.
 */
@Injectable({ providedIn: 'root' })
export class PendingSocial {
  private readonly current = signal<SocialIdentity | null>(null);

  readonly identity = this.current.asReadonly();

  set(identity: SocialIdentity | null): void {
    this.current.set(identity);
  }

  /** Lo devuelve y lo borra: sólo sirve para un alta. */
  take(): SocialIdentity | null {
    const value = this.current();
    this.current.set(null);
    return value;
  }

  clear(): void {
    this.current.set(null);
  }
}

/**
 * Si el correo es de los que Apple inventa al ocultar el de verdad.
 *
 * Sirve para reconocer la cuenta, pero **no para escribirle**: Apple sólo
 * reenvía a remitentes registrados, y además el negocio no la reconoce al verla
 * en su perfil. Por eso el alta le pide uno propio, como el registro con correo
 * de toda la vida.
 */
export function hidesEmail(identity: SocialIdentity | null): boolean {
  return (identity?.email ?? '').toLowerCase().endsWith(APPLE_RELAY_DOMAIN);
}
