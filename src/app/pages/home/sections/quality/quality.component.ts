import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PhoneComponent } from '../../../../components/phone/phone.component';
import { BipSlotComponent } from '../../../../components/bip-slot/bip-slot.component';
import { RevealDirective } from '../../../../shared/reveal.directive';
import { PLANS } from '../../../../data/plans.data';

/**
 * The Quality plan as it sells since V128: the animated cover (shown moving,
 * with the aurora demo), priority in Destacados and the bigger portfolio. The
 * brand colours and the exclusive effects left the plan, so they are not here.
 */
@Component({
  selector: 'app-home-quality',
  standalone: true,
  imports: [RouterLink, PhoneComponent, BipSlotComponent, RevealDirective],
  templateUrl: './quality.component.html',
  styleUrl: './quality.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QualitySectionComponent {
  private readonly quality = PLANS.find((p) => p.code === 'QUALITY');
  readonly price = this.quality?.price ?? '';
  readonly photos = this.quality?.portfolioLimit ?? 0;
  readonly diamond = this.quality?.diamond ?? '';

  /** `fx` paints a moving demo; without it, the icon. */
  readonly perks = [
    { name: 'Portada animada', kind: 'Se mueve en la lista', fx: 'aurora', icon: '' },
    { name: 'Con prioridad', kind: 'En Destacados', fx: null, icon: 'campaign' },
    { name: `${this.photos} fotos`, kind: 'En tu portfolio', fx: null, icon: 'photo_library' },
  ];
}
