// What each public page says to search engines: titles, descriptions,
// canonicals and schema.org. Pure data, loaded on demand by seo.ts (so it
// stays out of the initial bundle) and read at build time by
// scripts/build-sitemap.mjs.
import { BLOG_POSTS, postBySlug } from '../data/blog.data';
import { BUSINESS_TYPES, businessTypeBySlug } from '../data/business-types.data';
import { HOME_FAQ } from '../data/faq.data';
import { FEATURES, featureBySlug } from '../data/features.data';
import { HELP_INDEX, LEGAL_INDEX } from '../data/legal/legal.index';
import { PLANS } from '../data/plans.data';
import { CLIENT_STORE_LINKS, CLIENT_WEB_URL, SOCIAL_LINKS, STORE_LINKS, TRIAL_LABEL } from '../data/site.data';

/** The public origin of this site. Canonicals and structured data use it. */
export const SITE_URL = 'https://business.bipsy.es';
const SITE_NAME = 'Bipsy Business';
/** 1200x630, what WhatsApp, LinkedIn, X or Facebook show when the link is shared. */
export const DEFAULT_IMAGE = `${SITE_URL}/og-image.jpg`;

export interface PageSeo {
  title: string;
  description: string;
  /** False for the sign-in screens, the panel and anything personal. */
  index: boolean;
  /** schema.org objects for this page, besides the site-wide ones. */
  jsonLd?: object[];
  type?: 'website' | 'article';
}

/** Pages that are the product or personal, never search results. */
const PRIVATE = /^\/(panel|admin|acceder|registro|unirse|recuperar-contrasena|error|equipo\/|invitacion\/)/;

// Titles only: the legal prose stays out of the initial bundle (see legal.index.ts)
const ALL_LEGAL = [...LEGAL_INDEX, ...HELP_INDEX];

/** One line per document for the search snippet. */
const LEGAL_DESCRIPTIONS: Record<string, string> = {
  'aviso-legal': 'Quién presta Bipsy Business, sus datos de contacto y las condiciones de uso de esta web.',
  terminos: 'Términos y condiciones de uso de Bipsy y Bipsy Business.',
  'condiciones-suscripcion': 'Planes, precios, prueba gratuita, renovación y baja de la suscripción a Bipsy Business.',
  privacidad: 'Qué datos tratamos en Bipsy Business, para qué, cuánto tiempo y cómo ejercer tus derechos.',
  'encargo-tratamiento': 'El contrato de encargo del tratamiento entre tu negocio y Bipsy para los datos de tus clientes.',
  cookies: 'Qué cookies y almacenamiento usa la web de Bipsy Business y cómo gestionarlos.',
  'quienes-somos': 'Bipsy es un producto de Giralabs, estudio de desarrollo de software de Sevilla.',
  contacto: 'Cómo contactar con el equipo de Bipsy Business: soporte, ventas y privacidad.',
  seguridad: 'Cómo protegemos los datos de tu negocio y de tus clientes en Bipsy Business.',
};

/** Search snippets are cut around 155-160 characters: cut on a word before that. */
function clip(text: string, max = 158): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return clean.slice(0, clean.lastIndexOf(' ', max - 1)).replace(/[,;:.\s]+$/, '') + '…';
}

const priceNumber = (price: string) => Number(price.replace(',', '.'));

// ---- schema.org pieces ------------------------------------------------------

export const ORGANIZATION = {
  '@type': 'Organization',
  '@id': `${SITE_URL}/#organization`,
  name: 'Bipsy',
  url: CLIENT_WEB_URL,
  logo: `${SITE_URL}/icons/icon-512.webp`,
  sameAs: [
    ...SOCIAL_LINKS.filter((s) => s.url).map((s) => s.url),
    STORE_LINKS.appStore.url,
    CLIENT_STORE_LINKS.appStore.url,
  ],
  parentOrganization: { '@type': 'Organization', name: 'Giralabs', url: 'https://www.giralabs.es' },
};

