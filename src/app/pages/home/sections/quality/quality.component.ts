import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PhoneComponent } from '../../../../components/phone/phone.component';
import { BipSlotComponent } from '../../../../components/bip-slot/bip-slot.component';
import { RevealDirective } from '../../../../shared/reveal.directive';
import { PLANS } from '../../../../data/plans.data';

/**
 * The Quality plan, sold the way Quality itself sells: by showing the effects
 * moving. The names are the real ones of `gipsi_branding_catalog.dart`.
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
  readonly price = PLANS.find((p) => p.code === 'QUALITY')?.price ?? '';

  readonly effects = [
    { name: 'Halo', kind: 'Marco de foto', fx: 'halo' },
    { name: 'Aurora', kind: 'Portada', fx: 'aurora' },
    { name: 'Borde luminoso', kind: 'En búsquedas', fx: 'border' },
    { name: 'Brillo', kind: 'Nombre', fx: 'shine' },
    { name: 'Chispas', kind: 'Portada', fx: 'sparks' },
    { name: 'Órbita', kind: 'Marco de foto', fx: 'orbit' },
  ];
}
