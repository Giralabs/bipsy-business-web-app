import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MaintenanceService } from './maintenance.service';

/**
 * The reminder the team sees while it is inside during maintenance, on the
 * marketing site and on the panel alike: what they are looking at is NOT what
 * the public sees. «Salir» forgets the token and brings the maintenance page
 * back, to check how it looks from outside.
 */
@Component({
  selector: 'app-maintenance-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <aside class="mb" role="status">
      <span class="mb__dot" aria-hidden="true"></span>
      <span class="mb__text">Modo mantenimiento · estás dentro como equipo</span>
      <button type="button" class="mb__out" (click)="state.leave()">Salir</button>
    </aside>
  `,
  styles: [
    `
      /* Bottom right: the panel keeps the account in the bottom left corner and
         its toasts in the centre. Below the dialogs (100), above the drawer (90). */
      .mb {
        position: fixed;
        right: 16px;
        bottom: 16px;
        z-index: 95;
        display: flex;
        align-items: center;
        gap: 10px;
        max-width: calc(100% - 32px);
        padding: 6px 6px 6px 14px;
        border-radius: var(--r-pill);
        background: var(--clr-surface-2);
        color: var(--clr-text);
        font-family: var(--ff);
        font-size: 0.75rem;
        font-weight: 700;
        line-height: 1.3;
        /* It floats over any page, like the toasts: the one place a shadow does
           the job that lightness cannot. */
        box-shadow: var(--shadow-pop);
      }
      .mb__dot { flex: none; width: 8px; height: 8px; border-radius: 50%; background: var(--clr-warn); }
      .mb__out {
        flex: none;
        height: 28px;
        padding: 0 12px;
        border: 0;
        border-radius: var(--r-pill);
        background: var(--clr-subtle);
        font-size: 0.75rem;
        font-weight: 800;
        cursor: pointer;
        transition: background-color var(--dur-fast) ease;
      }
      .mb__out:hover { background: var(--clr-border); }
    `,
  ],
})
export class MaintenanceBadgeComponent {
  readonly state = inject(MaintenanceService);
}
