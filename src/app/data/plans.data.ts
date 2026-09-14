import { TRIAL_DAYS } from './site.data';

/**
 * The plans on sale, as defined in the backend catalogue.
 *
 * Source: V37__subscription_billing.sql (prices), V48__quality_branding.sql
 * (Quality features), V51__iap_subscriptions.sql (store products). The FREE
 * plan exists but is not sold (`selectable = FALSE`), so it is not shown.
 *
 * ⚠️ The price actually charged is the one configured in Google Play and App
 * Store Connect, which is also what the app shows at checkout. If the store
 * price changes, this page must change with it or the site will advertise one
 * number and the phone will charge another. See docs/RELEASE-STORES.md §3.
 */

export interface Plan {
  code: 'BIPSY' | 'QUALITY';
  name: string;
  /** Monthly price in euros, as a display string with a decimal comma. */
  price: string;
  tagline: string;
  description: string;
  /** Title of the feature list. */
  includesLabel: string;
  features: string[];
  recommended: boolean;
  /** Store product id, for reference when checking the consoles. */
  storeProductId: string;
}

export const PLANS: Plan[] = [
  {
    code: 'BIPSY',
    name: 'Bipsy Business',
    price: '18,99',
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
      'Portfolio de hasta 10 fotos',
    ],
    recommended: false,
    storeProductId: 'bipsy_business_monthly',
  },
  {
    code: 'QUALITY',
    name: 'Quality',
    price: '27,99',
    tagline: 'Para que tu negocio destaque.',
    description: 'Foto y portada animadas, tus colores, efectos exclusivos, portfolio sin límite y línea directa para pedir mejoras.',
    includesLabel: 'Todo lo de Bipsy Business, y además:',
    features: [
      'Portada animada',
      'Foto de perfil animada',
      'Tu color de marca en tu ficha',
      'Efectos exclusivos: marcos, destellos y auras',
      'Tu ficha a tu manera',
      'Portfolio sin límite',
      'Solicitudes directas a Bipsy',
      'Por delante en Destacados de tu zona',
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
      { label: 'Portfolio de fotos', bipsy: '10 fotos', quality: 'Sin límite' },
      { label: 'Color de marca', bipsy: false, quality: true },
      { label: 'Portada y foto animadas', bipsy: false, quality: true },
      { label: 'Efectos exclusivos', bipsy: false, quality: '27 efectos' },
      { label: 'Orden de la ficha', bipsy: false, quality: true },
      { label: 'Prioridad en Destacados de tu zona', bipsy: false, quality: true },
      { label: 'Solicitudes directas a Bipsy', bipsy: false, quality: true },
    ],
  },
];

/** The fine print under the plans. Every line is a real rule of the billing. */
export const PRICING_NOTES: string[] = [
  `Los primeros ${TRIAL_DAYS} días son gratis. Si no cancelas antes, la suscripción se renueva cada mes.`,
  'Un solo precio por negocio: tus trabajadores usan la app gratis con tu código de invitación.',
  'La suscripción se paga a través de Google Play o App Store, con la cuenta de tu móvil.',
  'El precio final lo muestra la tienda antes de pagar, con los impuestos de tu país.',
  'Sin permanencia: cancela cuando quieras desde la tienda y mantienes el acceso hasta el final del mes pagado.',
  'Cambia de plan cuando quieras. La tienda calcula la diferencia.',
];
