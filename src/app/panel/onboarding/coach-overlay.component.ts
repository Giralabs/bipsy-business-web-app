import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  ViewChild,
  OnDestroy,
  computed,
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

/** How long a page gets to paint the target: the checklist waits for the server. */
const MAX_TRIES = 14;
const OPTIONAL_TRIES = 6;
const SETTLED = MAX_TRIES + 1;

/**
 * The dark veil with a hole in it, ported from `coach_overlay.dart`.
 *
 * The hole is not a mask: it is a transparent box with a 9999px shadow, which
 * is the one trick that keeps the cut-out crisp at any zoom and costs nothing
 * to animate. The veil swallows every click, so the only way forward is the
 * buttons or the keyboard (arrows, Enter, Esc).
 *
 * The card stays invisible until it has its place, or each step would flash
 * where the previous one was. If the target cannot be measured (the page is
 * still routing, the drawer is closed on a phone), the step shows centred
 * instead of disappearing; if it is an optional one, it is dropped.
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

        <article #card class="coach__card" [class.coach__card--art]="step.art" [class.is-placed]="placed()"
                 [style.top.px]="cardTop()" [style.left.px]="cardLeft()">
          @if (step.art; as art) {
            <div class="coach__art" aria-hidden="true"><img [src]="'mr_bip/' + art + '.webp'" alt="" /></div>
          } @else {
            <span class="material-symbols-rounded coach__icon">{{ step.icon }}</span>
          }

          <h2>{{ step.title }}</h2>
          <p aria-live="polite">{{ step.body }}</p>

          <div class="coach__progress">
            <span class="coach__count pn-tabular">{{ coach.index() + 1 }} de {{ coach.total() }}</span>
            <div class="coach__bar" aria-hidden="true"><i [style.width.%]="progress()"></i></div>
          </div>

          @if (step.kind === 'invite') {
            <div class="coach__actions coach__actions--stack">
              <button #primary type="button" class="pn-btn pn-btn--primary pn-btn--block" (click)="goImport()">
                Sí, traer mis clientes
              </button>
              <button type="button" class="pn-btn pn-btn--text pn-btn--block" (click)="coach.finish()">
                Ahora no
              </button>
            </div>
          } @else {
            <div class="coach__actions">
              <button type="button" class="pn-btn pn-btn--text pn-btn--sm" (click)="coach.skip()">Saltar</button>
              <span class="coach__spacer"></span>
              @if (!coach.isFirst()) {
                <button type="button" class="pn-btn pn-btn--secondary pn-btn--sm" (click)="coach.back()">Atrás</button>
              }
              <button #primary type="button" class="pn-btn pn-btn--primary pn-btn--sm" (click)="coach.next()">
                {{ coach.isFirst() ? 'Empezar' : 'Siguiente' }}
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
  @ViewChild('primary') private primaryEl?: ElementRef<HTMLButtonElement>;

  readonly hole = signal<Hole | null>(null);
  readonly cardTop = signal(0);
  readonly cardLeft = signal(0);
  readonly placed = signal(false);

  readonly progress = computed(() => ((this.coach.index() + 1) / this.coach.total()) * 100);

  private timer?: ReturnType<typeof setTimeout>;

  constructor() {
    // `allowSignalWrites` because measuring is the whole job here: reacting to
    // the step means writing the box it has to cut out.
    effect(
      () => {
        const step = this.coach.step();
        clearTimeout(this.timer);
        this.placed.set(false);
        if (!step) {
          this.hole.set(null);
          return;
        }
        // A tick so the new text is in the DOM: its height decides where the
        // card fits, and the route has changed underneath.
        this.timer = setTimeout(() => this.measure(step, 0));
      },
      { allowSignalWrites: true },
    );
  }

  private measure(step: { target: string | null; optional?: boolean }, attempt: number): void {
    clearTimeout(this.timer);

    const { target } = step;
    if (!target) {
      this.hole.set(null);
      this.centre();
      return;
    }

    const element = document.querySelector<HTMLElement>(`[data-coach="${target}"]`);
    if (!element) {
      // An optional step is usually absent for good: no long wait on a blank veil.
      if (attempt < (step.optional ? OPTIONAL_TRIES : MAX_TRIES)) {
        this.timer = setTimeout(() => this.measure(step, attempt + 1), 120);
        return;
      }
      if (step.optional) {
        this.coach.dropCurrent();
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
    if (outOfView && attempt < SETTLED) {
      element.scrollIntoView({ block: rect.height > vh - 120 ? 'start' : 'center', behavior: 'smooth' });
      this.timer = setTimeout(() => this.measure(step, SETTLED), 450);
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
    } else if (fitsRight) {
      [top, x] = [clampTop(box.top), right];
    } else if (fitsLeft) {
      [top, x] = [clampTop(box.top), left];
    } else if (fitsBelow) {
      [top, x] = [box.top + box.height + gap, centredLeft];
    } else if (fitsAbove) {
      [top, x] = [box.top - gap - cardHeight, centredLeft];
    } else {
      [top, x] = [vh - cardHeight - 24, centredLeft];
    }
    this.show(top, x);
  }

  private centre(): void {
    const width = Math.min(380, window.innerWidth - 32);
    const height = this.cardEl?.nativeElement.offsetHeight || 300;
    this.show(Math.max(16, window.innerHeight / 2 - height / 2), window.innerWidth / 2 - width / 2);
  }

  private show(top: number, left: number): void {
    const first = !this.placed();
    this.cardTop.set(top);
    this.cardLeft.set(left);
    this.placed.set(true);
    this.cdr.markForCheck();
    // Only when the step changes: a scroll must not steal the focus back.
    if (first) setTimeout(() => this.primaryEl?.nativeElement.focus({ preventScroll: true }));
  }

  /** The page can still scroll under the veil; keep the hole on its target. */
  @HostListener('window:scroll')
  onScroll(): void {
    const step = this.coach.step();
    if (step?.target) this.measure(step, SETTLED);
  }

  goImport(): void {
    this.coach.finish();
    void this.router.navigateByUrl('/panel/clientes/importar');
  }

  @HostListener('window:resize')
  onResize(): void {
    const step = this.coach.step();
    if (step) this.measure(step, MAX_TRIES);
  }

  @HostListener('window:keydown', ['$event'])
  onKey(event: KeyboardEvent): void {
    if (!this.coach.step()) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      this.coach.skip();
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      if (this.coach.step()?.kind !== 'invite') this.coach.next();
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.coach.back();
    } else if (event.key === 'Tab') {
      this.trapFocus(event);
    }
  }

  /** It says `aria-modal`: Tab must not wander off behind the veil. */
  private trapFocus(event: KeyboardEvent): void {
    const card = this.cardEl?.nativeElement;
    if (!card) return;
    const buttons = Array.from(card.querySelectorAll('button'));
    if (buttons.length === 0) return;
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.shiftKey ? (at <= 0 ? buttons.length - 1 : at - 1) : (at + 1) % buttons.length;
    event.preventDefault();
    buttons[next].focus();
  }

  ngOnDestroy(): void {
    clearTimeout(this.timer);
  }
}
