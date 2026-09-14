import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PageHeroComponent } from '../../components/page-hero/page-hero.component';
import { PlanCardComponent } from '../../components/plan-card/plan-card.component';
import { FaqListComponent } from '../../components/faq-list/faq-list.component';
import { BipSlotComponent } from '../../components/bip-slot/bip-slot.component';
import { CtaBandComponent } from '../../components/cta-band/cta-band.component';
import { RevealDirective } from '../../shared/reveal.directive';
import { COMPARISON, PLANS, PRICING_NOTES } from '../../data/plans.data';
import { FaqItem, HELP_FAQ, HOME_FAQ } from '../../data/faq.data';
import { TRIAL_DAYS } from '../../data/site.data';

/**
 * Pricing page.
 *
 * ⚠️ Touches money: before changing a number here read docs/RELEASE-STORES.md.
 * The price charged is the store's, the trial must exist as an introductory
 * offer in both consoles, and the backend must grant the same days.
 */
@Component({
  selector: 'app-pricing',
  standalone: true,
  imports: [RouterLink, PageHeroComponent, PlanCardComponent, FaqListComponent, BipSlotComponent, CtaBandComponent, RevealDirective],
  templateUrl: './pricing.component.html',
  styleUrl: './pricing.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PricingComponent {
  readonly plans = PLANS;
  readonly comparison = COMPARISON;
  readonly notes = PRICING_NOTES;
  readonly trialDays = TRIAL_DAYS;

  readonly faq: FaqItem[] = [
    ...HOME_FAQ.filter((q) => /trabajador|comisión/i.test(q.q)),
    ...(HELP_FAQ.find((g) => g.id === 'plan')?.items ?? []),
  ];

  isText(value: boolean | string): value is string {
    return typeof value === 'string';
  }
}
