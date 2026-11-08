import {
  ChangeDetectionStrategy,
  Component,
  Directive,
  HostListener,
  Injectable,
  Input,
  inject,
  signal,
} from '@angular/core';

/**
 * Links to things that do not exist yet (the store listings, Bipsy's social
 * profiles). Clicking one says «Próximamente…» in a small floating notice
 * instead of going anywhere.
 *
 * They used to point at youtube.com, left over from a template: a Google Play
 * badge that opens YouTube is worse than one that tells the truth.
 *
 *   <a [href]="url" [comingSoon]="'Próximamente en Google Play'">
 *
 * An empty message (or null) does nothing and the link works as a link, so the
 * day the target exists it is enough to stop passing it.
 */
@Injectable({ providedIn: 'root' })
export class ComingSoonService {
  readonly message = signal<{ id: number; text: string } | null>(null);
  private seq = 0;
  private timer?: ReturnType<typeof setTimeout>;

  show(text: string): void {
    clearTimeout(this.timer);
    this.message.set({ id: ++this.seq, text });
    this.timer = setTimeout(() => this.message.set(null), 2800);
  }
}

@Directive({
  selector: '[comingSoon]',
  standalone: true,
})
export class ComingSoonDirective {
  @Input('comingSoon') message: string | null | undefined = null;
  private readonly soon = inject(ComingSoonService);

  @HostListener('click', ['$event'])
  onClick(event: Event): void {
    if (!this.message) return;
    event.preventDefault();
    event.stopPropagation();
    this.soon.show(this.message);
  }
}

/** The notice itself, mounted once in the root (the panel has its own toasts). */
@Component({
  selector: 'app-coming-soon-toast',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (soon.message(); as m) {
      @for (one of [m]; track one.id) {
        <div class="soon" role="status">
          <span class="material-symbols-rounded" aria-hidden="true">schedule</span>
          {{ one.text }}
        </div>
      }
    }
  `,
  styles: [
    `
      /* Bottom centre, like the panel's toasts; above the drawer (90). */
      .soon {
        position: fixed;
        left: 50%;
        bottom: 24px;
        z-index: 96;
        display: flex;
        align-items: center;
        gap: 8px;
        max-width: calc(100% - 32px);
        padding: 12px 18px;
        border-radius: var(--r-pill);
        background: var(--clr-text);
        color: var(--clr-base);
        font-family: var(--ff);
        font-size: 0.875rem;
        font-weight: 700;
        box-shadow: var(--shadow-pop);
        transform: translateX(-50%);
        animation: soon-in 0.2s ease-out;
      }
      .soon .material-symbols-rounded { font-size: 18px; }
      @keyframes soon-in {
        from { opacity: 0; transform: translate(-50%, 8px); }
        to { opacity: 1; transform: translate(-50%, 0); }
      }
      @media (prefers-reduced-motion: reduce) { .soon { animation: none; } }
    `,
  ],
})
export class ComingSoonToastComponent {
  readonly soon = inject(ComingSoonService);
}

/** The wording, in one place: the same badge shows on five pages. */
export const SOON = {
  googlePlay: 'Próximamente en Google Play',
  appStore: 'Próximamente en el App Store',
  instagram: 'Próximamente en Instagram',
  linkedin: 'Próximamente en LinkedIn',
} as const;