const APP = {
  '@type': 'SoftwareApplication',
  '@id': `${SITE_URL}/#app`,
  name: SITE_NAME,
  description:
    'App de reservas y gestión para barberías, peluquerías, centros de estética y cualquier negocio que trabaje con cita: agenda, reservas online, clientes, equipo y cobros.',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'iOS, iPadOS',
  url: SITE_URL,
  downloadUrl: STORE_LINKS.appStore.url,
  installUrl: STORE_LINKS.appStore.url,
  inLanguage: 'es',
  publisher: { '@id': `${SITE_URL}/#organization` },
  offers: {
    '@type': 'AggregateOffer',
    priceCurrency: 'EUR',
    lowPrice: priceNumber(PLANS[0].price),
    highPrice: Math.max(...PLANS.map((p) => priceNumber(p.price))),
    offerCount: PLANS.length,
    offers: PLANS.map((plan) => ({
      '@type': 'Offer',
      name: plan.name,
      price: priceNumber(plan.price),
      priceCurrency: 'EUR',
      description: plan.description,
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: priceNumber(plan.price),
        priceCurrency: 'EUR',
        unitCode: 'MON',
        referenceQuantity: { '@type': 'QuantitativeValue', value: 1, unitCode: 'MON' },
      },
    })),
  },
};

export const WEBSITE = {
  '@type': 'WebSite',
  '@id': `${SITE_URL}/#website`,
  name: SITE_NAME,
  url: SITE_URL,
  inLanguage: 'es',
  publisher: { '@id': `${SITE_URL}/#organization` },
};

function breadcrumbs(items: { name: string; path: string }[]): object {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: [{ name: 'Inicio', path: '/' }, ...items].map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: SITE_URL + item.path,
    })),
  };
}

function faqPage(items: { q: string; a: string }[]): object {
  return {
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  };
}

// ---- What each page says to search engines ----------------------------------

/**
 * Title, description and structured data of a path, written from the same
 * data the pages render, so a feature or a price changes in one place.
 * Titles lead with what people search ("app de reservas para peluquerías"),
 * end with the brand, and stay under ~60 characters where possible.
 */
