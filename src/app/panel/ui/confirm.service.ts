import { ChangeDetectionStrategy, Component, Injectable, ViewEncapsulation, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PnDialogComponent } from './dialog.component';

export interface ConfirmRequest {
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  /**
   * Shows a text box whose value comes back with the answer. With `required` the
   * confirm button waits switched off until something is written: it replaces a
   * «write a reason» that would only appear AFTER pressing.
   */
  reason?: { label: string; placeholder?: string; hint?: string; maxLength?: number; required?: boolean };
}

export interface ConfirmAnswer {
  ok: boolean;
  reason: string;
}

/**
 * The twin of `GipsiAlert.confirm()` and of the reason sheets
 * (`reason_sheet.dart`): a question, a destructive button and, when the app
 * asks for one, a free-text reason that travels with the answer.
 */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  readonly request = signal<ConfirmRequest | null>(null);
  private resolver: ((answer: ConfirmAnswer) => void) | null = null;

  ask(request: ConfirmRequest): Promise<ConfirmAnswer> {
    this.request.set(request);
    return new Promise((resolve) => {
      this.resolver = resolve;
    });
  }

  answer(ok: boolean, reason = ''): void {
    this.request.set(null);
    this.resolver?.({ ok, reason });
    this.resolver = null;
  }
}

@Component({
  selector: 'pn-confirm-host',
  standalone: true,
  imports: [PnDialogComponent, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (service.request(); as request) {
      <pn-dialog class="pn-alert" [title]="request.title" (closed)="cancel()">
        <h2 class="pn-alert__title">{{ request.title }}</h2>
        @if (request.message) {
          <p class="pn-alert__message">{{ request.message }}</p>
        }
        @if (request.reason; as field) {
          <div class="pn-fg pn-alert__reason">
            <p class="pn-fg__head">{{ field.label }}</p>
            <div class="pn-fg__body">
              <label class="pn-fg__row pn-fg__row--stack">
                <textarea
                  class="pn-fg__input"
                  rows="3"
                  [attr.aria-label]="field.label"
                  [placeholder]="field.placeholder ?? ''"
                  [maxlength]="field.maxLength ?? 300"
                  [(ngModel)]="reason"
                ></textarea>
              </label>
            </div>
            @if (field.hint) {
              <p class="pn-fg__foot">{{ field.hint }}</p>
            }
          </div>
        }

        <ng-container dialogActions>
          <button type="button" class="pn-btn pn-btn--secondary" (click)="cancel()">
            {{ request.cancelLabel ?? 'Cancelar' }}
          </button>
          <button
            type="button"
            class="pn-btn"
            [class.pn-btn--danger]="request.destructive"
            [class.pn-btn--primary]="!request.destructive"
            [disabled]="request.reason?.required && !reason.trim()"
            (click)="confirm()"
          >
            {{ request.confirmLabel }}
          </button>
        </ng-container>
      </pn-dialog>
    }
  `,
  // Not encapsulated: it restyles the frame `pn-dialog` draws, and only under
  // `pn-dialog.pn-alert`, so nothing else in the panel is touched.
  encapsulation: ViewEncapsulation.None,
  styles: [
    `
      /* A macOS alert, not a sheet: narrow, no title bar, the question in
         bold and centred, and the two answers side by side and equal. */
      pn-dialog.pn-alert .pn-dialog { width: min(400px, 100%); border-radius: 18px; }
      pn-dialog.pn-alert .pn-dialog__head { display: none; }
      pn-dialog.pn-alert .pn-dialog__body { padding: 26px 24px 6px; text-align: center; }
      pn-dialog.pn-alert .pn-alert__title {
        font-size: 1.0625rem;
        font-weight: 700;
        letter-spacing: -0.2px;
        line-height: 1.35;
        text-wrap: balance;
      }
      pn-dialog.pn-alert .pn-alert__message {
        margin-top: 8px;
        font-size: 0.875rem;
        line-height: 1.5;
        color: var(--clr-text-2);
        text-wrap: pretty;
      }
      pn-dialog.pn-alert .pn-alert__reason { margin: 18px 0 4px; text-align: left; }
      pn-dialog.pn-alert .pn-alert__reason textarea.pn-fg__input { min-height: 72px; }
      pn-dialog.pn-alert .pn-dialog__foot { padding: 16px 20px 20px; border-top: 0; }
      pn-dialog.pn-alert .pn-dialog__keys { display: none; }
      pn-dialog.pn-alert .pn-dialog__foot .pn-btn { flex: 1; min-width: 0; }
    `,
  ],
})
export class PnConfirmHostComponent {
  readonly service = inject(ConfirmService);
  reason = '';

  confirm(): void {
    const reason = this.reason.trim();
    this.reason = '';
    this.service.answer(true, reason);
  }

  /** The text goes too: it must not appear in the next dialog that asks for one. */
  cancel(): void {
    this.reason = '';
    this.service.answer(false);
  }
}
