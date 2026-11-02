import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

/** Two branches of paired leaves, generated along arcs so both are symmetrical. */
const LAUREL_STEM =
  'M41.68,89.13 A40.0,40.0 0 0 1 18.48,25.37 M58.32,89.13 A40.0,40.0 0 0 0 81.52,25.37';
const LAUREL_LEAVES =
  'M26.94,82.69 Q28.20,74.51 21.48,69.69 Q20.22,77.86 26.94,82.69Z M26.94,82.69 Q20.15,77.97 12.86,81.90 Q19.66,86.61 26.94,82.69Z M15.93,70.96 Q20.02,64.39 16.02,57.76 Q11.93,64.33 15.93,70.96Z M15.93,70.96 Q11.82,64.40 4.11,65.09 Q8.22,71.65 15.93,70.96Z M10.43,55.84 Q16.35,51.72 15.35,44.57 Q9.43,48.70 10.43,55.84Z M10.43,55.84 Q9.32,48.72 2.46,46.48 Q3.57,53.60 10.43,55.84Z M11.33,39.78 Q17.88,38.43 19.64,31.98 Q13.09,33.33 11.33,39.78Z M11.33,39.78 Q12.98,33.30 7.96,28.89 Q6.30,35.37 11.33,39.78Z M18.48,25.37 Q24.51,26.60 28.35,21.78 Q22.31,20.55 18.48,25.37Z M18.48,25.37 Q22.23,20.49 19.58,14.93 Q15.83,19.82 18.48,25.37Z M18.48,25.37 Q24.86,23.38 25.25,16.71 Q18.87,18.70 18.48,25.37Z M73.06,82.69 Q80.34,86.61 87.14,81.90 Q79.85,77.97 73.06,82.69Z M73.06,82.69 Q79.78,77.86 78.52,69.69 Q71.80,74.51 73.06,82.69Z M84.07,70.96 Q91.78,71.65 95.89,65.09 Q88.18,64.40 84.07,70.96Z M84.07,70.96 Q88.07,64.33 83.98,57.76 Q79.98,64.39 84.07,70.96Z M89.57,55.84 Q96.43,53.60 97.54,46.48 Q90.68,48.72 89.57,55.84Z M89.57,55.84 Q90.57,48.70 84.65,44.57 Q83.65,51.72 89.57,55.84Z M88.67,39.78 Q93.70,35.37 92.04,28.89 Q87.02,33.30 88.67,39.78Z M88.67,39.78 Q86.91,33.33 80.36,31.98 Q82.12,38.43 88.67,39.78Z M81.52,25.37 Q84.17,19.82 80.42,14.93 Q77.77,20.49 81.52,25.37Z M81.52,25.37 Q77.69,20.55 71.65,21.78 Q75.49,26.60 81.52,25.37Z M81.52,25.37 Q81.13,18.70 74.75,16.71 Q75.14,23.38 81.52,25.37Z';

/**
 * The plan's mark (`plan_mark.dart`): the business symbol the panel already
 * uses, and with Quality the symbol smaller inside a laurel wreath, in the grey
 * measured from those same files so both read as one piece. The trimmed files
 * have no air around the drawing, hence a smaller factor than the app's 0.78.
 */
@Component({
  selector: 'pn-plan-mark',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="mark" [class.mark--quality]="quality" [style.width.px]="size" [style.height.px]="size" aria-hidden="true">
      @if (quality) {
        <svg viewBox="0 0 100 100" class="mark__wreath">
          <path [attr.d]="stem" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" />
          <path [attr.d]="leaves" fill="currentColor" />
        </svg>
      }
      <img class="mark__symbol theme-dark-only" src="assets_bipsy_business/Brand Marks/apricot_dark_symbol_nobackground_trim.webp" alt="" />
      <img class="mark__symbol theme-light-only" src="assets_bipsy_business/Brand Marks/apricot_light_symbol_nobackground_trim.webp" alt="" />
    </span>
  `,
  styles: [
    `
      :host { display: inline-flex; flex: none; }
      .mark { position: relative; display: inline-grid; place-items: center; color: #6d7174; }
      @media (prefers-color-scheme: dark) {
        .mark { color: #99a7b4; }
      }
      .mark__wreath { position: absolute; inset: 0; width: 100%; height: 100%; }
      .mark__symbol { width: 100%; height: 100%; object-fit: contain; }
      .mark--quality .mark__symbol { width: 46%; height: 46%; }
    `,
  ],
})
export class PnPlanMarkComponent {
  @Input() quality = false;
  @Input() size = 28;

  readonly stem = LAUREL_STEM;
  readonly leaves = LAUREL_LEAVES;
}
