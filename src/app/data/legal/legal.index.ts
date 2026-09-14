/**
 * Legal documents by name only, for the footer and the side navigation.
 *
 * Kept apart from the content files so the footer —loaded on every page— does
 * not pull tens of kB of legal prose into the initial bundle.
 *
 * ⚠️ A new document has to be added here AND to its content file.
 */
import { LegalSlug } from './legal.models';

export interface LegalEntry {
  slug: LegalSlug;
  title: string;
}

/** What the law requires, plus the two documents specific to businesses. */
export const LEGAL_INDEX: LegalEntry[] = [
  { slug: 'aviso-legal', title: 'Aviso legal' },
  { slug: 'terminos', title: 'Términos y condiciones' },
  { slug: 'condiciones-suscripcion', title: 'Condiciones de suscripción' },
  { slug: 'privacidad', title: 'Política de privacidad' },
  { slug: 'encargo-tratamiento', title: 'Encargo del tratamiento' },
  { slug: 'cookies', title: 'Política de cookies' },
];

export const HELP_INDEX: LegalEntry[] = [
  { slug: 'quienes-somos', title: 'Quiénes somos' },
  { slug: 'contacto', title: 'Contacto' },
  { slug: 'seguridad', title: 'Seguridad' },
];

export const LEGAL_GROUPS: { label: string; entries: LegalEntry[] }[] = [
  { label: 'Legal', entries: LEGAL_INDEX },
  { label: 'Empresa', entries: HELP_INDEX },
];
