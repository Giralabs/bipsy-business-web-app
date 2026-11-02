import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SetupStep } from '../core/data/setup.store';

/**
 * The rows of `setup_guide_sheet.dart`: each step leads to where it is done, and
 * what is done stays crossed out. No descriptions: the title already says what
 * to do, and a list like this is read at a glance.
 */
@Component({
  selector: 'pn-setup-steps',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (step of steps; track step.id) {
      <a class="pn-row" [routerLink]="step.route" [attr.aria-label]="step.title + (step.done ? ', hecho' : '')" (click)="opened.emit()">
        <span class="material-symbols-rounded pn-row__icon" [class.step--done]="step.done">{{ step.done ? 'check' : step.icon }}</span>
        <span class="pn-row__main">
          <span class="pn-row__title" [class.step__title--done]="step.done">{{ step.title }}</span>
        </span>
        <span class="material-symbols-rounded pn-row__chev">arrow_forward_ios</span>
      </a>
    }
  `,
  styles: [
    `
      :host { display: block; }
      .step--done { color: var(--clr-success); }
      .step__title--done { color: var(--clr-text-2); text-decoration: line-through; }
    `,
  ],
})
export class PnSetupStepsComponent {
  @Input({ required: true }) steps: SetupStep[] = [];
  @Output() opened = new EventEmitter<void>();
}
