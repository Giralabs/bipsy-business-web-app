import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  ViewChild,
  OnDestroy,
  effect,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { CoachService } from './coach.service';

interface Hole {
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * The dark veil with a hole in it, ported from `coach_overlay.dart`.
 *
 * The hole is not a mask: it is a transparent box with a 9999px shadow, which
 * is the one trick that keeps the cut-out crisp at any zoom and costs nothing
 * to animate. The veil swallows every click, so the only way forward is the
 * button — same as the app.
 *
 * If the target cannot be measured after a few tries (the page is still
 * routing), the step shows centred instead of disappearing.
 */
@Component({
  selector: 'app-coach-overlay',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (coach.step(); as step) {
      <div class="coach" role="dialog" aria-modal="true" [attr.aria-label]="step.title">
        @if (hole(); as box) {
          <div
            class="coach__hole"
            [style.top.px]="box.top"
            [style.left.px]="box.left"
            [style.width.px]="box.width"
            [style.height.px]="box.height"
          ></div>
        } @else {
          <div class="coach__veil"></div>
        }

        <article #card class="coach__card" [style.top.px]="cardTop()" [style.left.px]="cardLeft()">
          <span class="material-symbols-rounded coach__icon">{{ step.icon }}</span>
          <h2>{{ step.title }}</h2>
          <p>{{ step.body }}</p>

          <div class="coach__dots" aria-hidden="true">
            @for (dot of dots(); track $index) {
              <span [class.on]="$index === coach.index()"></span>
            }
          </div>

          @if (step.kind === 'invite') {
            <div class="coach__actions coach__actions--stack">
              <button type="button" class="pn-btn pn-btn--primary pn-btn--block" (click)="goImport()">
                Sí, traer mis clientes
              </button>
              <button type="button" class="pn-btn pn-btn--text pn-btn--block" (click)="coach.finish()">
                Ahora no
              </button>
            </div>
          } @else {
            <div class="coach__actions">
              <button type="button" class="pn-btn pn-btn--text pn-btn--sm" (click)="coach.skip()">Saltar</button>
              <button type="button" class="pn-btn pn-btn--primary pn-btn--sm" (click)="coach.next()">
                {{ coach.isLast() ? 'Terminar' : 'Siguiente' }}
              </button>
            </div>
          }
        </article>
      </div>
    }
  `,
  styleUrl: './coach-overlay.component.css',
})
export class CoachOverlayComponent implements OnDestroy {
  readonly coach = inject(CoachService);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);

  @ViewChild('card') private cardEl?: ElementRef<HTMLElement>;

  readonly hole = signal<Hole | null>(null);
  readonly cardTop = signal(0);
  readonly cardLeft = signal(0);

  private timer?: ReturnType<typeof setTimeout>;

  constructor() {
    // `allowSignalWrites` because measuring is the whole job here: reacting to
    // the step means writing the box it has to cut out.
    effect(
      () => {
        const step = this.coach.step();
        if (!step) {
          this.hole.set(null);
          return;
        }
        // The route changes first; give the new page a frame to lay out.
        this.measure(step.target, 0);
      },
      { allowSignalWrites: true },
    );
  }

  dots(): number[] {
    return Array.from({ length: this.coach.total() }, (_, index) => index);
  }

  private measure(target: string | null, attempt: number): void {
    clearTimeout(this.timer);

    if (!target) {
      this.hole.set(null);
      this.centre();
      return;
    }

    const element = document.querySelector<HTMLElement>(`[data-coach="${target}"]`);
    if (!element) {
      // Six tries of 120 ms, exactly like the app, and then give up quietly.
      if (attempt < 6) {
        this.timer = setTimeout(() => this.measure(target, attempt + 1), 120);
        return;
      }
      this.hole.set(null);
      this.centre();
      return;
    }

    let rect = element.getBoundingClientRect();
    // A drawer that is closed (phone) leaves the item off screen: centre it.
    if (rect.width === 0 || rect.right <= 0) {
      this.hole.set(null);
      this.centre();
      return;
    }

    // Below the fold (the checklist on the desk usually is): bring it into
    // view first and measure once the scroll has settled. Without this the
    // hole and its card were drawn outside the window.
    const vh = window.innerHeight;
    const outOfView = rect.top < 0 || rect.bottom > vh;
    if (outOfView && attempt < 7) {
      element.scrollIntoView({ block: rect.height > vh - 120 ? 'start' : 'center', behavior: 'smooth' });
      this.timer = setTimeout(() => this.measure(target, 7), 450);
      return;
    }
    rect = element.getBoundingClientRect();

    const pad = 8;
    const box: Hole = {
      top: rect.top - pad,
      left: rect.left - pad,
      width: rect.width + pad * 2,
      height: rect.height + pad * 2,
    };
    this.hole.set(box);
    this.place(box, !!element.closest('.sb'));
  }

  /**
   * Where the card goes: beside a sidebar item; otherwise below, above, to
   * the right or to the left of the hole — the first that fits — and, if the
   * hole fills the screen, pinned to the bottom of it. Always inside the
   * window.
   */
  private place(box: Hole, besideFirst: boolean): void {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const cardWidth = Math.min(380, vw - 32);
    const cardHeight = this.cardEl?.nativeElement.offsetHeight || 280;
    const gap = 18;
    const clampTop = (top: number) => Math.min(Math.max(16, top), vh - cardHeight - 16);
    const clampLeft = (left: number) => Math.min(Math.max(16, left), vw - cardWidth - 16);
    const centredLeft = clampLeft(box.left + box.width / 2 - cardWidth / 2);

    const right = box.left + box.width + gap;
    const left = box.left - gap - cardWidth;
    const fitsRight = right + cardWidth + 16 <= vw;
    const fitsLeft = left >= 16;
    const fitsBelow = box.top + box.height + gap + cardHeight + 16 <= vh;
    const fitsAbove = box.top - gap - cardHeight >= 16;

    let top: number;
    let x: number;
    if (besideFirst && fitsRight) {
      [top, x] = [clampTop(box.top - 20), right];
    } else if (fitsBelow) {
      [top, x] = [box.top + box.height + gap, centredLeft];
    } else if (fitsAbove) {
      [top, x] = [box.top - gap - cardHeight, centredLeft];
    } else if (fitsRight) {
      [top, x] = [clampTop(box.top), right];
    } else if (fitsLeft) {
      [top, x] = [clampTop(box.top), left];
    } else {
      [top, x] = [vh - cardHeight - 24, centredLeft];
    }
    this.cardTop.set(top);
    this.cardLeft.set(x);
    this.cdr.markForCheck();
  }

  private centre(): void {
    const width = Math.min(380, window.innerWidth - 32);
    const height = this.cardEl?.nativeElement.offsetHeight || 300;
    this.cardTop.set(Math.max(16, window.innerHeight / 2 - height / 2));
    this.cardLeft.set(window.innerWidth / 2 - width / 2);
    this.cdr.markForCheck();
  }

  /** The page can still scroll under the veil; keep the hole on its target. */
  @HostListener('window:scroll')
  onScroll(): void {
    const step = this.coach.step();
    if (step?.target) this.measure(step.target, 7);
  }

  goImport(): void {
    this.coach.finish();
    void this.router.navigateByUrl('/panel/clientes/importar');
  }

  @HostListener('window:resize')
  onResize(): void {
    const step = this.coach.step();
    if (step) this.measure(step.target, 6);
  }

  ngOnDestroy(): void {
    clearTimeout(this.timer);
  }
}
