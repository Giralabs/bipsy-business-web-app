import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';
import { PolicyGroup, ServiceResponse } from '../core/api/models';
import { fromInstant } from '../core/util/dates';
import { PnVerifiedBadgeComponent } from '../ui/verified-badge.component';
import {
  PreviewVm,
  appPrice,
  categoryIcon,
  longDuration,
  ratingValue,
  relativeDate,
  reviewInitials,
  stars,
} from './preview-model';

export type Platform = 'ios' | 'android';

/** Safe areas and chrome of each phone, in logical pixels. */
interface DeviceSpec {
  /** Screen, in logical pixels: iPhone 15 and Pixel 8. */
  width: number;
  height: number;
  safeTop: number;
  safeBottom: number;
  /** Outer radius of the glass and of the bezel. */
  screenRadius: number;
  bezel: number;
  /** `GipsiRadii.xxl` on iOS, the Material sheet on Android. */
  sheetRadius: number;
}

const DEVICES: Record<Platform, DeviceSpec> = {
  ios: { width: 393, height: 852, safeTop: 59, safeBottom: 34, screenRadius: 44, bezel: 11, sheetRadius: 36 },
  android: { width: 412, height: 915, safeTop: 24, safeBottom: 24, screenRadius: 32, bezel: 10, sheetRadius: 32 },
};

/** `GipsiImageRatios.businessCover`. */
const COVER_RATIO = 16 / 9;

/**
 * The shop as it looks in the CUSTOMER PHONE APP, inside its device frame.
 *
 * It is a port of `packages/gipsi_shared_ui/lib/src/business/
 * gipsi_business_detail_body.dart` and of the widgets it uses
 * (`gipsi_service_row.dart`, `gipsi_review_card.dart`,
 * `gipsi_portfolio_strip.dart`, `gipsi_policies_section.dart`,
 * `gipsi_rating.dart`, `gipsi_business_schedule_sheet.dart`). Every size,
 * padding and string in the stylesheet and the template comes from there:
 * `GipsiSpacing`, `GipsiRadii` and `GipsiTypography` map 1:1 onto CSS pixels.
 *
 * The frame reuses the mock-up kit of `src/styles/app-mockup.css` (`.ph`,
 * `.ph__screen`, `.ph__island`, `.ph__status`), resized to the real screen of
 * each phone and with each platform's conventions: Dynamic Island and home
 * indicator on iOS, punch-hole and gesture pill on Android, and the schedule
 * opening as a Cupertino popup or as a Material sheet.
 */
