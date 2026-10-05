import { ChangeDetectionStrategy, Component, Injectable, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PnDialogComponent } from './dialog.component';

export interface ConfirmRequest {
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  /** Shows a text box whose value comes back with the answer. */
  reason?: { label: string; placeholder?: string; hint?: string; maxLength?: number };
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
      <pn-dialog [title]="request.title" (closed)="service.answer(false)">
        @if (request.message) {
          <p class="pn-dim" style="line-height:1.55">{{ request.message }}</p>
        }
        @if (request.reason; as field) {
          <label class="pn-field" style="margin-top:16px;margin-bottom:0">
            <span class="pn-field__label">{{ field.label }}</span>
            <textarea
              class="pn-textarea"
              [placeholder]="field.placeholder ?? ''"
              [maxlength]="field.maxLength ?? 300"
              [(ngModel)]="reason"
            ></textarea>
            @if (field.hint) {
              <span class="pn-field__hint">{{ field.hint }}</span>
            }
          </label>
        }

        <ng-container dialogActions>
          <button type="button" class="pn-btn pn-btn--secondary" (click)="service.answer(false)">
            {{ request.cancelLabel ?? 'Cancelar' }}
          </button>
          <button
            type="button"
            class="pn-btn"
            [class.pn-btn--danger]="request.destructive"
            [class.pn-btn--primary]="!request.destructive"
            (click)="confirm()"
          >
            {{ request.confirmLabel }}
          </button>
        </ng-container>
      </pn-dialog>
    }
  `,
})
export class PnConfirmHostComponent {
  readonly service = inject(ConfirmService);
  reason = '';

  confirm(): void {
    const reason = this.reason;
    this.reason = '';
    this.service.answer(true, reason);
  }
}
