import { Directive, ElementRef, Input, NgZone, OnDestroy, OnInit, Renderer2 } from '@angular/core';

/**
 * Shows an element with an entrance animation the first time it enters the
 * viewport.
 *
 * The animation itself lives in `styles.css` (`[appReveal]` / `.is-revealed`)
 * so every section shares the same curve and distance. This directive only
 * decides WHEN: it adds the class once and stops observing, because replaying
 * the entrance every time you scroll back up reads as a glitch, not as motion.
 *
 * With `prefers-reduced-motion` the CSS drops the transform and the element
 * simply fades in.
 */
@Directive({
  selector: '[appReveal]',
  standalone: true,
})
export class RevealDirective implements OnInit, OnDestroy {
  /** Delay in milliseconds, for staggering items of the same row. */
  @Input() revealDelay = 0;

  /** Entrance direction. `up` is the default; `left`/`right` suit split rows. */
  @Input() revealFrom: 'up' | 'left' | 'right' | 'scale' = 'up';

  private observer?: IntersectionObserver;

  constructor(
    private readonly host: ElementRef<HTMLElement>,
    private readonly renderer: Renderer2,
    private readonly zone: NgZone,
  ) {}

  ngOnInit(): void {
    const el = this.host.nativeElement;
    this.renderer.setAttribute(el, 'data-reveal', this.revealFrom);
    if (this.revealDelay > 0) {
      this.renderer.setStyle(el, '--reveal-delay', `${this.revealDelay}ms`, 2);
    }

    // Old browsers without IntersectionObserver: show everything right away
    // instead of leaving the page blank.
    if (typeof IntersectionObserver === 'undefined') {
      this.renderer.addClass(el, 'is-revealed');
      return;
    }

    // Outside Angular: an observer callback per section would otherwise
    // trigger change detection for the whole page while scrolling.
    this.zone.runOutsideAngular(() => {
      this.observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            this.renderer.addClass(el, 'is-revealed');
            this.observer?.disconnect();
          }
        },
        // Threshold 0 and not a ratio: an element taller than the screen never
        // reaches "12 % visible" and would stay hidden forever.
        { threshold: 0, rootMargin: '0px 0px -8% 0px' },
      );
      this.observer.observe(el);
    });
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }
}
