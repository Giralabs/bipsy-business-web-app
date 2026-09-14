import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PageHeroComponent } from '../../components/page-hero/page-hero.component';
import { BipSlotComponent } from '../../components/bip-slot/bip-slot.component';
import { CtaBandComponent } from '../../components/cta-band/cta-band.component';
import { RevealDirective } from '../../shared/reveal.directive';
import { TiltDirective } from '../../shared/tilt.directive';
import { BUSINESS_TYPES } from '../../data/business-types.data';

@Component({
  selector: 'app-business-types',
  standalone: true,
  imports: [RouterLink, PageHeroComponent, BipSlotComponent, CtaBandComponent, RevealDirective, TiltDirective],
  templateUrl: './business-types.component.html',
  styleUrl: './business-types.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BusinessTypesComponent {
  readonly types = BUSINESS_TYPES;
}
