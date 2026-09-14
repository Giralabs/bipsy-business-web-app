import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { Router, RouterLink } from '@angular/router';
import { PageHeroComponent } from '../../components/page-hero/page-hero.component';
import { PhoneComponent } from '../../components/phone/phone.component';
import { BipSlotComponent } from '../../components/bip-slot/bip-slot.component';
import { CtaBandComponent } from '../../components/cta-band/cta-band.component';
import { RevealDirective } from '../../shared/reveal.directive';
import { TiltDirective } from '../../shared/tilt.directive';
import { Feature, FeatureGroup, featureBySlug, featuresOf, groupOf } from '../../data/features.data';

/** One feature in depth. The slug comes from the route as an input. */
@Component({
  selector: 'app-feature-detail',
  standalone: true,
  imports: [RouterLink, PageHeroComponent, PhoneComponent, BipSlotComponent, CtaBandComponent, RevealDirective, TiltDirective],
  templateUrl: './feature-detail.component.html',
  styleUrl: './feature-detail.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeatureDetailComponent {
  feature?: Feature;
  group?: FeatureGroup;
  related: Feature[] = [];

  constructor(
    private readonly title: Title,
    private readonly router: Router,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  // A setter and not ngOnInit: navigating from one feature to another reuses
  // the component, and only the input changes.
  @Input()
  set slug(value: string) {
    const feature = featureBySlug(value);
    if (!feature) {
      void this.router.navigate(['/funcionalidades']);
      return;
    }
    this.feature = feature;
    this.group = groupOf(feature.group);
    this.related = featuresOf(feature.group).filter((f) => f.slug !== feature.slug);
    this.title.setTitle(`${feature.name} · Bipsy Business`);
    this.cdr.markForCheck();
  }
}
