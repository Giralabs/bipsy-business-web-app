/**
 * The password policy, written once: `GipsiPasswordPolicy` plus
 * `core/password_rules.dart`.
 *
 * These values are the backend's (`StrongPasswordValidator`), not a design
 * decision. The server stays the authority and may reject one that passes here,
 * so its own reason still has to reach the screen (`message()` in `resource.ts`).
 *
 * Only for a password being CHOSEN. The sign-in fields never use this: there the
 * password already exists and may predate the rule, so rejecting it would lock
 * its owner out.
 */
export const PASSWORD_MIN_LENGTH = 8;

const BLOCKLIST: ReadonlySet<string> = new Set([
  '12345678',
  '123456789',
  '1234567890',
  'password',
  'contrasena',
  'contraseña',
  'qwerty123',
  '11111111',
  '00000000',
  'abc12345',
  'iloveyou',
  'princesa',
  'bipsy123',
  'gipsi123',
  'administrador',
]);

export interface PasswordCheck {
  hasMinLength: boolean;
  hasLetterAndDigit: boolean;
  isCommon: boolean;
  isValid: boolean;
}

export function checkPassword(value: string): PasswordCheck {
  // Any letter and digit, not just ASCII: the server uses `Character.isLetter`,
  // so «contraseña» counts its ñ and `[a-zA-Z]` would disagree with it.
  const hasMinLength = value.length >= PASSWORD_MIN_LENGTH;
  const hasLetterAndDigit = /\p{L}/u.test(value) && /\p{Nd}/u.test(value);
  const isCommon = BLOCKLIST.has(value.toLowerCase());
  return {
    hasMinLength,
    hasLetterAndDigit,
    isCommon,
    isValid: hasMinLength && hasLetterAndDigit && !isCommon,
  };
}

/**
 * The first thing to fix, or null when it is fine. Only one on purpose: three
 * errors at once under a field do not get read.
 */
export function newPasswordError(value: string, emptyMessage = 'Elige una contraseña'): string | null {
  if (!value) return emptyMessage;
  const check = checkPassword(value);
  if (!check.hasMinLength) return 'Mínimo 8 caracteres';
  if (!check.hasLetterAndDigit) return 'Añade al menos una letra y un número';
  if (check.isCommon) return 'Esa contraseña es demasiado común';
  return null;
}
