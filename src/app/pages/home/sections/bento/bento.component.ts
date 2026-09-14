import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RevealDirective } from '../../../../shared/reveal.directive';
import { TiltDirective } from '../../../../shared/tilt.directive';

/**
 * Feature grid of the home page. Each tile has its own small animation that
 * says what the feature does before the text does: slots filling up, a queue
 * moving forward, a chart growing.
 */
@Component({
  selector: 'app-home-bento',
  standalone: true,
  imports: [RouterLink, RevealDirective, TiltDirective],
  templateUrl: './bento.component.html',
  styleUrl: './bento.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BentoSectionComponent {
  readonly slots = ['09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '16:30', '17:00', '17:30', '18:00'];
  readonly bars = [40, 62, 48, 74, 58, 88, 70];
}
