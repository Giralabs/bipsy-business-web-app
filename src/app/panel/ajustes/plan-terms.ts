import { BillingMethod, PlanOffer, SubscriptionPlan, SubscriptionStatus } from '../core/api/models';
import { MONTHS, fromInstant, shortDate } from '../core/util/dates';
import { money } from '../core/util/format';

/**
 * The words of the plan screens (wall, Mi plan, checkout), worked out from the
 * server's status. Pure functions and no Angular, so the rules read in one
 * place: the server decides WHAT applies (`trialAvailable`, `gift`, `offer`…)
 * and this only decides how it is said.
 */

export const PLAN_CODES = { BIPSY: 'BIPSY', QUALITY: 'QUALITY' } as const;

/** The plan's diamond, by plan code. Unknown codes get Business's. */
const DIAMONDS: Record<string, string> = {
  [PLAN_CODES.BIPSY]: 'assets_bipsy_business/Plans/diamond_business.webp',
  [PLAN_CODES.QUALITY]: 'assets_bipsy_business/Plans/diamond_quality.webp',
};

export function diamondOf(planCode: string | null | undefined): string {
  return DIAMONDS[planCode ?? ''] ?? DIAMONDS[PLAN_CODES.BIPSY];
}

export interface PlanPerk {
  icon: string;
  title: string;
  text: string;
}

/**
 * What Quality adds, as the approved design says it. «Anuncia tu negocio con
 * prioridad» is not a feature flag (the Explore ranking reads the plan), so
 * this list cannot come from `plan.features`.
 */
export function qualityPerks(plan: SubscriptionPlan): PlanPerk[] {
  return [
    { icon: 'animated_images', title: 'Portada animada', text: 'Tu portada se mueve y llama la atención.' },
    { icon: 'campaign', title: 'Anuncia tu negocio con prioridad', text: 'Sales antes en Destacados de Explorar.' },
    { icon: 'photo_library', title: `Portfolio de ${plan.portfolioLimit} fotos`, text: 'Cinco veces más que en Business.' },
  ];
}

/** One line for Business: the design does not list its features one by one. */
export function businessSummary(plan: SubscriptionPlan): string {
  return `Agenda, equipo, clientes, cobros, lista de espera y ${plan.portfolioLimit} fotos.`;
}

/**
 * The offer is only for the first plan and only with Stripe (the web always
 * pays with Stripe). During a gift there is no offer: the gift was the free
 * period.
 */
export function visibleOffer(plan: SubscriptionPlan, status: SubscriptionStatus | null): PlanOffer | null {
  if (!plan.offer?.active || !status?.trialAvailable || status.gift) return null;
  return plan.offer;
}

/** The free month badge: first plan, outside a gift, and the plan has one. */
export function hasFreeMonth(plan: SubscriptionPlan, status: SubscriptionStatus | null): boolean {
  return !!status?.trialAvailable && !status.gift && (plan.trialMonths ?? 0) > 0;
}

/**
 * `ZonedDateTime.plusMonths`, which is what the backend uses: a natural month,
 * and the 31st falls on the last day of a shorter month instead of spilling
 * into the next one (31 Jan + 1 → 28 Feb, not 3 Mar).
 */
export function addMonths(date: Date, months: number): Date {
  const out = new Date(date);
  const day = out.getDate();
  out.setDate(1);
  out.setMonth(out.getMonth() + months);
  const lastDay = new Date(out.getFullYear(), out.getMonth() + 1, 0).getDate();
  out.setDate(Math.min(day, lastDay));
  return out;
}

/** «4 de diciembre», and the year when it is not this one. */
export function dayMonth(date: Date, now: Date): string {
  const text = `${date.getDate()} de ${MONTHS[date.getMonth()]}`;
  return date.getFullYear() === now.getFullYear() ? text : `${text} de ${date.getFullYear()}`;
}

