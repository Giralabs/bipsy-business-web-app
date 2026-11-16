import { WEB } from './invite-messages';

/**
 * `GipsiLinks.slugify` and `slugify()` of the customer web: `estetica-luna-12`.
 * The shape of a business page: the name is decoration, the web and the deep
 * links resolve by the trailing number.
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

/**
 * What a business hands out as «its link».
 *
 * Its subdomain, `https://esteticaluna.bipsy.es` (backend V131), as soon as it
 * has one: it redirects to the page below, and it is what fits in a bio or on a
 * poster. Before that (the first minute after sign-up) the page itself,
 * `bipsy.es/negocio/estetica-luna-12`, which is where the subdomain leads
 * anyway and keeps working forever.
 */
export function businessLink(id: number, name: string | null | undefined, subdomain?: string | null): string {
  return subdomain ? `https://${subdomain}.bipsy.es` : `${WEB}/negocio/${businessSlug(id, name)}`;
}

/** The link without `https://`, to print or read out: `esteticaluna.bipsy.es`. */
export function businessLinkLabel(id: number, name: string | null | undefined, subdomain?: string | null): string {
  return businessLink(id, name, subdomain).replace(/^https?:\/\//, '');
}

/** The message that goes with it, naming the business whoever gets it will see. */
export function businessLinkMessage(id: number, name: string | null | undefined, subdomain?: string | null): string {
  const greeting = name?.trim() ? `Reserva en ${name.trim()} desde aquí:` : 'Reserva desde aquí:';
  return `${greeting}\n${businessLink(id, name, subdomain)}`;
}
