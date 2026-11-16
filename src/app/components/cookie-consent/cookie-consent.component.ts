import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AnalyticsService } from '../../shared/analytics';

/**
 * The cookie notice. Only appears when there is a Google Analytics ID and the
 * visitor has not answered yet (see AnalyticsService).
 *
 * The two buttons look the same on purpose: the AEPD asks that rejecting be
 * as easy and as visible as accepting. It does not block the page; until there
 * is an answer, nothing from Google loads.
 */
@Component({
  selector: 'app-cookie-consent',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (analytics.needsChoice()) {
      <section class="cc" role="region" aria-labelledby="cc-title">
        <p class="cc__title" id="cc-title">Cookies de análisis</p>
        <p class="cc__text">
          Usamos Google Analytics para saber qué páginas se visitan y mejorar la web. Solo si aceptas.
          <a routerLink="/legal/cookies">Política de cookies</a>
        </p>
        <div class="cc__actions">
          <button type="button" class="btn btn--subtle btn--sm" (click)="analytics.reject()">Rechazar</button>
          <button type="button" class="btn btn--subtle btn--sm" (click)="analytics.accept()">Aceptar</button>
        </div>
      </section>
    }
  `,
  styles: [
    `
      /* Bottom left: the bottom right is the «en desarrollo» pill. Above the
         drawer (90) and the maintenance badge (95), under the dialogs (100). */
      .cc {
        position: fixed;
        left: 16px;
        bottom: 16px;
        z-index: 97;
        width: min(400px, calc(100% - 32px));
        padding: 18px 18px 16px;
        border-radius: var(--r-lg);
        background: var(--clr-surface-2);
        color: var(--clr-text);
        font-family: var(--ff);
        box-shadow: var(--shadow-pop);
        animation: cc-in 0.25s ease-out;
      }
      .cc__title { font-size: 0.9375rem; font-weight: 800; }
      .cc__text { margin-top: 6px; font-size: 0.875rem; line-height: 1.55; color: var(--clr-text-2); }
      .cc__text a { color: var(--clr-text); font-weight: 700; text-decoration: underline; text-underline-offset: 2px; }
      .cc__actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 14px; }
      @keyframes cc-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
      @media (prefers-reduced-motion: reduce) { .cc { animation: none; } }
    `,
  ],
})
export class CookieConsentComponent {
  readonly analytics = inject(AnalyticsService);
}
