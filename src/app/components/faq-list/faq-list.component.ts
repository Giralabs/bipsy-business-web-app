import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { FaqItem } from '../../data/faq.data';

/**
 * Accordion of questions. One open at a time: several long answers open at
 * once turn the list back into a wall of text, which is what it replaces.
 *
 * The height animates with `grid-template-rows: 0fr → 1fr`, which animates to
 * the real height of the answer without measuring it in JavaScript.
 */
@Component({
  selector: 'app-faq-list',
  standalone: true,
  templateUrl: './faq-list.component.html',
  styleUrl: './faq-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FaqListComponent {
  @Input({ required: true }) items: FaqItem[] = [];

  /** Prefix for the element ids, so two lists on one page do not collide. */
  @Input() idPrefix = 'faq';

  openIndex: number | null = 0;

  toggle(index: number): void {
    this.openIndex = this.openIndex === index ? null : index;
  }
}