export function seoFor(path: string): PageSeo {
  if (PRIVATE.test(path)) {
    return { title: SITE_NAME, description: '', index: false };
  }

  const [, first = '', second = ''] = path.split('/');

  switch (first) {
    case '':
      return {
        title: 'Bipsy Business · App de reservas y agenda para tu negocio',
        description: clip(
          `La app de reservas y gestión para barberías, peluquerías, centros de estética y cualquier negocio con cita. Agenda, reservas online 24/7, clientes, equipo y cobros. ${TRIAL_LABEL}.`,
        ),
        index: true,
        jsonLd: [APP, faqPage(HOME_FAQ)],
      };

    case 'funcionalidades': {
      if (!second) {
        return {
          title: 'Funcionalidades: agenda, reservas online y cobros · Bipsy Business',
          description: clip(
            `Todo lo que hace Bipsy Business: ${FEATURES.map((f) => f.name.toLowerCase()).join(', ')}. Incluido en todos los planes.`,
          ),
          index: true,
          jsonLd: [breadcrumbs([{ name: 'Funcionalidades', path: '/funcionalidades' }])],
        };
      }
      const feature = featureBySlug(second);
      if (!feature) break;
      return {
        title: `${feature.name} para tu negocio · Bipsy Business`,
        description: clip(`${feature.summary} ${feature.intro}`),
        index: true,
        jsonLd: [
          breadcrumbs([
            { name: 'Funcionalidades', path: '/funcionalidades' },
            { name: feature.name, path: `/funcionalidades/${feature.slug}` },
          ]),
        ],
      };
    }

    case 'negocios': {
      if (!second) {
        return {
          title: 'App de reservas para barberías, peluquerías y más · Bipsy Business',
          description: clip(
            `Bipsy Business se adapta a cada negocio con cita: ${BUSINESS_TYPES.map((t) => t.name.toLowerCase()).join(', ')}.`,
          ),
          index: true,
          jsonLd: [breadcrumbs([{ name: 'Negocios', path: '/negocios' }])],
        };
      }
      const type = businessTypeBySlug(second);
      if (!type) break;
      return {
        title: `App de reservas para ${type.name.toLowerCase()} · Bipsy Business`,
        description: clip(`${type.headline}. ${type.intro}`),
        index: true,
        jsonLd: [
          breadcrumbs([
            { name: 'Negocios', path: '/negocios' },
            { name: type.name, path: `/negocios/${type.slug}` },
          ]),
        ],
      };
    }

    case 'precios':
      return {
        title: `Precios desde ${PLANS[0].price} €/mes, ${TRIAL_LABEL.toLowerCase()} · Bipsy Business`,
        description: clip(
          PLANS.map((p) => `${p.name}, ${p.price} € al mes: ${p.tagline.replace(/\.$/, '').toLowerCase()}`).join('. ') +
            `. ${TRIAL_LABEL}, sin permanencia y con todo tu equipo incluido.`,
        ),
        index: true,
        jsonLd: [APP, breadcrumbs([{ name: 'Precios', path: '/precios' }])],
      };

    case 'por-que-bipsy':
      return {
        title: 'Por qué Bipsy Business: agenda, clientes y cobros en una app',
        description: clip(
          'Por qué los negocios con cita eligen Bipsy Business: reservas online sin comisión por cita, equipo gratis, todo en una sola app y tus clientes reservando desde Bipsy.',
        ),
        index: true,
        jsonLd: [breadcrumbs([{ name: 'Por qué Bipsy', path: '/por-que-bipsy' }])],
      };

    case 'app-para-clientes':
      return {
        title: 'Bipsy, la app gratuita con la que tus clientes reservan',
        description: clip(
          'Tus clientes te encuentran en Bipsy, ven tus huecos libres y reservan sin llamar. Gratis para ellos, en el App Store.',
        ),
        index: true,
        jsonLd: [breadcrumbs([{ name: 'App para clientes', path: '/app-para-clientes' }])],
      };

    case 'blog': {
      if (!second) {
        return {
          title: 'Blog de Bipsy Business: guías para llenar tu agenda',
          description: clip(
            'Guías prácticas para negocios con cita: menos plantones, lista de espera, equipo, clientes y novedades de Bipsy Business.',
          ),
          index: true,
          jsonLd: [breadcrumbs([{ name: 'Blog', path: '/blog' }])],
        };
      }
      const post = postBySlug(second);
      if (!post) break;
      return {
        title: `${post.title} · Bipsy Business`,
        description: clip(post.excerpt),
        index: true,
        type: 'article',
        jsonLd: [
          {
            '@type': 'BlogPosting',
            headline: post.title,
            description: post.excerpt,
            datePublished: post.date,
            dateModified: post.date,
            inLanguage: 'es',
            mainEntityOfPage: `${SITE_URL}/blog/${post.slug}`,
            image: post.gallery?.length ? `${SITE_URL}/${post.gallery[0].src}` : DEFAULT_IMAGE,
            author: { '@type': 'Organization', name: 'Bipsy', url: CLIENT_WEB_URL },
            publisher: { '@id': `${SITE_URL}/#organization` },
          },
          breadcrumbs([
            { name: 'Blog', path: '/blog' },
            { name: post.title, path: `/blog/${post.slug}` },
          ]),
        ],
      };
    }

    case 'ayuda':
      return {
        title: 'Centro de ayuda · Bipsy Business',
        description: clip('Respuestas a las dudas más frecuentes sobre Bipsy Business: alta, agenda, equipo, cobros, planes y cuenta.'),
        index: true,
      };

    case 'legal': {
      const doc = ALL_LEGAL.find((entry) => entry.slug === second);
      if (!doc) break;
      return {
        title: `${doc.title} · Bipsy Business`,
        description: clip(LEGAL_DESCRIPTIONS[doc.slug] ?? doc.title),
        index: true,
      };
    }
  }

  // Unknown URL: the "not found" page
  return { title: `Página no encontrada · ${SITE_NAME}`, description: '', index: false };
}

/** Every public path, for the sitemap (scripts/build-sitemap.mjs reads the same data). */
export function publicPaths(): string[] {
  return [
    '/',
    '/funcionalidades',
    ...FEATURES.map((f) => `/funcionalidades/${f.slug}`),
    '/negocios',
    ...BUSINESS_TYPES.map((t) => `/negocios/${t.slug}`),
    '/precios',
    '/por-que-bipsy',
    '/app-para-clientes',
    '/blog',
    ...BLOG_POSTS.map((p) => `/blog/${p.slug}`),
    '/ayuda',
    ...ALL_LEGAL.map((entry) => `/legal/${entry.slug}`),
  ];
}
