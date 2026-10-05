import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Input,
  NgZone,
  OnDestroy,
} from '@angular/core';
import { BIP_RIGS, BIP_RIG_VERSION, BipRig } from './bip-rigs.data';

/**
 * A Mr. Bip render, cut into layers and animated.
 *
 * **Why layers and not a video or a frame sequence.** These are still renders
 * and there is no 3D model of the mascot to re-render from, so the movement
 * has to come out of the pictures. `scripts/build-bip-rigs.mjs` cuts each one
 * into head, body and arms, reconstructs whatever a moving layer was sitting
 * on so it has something to move over, and the layers are then turned against
 * each other with CSS transforms. That is about 90 kB a rig and it animates on
 * the compositor, where a frame sequence of the same movement would be a
 * couple of megabytes in the page's critical path.
 *
 * Each arm turns on its own shoulder, so the hands travel while the shoulders
 * stay put. At rest the layers reproduce the original render pixel for pixel;
 * the generator's `--check` measures it.
 *
 * `rig` picks both the folder under `public/mr_bip/rig/` and the set of
 * keyframes in the stylesheet: `mb-00` pulls his tie straight, `mb-03` ticks
 * off a checklist, `mb-05` opens his arms. Geometry lives in
 * `bip-rigs.data.ts`, movement in `bip-rig.component.css`.
 *
 * Playback stops when the picture scrolls out of view, and
 * `prefers-reduced-motion` leaves Mr. Bip standing still.
 */
@Component({
  selector: 'app-bip-rig',
  standalone: true,
  templateUrl: './bip-rig.component.html',
  styleUrl: './bip-rig.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BipRigComponent implements AfterViewInit, OnDestroy {
  @Input({ required: true })
  set rig(name: string) {
    const found = BIP_RIGS[name];
    if (!found) throw new Error(`[bip-rig] unknown rig "${name}"`);
    this.def = found;
  }

  /** Overrides the rig's own description, when the context needs a different one. */
  @Input() label = '';

  /**
   * `high` for the hero, which is the page's largest contentful paint; the
   * illustrations further down the page stay out of its way.
   */
  @Input() priority: 'high' | 'auto' = 'auto';

  def!: BipRig;

  private observer?: IntersectionObserver;

  constructor(
    private readonly host: ElementRef<HTMLElement>,
    private readonly zone: NgZone,
  ) {}

  src(file: string): string {
    return `mr_bip/rig/${this.def.name}/${file}.webp?v=${BIP_RIG_VERSION}`;
  }

  ngAfterViewInit(): void {
    if (typeof IntersectionObserver === 'undefined') return;
    // Outside Angular: this only toggles a class, and running change detection
    // on every scroll past the picture would be wasted work.
    this.zone.runOutsideAngular(() => {
      this.observer = new IntersectionObserver(([entry]) => {
        this.host.nativeElement.classList.toggle('rig--paused', !entry.isIntersecting);
      });
      this.observer.observe(this.host.nativeElement);
    });
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }
}
