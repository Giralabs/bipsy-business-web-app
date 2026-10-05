import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { SiteSession } from '../../shared/site-session.service';
import { RouterLink } from '@angular/router';
import { PageHeroComponent } from '../../components/page-hero/page-hero.component';
import { BipSlotComponent } from '../../components/bip-slot/bip-slot.component';
import { CtaBandComponent } from '../../components/cta-band/cta-band.component';
import { RevealDirective } from '../../shared/reveal.directive';
import { TiltDirective } from '../../shared/tilt.directive';
import { FEATURE_GROUPS, FEATURES, Feature, FeatureGroup, featuresOf } from '../../data/features.data';

/** All the features, grouped by what the business wants to get done. */
@Component({
  selector: 'app-features',
  standalone: true,
  imports: [RouterLink, PageHeroComponent, BipSlotComponent, CtaBandComponent, RevealDirective, TiltDirective],
  templateUrl: './features.component.html',
  styleUrl: './features.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeaturesComponent {
  /** Signed in: the call to action goes to the panel, not to sign-up. */
  readonly session = inject(SiteSession);
  readonly groups: Array<FeatureGroup & { items: Feature[] }> = FEATURE_GROUPS.map((g) => ({
    ...g,
    items: featuresOf(g.id),
  }));
  readonly total = FEATURES.length;
}
