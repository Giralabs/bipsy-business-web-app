import { WEB } from './invite-messages';

/**
 * `GipsiLinks.slugify` and `slugify()` of the customer web: `estetica-luna-12`.
 * The name is decoration: the web and the deep links resolve by the trailing
 * number, so a renamed business keeps its printed posters working.
 */
export function businessSlug(id: number, name: string | null | undefined): string {
  const slug = (name ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return slug ? `${slug}-${id}` : String(id);
}

/** `GipsiLinks.business`: what a business hands out as «its link». */
export function businessLink(id: number, name: string | null | undefined): string {
  return `${WEB}/negocio/${businessSlug(id, name)}`;
}

/** The message that goes with it, naming the business whoever gets it will see. */
export function businessLinkMessage(id: number, name: string | null | undefined): string {
  const greeting = name?.trim() ? `Reserva en ${name.trim()} desde aquí:` : 'Reserva desde aquí:';
  return `${greeting}\n${businessLink(id, name)}`;
}
