import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PageHeroComponent } from '../../components/page-hero/page-hero.component';
import { FaqListComponent } from '../../components/faq-list/faq-list.component';
import { BipRigComponent } from '../../components/bip-rig/bip-rig.component';
import { RevealDirective } from '../../shared/reveal.directive';
import { FaqGroup, HELP_FAQ } from '../../data/faq.data';
import { SUPPORT_RESPONSE_TIME } from '../../data/site.data';
import { LEGAL_COMPANY } from '../../data/legal/legal.models';

/**
 * Help center. The search filters the questions already on the page: it is a
 * shortcut to read less, not a real search engine, so it needs nothing from a
 * server.
 */
@Component({
  selector: 'app-help',
  standalone: true,
  imports: [RouterLink, PageHeroComponent, FaqListComponent, BipRigComponent, RevealDirective],
  templateUrl: './help.component.html',
  styleUrl: './help.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HelpComponent {
  readonly groups = HELP_FAQ;
  readonly email = LEGAL_COMPANY.email;
  readonly responseTime = SUPPORT_RESPONSE_TIME;

  query = '';

  get filtered(): FaqGroup[] {
    const q = this.normalize(this.query.trim());
    if (!q) return this.groups;
    return this.groups
      .map((g) => ({ ...g, items: g.items.filter((i) => this.normalize(`${i.q} ${i.a}`).includes(q)) }))
      .filter((g) => g.items.length > 0);
  }

  onSearch(event: Event): void {
    this.query = (event.target as HTMLInputElement).value;
  }

  // Accent-insensitive: "cancelacion" has to find "cancelación".
  private normalize(text: string): string {
    return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  }
}
