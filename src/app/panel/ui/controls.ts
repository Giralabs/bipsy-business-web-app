import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { initials } from '../core/util/format';

/**
 * The small controls of `gipsi_controls.dart`, as components so a template
 * never has to remember the ARIA of a switch or the initials of an avatar.
 * The looks live in `src/styles/panel.css`; these only hold behaviour.
 */

@Component({
  selector: 'pn-switch',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      role="switch"
      class="pn-switch"
      [attr.aria-checked]="checked"
      [attr.aria-label]="label"
      [disabled]="disabled"
      (click)="toggle.emit(!checked)"
    ></button>
  `,
})
export class PnSwitchComponent {
  @Input() checked = false;
  @Input() disabled = false;
  @Input() label = '';
  @Output() toggle = new EventEmitter<boolean>();
}

export interface SegmentOption {
  id: string;
  label: string;
  /** Shown as a small balloon after the label, for pending counters. */
  badge?: number;
}

@Component({
  selector: 'pn-segmented',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="pn-seg" role="tablist" [attr.aria-label]="label">
      @for (option of options; track option.id) {
        <button
          type="button"
          role="tab"
          [attr.aria-selected]="option.id === value"
          (click)="valueChange.emit(option.id)"
        >
          {{ option.label }}
          @if (option.badge) {
            <span class="pn-seg__badge">{{ option.badge }}</span>
          }
        </button>
      }
    </div>
  `,
  styles: [
    `
      .pn-seg__badge {
        margin-left: 6px;
        font-size: 0.6875rem;
        font-weight: 800;
        color: var(--clr-warn-text);
      }
    `,
  ],
})
export class PnSegmentedComponent {
  @Input({ required: true }) options: SegmentOption[] = [];
  @Input({ required: true }) value = '';
  @Input() label = '';
  @Output() valueChange = new EventEmitter<string>();
}

@Component({
  selector: 'pn-avatar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (url) {
      <img [src]="url" [alt]="name" />
    } @else {
      {{ short }}
    }
  `,
  host: {
    class: 'pn-avatar',
    '[class.pn-avatar--sm]': "size === 'sm'",
    '[class.pn-avatar--lg]': "size === 'lg'",
    '[class.pn-avatar--xl]': "size === 'xl'",
    '[attr.title]': 'name',
  },
})
export class PnAvatarComponent {
  @Input() name = '';
  @Input() url: string | null = null;
  @Input() size: 'sm' | 'md' | 'lg' | 'xl' = 'md';

  get short(): string {
    return initials(this.name);
  }
}

/**
 * The empty state of `gipsi_states.dart`: a loose 48px icon, no disc behind
 * it. The disc was removed on purpose — it read as a broken image.
 */
@Component({
  selector: 'pn-empty',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="material-symbols-rounded">{{ icon }}</span>
    <h3>{{ title }}</h3>
    @if (text) {
      <p>{{ text }}</p>
    }
    <ng-content />
  `,
  host: { class: 'pn-empty' },
})
export class PnEmptyComponent {
  @Input() icon = 'inbox';
  @Input({ required: true }) title = '';
  @Input() text = '';
}

@Component({
  selector: 'pn-error',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="pn-error__disc"><span class="material-symbols-rounded">wifi_tethering_error</span></div>
    <h3>{{ title }}</h3>
    <p>{{ text }}</p>
    <button type="button" class="pn-btn pn-btn--secondary" style="margin-top:20px" (click)="retry.emit()">
      <span class="material-symbols-rounded">refresh</span>
      Reintentar
    </button>
  `,
  host: { class: 'pn-error' },
})
export class PnErrorComponent {
  @Input() title = 'Algo no ha ido bien';
  @Input() text = 'No hemos podido conectar con Bipsy. Inténtalo otra vez.';
  @Output() retry = new EventEmitter<void>();
}
