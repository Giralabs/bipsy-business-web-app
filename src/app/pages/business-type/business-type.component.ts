import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { Router, RouterLink } from '@angular/router';
import { PageHeroComponent } from '../../components/page-hero/page-hero.component';
import { PhoneComponent } from '../../components/phone/phone.component';
import { BipSlotComponent } from '../../components/bip-slot/bip-slot.component';
import { CtaBandComponent } from '../../components/cta-band/cta-band.component';
import { RevealDirective } from '../../shared/reveal.directive';
import { TiltDirective } from '../../shared/tilt.directive';
import { BUSINESS_TYPES, BusinessType, businessTypeBySlug } from '../../data/business-types.data';
import { FEATURES, Feature } from '../../data/features.data';

/** Demo business names for the phone of each trade page. */
const DEMO_NAMES: Record<string, string> = {
  HAIRDRESSER: 'Peluquería Luna',
  BARBER: 'Barbería Nómada',
  ESTHETIC: 'Estética Alba',
  NAILS: 'Nails Studio',
  MAKEUP: 'Estudio Rubor',
  TATTOO: 'Tinta Negra',
  EYEBROWS: 'Lash & Brow',
  LASER: 'Láser Centro',
  MASSAGE: 'Masajes Calma',
  PILATES: 'Estudio Core',
  PHYSIO: 'Fisio Activa',
  PERSONAL_TRAINER: 'Coach Fit',
  NUTRITION: 'Nutri Verde',
  COACHING: 'Mente Clara',
  PHOTOGRAPHY: 'Estudio Foco',
  TUTORING: 'Academia Aula',
};

@Component({
  selector: 'app-business-type',
  standalone: true,
  imports: [RouterLink, PageHeroComponent, PhoneComponent, BipSlotComponent, CtaBandComponent, RevealDirective, TiltDirective],
  templateUrl: './business-type.component.html',
  styleUrl: './business-type.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BusinessTypeComponent {
  type?: BusinessType;
  features: Feature[] = [];
  others: BusinessType[] = [];
  demoName = '';

  constructor(
    private readonly title: Title,
    private readonly router: Router,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  @Input()
  set slug(value: string) {
    const type = businessTypeBySlug(value);
    if (!type) {
      void this.router.navigate(['/negocios']);
      return;
    }
    this.type = type;
    this.demoName = DEMO_NAMES[type.code] ?? 'Tu negocio';
    this.features = type.highlights.flatMap((slug) => FEATURES.filter((f) => f.slug === slug));
    this.others = BUSINESS_TYPES.filter((t) => t.slug !== type.slug);
    this.title.setTitle(`Bipsy Business para ${type.name.toLowerCase()}`);
    this.cdr.markForCheck();
  }

  duration(minutes: number): string {
    if (minutes < 60) return `${minutes} min`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m === 0 ? `${h} h` : `${h} h ${m} min`;
  }
}
