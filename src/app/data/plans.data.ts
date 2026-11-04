import { WELCOME_DAYS } from './site.data';

/**
 * The plans on sale, as defined in the backend catalogue.
 *
 * Source: V128__subscription_plans_v2.sql (prices 19,99 / 29,99, the free
 * first month, the portfolio quota per plan and the features Quality lost:
 * animated profile photo, brand colours, exclusive effects, unlimited
 * portfolio), V51__iap_subscriptions.sql (store products). Quality's priority
 * in Destacados is not a feature flag: the Explore ranking reads the plan. The
 * FREE plan exists but is not sold (`selectable = FALSE`), so it is not shown.
 *
 * ⚠️ Two places charge: Stripe (card, SEPA, Apple Pay and Google Pay from the
 * web panel — the backend's catalogue price) and Google Play / App Store
 * Connect (from the phone). If any of them changes price, this page must
 * change with it or the site will advertise one number and the checkout
 * charge another. See docs/RELEASE-STORES.md §3.
 */

export interface Plan {
  code: 'BIPSY' | 'QUALITY';
  name: string;
  /** Monthly price in euros, as a display string with a decimal comma. */
  price: string;
  /** Portfolio photos the plan shows (`plan.portfolio_limit`). */
  portfolioLimit: number;
  /** The plan's diamond, the same one the panel and the app show. */
  diamond: string;
  tagline: string;
  description: string;
  /** Title of the feature list. */
  includesLabel: string;
  features: string[];
  recommended: boolean;
  /** Store product id, for reference when checking the consoles. */
  storeProductId: string;
}

export const BUSINESS_PHOTOS = 20;
export const QUALITY_PHOTOS = 100;

export const PLANS: Plan[] = [
  {
    code: 'BIPSY',
    name: 'Bipsy Business',
    price: '19,99',
    portfolioLimit: BUSINESS_PHOTOS,
    diamond: 'assets_bipsy_business/Plans/diamond_business.webp',
    tagline: 'Toda la app para gestionar tu negocio.',
    description: 'Citas, equipo, clientes, reseñas, fichaje y finanzas. Sin funciones escondidas.',
    includesLabel: 'Incluye',
    features: [
      'Agenda y reservas online 24/7',
      'Catálogo de servicios y horarios',
      'Todo tu equipo gratis con código de invitación',
      'Permisos, ausencias y vacaciones',
      'Agenda de clientes y mensajes',
      'Reseñas verificadas con respuesta',
      'Fichaje del equipo',
      'Finanzas: caja, gastos y comisiones',
      'Lista de espera',
      `Portfolio de ${BUSINESS_PHOTOS} fotos`,
    ],
    recommended: false,
    storeProductId: 'bipsy_business_monthly',
  },
  {
    code: 'QUALITY',
    name: 'Quality',
    price: '29,99',
    portfolioLimit: QUALITY_PHOTOS,
    diamond: 'assets_bipsy_business/Plans/diamond_quality.webp',
    tagline: 'Para que tu negocio destaque.',
    description: `Portada animada, tu negocio anunciado con prioridad en Destacados y un portfolio de ${QUALITY_PHOTOS} fotos.`,
    includesLabel: 'Todo lo de Bipsy Business, y además:',
    features: [
      'Portada animada',
      'Anuncia tu negocio con prioridad en Destacados de Explorar',
      `Portfolio de ${QUALITY_PHOTOS} fotos`,
    ],
    recommended: true,
    storeProductId: 'bipsy_quality_monthly',
  },
];

export interface ComparisonRow {
  label: string;
  hint?: string;
  bipsy: boolean | string;
  quality: boolean | string;
}

export interface ComparisonGroup {
  label: string;
  rows: ComparisonRow[];
}

export const COMPARISON: ComparisonGroup[] = [
  {
    label: 'Agenda y reservas',
    rows: [
      { label: 'Reservas online 24/7', bipsy: true, quality: true },
      { label: 'Agenda Hoy · Pendientes · Agenda', bipsy: true, quality: true },
      { label: 'Aceptación automática y reglas de reserva', bipsy: true, quality: true },
      { label: 'Lista de espera', bipsy: true, quality: true },
      { label: 'Protección contra plantones', hint: 'Tarifa de hasta el 50 % con tope de 100 €', bipsy: true, quality: true },
    ],
  },
  {
    label: 'Clientes',
    rows: [
      { label: 'Agenda de clientes e importación', bipsy: true, quality: true },
      { label: 'Mensajes con clientes', bipsy: true, quality: true },
      { label: 'Reseñas verificadas', bipsy: true, quality: true },
    ],
  },
  {
    label: 'Equipo y finanzas',
    rows: [
      { label: 'Trabajadores', hint: 'Entran con código de invitación', bipsy: 'Gratis', quality: 'Gratis' },
      { label: 'Permisos por trabajador', bipsy: true, quality: true },
      { label: 'Ausencias y vacaciones', bipsy: true, quality: true },
      { label: 'Fichaje', bipsy: true, quality: true },
      { label: 'Finanzas, caja y comisiones', bipsy: true, quality: true },
      { label: 'Cobros con tarjeta', hint: 'Sin comisión de Bipsy', bipsy: true, quality: true },
    ],
  },
  {
    label: 'Escaparate',
    rows: [
      { label: 'Ficha en la app de Bipsy', bipsy: true, quality: true },
      { label: 'Portfolio de fotos', bipsy: `${BUSINESS_PHOTOS} fotos`, quality: `${QUALITY_PHOTOS} fotos` },
      { label: 'Portada animada', bipsy: false, quality: true },
      { label: 'Prioridad en Destacados de Explorar', bipsy: false, quality: true },
    ],
  },
];

/** The fine print under the plans. Every line is a real rule of the billing. */
export const PRICING_NOTES: string[] = [
  `Al darte de alta tienes ${WELCOME_DAYS} días de prueba para elegir plan, sin poner ningún método de pago.`,
  'El primer plan de cada negocio tiene el primer mes gratis. Si no cancelas antes, se cobra cada mes por adelantado.',
  'Un solo precio por negocio: tus trabajadores usan la app gratis con tu código de invitación.',
  'Paga desde el panel web con tarjeta, cuenta bancaria (SEPA), Apple Pay o Google Pay, procesado por Stripe, o desde la app del móvil con App Store o Google Play.',
  'Antes de confirmar ves el precio final, con los impuestos de tu país.',
  'Sin permanencia: cancela cuando quieras desde Mi plan (o desde la tienda, si contrataste en el móvil) y mantienes el acceso hasta el final del mes pagado, también durante el mes gratis.',
  `Cambia de plan cuando quieras: la diferencia se prorratea. Si bajas a Bipsy Business, las fotos que pasen de ${BUSINESS_PHOTOS} se guardan sin verse y vuelven si subes otra vez.`,
];
