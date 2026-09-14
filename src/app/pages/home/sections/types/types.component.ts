import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RevealDirective } from '../../../../shared/reveal.directive';
import { TiltDirective } from '../../../../shared/tilt.directive';
import { BUSINESS_TYPES } from '../../../../data/business-types.data';

/** Trades grid of the home page: the eight most common, then a link to all. */
@Component({
  selector: 'app-home-types',
  standalone: true,
  imports: [RouterLink, RevealDirective, TiltDirective],
  templateUrl: './types.component.html',
  styleUrl: './types.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TypesSectionComponent {
  readonly types = BUSINESS_TYPES.slice(0, 8);
  readonly total = BUSINESS_TYPES.length;
}
