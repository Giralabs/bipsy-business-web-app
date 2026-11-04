import { Injectable, computed, inject } from '@angular/core';
import { Api } from '../api/api';
import { SubscriptionPlan } from '../api/models';
import { resource } from './resource';

/**
 * The plans on sale (`GET /subscriptions/plans`), shared by the plan wall,
 * Mi plan and the portfolio quota notice.
 *
 * Only `selectable` plans: the free plan is not sold, Bipsy grants it from
 * the admin panel.
 */
@Injectable({ providedIn: 'root' })
export class PlansStore {
  private readonly api = inject(Api);

  readonly catalogue = resource<SubscriptionPlan[]>(
    () => this.api.get<SubscriptionPlan[]>('/subscriptions/plans'),
    [],
  );

  readonly selectable = computed(() => this.catalogue.value().filter((plan) => plan.selectable));

  /** The biggest portfolio on sale, for «con Quality caben N». */
  readonly maxPortfolioLimit = computed(() =>
    Math.max(0, ...this.selectable().map((plan) => plan.portfolioLimit ?? 0)),
  );

  load(): Promise<void> {
    return this.catalogue.load();
  }
}
