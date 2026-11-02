import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnDestroy,
  Output,
  ViewChild,
  inject,
} from '@angular/core';

/**
 * What the app solves with a bottom sheet, a desk solves with a centred sheet
 * drawn the macOS way: the grouped floor of the app inside, a quiet header,
 * and the actions small and to the right, the primary one last.
 *
 * Escape and a click on the scrim close it, because a sheet is dragged away
 * and a dialog has to offer the same escape hatch; ⌘/Ctrl + Enter presses the
 * primary action.
 */
@Component({
  selector: 'pn-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="pn-scrim" [class.is-leaving]="leaving" (click)="onScrim($event)">
      <div
        #box
        class="pn-dialog"
        [class.pn-dialog--wide]="wide"
        role="dialog"
        aria-modal="true"
        tabindex="-1"
        [attr.aria-label]="title"
      >
        <header class="pn-dialog__head">
          <h2>{{ title }}</h2>
          <button type="button" class="pn-icon-btn pn-icon-btn--ghost" aria-label="Cerrar" (click)="close()">
            <span class="material-symbols-rounded">close</span>
          </button>
        </header>

        <div class="pn-dialog__body">
          <ng-content />
        </div>

        <footer #foot class="pn-dialog__foot">
          @if (hasPrimary) {
            <span class="pn-dialog__keys" aria-hidden="true"><kbd>{{ mod }}</kbd> <kbd>↵</kbd> para {{ primaryVerb }}</span>
          }
          <ng-content select="[dialogActions]" />
        </footer>
      </div>
    </div>
  `,
})
export class PnDialogComponent implements AfterViewInit, OnDestroy {
  /** Open dialogs, the newest last: keys belong to the one on top only. */
  private static readonly stack: PnDialogComponent[] = [];

  @Input({ required: true }) title = '';
  @Input() wide = false;
  @Output() closed = new EventEmitter<void>();

  @ViewChild('foot') private foot?: ElementRef<HTMLElement>;
  @ViewChild('box') private box?: ElementRef<HTMLElement>;
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);

  /** Where the focus was before opening: it goes back there on closing. */
  private readonly opener = document.activeElement as HTMLElement | null;
  leaving = false;

  constructor() {
    PnDialogComponent.stack.push(this);
    // The page under the scrim must not scroll with the wheel meant for the dialog.
    document.documentElement.style.overflow = 'hidden';
  }

  private get onTop(): boolean {
    const stack = PnDialogComponent.stack;
    return stack[stack.length - 1] === this;
  }

  /** Every way out goes through here, so all of them leave with the same short fade. */
  close(): void {
    if (this.leaving) return;
    this.leaving = true;
    this.cdr.markForCheck();
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    setTimeout(() => this.closed.emit(), reduced ? 0 : 110);
  }

  ngOnDestroy(): void {
    const stack = PnDialogComponent.stack;
    stack.splice(stack.indexOf(this), 1);
    if (stack.length === 0) document.documentElement.style.overflow = '';
    if (this.opener && document.contains(this.opener)) this.opener.focus({ preventScroll: true });
  }

  /** ⌘ on a Mac, Ctrl elsewhere: what the shortcut hint says. */
  readonly mod = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl';
  hasPrimary = false;
  primaryVerb = 'confirmar';

  ngAfterViewInit(): void {
    // Ready to type, as a macOS sheet: the first field, or the dialog itself so
    // Tab starts inside it. Never a field that opens something by itself.
    setTimeout(() => {
      const first = this.host.nativeElement.querySelector<HTMLElement>(
        '.pn-dialog__body :is(input:not([type=hidden]):not([type=file]):not([type=checkbox]):not([type=radio]):not([type=date]), textarea, select):not(:disabled)',
      );
      (first ?? this.box?.nativeElement)?.focus({ preventScroll: true });
    });
    const primary = this.primary();
    if (!primary) return;
    // «Guardar» → «guardar»: the hint names what the shortcut will press. The
    // icon's ligature («send») is text too, so it is left out.
    const copy = primary.cloneNode(true) as HTMLElement;
    copy.querySelectorAll('.material-symbols-rounded, .pn-spinner').forEach((icon) => icon.remove());
    const label = (copy.textContent ?? '').trim();
    this.primaryVerb = label && label.split(/\s+/).length <= 2 ? label.toLowerCase() : 'confirmar';
    this.hasPrimary = true;
    setTimeout(() => this.cdr.markForCheck());
  }

  onScrim(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('pn-scrim')) this.close();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.onTop) this.close();
  }

  /** ⌘/Ctrl + Enter presses the main button, as in a macOS sheet. */
  @HostListener('document:keydown', ['$event'])
  onKey(event: KeyboardEvent): void {
    if (!this.onTop || event.key !== 'Enter' || !(event.metaKey || event.ctrlKey)) return;
    const primary = this.primary();
    if (!primary || primary.disabled) return;
    event.preventDefault();
    primary.click();
  }

  /** The last primary button of the footer: where every dialog puts its main action. */
  private primary(): HTMLButtonElement | null {
    const buttons = this.foot?.nativeElement.querySelectorAll<HTMLButtonElement>('button.pn-btn--primary');
    return buttons && buttons.length ? buttons[buttons.length - 1] : null;
  }
}
