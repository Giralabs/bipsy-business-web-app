import { ChangeDetectionStrategy, Component, Input, inject } from '@angular/core';
import { SiteSession } from '../../shared/site-session.service';
import { RouterLink } from '@angular/router';
import { Plan } from '../../data/plans.data';
import { TRIAL_LABEL } from '../../data/site.data';

/**
 * A plan, drawn like `_PlanCard` of the app's plan selection screen: the
 * plan's diamond and name with its pill, the price in the accent colour, the
 * free month pill in green and the feature list with filled check icons.
 *
 * The recommended plan gets an animated border, only to point at it.
 */
@Component({
  selector: 'app-plan-card',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './plan-card.component.html',
  styleUrl: './plan-card.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlanCardComponent {
  /** Signed in: the call to action goes to the panel, not to sign-up. */
  readonly session = inject(SiteSession);
  @Input({ required: true }) plan!: Plan;

  /** Shows the full feature list; the home teaser only needs the first few. */
  @Input() maxFeatures = 99;

  readonly trialLabel = TRIAL_LABEL;

  get euros(): string {
    return this.plan.price.split(',')[0];
  }

  get cents(): string {
    return this.plan.price.split(',')[1] ?? '00';
  }
}
