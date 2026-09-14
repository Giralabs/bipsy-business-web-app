import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

export interface Crumb {
  label: string;
  link?: string;
}

/**
 * Opening block of every inner page: breadcrumbs, eyebrow, title, lead and
 * two projection slots — `[actions]` under the text and `[art]` on the right.
 * One component so every page opens with the same rhythm as the home hero.
 */
@Component({
  selector: 'app-page-hero',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './page-hero.component.html',
  styleUrl: './page-hero.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageHeroComponent {
  @Input() eyebrow = '';
  @Input() icon = 'auto_awesome';
  @Input({ required: true }) title!: string;
  @Input() lead = '';
  @Input() crumbs: Crumb[] = [];

  /** Two columns, with the `[art]` slot on the right. */
  @Input() split = false;
}
