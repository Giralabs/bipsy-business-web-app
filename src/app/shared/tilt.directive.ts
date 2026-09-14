import { Directive, ElementRef, Input, NgZone, OnDestroy, OnInit } from '@angular/core';

/**
 * Tilts an element towards the pointer and exposes the pointer position as
 * `--mx` / `--my` (0–100 %) so the CSS can paint a light that follows it.
 *
 * Only on devices with a real pointer: on touch there is no hover, and a card
 * that jumps on tap looks broken. With `prefers-reduced-motion` it does nothing.
 */
@Directive({
  selector: '[appTilt]',
  standalone: true,
})
export class TiltDirective implements OnInit, OnDestroy {
  /** Maximum rotation in degrees. Keep it small: past 8° text gets hard to read. */
  @Input() tiltMax = 6;

  private frame = 0;
  private readonly cleanups: Array<() => void> = [];

  constructor(
    private readonly host: ElementRef<HTMLElement>,
    private readonly zone: NgZone,
  ) {}

  ngOnInit(): void {
    if (typeof window === 'undefined') return;
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!finePointer || reduced) return;

    const el = this.host.nativeElement;

    this.zone.runOutsideAngular(() => {
      const onMove = (event: PointerEvent): void => {
        const rect = el.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width;
        const y = (event.clientY - rect.top) / rect.height;
        cancelAnimationFrame(this.frame);
        this.frame = requestAnimationFrame(() => {
          el.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`);
          el.style.setProperty('--my', `${(y * 100).toFixed(1)}%`);
          el.style.transform =
            `perspective(900px) rotateX(${((0.5 - y) * this.tiltMax).toFixed(2)}deg) ` +
            `rotateY(${((x - 0.5) * this.tiltMax).toFixed(2)}deg)`;
        });
      };
      const onLeave = (): void => {
        cancelAnimationFrame(this.frame);
        el.style.transform = '';
      };

      el.addEventListener('pointermove', onMove);
      el.addEventListener('pointerleave', onLeave);
      this.cleanups.push(
        () => el.removeEventListener('pointermove', onMove),
        () => el.removeEventListener('pointerleave', onLeave),
      );
    });
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.frame);
    this.cleanups.forEach((fn) => fn());
  }
}
