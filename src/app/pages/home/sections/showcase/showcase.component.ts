import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PhoneComponent } from '../../../../components/phone/phone.component';
import { RevealDirective } from '../../../../shared/reveal.directive';
import { Feature, ScreenId, featureBySlug } from '../../../../data/features.data';

interface ShowcaseTab {
  label: string;
  icon: string;
  screen: ScreenId;
  feature: Feature;
}

const TABS: Array<{ label: string; icon: string; screen: ScreenId; slug: string }> = [
  { label: 'Agenda', icon: 'calendar_month', screen: 'agenda', slug: 'agenda-y-reservas-online' },
  { label: 'Clientes', icon: 'contacts', screen: 'clientes', slug: 'agenda-de-clientes' },
  { label: 'Finanzas', icon: 'account_balance_wallet', screen: 'finanzas', slug: 'finanzas' },
  { label: 'Equipo', icon: 'groups', screen: 'equipo', slug: 'gestion-de-equipo' },
  { label: 'Tu ficha', icon: 'storefront', screen: 'ficha', slug: 'ficha-en-bipsy' },
  { label: 'Lista de espera', icon: 'hourglass_top', screen: 'espera', slug: 'lista-de-espera' },
];

/**
 * "The whole business in your pocket": a tab per area of the app with the
 * phone showing that screen and the story next to it.
 *
 * The tabs advance on their own. The progress bar of the active tab IS the
 * timer: its `animationend` moves to the next tab, so pausing the animation
 * on hover pauses the carousel with no second clock that could drift from
 * what the bar shows.
 */
@Component({
  selector: 'app-home-showcase',
  standalone: true,
  imports: [RouterLink, PhoneComponent, RevealDirective],
  templateUrl: './showcase.component.html',
  styleUrl: './showcase.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShowcaseSectionComponent {
  readonly tabs: ShowcaseTab[] = TABS.flatMap((t) => {
    const feature = featureBySlug(t.slug);
    return feature ? [{ label: t.label, icon: t.icon, screen: t.screen, feature }] : [];
  });

  active = 0;
  paused = false;

  /** With reduced motion the bar would end instantly and spin the carousel. */
  readonly autoplay =
    typeof window !== 'undefined' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  get current(): ShowcaseTab {
    return this.tabs[this.active];
  }

  select(index: number): void {
    this.active = index;
  }

  next(): void {
    this.active = (this.active + 1) % this.tabs.length;
  }
}
