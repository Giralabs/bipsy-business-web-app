import { ChangeDetectionStrategy, Component, Input, booleanAttribute } from '@angular/core';
import { BipRigComponent } from '../bip-rig/bip-rig.component';
import { BIP_RIGS } from '../bip-rig/bip-rigs.data';
import { BipSlotComponent } from '../bip-slot/bip-slot.component';

/**
 * The page that is shown INSTEAD of content: not found, something broke, the
 * site is under maintenance. One component for the three so they read as the
 * same family — Mr. Bip on one side, a short explanation and a way out on the
 * other.
 *
 * It only paints. What to say and what the buttons do is up to whoever uses
 * it; the buttons are projected with the `actions` attribute and anything else
 * (a line of feedback under them) goes in as plain content.
 */
@Component({
  selector: 'app-status-page',
  standalone: true,
  imports: [BipRigComponent, BipSlotComponent],
  templateUrl: './status-page.component.html',
  styleUrl: './status-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatusPageComponent {
  /** Mr. Bip illustration (`public/mr_bip/<code>.webp`) and what he is doing in it. */
  @Input({ required: true }) bip!: string;
  @Input({ required: true }) pose!: string;

  /**
   * The animated cut-up of `bip`, when there is one; otherwise the flat render
   * is shown. Same rule as the access pages: a code gets its animation here
   * the moment `scripts/build-bip-rigs.mjs` learns to cut it.
   */
  get rig(): string | null {
    const name = this.bip.toLowerCase();
    return BIP_RIGS[name] ? name : null;
  }

  /** Material symbol of the eyebrow. */
  @Input() icon = 'info';
  @Input({ required: true }) eyebrow!: string;
  @Input({ required: true }) heading!: string;
  @Input({ required: true }) lead!: string;

  /** A message written by a person (the admin's note during maintenance). */
  @Input() message: string | null = null;

  /** A quiet closing line under the buttons. */
  @Input() note = '';

  /**
   * True when the page is alone on screen, without the site header and footer:
   * it fills the window and carries the brand itself.
   */
  @Input({ transform: booleanAttribute }) standalone = false;
}
