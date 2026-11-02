import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

/**
 * The «Verificado por Bipsy» seal (`gipsi_verified_badge.dart`). Icon only: it
 * sits next to a name that already fills the row.
 *
 * It takes the logo's colours and not the accent, so it reads as Bipsy's: in
 * light the seal is graphite with a mint tick, in dark the seal is mint and the
 * tick lets the background through. `onDark` forces the second over a photo.
 *
 * It does not decide whether it shows: that is `verified`, which already
 * accounts for payments being active. `muted` and `danger` are only for the
 * business looking at its own status.
 */
@Component({
  selector: 'pn-verified-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="seal"
      role="img"
      [class.seal--muted]="tone === 'muted'"
      [class.seal--danger]="tone === 'danger'"
      [class.seal--on-dark]="onDark"
      [style.font-size.px]="size"
      [attr.aria-label]="label"
    >
      @if (tone === 'brand') {
        <span class="seal__tick"></span>
      }
      <span class="material-symbols-rounded fill seal__icon">verified</span>
    </span>
  `,
  styles: [
    `
      :host { display: inline-flex; flex: none; vertical-align: middle; }

      .seal {
        --seal: #2e343b;
        --tick: #c0eed3;
        position: relative;
        display: inline-grid;
        place-items: center;
        width: 1em;
        height: 1em;
        line-height: 1;
      }
      @media (prefers-color-scheme: dark) {
        .seal { --seal: #c0eed3; --tick: transparent; }
      }
      .seal--on-dark { --seal: #c0eed3; --tick: transparent; }
      .seal--muted { --seal: var(--clr-text-3); }
      .seal--danger { --seal: var(--clr-danger); }

      .seal__tick {
        position: absolute;
        width: 0.5em;
        height: 0.5em;
        border-radius: 50%;
        background: var(--tick);
      }
      .seal__icon { position: relative; font-size: 1em; color: var(--seal); }
    `,
  ],
})
export class PnVerifiedBadgeComponent {
  @Input() size = 18;
  @Input() tone: 'brand' | 'muted' | 'danger' = 'brand';
  @Input() onDark = false;
  @Input() label = 'Verificado por Bipsy';
}