/** «4 dic», and «4 feb 2027» when it is not this year. */
export function shortDayMonth(date: Date, now: Date): string {
  const text = shortDate(date);
  return date.getFullYear() === now.getFullYear() ? text : `${text} ${date.getFullYear()}`;
}

function capFirst(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function monthsWord(count: number): string {
  return count === 1 ? '1 mes' : `${count} meses`;
}

/**
 * «Dic, ene, feb» — the months an offer is charged, starting with the first
 * charge. Long offers read better as a range: «Dic a may».
 */
export function offerMonthsLabel(firstCharge: Date, months: number): string {
  const names = Array.from({ length: months }, (_, i) =>
    MONTHS[addMonths(firstCharge, i).getMonth()].slice(0, 3),
  );
  const text = months > 3 ? `${names[0]} a ${names[names.length - 1]}` : names.join(', ');
  return capFirst(text);
}

/**
 * When the first charge would be if they contracted now. It is a preview for
 * the plan cards: the real date comes back in `CheckoutResponse.firstChargeAt`.
 * Null = it is charged today.
 */
export function firstChargePreview(
  plan: SubscriptionPlan,
  status: SubscriptionStatus | null,
  now: Date,
): Date | null {
  if (status?.gift && status.currentPeriodEnd) return fromInstant(status.currentPeriodEnd);
  if (hasFreeMonth(plan, status)) return addMonths(now, plan.trialMonths ?? 0);
  return null;
}

/** The line under the plan's button: what is charged and when. */
export function chargeNote(plan: SubscriptionPlan, status: SubscriptionStatus | null, now: Date): string {
  const first = firstChargePreview(plan, status, now);
  if (status?.gift && first) {
    return `Hasta el ${dayMonth(first, now)} no se te cobra nada. Ese día empieza ${plan.name} a ${money(plan.priceCents)} al mes.`;
  }
  if (!first) return 'Se cobra hoy y cada mes por adelantado.';
  const offer = visibleOffer(plan, status);
  if (offer) {
    return (
      `Hoy no se te cobra nada. Desde el ${shortDayMonth(first, now)}: ${money(offer.priceCents)} al mes ` +
      `durante ${monthsWord(offer.months)} y después ${money(plan.priceCents)}.`
    );
  }
  return `Hoy no se te cobra nada. Desde el ${shortDayMonth(first, now)}: ${money(plan.priceCents)} al mes.`;
}

/** «3 meses, tras el mes gratis» under the offer price. */
export function offerTerm(offer: PlanOffer, freeMonth: boolean): string {
  return freeMonth ? `${monthsWord(offer.months)}, tras el mes gratis` : monthsWord(offer.months);
}

/** The plan wall's title, with the truth about what ended (`endedAccess`). */
export function wallTitle(status: SubscriptionStatus | null, welcomeDays: number | null): string {
  switch (status?.endedAccess) {
    case 'GIFT':
      return status.planName ? `Se ha terminado tu ${status.planName} de regalo` : 'Se ha terminado tu regalo';
    case 'WELCOME_TRIAL':
      return welcomeDays ? `Se han acabado tus ${welcomeDays} días de prueba` : 'Se han acabado tus días de prueba';
    case 'FREE_PLAN':
      return 'Se ha terminado tu plan gratuito';
    case 'PAID':
      return status.state === 'CANCELED' ? 'Tu suscripción está cancelada' : 'Tu suscripción ha terminado';
    default:
      return 'Elige tu plan';
  }
}

export function wallLead(status: SubscriptionStatus | null): string {
  return status?.trialAvailable
    ? 'El primer mes es gratis. Cancela cuando quieras.'
    : 'Para seguir gestionando tu negocio, elige un plan.';
}

const BRANDS: Record<string, string> = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  amex: 'American Express',
  discover: 'Discover',
  diners: 'Diners',
  jcb: 'JCB',
  unionpay: 'UnionPay',
  cartes_bancaires: 'Cartes Bancaires',
};

