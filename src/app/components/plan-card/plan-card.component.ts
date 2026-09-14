import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Plan } from '../../data/plans.data';
import { TRIAL_DAYS } from '../../data/site.data';

/**
 * A plan, drawn like `_PlanCard` of the app's plan selection screen: name with
 * its pill, the price in the accent colour, the trial pill in green and the
 * feature list with filled check icons.
 *
 * The recommended plan gets the animated border of Quality's «Borde animado»
 * card effect: the plan that sells effects shows one.
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
  @Input({ required: true }) plan!: Plan;

  /** Shows the full feature list; the home teaser only needs the first few. */
  @Input() maxFeatures = 99;

  readonly trialDays = TRIAL_DAYS;

  get euros(): string {
    return this.plan.price.split(',')[0];
  }

  get cents(): string {
    return this.plan.price.split(',')[1] ?? '00';
  }
}
