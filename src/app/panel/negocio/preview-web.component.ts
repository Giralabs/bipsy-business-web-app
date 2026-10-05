import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { PolicyGroup, ServiceResponse } from '../core/api/models';
import { fromInstant } from '../core/util/dates';
import { PreviewVm, longDuration, ratingValue, stars, webPrice } from './preview-model';

/**
 * The shop as it looks in the CUSTOMER WEB APP (`bipsy-web-app`).
 *
 * Markup and styles are a copy of
 * `bipsy-web-app/src/app/pages/business-detail/business-detail.component.{html,css}`
 * plus the page chrome that wraps it in
 * `bipsy-web-app/src/app/app.component.html` — the promo strip and the navbar
 * on a desktop (`components/promo-bar`, `components/navbar`), the store strip
 * and the floating tab bar on touch (`components/app-banner`,
 * `components/tab-bar`). Nothing here is invented: if it looks different from
 * the customer web, the copy has drifted and it has to be brought back.
 *
 * Two deliberate changes, both marked in the stylesheet:
 *  - the media queries became container queries, so the layout breaks at the
 *    width of the FRAME (1280 / 834 / 390) and not at the width of the panel;
 *  - every customer action calls `act`, which only says that this is a
 *    preview.
 */
@Component({
  selector: 'app-preview-web',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './preview-web.component.html',
  styleUrl: './preview-web.component.css',
})
export class PreviewWebComponent {
  @Input({ required: true }) vm!: PreviewVm;
  @Output() act = new EventEmitter<void>();

  readonly price = webPrice;
  readonly duration = longDuration;
  readonly stars = stars;

  readonly scheduleOpen = signal(false);
  readonly allPoliciesOpen = signal(false);

  /** `chargesCancellation()` of `bipsy.models.ts`. */
  get chargesCancellation(): boolean {
    const b = this.vm.business;
    return !!b.requiresCard && (b.cancellationFeePercent ?? 0) > 0;
  }

  get ratingDisplay(): string {
    return ratingValue(this.vm.score.value ?? 0);
  }

  get visiblePolicies(): PolicyGroup[] {
    return this.allPoliciesOpen() ? this.vm.policies : this.vm.previewPolicies;
  }

  serviceMeta(service: ServiceResponse): string {
    return longDuration(service.duration);
  }

  reviewAuthor(name: string | null): string {
    return name?.trim() || 'Cliente';
  }

  reviewInitial(name: string | null): string {
    return (name?.trim() || '?')[0].toUpperCase();
  }

  reviewDate(iso: string): string {
    return fromInstant(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  /**
   * A photo whose file is gone answers 404 and leaves the broken-image icon.
   * `onPortfolioError` drops it from the list in the customer web; here the
   * list is shared with the phone preview, so only this copy is hidden.
   */
  hideBroken(event: Event): void {
    (event.target as HTMLElement).style.display = 'none';
  }
}