export const SEPA_BRAND = 'sepa_debit';

/**
 * «Visa ···· 4242» or «Cuenta ES ···· 1234». The backend only sends the last
 * four digits of the IBAN, not its country: Bipsy businesses are in Spain.
 */
export function methodLabel(method: BillingMethod): string {
  if (method.brand === SEPA_BRAND) return `Cuenta ES ···· ${method.last4}`;
  const brand = BRANDS[method.brand] ?? capFirst(method.brand.replace(/_/g, ' '));
  return `${brand} ···· ${method.last4}`;
}

/** «Caduca 12/29» for cards; bank accounts do not expire. */
export function methodExpiry(method: BillingMethod): string | null {
  if (method.brand === SEPA_BRAND || !method.expMonth || !method.expYear) return null;
  return `Caduca ${String(method.expMonth).padStart(2, '0')}/${String(method.expYear).slice(-2)}`;
}

export type PlanTone = 'success' | 'accent' | 'warn' | 'grey';

export interface PlanRow {
  label: string;
  value: string;
}

/** The top card of Mi plan: its pill, an optional sentence and the date rows. */
export interface PlanSummary {
  pill: string;
  tone: PlanTone;
  text: string | null;
  rows: PlanRow[];
}

/**
 * Mi plan's top card for every situation the server can describe. The order
 * matters: a gift is a gift whatever its state says, and a cancelled plan
 * says so before anything about its price.
 */
export function planSummary(status: SubscriptionStatus, now: Date): PlanSummary {
  const end = status.currentPeriodEnd ? fromInstant(status.currentPeriodEnd) : null;
  const planName = status.planName ?? 'tu plan';
  const rows: PlanRow[] = [];

  if (status.giftEndedAt) {
    rows.push({ label: 'Regalo', value: `Terminado el ${shortDayMonth(fromInstant(status.giftEndedAt), now)}` });
  }

  if (status.gift) {
    const scheduled = status.scheduled;
    if (scheduled) {
      const startsAt = fromInstant(scheduled.startsAt);
      if (end) rows.push({ label: 'Regalo hasta', value: shortDayMonth(end, now) });
      rows.push({ label: 'Primer cobro', value: `${shortDayMonth(startsAt, now)} · ${money(scheduled.priceCents)}` });
      if (scheduled.planCode !== status.planCode) rows.push({ label: 'Después', value: scheduled.planName });
      return { pill: 'Regalo de Bipsy', tone: 'accent', text: null, rows };
    }
    if (end) rows.push({ label: 'Hasta', value: shortDayMonth(end, now) });
    rows.push({ label: 'Después', value: 'Sin plan' });
    const text = end
      ? `Deja un método de pago guardado y seguirás con ${planName} cuando acabe el regalo, sin cortes. ` +
        `Hasta el ${dayMonth(end, now)} no se te cobra nada.`
      : null;
    return { pill: 'Regalo de Bipsy', tone: 'accent', text, rows };
  }

  if (status.cancelAtPeriodEnd && end) {
    return {
      pill: 'Cancelado',
      tone: 'grey',
      text:
        `Sigues con ${planName} hasta el ${dayMonth(end, now)}. Ese día no se te cobrará nada y tendrás que ` +
        'elegir un plan para seguir usando Bipsy.',
      rows,
    };
  }

  switch (status.state) {
    case 'TRIAL':
      return { pill: 'Mes gratis', tone: 'accent', text: null, rows: [...rows, ...freeMonthRows(status, now)] };
    case 'WELCOME_TRIAL':
      if (end) rows.push({ label: 'Hasta', value: shortDayMonth(end, now) });
      return {
        pill: 'Prueba',
        tone: 'accent',
        text: status.trialAvailable
          ? 'Elige un plan para no perder el acceso. El primer mes es gratis.'
          : 'Elige un plan para no perder el acceso.',
        rows,
      };
    case 'PAST_DUE':
      if (end) rows.push({ label: 'Renovación', value: shortDayMonth(end, now) });
      return {
        pill: 'Pago pendiente',
        tone: 'warn',
        text: 'No hemos podido cobrar la renovación. Revisa tu método de pago para no perder el acceso.',
        rows,
      };
    case 'ACTIVE':
      return { pill: 'Activo', tone: 'success', text: null, rows: [...rows, ...activeRows(status, end, now)] };
    case 'EXPIRED':
      return { pill: 'Caducado', tone: 'grey', text: null, rows };
    case 'CANCELED':
      return { pill: 'Cancelado', tone: 'grey', text: null, rows };
    default:
      return { pill: 'Sin plan', tone: 'grey', text: null, rows };
  }
}

