/**
 * Site-wide facts: the trial, the store and social links, the contact.
 *
 * What the web ANNOUNCES about the trial must be what the backend grants:
 *  - the first plan comes with its first month free (`plan.trial_months = 1`
 *    in V128, a natural month, only while `trialAvailable`), and the App Store
 *    products carry the same 1-month introductory offer;
 *  - finishing the sign-up gives `Business.WELCOME_TRIAL_DAYS = 3` courtesy
 *    days (`WELCOME_DAYS`) before the plan wall shows up.
 * If either changes in the backend, change it here. See docs/RELEASE-STORES.md
 * and docs/LEGAL-PENDIENTE.md §4. bipsy-web-app announces the trial too, in
 * `PromoBarComponent.trialLabel`.
 */
export const TRIAL_MONTHS = 1;
/** Courtesy days after the sign-up, before choosing a plan (`Business.WELCOME_TRIAL_DAYS`). */
export const WELCOME_DAYS = 3;
/**
 * The trial as a pill or a headline. Spelt out: «1.er mes gratis» read like an
 * abbreviation in a hurry, and José asked for it to go.
 */
export const TRIAL_LABEL = 'Primer mes gratis';
/** The trial as a call to action. */
export const TRIAL_CTA = 'Probar el primer mes gratis';

export interface ExternalLink {
  label: string;
  url: string;
}

/** The customer-facing web (bipsy-web-app). */
export const CLIENT_WEB_URL = 'https://bipsy.es';

/**
 * Where the store badges lead. Every external link used to point at
 * youtube.com, left over from a template: a badge that looks right and lands
 * somewhere else.
 *
 * The listings exist but are not published yet (bipsy-web-app,
 * `data/app-links.ts`, which holds the App Store ids). Until they are, the
 * badges go to the download page on bipsy.es, which hands out the right store
 * per device and says «muy pronto» meanwhile. A store link that answers «not
 * available» is worse than none. When the apps are published, point these at
 * the listings:
 *   business: https://apps.apple.com/es/app/id6828380398 ·
 *             https://play.google.com/store/apps/details?id=com.gipsi.gipsi_business
 *   customer: https://apps.apple.com/es/app/id6828380156 ·
 *             https://play.google.com/store/apps/details?id=com.gipsi.gipsi
 */
const BUSINESS_DOWNLOAD_URL = `${CLIENT_WEB_URL}/descargar/negocio`;
const CLIENT_DOWNLOAD_URL = `${CLIENT_WEB_URL}/descargar`;

const PLAY_BADGE = 'assets_apps/donwload_play_store.webp';
const APP_STORE_BADGE = 'assets_apps/download_app_store.webp';

/** Bipsy Business, the app this site sells. */
export const STORE_LINKS = {
  googlePlay: { label: 'Consíguelo en Google Play', url: BUSINESS_DOWNLOAD_URL, image: PLAY_BADGE },
  appStore: { label: 'Descárgalo en el App Store', url: BUSINESS_DOWNLOAD_URL, image: APP_STORE_BADGE },
} as const;

/** Bipsy, the customers' app: only the page that presents it links to it. */
export const CLIENT_STORE_LINKS = {
  googlePlay: { label: 'Consigue Bipsy en Google Play', url: CLIENT_DOWNLOAD_URL, image: PLAY_BADGE },
  appStore: { label: 'Descarga Bipsy en el App Store', url: CLIENT_DOWNLOAD_URL, image: APP_STORE_BADGE },
} as const;

export interface SocialLink extends ExternalLink {
  id: 'instagram' | 'linkedin';
  /** SVG path in a 24×24 box, painted with currentColor. */
  path: string;
}

/**
 * Bipsy's own profiles. None exists yet, so the footer shows no «Síguenos»
 * (it hides itself while this list is empty). When one is created, add it
 * here with its real URL; the icons are kept for that day.
 */
export const SOCIAL_LINKS: SocialLink[] = [];

/** Icons ready for when the profiles exist. */
export const SOCIAL_ICONS: Record<SocialLink['id'], Omit<SocialLink, 'url'>> = {
  instagram: {
    id: 'instagram',
    label: 'Bipsy en Instagram',
    path:
      'M12 2.2c3.2 0 3.6 0 4.8.1 1.2.1 1.8.2 2.2.4.6.2 1 .5 1.4.9.4.4.7.8.9 1.4.2.4.4 1.1.4 2.2.1 1.3.1 1.6.1 4.8s0 3.6-.1 4.8c-.1 1.2-.2 1.8-.4 2.2-.2.6-.5 1-.9 1.4-.4.4-.8.7-1.4.9-.4.2-1.1.4-2.2.4-1.3.1-1.6.1-4.8.1s-3.6 0-4.8-.1c-1.2-.1-1.8-.2-2.2-.4-.6-.2-1-.5-1.4-.9-.4-.4-.7-.8-.9-1.4-.2-.4-.4-1.1-.4-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.8c.1-1.2.2-1.8.4-2.2.2-.6.5-1 .9-1.4.4-.4.8-.7 1.4-.9.4-.2 1.1-.4 2.2-.4C8.4 2.2 8.8 2.2 12 2.2Zm0 4.6a5.2 5.2 0 1 0 0 10.4 5.2 5.2 0 0 0 0-10.4Zm0 8.6a3.4 3.4 0 1 1 0-6.8 3.4 3.4 0 0 1 0 6.8Zm5.4-9.9a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4Z',
  },
  linkedin: {
    id: 'linkedin',
    label: 'Bipsy en LinkedIn',
    path:
      'M20.4 20.5h-3.6v-5.6c0-1.3 0-3-1.8-3s-2.1 1.4-2.1 2.9v5.7H9.3V9h3.4v1.6h.1c.5-.9 1.6-1.8 3.4-1.8 3.6 0 4.3 2.4 4.3 5.5v6.2ZM5.3 7.4a2.1 2.1 0 1 1 0-4.2 2.1 2.1 0 0 1 0 4.2ZM7.1 20.5H3.5V9h3.6v11.5Z',
  },
};

/**
 * The help centre, which is its own site (bipsy-help-app, in Astro) on its
 * own subdomain. Both this web and bipsy-web-app link to it, so the answers
 * live in one place instead of two.
 *
 * Browsing locally it points at the Astro dev server instead, so following
 * the link while developing does not throw you out to production. Any host
 * that is not localhost is treated as the real thing — including a
 * production build served locally, which is what you want when checking one.
 */
const HELP_PROD_URL = 'https://help.bipsy.es';
/** Where `npm start` in bipsy-help-app serves it (see its astro.config.mjs). */
const HELP_DEV_URL = 'http://localhost:4321';

const onLocalhost = typeof location !== 'undefined'
  && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);

export const HELP_URL = onLocalhost ? HELP_DEV_URL : HELP_PROD_URL;

/** Support answers tickets in 24–48 working hours (support_screen.dart). */
export const SUPPORT_RESPONSE_TIME = '24-48 h laborables';
