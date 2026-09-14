import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BipSlotComponent } from '../bip-slot/bip-slot.component';
import { RevealDirective } from '../../shared/reveal.directive';
import { STORE_LINKS, TRIAL_DAYS } from '../../data/site.data';

/**
 * The closing call to action that ends most pages: headline, the two buttons
 * and Mr. Bip inviting to try. Same block everywhere so the offer reads the
 * same wherever the visitor decides.
 */
@Component({
  selector: 'app-cta-band',
  standalone: true,
  imports: [RouterLink, BipSlotComponent, RevealDirective],
  templateUrl: './cta-band.component.html',
  styleUrl: './cta-band.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CtaBandComponent {
  @Input() title = 'Empieza hoy. Los primeros 30 días corren de nuestra cuenta.';
  @Input() text = 'Date de alta en cinco pasos, añade a tu equipo gratis y recibe tu primera reserva esta misma semana.';

  readonly trialDays = TRIAL_DAYS;
  readonly stores = STORE_LINKS;
}