/** «Gratis hasta 4 dic», then the offer months if any, then the plan price. */
function freeMonthRows(status: SubscriptionStatus, now: Date): PlanRow[] {
  const rows: PlanRow[] = [];
  const firstCharge = status.trialEndsAt ? fromInstant(status.trialEndsAt) : null;
  if (firstCharge) rows.push({ label: 'Gratis hasta', value: shortDayMonth(firstCharge, now) });
  const offer = status.offer;
  if (offer && firstCharge) {
    rows.push({
      label: offerMonthsLabel(firstCharge, offer.months),
      value: `${money(offer.priceCents)} · ${offer.label}`,
    });
    const fullPrice = fromInstant(offer.until);
    rows.push({ label: `Desde ${MONTHS[fullPrice.getMonth()]}`, value: `${money(status.priceCents)} al mes` });
  } else {
    rows.push({ label: 'Después', value: `${money(status.priceCents)} al mes` });
  }
  return rows;
}

/** The price in force (the offer while it lasts) and the renewal date. */
function activeRows(status: SubscriptionStatus, end: Date | null, now: Date): PlanRow[] {
  const rows: PlanRow[] = [];
  const offer = status.offer;
  const offerRunning = offer && fromInstant(offer.until).getTime() > now.getTime();
  if (offer && offerRunning) {
    rows.push({ label: 'Precio', value: `${money(offer.priceCents)} al mes · ${offer.label}` });
    rows.push({ label: `Desde el ${shortDayMonth(fromInstant(offer.until), now)}`, value: `${money(status.priceCents)} al mes` });
  } else {
    rows.push({ label: 'Precio', value: `${money(status.priceCents)} al mes` });
  }
  if (end) rows.push({ label: 'Se renueva el', value: shortDayMonth(end, now) });
  return rows;
}

/** Charged by a phone store: managed there, never from the web. */
export function storeName(status: SubscriptionStatus | null): string | null {
  if (status?.billedBy === 'APP_STORE') return 'App Store';
  if (status?.billedBy === 'GOOGLE_PLAY') return 'Google Play';
  return null;
}

/** The Stripe portal only knows what was contracted with Stripe (or left ready during a gift). */
export function managedWithStripe(status: SubscriptionStatus | null): boolean {
  return status?.billedBy === 'STRIPE' || !!status?.scheduled;
}

export interface NoticeText {
  title: string;
  sub: string;
}

/** The one plan reminder at the top of Ajustes, from `status.notice`. Null = nothing to show. */
export function noticeText(status: SubscriptionStatus | null, now: Date): NoticeText | null {
  switch (status?.notice) {
    case 'COURTESY':
      return { title: 'Mejora tu plan para no perder el acceso', sub: 'El primer mes es gratis' };
    case 'GIFT_ENDING': {
      const end = status.currentPeriodEnd ? fromInstant(status.currentPeriodEnd) : null;
      const plan = status.planName ?? 'plan';
      return {
        title: end ? `Tu ${plan} de regalo acaba el ${shortDayMonth(end, now)}` : `Tu ${plan} de regalo está a punto de acabar`,
        sub: 'Elige un plan para no perder el acceso',
      };
    }
    default:
      return null;
  }
}
