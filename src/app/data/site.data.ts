/**
 * Site-wide facts: the trial, the store and social links, the contact.
 *
 * ⚠️ `TRIAL_DAYS` is what the web ANNOUNCES. Today it does not match the
 * backend (`plan.trial_days = 14`, `Business.WELCOME_TRIAL_DAYS = 5`) nor any
 * store offer. Before billing is switched on, the three must agree and the
 * introductory offer must exist in Play Console and App Store Connect — see
 * docs/RELEASE-STORES.md and docs/LEGAL-PENDIENTE.md §4. bipsy-web-app
 * announces the same number in `PromoBarComponent.trialLabel`.
 */
export const TRIAL_DAYS = 30;
export const TRIAL_LABEL = `${TRIAL_DAYS} días gratis`;

/** Placeholder target for every external link that does not exist yet. */
const PLACEHOLDER_URL = 'https://www.youtube.com';

export interface ExternalLink {
  label: string;
  url: string;
}

// TODO: point to the real store listings once the apps are published.
export const STORE_LINKS = {
  googlePlay: { label: 'Consíguelo en Google Play', url: PLACEHOLDER_URL, image: 'assets_apps/donwload_play_store.webp' },
  appStore: { label: 'Descárgalo en el App Store', url: PLACEHOLDER_URL, image: 'assets_apps/download_app_store.webp' },
} as const;

export interface SocialLink extends ExternalLink {
  id: 'instagram' | 'linkedin';
  /** SVG path in a 24×24 box, painted with currentColor. */
  path: string;
}

// TODO: point to the real profiles once they exist.
export const SOCIAL_LINKS: SocialLink[] = [
  {
    id: 'instagram',
    label: 'Bipsy en Instagram',
    url: PLACEHOLDER_URL,
    path:
      'M12 2.2c3.2 0 3.6 0 4.8.1 1.2.1 1.8.2 2.2.4.6.2 1 .5 1.4.9.4.4.7.8.9 1.4.2.4.4 1.1.4 2.2.1 1.3.1 1.6.1 4.8s0 3.6-.1 4.8c-.1 1.2-.2 1.8-.4 2.2-.2.6-.5 1-.9 1.4-.4.4-.8.7-1.4.9-.4.2-1.1.4-2.2.4-1.3.1-1.6.1-4.8.1s-3.6 0-4.8-.1c-1.2-.1-1.8-.2-2.2-.4-.6-.2-1-.5-1.4-.9-.4-.4-.7-.8-.9-1.4-.2-.4-.4-1.1-.4-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.8c.1-1.2.2-1.8.4-2.2.2-.6.5-1 .9-1.4.4-.4.8-.7 1.4-.9.4-.2 1.1-.4 2.2-.4C8.4 2.2 8.8 2.2 12 2.2Zm0 4.6a5.2 5.2 0 1 0 0 10.4 5.2 5.2 0 0 0 0-10.4Zm0 8.6a3.4 3.4 0 1 1 0-6.8 3.4 3.4 0 0 1 0 6.8Zm5.4-9.9a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4Z',
  },
  {
    id: 'linkedin',
    label: 'Bipsy en LinkedIn',
    url: PLACEHOLDER_URL,
    path:
      'M20.4 20.5h-3.6v-5.6c0-1.3 0-3-1.8-3s-2.1 1.4-2.1 2.9v5.7H9.3V9h3.4v1.6h.1c.5-.9 1.6-1.8 3.4-1.8 3.6 0 4.3 2.4 4.3 5.5v6.2ZM5.3 7.4a2.1 2.1 0 1 1 0-4.2 2.1 2.1 0 0 1 0 4.2ZM7.1 20.5H3.5V9h3.6v11.5Z',
  },
];

/** The customer-facing web (bipsy-web-app). */
// TODO: replace with the production domain of bipsy-web-app when it is deployed.
export const CLIENT_WEB_URL = PLACEHOLDER_URL;

/** Support answers tickets in 24–48 working hours (support_screen.dart). */
export const SUPPORT_RESPONSE_TIME = '24-48 h laborables';
