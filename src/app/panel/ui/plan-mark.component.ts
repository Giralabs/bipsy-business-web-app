import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { PLAN_CODES, diamondOf } from '../ajustes/plan-terms';

/**
 * The plan's mark: the diamond of the plan screens, silver for Bipsy Business
 * and green for Quality. One image per plan, the same in light and dark.
 */
@Component({
  selector: 'pn-plan-mark',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <img class="mark" [src]="src" alt="" aria-hidden="true" [style.width.px]="size" [style.height.px]="size" />
  `,
  styles: [
    `
      :host { display: inline-flex; flex: none; }
      .mark { object-fit: contain; }
    `,
  ],
})
export class PnPlanMarkComponent {
  @Input() quality = false;
  @Input() size = 28;

  get src(): string {
    return diamondOf(this.quality ? PLAN_CODES.QUALITY : PLAN_CODES.BIPSY);
  }
}