@Component({
  selector: 'app-preview-app',
  standalone: true,
  imports: [PnVerifiedBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './preview-app.component.html',
  styleUrl: './preview-app.component.css',
})
export class PreviewAppComponent {
  @Input({ required: true }) vm!: PreviewVm;
  @Input() platform: Platform = 'ios';
  @Output() act = new EventEmitter<void>();

  readonly price = appPrice;
  readonly duration = longDuration;
  readonly categoryIcon = categoryIcon;
  readonly stars = stars;

  /** Which sheet is open, if any: the app only ever shows one. */
  readonly sheet = signal<'schedule' | 'policies' | null>(null);

  /**
   * Whether the last pixel of the cover has left the screen. It rules the
   * colour of the clock and the battery, exactly like `_coverGone` does:
   * white over the photo, the theme's colour once the photo is gone.
   */
  readonly coverGone = signal(false);

  readonly device = computed(() => DEVICES[this.platform]);

  get spec(): DeviceSpec {
    return DEVICES[this.platform];
  }

  /** `expandedHeight = screenWidth / GipsiImageRatios.businessCover`. */
  get coverHeight(): number {
    return Math.round(this.spec.width / COVER_RATIO);
  }

  /** The app's clock: the hour the mock-ups always show. */
  get clock(): string {
    return '9:41';
  }

  /**
   * The sections that are actually painted, in order.
   *
   * Only the gallery can come out empty, and `_orderedSections` skips it
   * without leaving its divider behind: with the divider computed from the
   * raw order, a business with no photos got two rules in a row.
   */
  get sections(): string[] {
    return this.vm.order.filter((s) => s !== 'GALLERY' || this.vm.strip.length > 0);
  }

  /** Group headers only show when there is more than one group. */
  get showGroupHeaders(): boolean {
    return this.vm.previewPolicies.length > 1;
  }

  get policiesTruncated(): boolean {
    const shown = this.vm.previewPolicies.reduce((n, g) => n + g.policies.length, 0);
    return shown < this.vm.totalPolicies;
  }

  /** `GipsiPoliciesSection` never draws an empty group. */
  groupsWith(groups: PolicyGroup[]): PolicyGroup[] {
    return groups.filter((g) => g.policies.length > 0);
  }

  onScroll(event: Event): void {
    const limit = this.coverHeight - this.spec.safeTop;
    const gone = (event.target as HTMLElement).scrollTop > limit;
    if (gone !== this.coverGone()) this.coverGone.set(gone);
  }

  /** `_InfoActions`: a quarter of the row each, never wider than 120. */
  actionWidth(count: number): number {
    const inner = this.spec.width - 2 * 20; // GipsiSpacing.screenHorizontal
    const share = (inner - 8 * (count - 1)) / count;
    return Math.min(120, share);
  }

  get actionCount(): number {
    const b = this.vm.business;
    let n = 0;
    if (b.phone) n++;
    if (this.vm.hasVenue && this.vm.locationDisplay) n++;
    if (this.vm.hasSchedule) n++;
    if (b.chatEnabled) n++;
    return n;
  }

  rating(value: number): string {
    return ratingValue(value);
  }

  reviewDate(iso: string): string {
    return relativeDate(fromInstant(iso));
  }

  initials(name: string | null): string {
    return reviewInitials(name ?? '');
  }

  /**
   * `_SocialRow`: only the networks the business has, in the order of
   * «Editar perfil» — web, Instagram, Facebook, X, TikTok and WhatsApp — with
   * the addresses `BusinessSocialLinks` builds from the stored handles.
   */
  get socialLinks(): { label: string; icon: string | null; url: string }[] {
    const s = this.vm.business.social ?? {};
    const handle = (value: string | null | undefined) => (value ?? '').trim().replace(/^@/, '');
    const site = (s.website ?? '').trim();
    const phone = (s.whatsapp ?? '').replace(/[^0-9]/g, '');
    const links: { label: string; icon: string | null; url: string | null }[] = [
      { label: 'Web', icon: null, url: site ? (/^https?:\/\//i.test(site) ? site : `https://${site}`) : null },
      { label: 'Instagram', icon: 'instagram', url: handle(s.instagram) ? `https://instagram.com/${handle(s.instagram)}` : null },
      { label: 'Facebook', icon: 'facebook', url: handle(s.facebook) ? `https://facebook.com/${handle(s.facebook)}` : null },
      { label: 'X', icon: 'x', url: handle(s.x) ? `https://x.com/${handle(s.x)}` : null },
      { label: 'TikTok', icon: 'tiktok', url: handle(s.tiktok) ? `https://tiktok.com/@${handle(s.tiktok)}` : null },
      { label: 'WhatsApp', icon: 'whatsapp', url: phone ? `https://wa.me/${phone}` : null },
    ];
    return links.filter((link): link is { label: string; icon: string | null; url: string } => link.url !== null);
  }

  /**
   * `_placeNote` of `gipsi_service_row.dart`: where the service is given, only
   * when it is not just at the venue, with the surcharge stuck to it.
   */
  placeNote(service: ServiceResponse): string | null {
    const where =
      service.serviceMode === 'BOTH' ? 'También a domicilio'
      : service.serviceMode === 'AT_CUSTOMER' ? 'Solo a domicilio'
      : null;
    if (where === null) return null;
    const cents = service.homeSurchargeCents ?? 0;
    return cents > 0 ? `${where} · +${appPrice(cents / 100)}` : where;
  }

  serviceIcon(service: ServiceResponse): string {
    void service;
    const categories = this.vm.business.categories ?? [];
    const primary = categories.find((c) => c.primary) ?? categories[0];
    return categoryIcon(primary?.code);
  }

  hideBroken(event: Event): void {
    (event.target as HTMLElement).style.display = 'none';
  }
}
