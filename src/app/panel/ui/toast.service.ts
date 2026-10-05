import { ChangeDetectionStrategy, Component, Injectable, inject, signal } from '@angular/core';

export interface Toast {
  id: number;
  text: string;
  tone: 'info' | 'error';
}

/**
 * The app replaced snack bars with `GipsiInlineNotice` because on iOS a snack
 * bar ends up behind the sheet. On a desk there is no sheet covering the
 * bottom, so a short toast is back — same wording, same 2.8 s.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);
  private next = 1;

  show(text: string, tone: 'info' | 'error' = 'info'): void {
    const toast: Toast = { id: this.next++, text, tone };
    this.toasts.set([...this.toasts(), toast]);
    setTimeout(() => this.dismiss(toast.id), 2800);
  }

  error(text: string): void {
    this.show(text, 'error');
  }

  dismiss(id: number): void {
    this.toasts.set(this.toasts().filter((toast) => toast.id !== id));
  }
}

@Component({
  selector: 'pn-toasts',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (toast of toasts.toasts(); track toast.id) {
      <div class="pn-toast" [class.pn-toast--error]="toast.tone === 'error'" role="status">
        <span class="material-symbols-rounded">
          {{ toast.tone === 'error' ? 'error' : 'check_circle' }}
        </span>
        {{ toast.text }}
      </div>
    }
  `,
})
export class PnToastsComponent {
  readonly toasts = inject(ToastService);
}
