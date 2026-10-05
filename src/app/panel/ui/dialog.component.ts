import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  HostListener,
  Input,
  Output,
} from '@angular/core';

/**
 * What the app solves with a bottom sheet, a desk solves with a centred
 * dialog: same 36px top radius, same grouped floor inside, same rule that the
 * primary action lives at the bottom right.
 *
 * Escape and a click on the scrim close it, because a sheet is dragged away
 * and a dialog has to offer the same escape hatch.
 */
@Component({
  selector: 'pn-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="pn-scrim" (click)="onScrim($event)">
      <div
        class="pn-dialog"
        [class.pn-dialog--wide]="wide"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="title"
      >
        <header class="pn-dialog__head">
          <h2>{{ title }}</h2>
          <button type="button" class="pn-icon-btn pn-icon-btn--ghost" aria-label="Cerrar" (click)="closed.emit()">
            <span class="material-symbols-rounded">close</span>
          </button>
        </header>

        <div class="pn-dialog__body">
          <ng-content />
        </div>

        <footer class="pn-dialog__foot">
          <ng-content select="[dialogActions]" />
        </footer>
      </div>
    </div>
  `,
})
export class PnDialogComponent {
  @Input({ required: true }) title = '';
  @Input() wide = false;
  @Output() closed = new EventEmitter<void>();

  onScrim(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('pn-scrim')) this.closed.emit();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closed.emit();
  }
}
