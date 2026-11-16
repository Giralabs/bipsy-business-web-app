import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  Input,
  OnDestroy,
  inject,
} from '@angular/core';

export interface StorySlide {
  src: string;
  alt: string;
}

/** Below this many px a pointer move is a tap, not a swipe. */
const SWIPE = 40;

/**
 * A carousel that behaves like an Instagram story: one bar per slide on top,
 * the active one fills while it is shown and its `animationend` moves on, so
 * pausing the bar (hover, or off screen) pauses the carousel with no second
 * clock. Tap the left or right half, swipe, or use the arrow keys.
 *
 * Made for the 4:5 posts of @bipsy_es (the App Store launch carousel), and
 * the same behaviour as the launch carousel on giralabs.es.
 */
@Component({
  selector: 'app-story-carousel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'region',
    'aria-roledescription': 'carrusel',
    '[attr.aria-label]': 'label',
    tabindex: '0',
    '[class.is-playing]': 'playing',
  },
  template: `
    <div class="sc">
      <div class="sc__track" [style.transform]="'translateX(' + -index * 100 + '%)'">
        @for (slide of slides; track slide.src; let i = $index) {
          <figure class="sc__slide" aria-roledescription="lámina" [attr.aria-label]="i + 1 + ' de ' + slides.length">
            <img [src]="slide.src" [alt]="slide.alt" width="1080" height="1350" draggable="false"
                 [attr.loading]="i === 0 ? 'eager' : 'lazy'" decoding="async" />
          </figure>
        }
      </div>

      <div class="sc__bars" aria-hidden="true">
        @for (slide of slides; track slide.src; let i = $index) {
          <span class="sc__bar" [class.is-done]="i < index" [class.is-active]="i === index">
            @if (i === index) {
              <!-- Re-created on every change, which restarts the fill -->
              @for (k of [run]; track k) {
                <i (animationend)="go(index + 1)"></i>
              }
            } @else {
              <i></i>
            }
          </span>
        }
      </div>

      <button type="button" class="sc__hit sc__hit--prev" aria-label="Lámina anterior" (click)="tap(-1)"></button>
      <button type="button" class="sc__hit sc__hit--next" aria-label="Lámina siguiente" (click)="tap(1)"></button>
    </div>
  `,
  styles: [
    `
      :host { display: block; position: relative; outline: none; user-select: none; -webkit-user-select: none; }
      :host(:focus-visible) .sc { box-shadow: 0 0 0 3px var(--clr-accent); }

      .sc {
        position: relative;
        overflow: hidden;
        aspect-ratio: 4 / 5;
        border-radius: var(--r-xl, 24px);
        background: #2e343b;
        /* The slides are carbon: a thin rim keeps them apart from a dark page */
        box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.12), 0 24px 60px rgba(0, 0, 0, 0.28);
        touch-action: pan-y;
      }

      .sc__track { display: flex; height: 100%; transition: transform 0.7s cubic-bezier(0.65, 0, 0.25, 1); }
      .sc__slide { flex: 0 0 100%; height: 100%; margin: 0; }
      .sc__slide img { display: block; width: 100%; height: 100%; object-fit: cover; pointer-events: none; }

      .sc__bars { position: absolute; top: 12px; left: 14px; right: 14px; display: flex; gap: 5px; pointer-events: none; }
      .sc__bar { flex: 1; height: 3px; border-radius: 2px; overflow: hidden; background: rgba(255, 255, 255, 0.28); }
      .sc__bar i { display: block; height: 100%; background: rgba(255, 255, 255, 0.95); transform: scaleX(0); transform-origin: left; }
      .sc__bar.is-done i { transform: none; }
      .sc__bar.is-active i { animation: sc-fill 5200ms linear forwards; animation-play-state: paused; }
      :host(.is-playing) .sc__bar.is-active i { animation-play-state: running; }
      :host(.is-playing:hover) .sc__bar.is-active i { animation-play-state: paused; }
      @keyframes sc-fill { from { transform: scaleX(0); } to { transform: scaleX(1); } }

      .sc__hit { position: absolute; top: 0; bottom: 0; width: 50%; padding: 0; border: 0; background: transparent; }
      .sc__hit--prev { left: 0; cursor: w-resize; }
      .sc__hit--next { right: 0; cursor: e-resize; }
      .sc__hit:focus-visible { outline: 2px solid rgba(255, 255, 255, 0.8); outline-offset: -6px; border-radius: 18px; }

      @media (prefers-reduced-motion: reduce) {
        .sc__track { transition: none; }
        .sc__bar.is-active i { animation: none; transform: none; }
      }
    `,
  ],
})
export class StoryCarouselComponent implements AfterViewInit, OnDestroy {
  @Input({ required: true }) slides: StorySlide[] = [];
  @Input() label = 'Carrusel';

  index = 0;
  /** Bumped on every change so the active bar is re-created and refills. */
  run = 0;
  playing = false;

  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly cdr = inject(ChangeDetectorRef);
  private observer?: IntersectionObserver;
  private startX: number | null = null;
  private swiped = false;

  ngAfterViewInit(): void {
    if (typeof IntersectionObserver === 'undefined') return;
    // Plays only while on screen
    this.observer = new IntersectionObserver(
      ([entry]) => {
        this.playing = entry.isIntersecting;
        this.cdr.markForCheck();
      },
      { threshold: 0.4 },
    );
    this.observer.observe(this.host.nativeElement);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }

  go(next: number): void {
    const count = this.slides.length;
    if (!count) return;
    this.index = (next + count) % count;
    this.run++;
    this.cdr.markForCheck();
  }

  /** A swipe ends on one of the halves: that click must not move again. */
  tap(step: number): void {
    if (this.swiped) {
      this.swiped = false;
      return;
    }
    this.go(this.index + step);
  }

  @HostListener('keydown', ['$event'])
  onKey(e: KeyboardEvent): void {
    if (e.key === 'ArrowRight') this.go(this.index + 1);
    if (e.key === 'ArrowLeft') this.go(this.index - 1);
  }

  @HostListener('pointerdown', ['$event'])
  onDown(e: PointerEvent): void {
    this.startX = e.clientX;
  }

  @HostListener('pointerup', ['$event'])
  onUp(e: PointerEvent): void {
    if (this.startX === null) return;
    const dx = e.clientX - this.startX;
    this.startX = null;
    if (Math.abs(dx) > SWIPE) {
      this.swiped = true;
      this.go(this.index + (dx < 0 ? 1 : -1));
    }
  }
}
