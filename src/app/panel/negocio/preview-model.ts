import {
  BusinessDetail,
  PolicyGroup,
  PortfolioImage,
  ReviewResponse,
  ServiceResponse,
  ShowcaseSection,
} from '../core/api/models';

/**
 * What the two faithful previews of `/panel/negocio/vista-previa` paint.
 *
 * The screen loads the public endpoints once and hands the SAME resolved data
 * to both renderers, exactly like the app hands one `BusinessResponse` to
 * `GipsiBusinessDetailBody`: if the web and the phone showed different fields
 * the preview would be lying about one of them.
 */
export interface PreviewDay {
  label: string;
  /** Joined ranges, or «Cerrado» — `gipsi_business_schedule_sheet.dart`. */
  hours: string;
  closed: boolean;
  today: boolean;
}

/**
 * Fields of the public `BusinessResponse` that the customer ficha reads and
 * `BusinessDetail` does not declare: only this screen needs them, so they are
 * widened here instead of in the shared model.
 */
export interface PublicBusinessExtras {
  requiresCard?: boolean;
  cancellationFeePercent?: number;
  cancellationWindowHours?: number;
}

export interface PreviewVm {
  business: BusinessDetail & PublicBusinessExtras;
  coverUrl: string | null;
  avatarUrl: string | null;
  /** Primary category, or the first one — `primaryCategory()` in both apps. */
  categoryName: string | null;
  locationDisplay: string;
  hasVenue: boolean;
  score: { value: number | null; count: number };
  order: ShowcaseSection[];
  /** null = still loading, the app's «services == null». */
  services: ServiceResponse[] | null;
  portfolio: PortfolioImage[];
  /** The first ten, the `_previewLimit` of the strip. */
  strip: PortfolioImage[];
  policies: PolicyGroup[];
  /** The first five, spread over their groups (`GipsiPoliciesSection`). */
  previewPolicies: PolicyGroup[];
  totalPolicies: number;
  /** null = still loading. */
  reviews: ReviewResponse[] | null;
  week: PreviewDay[];
  hasSchedule: boolean;
}

// ----- FORMATO -----------------------------------------------------------

const EUR_0 = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});
const EUR_2 = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** `GipsiFormat.priceShort`: «22 €» when it is round, «22,50 €» otherwise. */
export function appPrice(value: number): string {
  return Number.isInteger(value) ? EUR_0.format(value) : EUR_2.format(value);
}

/** `euros()` of the customer web: always two decimals, «22,00 €». */
export function webPrice(value: number): string {
  return EUR_2.format(value);
}

/** `GipsiFormat.duration` / `duration()` of the web: «45 min», «1 h 30 min». */
export function longDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/** `GipsiFormat.rating`: one decimal with a comma. */
export function ratingValue(value: number): string {
  return value.toFixed(1).replace('.', ',');
}

/** The five stars of a rating, filled or not. */
export function stars(rating: number): boolean[] {
  return [1, 2, 3, 4, 5].map((n) => n <= Math.round(rating));
}

/**
 * `_relativeDate` of `gipsi_review_card.dart`, literals included: the app
 * writes «hace 3 dias» and «hace 2 sem» without accents, so the preview does
 * too — this is what the customer reads.
 */
export function relativeDate(date: Date, now: Date = new Date()): string {
  const days = Math.floor((now.getTime() - date.getTime()) / 86_400_000);
  if (days < 1) return 'hoy';
  if (days < 2) return 'ayer';
  if (days < 7) return `hace ${days} dias`;
  if (days < 30) return `hace ${Math.floor(days / 7)} sem`;
  const dd = `${date.getDate()}`.padStart(2, '0');
  const mm = `${date.getMonth() + 1}`.padStart(2, '0');
  return `${dd}/${mm}/${date.getFullYear()}`;
}

/** First letter of the first and last word, as the review avatar does. */
export function reviewInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** `iconForCategory` of `gipsi_service_row.dart`, for a service with no photo. */
export function categoryIcon(code: string | null | undefined): string {
  switch ((code ?? '').toUpperCase()) {
    case 'HAIRDRESSER': return 'content_cut';
    case 'BARBER': return 'face_retouching_natural';
    case 'ESTHETIC': return 'auto_awesome';
    case 'NAILS': return 'brush';
    case 'MASSAGE': return 'self_improvement';
    case 'TATTOO': return 'draw';
    case 'MAKEUP': return 'palette';
    case 'EYEBROWS': return 'remove_red_eye';
    case 'PHYSIO': return 'healing';
    case 'PERSONAL_TRAINER': return 'fitness_center';
    case 'TUTORING': return 'school';
    case 'PILATES': return 'accessibility_new';
    case 'LASER': return 'flash_on';
    case 'NUTRITION': return 'eco';
    case 'PHOTOGRAPHY': return 'camera_alt';
    case 'COACHING': return 'track_changes';
    default: return 'spa';
  }
}
