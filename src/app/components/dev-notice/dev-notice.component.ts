import { ChangeDetectionStrategy, Component, Input, signal } from '@angular/core';

const STORAGE_KEY = 'bipsy_business_dev_notice_seen';

/**
 * «Web en desarrollo». A pill in the bottom right corner that opens into a
 * card with the explanation, on the marketing site and the panel alike.
 *
 * It floats instead of being a strip: the site already has its trial strip and
 * a sticky bar, and the panel fills the screen height, so one more band pushed
 * everything down. Bottom right because the panel keeps the account in the
 * bottom left and its toasts in the centre. When the maintenance badge is
 * there too (`raised`), it sits on top of it.
 *
 * The first visit shows it open; closing it leaves the pill, and that is
 * remembered in this browser. The pill itself stays: it is a notice, not an ad.
 */
@Component({
  selector: 'app-dev-notice',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <aside class="dev" [class.dev--raised]="raised" aria-label="Aviso: web en desarrollo">
      @if (open()) {
        <div class="dev__card" id="dev-notice-card" role="status">
          <button type="button" class="dev__close" (click)="close()" aria-label="Cerrar el aviso">
            <span class="material-symbols-rounded">close</span>
          </button>
          <p class="dev__title">
            <span class="material-symbols-rounded" aria-hidden="true">construction</span>
            Web en desarrollo
          </p>
          <p class="dev__text">
            Estamos terminando Bipsy Business. Puede que algunas cosas cambien o todavía no funcionen
            del todo. Si ves algo raro, escríbenos a
            <a href="mailto:soporte@bipsy.es">soporte&#64;bipsy.es</a>.
          </p>
        </div>
      }
      <button type="button" class="dev__pill" (click)="toggle()"
              [attr.aria-expanded]="open()" aria-controls="dev-notice-card">
        <span class="dev__dot" aria-hidden="true"></span>
        En desarrollo
      </button>
    </aside>
  `,
  styles: [
    `
      /* Below the dialogs (100), above the drawer (90), like the maintenance badge. */
      .dev {
        position: fixed;
        right: 16px;
        bottom: 16px;
        z-index: 94;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 8px;
        max-width: calc(100% - 32px);
        font-family: var(--ff);
      }
      .dev--raised { bottom: 60px; }
      .dev__pill {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        height: 32px;
        padding: 0 14px 0 12px;
        border: 0;
        border-radius: var(--r-pill);
        background: var(--clr-text);
        color: var(--clr-base);
        font-family: inherit;
        font-size: 0.75rem;
        font-weight: 800;
        cursor: pointer;
        box-shadow: var(--shadow-pop);
        transition: transform var(--dur-fast) ease;
      }
      .dev__pill:active { transform: scale(0.96); }
      .dev__pill:focus-visible { outline: 2px solid var(--clr-text); outline-offset: 3px; }
      .dev__dot { width: 8px; height: 8px; border-radius: 50%; background: var(--clr-warn); }
      .dev__card {
        position: relative;
        width: 300px;
        max-width: 100%;
        padding: 16px 40px 16px 16px;
        border-radius: 16px;
        background: var(--clr-surface);
        color: var(--clr-text);
        box-shadow: var(--shadow-pop);
        animation: dev-in 0.2s ease-out;
      }
      .dev__title {
        display: flex;
        align-items: center;
        gap: 6px;
        margin: 0 0 6px;
        font-size: 0.875rem;
        font-weight: 800;
      }
      .dev__title .material-symbols-rounded { font-size: 18px; color: var(--clr-warn); }
      .dev__text { margin: 0; font-size: 0.8125rem; line-height: 1.5; color: var(--clr-text-2); }
      .dev__text a { color: var(--clr-text); font-weight: 700; }
      .dev__close {
        position: absolute;
        top: 8px;
        right: 8px;
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 0;
        border-radius: 50%;
        background: transparent;
        color: var(--clr-text-2);
        cursor: pointer;
      }
      .dev__close:hover { background: var(--clr-subtle); color: var(--clr-text); }
      .dev__close .material-symbols-rounded { font-size: 18px; }
      @keyframes dev-in {
        from { opacity: 0; transform: translateY(6px); }
        to { opacity: 1; transform: none; }
      }
      @media (prefers-reduced-motion: reduce) { .dev__card { animation: none; } }
    `,
  ],
})
export class DevNoticeComponent {
  /** The maintenance badge is in the same corner. */
  @Input() raised = false;

  readonly open = signal(!readSeen());

  toggle(): void {
    this.open.update((v) => !v);
    if (!this.open()) markSeen();
  }

  close(): void {
    this.open.set(false);
    markSeen();
  }
}

function readSeen(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function markSeen(): void {
  try {
    localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    /* No storage: it shows open again next time, nothing more. */
  }
}
