import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input } from '@angular/core';

/**
 * Spot for a Mr. Bip illustration.
 *
 * Every slot carries a `code` (MB-01, MB-02…) that matches the design list in
 * `docs/BUSINESS-WEB.md`. The component first tries `public/mr_bip/<code>.webp`:
 * **dropping the finished artwork there with that name is all it takes to
 * publish it**, no code change. Until the file exists the image fails to load
 * and the placeholder is shown instead, with the pose written on it.
 *
 * `phone` marks the illustrations where Mr. Bip holds a phone showing a real
 * screenshot of the app; `solo` is the mascot on its own.
 */
@Component({
  selector: 'app-bip-slot',
  standalone: true,
  templateUrl: './bip-slot.component.html',
  styleUrl: './bip-slot.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BipSlotComponent {
  @Input({ required: true }) code!: string;

  /** What Mr. Bip is doing, in a few words. Also the alt text of the artwork. */
  @Input({ required: true }) pose!: string;

  @Input() variant: 'solo' | 'phone' = 'solo';

  /** Screenshot that goes on the phone, when `variant` is `phone`. */
  @Input() screen = '';

  /** CSS aspect ratio of the final artwork. */
  @Input() ratio = '4 / 5';

  /** `client` is Bip with the hoodie (Bipsy app); `business` is Mr. Bip in a suit. */
  @Input() mascot: 'business' | 'client' = 'business';

  /** Hides the caption and keeps only the silhouette, for small slots. */
  @Input() compact = false;

  /** False once the artwork file has failed to load. */
  hasArtwork = true;

  constructor(private readonly cdr: ChangeDetectorRef) {}

  get artworkSrc(): string {
    return `mr_bip/${this.code}.webp`;
  }

  get mascotName(): string {
    return this.mascot === 'client' ? 'Bip' : 'Mr. Bip';
  }

  onArtworkError(): void {
    this.hasArtwork = false;
    this.cdr.markForCheck();
  }
}
