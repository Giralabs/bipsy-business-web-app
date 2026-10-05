import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api } from '../core/api/api';
import { AuthService } from '../core/auth/auth.service';
import {
  BusinessDetail,
  PageResponse,
  PolicyGroup,
  PortfolioImage,
  PublicScheduleEntry,
  ReviewResponse,
  ServiceResponse,
  ShowcaseSection,
  WeekdayName,
} from '../core/api/models';
import { message } from '../core/data/resource';
import { PnEmptyComponent, PnErrorComponent } from '../ui/controls';
import { ToastService } from '../ui/toast.service';
import { PreviewAppComponent } from './preview-app.component';
import { PreviewDay, PreviewVm, PublicBusinessExtras } from './preview-model';
import { PreviewWebComponent } from './preview-web.component';

const DEFAULT_ORDER: ShowcaseSection[] = ['GALLERY', 'SERVICES', 'REVIEWS'];

/** Monday first, the seven names of `gipsi_business_schedule_sheet.dart`. */
const DAYS: { id: WeekdayName; label: string; js: number }[] = [
  { id: 'MONDAY', label: 'Lunes', js: 1 },
  { id: 'TUESDAY', label: 'Martes', js: 2 },
  { id: 'WEDNESDAY', label: 'Miércoles', js: 3 },
  { id: 'THURSDAY', label: 'Jueves', js: 4 },
  { id: 'FRIDAY', label: 'Viernes', js: 5 },
  { id: 'SATURDAY', label: 'Sábado', js: 6 },
  { id: 'SUNDAY', label: 'Domingo', js: 0 },
];

/** `_previewLimit` of the portfolio strip. */
const STRIP = 10;
/** `GipsiPoliciesSection.previewLimit`. */
const POLICY_PREVIEW = 5;

type Mode = 'web' | 'app';

/** The three widths the customer web is looked at, and their viewport. */
const WEB_SIZES = {
  escritorio: { width: 1280, height: 800 },
  tablet: { width: 834, height: 1112 },
  movil: { width: 390, height: 844 },
} as const;
type WebSize = keyof typeof WEB_SIZES;

/** The chrome of the fake browser, in pixels: it is part of the frame. */
const BROWSER_BAR = 46;
/** The two phones side by side, plus their bezels, the gap and the label. */
const PHONES_WIDTH = 900;
const PHONES_HEIGHT = 975;

/**
 * `/panel/negocio/vista-previa` — `business_preview_screen.dart`: the shop
 * exactly as a customer sees it, on the web and on a phone.
 *
 * It reads the SAME public endpoints as the customer apps
 * (`GET /businesses/{id}`, `/services`, `/schedule`, `/portfolio`,
 * `/policies` and `/reviews/business/{id}`), never `/businesses/me`: reading
 * the private one would show things the customer may not see and the preview
 * would stop being one.
 *
 * What it paints is not a drawing of those screens: `preview-web.component`
 * carries the markup and the styles of
 * `bipsy-web-app/src/app/pages/business-detail`, and `preview-app.component`
 * ports `gipsi_shared_ui/.../gipsi_business_detail_body.dart` at its real size
 * inside each phone's frame. This component only loads the data once, hands
 * the same view model to both, and answers the customer's actions with a
 * toast — the same thing `business_preview_screen.dart` does with its alert.
 */
