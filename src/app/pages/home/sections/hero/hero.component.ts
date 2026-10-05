import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
} from '@angular/core';
import { SiteSession } from '../../../../shared/site-session.service';
import { RouterLink } from '@angular/router';
import { FrameSequenceComponent } from '../../../../components/frame-sequence/frame-sequence.component';
import { BipRigComponent } from '../../../../components/bip-rig/bip-rig.component';
import { BUSINESS_TYPES } from '../../../../data/business-types.data';
import { STORE_LINKS, TRIAL_DAYS } from '../../../../data/site.data';

/**
 * The hero of the home page: the promise, the two buttons and, on the right,
 * Mr. Bip's Blender animation alone on the stage, with a little parallax.
 */
@Component({
  selector: 'app-home-hero',
  standalone: true,
  imports: [RouterLink, FrameSequenceComponent, BipRigComponent],
  templateUrl: './hero.component.html',
  styleUrl: './hero.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeroSectionComponent implements OnInit, OnDestroy {
  /** Signed in: the call to action goes to the panel, not to sign-up. */
  readonly session = inject(SiteSession);
  /** Short on purpose: the rotating line must fit the column at display size. */
  readonly words = ['tu barbería', 'tu peluquería', 'tu salón', 'tu estudio', 'tu clínica', 'tu negocio'];
  wordIndex = 0;

  readonly trialDays = TRIAL_DAYS;
  readonly stores = STORE_LINKS;
  /** Twice, so the marquee can loop without a visible seam. */
  readonly marquee = [...BUSINESS_TYPES, ...BUSINESS_TYPES];

  @ViewChild('visual', { static: true }) private visualRef!: ElementRef<HTMLElement>;

  private wordTimer?: ReturnType<typeof setInterval>;
  private removePointer?: () => void;

  constructor(
    private readonly zone: NgZone,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    this.wordTimer = setInterval(() => {
      this.wordIndex = (this.wordIndex + 1) % this.words.length;
      this.cdr.markForCheck();
    }, 2600);

    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    // Parallax of the stage. Outside Angular: it only writes two CSS
    // variables and must not run change detection on every pointer move.
    const el = this.visualRef.nativeElement;
    this.zone.runOutsideAngular(() => {
      let frame = 0;
      const onMove = (event: PointerEvent): void => {
        const rect = el.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
        const y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
          el.style.setProperty('--px', x.toFixed(3));
          el.style.setProperty('--py', y.toFixed(3));
        });
      };
      const onLeave = (): void => {
        el.style.setProperty('--px', '0');
        el.style.setProperty('--py', '0');
      };
      window.addEventListener('pointermove', onMove, { passive: true });
      el.addEventListener('pointerleave', onLeave);
      this.removePointer = () => {
        window.removeEventListener('pointermove', onMove);
        el.removeEventListener('pointerleave', onLeave);
      };
    });
  }

  ngOnDestroy(): void {
    clearInterval(this.wordTimer);
    this.removePointer?.();
  }
}