@Component({
  selector: 'app-panel-vista-previa',
  standalone: true,
  imports: [RouterLink, PnEmptyComponent, PnErrorComponent, PreviewWebComponent, PreviewAppComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './vista-previa.component.html',
  styleUrl: './vista-previa.component.css',
})
export class VistaPreviaComponent implements OnDestroy {
  readonly auth = inject(AuthService);
  private readonly api = inject(Api);
  private readonly toasts = inject(ToastService);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly business = signal<(BusinessDetail & PublicBusinessExtras) | null>(null);
  readonly services = signal<ServiceResponse[] | null>(null);
  readonly schedule = signal<PublicScheduleEntry[]>([]);
  readonly portfolio = signal<PortfolioImage[]>([]);
  readonly policies = signal<PolicyGroup[]>([]);
  readonly reviews = signal<ReviewResponse[] | null>(null);
  readonly reviewTotal = signal<number | null>(null);

  readonly businessId = this.auth.businessId;

  // ----- EL CONMUTADOR --------------------

  readonly mode = signal<Mode>('web');
  readonly webSize = signal<WebSize>('escritorio');
  readonly sizes = Object.keys(WEB_SIZES) as WebSize[];

  readonly sizeLabel: Record<WebSize, string> = {
    escritorio: 'Escritorio',
    tablet: 'Tablet',
    movil: 'Móvil',
  };

  readonly webWidth = computed(() => WEB_SIZES[this.webSize()].width);
  readonly webHeight = computed(() => WEB_SIZES[this.webSize()].height);

  /** Size of what is being shown, before shrinking it to fit the panel. */
  readonly frameWidth = computed(() => (this.mode() === 'web' ? this.webWidth() : PHONES_WIDTH));
  readonly frameHeight = computed(() =>
    this.mode() === 'web' ? this.webHeight() + BROWSER_BAR : PHONES_HEIGHT,
  );

  /**
   * How much the frame has to shrink to fit the panel. Only down, never up:
   * a phone blown up to 1.4 would stop being a phone.
   */
  private readonly stageWidth = signal(0);
  readonly scale = computed(() => {
    const available = this.stageWidth();
    if (available <= 0) return 1;
    return Math.min(1, available / this.frameWidth());
  });

  private observer?: ResizeObserver;

  /**
   * Setter and not `ngAfterViewInit`: while the ficha loads there is no
   * stage, so a one-off read after the first render would always find
   * nothing and the frame would never be shrunk.
   */
  @ViewChild('stage')
  set stage(ref: ElementRef<HTMLElement> | undefined) {
    this.observer?.disconnect();
    const host = ref?.nativeElement;
    if (!host || typeof ResizeObserver === 'undefined') return;
    this.observer = new ResizeObserver((entries) => {
      this.stageWidth.set(entries[0].contentRect.width);
    });
    this.observer.observe(host);
  }

  // ----- LO QUE SE PINTA --------------------

  readonly vm = computed<PreviewVm | null>(() => {
    const b = this.business();
    if (!b) return null;

    const policies = this.policies().filter((group) => group.policies.length > 0);
    const services = this.services();

    return {
      business: b,
      coverUrl: b.branding?.animatedCoverUrl ?? b.coverImageUrl ?? null,
      avatarUrl: b.branding?.animatedProfileUrl ?? b.profileImageUrl ?? null,
      categoryName: primaryCategoryName(b),
      locationDisplay: locationDisplay(b),
      hasVenue: serviceMode(b) !== 'AT_CUSTOMER',
      score: this.score(),
      order: this.order(),
      services: services === null ? null : services.filter((s) => s.active !== false),
      portfolio: this.portfolio(),
      strip: this.portfolio().slice(0, STRIP),
      policies,
      previewPolicies: trimPolicies(policies, POLICY_PREVIEW),
      totalPolicies: policies.reduce((sum, group) => sum + group.policies.length, 0),
      reviews: this.reviews(),
      week: this.week(),
      hasSchedule: this.schedule().length > 0,
    };
  });

  /** Mean from the business, or from the loaded reviews if it does not come. */
  private readonly score = computed(() => {
    const b = this.business();
    const list = this.reviews();
    let value = (b?.averageRating ?? 0) > 0 ? b!.averageRating : null;
    let count = (b?.reviewCount ?? 0) > 0 ? b!.reviewCount! : 0;
    if (value == null && list && list.length > 0) {
      value = list.reduce((sum, r) => sum + r.rating, 0) / list.length;
      count = this.reviewTotal() ?? list.length;
    }
    return { value, count };
  });

  private readonly order = computed(() => {
    const order = this.business()?.branding?.sectionOrder ?? DEFAULT_ORDER;
    return [...order, ...DEFAULT_ORDER.filter((s) => !order.includes(s))];
  });

  /**
   * The seven days with their ranges together, as the schedule sheet builds
   * them: the backend sends one row per range, so morning and afternoon are
   * two, and a day with none is closed.
   */
  private readonly week = computed<PreviewDay[]>(() => {
    const today = new Date().getDay();
    return DAYS.map((day) => {
      const ranges = this.schedule()
        .filter((entry) => entry.dayOfWeek === day.id)
        .sort((a, b) => a.startTime.localeCompare(b.startTime))
        .map((entry) => `${entry.startTime.slice(0, 5)} - ${entry.endTime.slice(0, 5)}`);
      return {
        label: day.label,
        hours: ranges.length > 0 ? ranges.join('\n') : 'Cerrado',
        closed: ranges.length === 0,
        today: day.js === today,
      };
    });
  });

  /** The address of the ficha in the customer web, to write it on the bar. */
  readonly publicUrl = computed(() => {
    const b = this.business();
    if (!b) return 'bipsy.es';
    return `bipsy.es/negocio/${businessSlug(b.id, b.name)}`;
  });

  constructor() {
    void this.load();
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }

  async load(): Promise<void> {
    const id = this.businessId();
    if (id == null) {
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    try {
      this.business.set(await this.api.get<BusinessDetail & PublicBusinessExtras>(`/businesses/${id}`));
    } catch (cause) {
      this.error.set(message(cause));
      this.loading.set(false);
      return;
    }
    this.loading.set(false);

    // The rest paints as it arrives; a failed block simply does not show,
    // like the app's `valueOrNull`.
    const [services, schedule, portfolio, policies, reviews] = await Promise.allSettled([
      this.api.get<ServiceResponse[]>(`/businesses/${id}/services`),
      this.api.get<PublicScheduleEntry[]>(`/businesses/${id}/schedule`),
      this.api.get<PortfolioImage[]>(`/businesses/${id}/portfolio`),
      this.api.get<PolicyGroup[]>(`/businesses/${id}/policies`),
      this.api.get<PageResponse<ReviewResponse>>(`/reviews/business/${id}`, { page: 0, size: 3, sort: 'rating,desc' }),
    ]);
    this.services.set(services.status === 'fulfilled' ? services.value : []);
    if (schedule.status === 'fulfilled') this.schedule.set(schedule.value);
    if (portfolio.status === 'fulfilled') this.portfolio.set(portfolio.value);
    if (policies.status === 'fulfilled') this.policies.set(policies.value);
    // A failed page of reviews is treated as «there are none», like the app:
    // leaving it at null would keep the skeleton forever.
    this.reviews.set(reviews.status === 'fulfilled' ? reviews.value.content : []);
    this.reviewTotal.set(reviews.status === 'fulfilled' ? reviews.value.totalElements : null);
  }

  /** A button that does nothing reads as broken: say why. */
  notify(): void {
    this.toasts.show('Aquí las acciones del cliente no se ejecutan.');
  }
}

// ----- AYUDAS --------------------

function serviceMode(b: BusinessDetail): string {
  return b.serviceMode ?? (b.worksAtHome ? 'AT_CUSTOMER' : 'AT_BUSINESS');
}

/** `BusinessResponse.locationDisplay`: street and town, or «A domicilio». */
function locationDisplay(b: BusinessDetail): string {
  const mode = serviceMode(b);
  const label = locationLabel(b.address, b.city);
  if (mode === 'AT_CUSTOMER') return 'A domicilio';
  if (mode === 'BOTH') return label ? `${label} · también a domicilio` : 'A domicilio';
  return label;
}

/** `BusinessResponse.locationLabel`: street, town, no «, España», no repeated town. */
function locationLabel(address: string | null, city: string | null): string {
  const street = (address ?? '').trim().replace(/,\s*españa$/i, '').trim();
  const town = (city ?? '').trim();
  if (!street) return town;
  if (!town) return street;
  return street.toLowerCase().includes(town.toLowerCase()) ? street : `${street}, ${town}`;
}

/** `primaryCategory()`: the one marked as primary, or the first one. */
function primaryCategoryName(b: BusinessDetail): string | null {
  const list = b.categories ?? [];
  return (list.find((c) => c.primary) ?? list[0])?.name ?? null;
}

/**
 * Five rules at most, spread over their groups and never leaving an empty
 * one: `GipsiPoliciesSection` and the customer web trim them the same way.
 */
function trimPolicies(groups: PolicyGroup[], limit: number): PolicyGroup[] {
  let left = limit;
  const trimmed: PolicyGroup[] = [];
  for (const group of groups) {
    if (left <= 0) break;
    const slice = group.policies.slice(0, left);
    left -= slice.length;
    trimmed.push({ ...group, policies: slice });
  }
  return trimmed;
}

/** `businessSlug()` of the customer web: `barberia-el-maestro-3`. */
function businessSlug(id: number, name: string): string {
  const slug = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return slug ? `${slug}-${id}` : String(id);
}
