import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BipRigComponent } from '../../components/bip-rig/bip-rig.component';
import { BIP_RIGS } from '../../components/bip-rig/bip-rigs.data';

/**
 * The frame every access page shares: the form on the left, Mr. Bip and the
 * promise on the right. On a phone the mascot steps aside — a keyboard plus a
 * 4:5 illustration leaves no room for the form.
 *
 * The right column is the only place in the panel where mint shows up: it is
 * still the landing talking, and the graphite of the app starts once inside.
 */
@Component({
  selector: 'app-auth-layout',
  standalone: true,
  imports: [RouterLink, BipRigComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="auth pn">
      <div class="auth__form">
        <a routerLink="/" class="auth__brand" aria-label="Bipsy Business, inicio">
          <!-- Los archivos con sufijo _trim y la variante «dark» sobre fondo
               oscuro: los mismos que usa la cabecera de la web informativa.
               Sin recortar, el logo salía diminuto. -->
          <img class="theme-dark-only" src="assets_bipsy_business/Combination Marks/combinationmark_horizontal_dark_nobackground_trim.webp" alt="Bipsy Business" />
          <img class="theme-light-only" src="assets_bipsy_business/Combination Marks/combinationmark_horizontal_light_nobackground_trim.webp" alt="Bipsy Business" />
        </a>

        <div class="auth__panel">
          <ng-content />
        </div>
      </div>

      <aside class="auth__art" aria-hidden="true">
        <div class="aura aura--mint auth__aura"></div>
        @if (rig) {
          <app-bip-rig class="auth__bip auth__bip--rig" [rig]="rig" />
        } @else {
          <img class="auth__bip" [src]="'mr_bip/' + bip + '.webp'" alt="" />
        }
        <p class="auth__claim">{{ claim }}</p>
      </aside>
    </div>
  `,
  styleUrl: './auth-layout.component.css',
})
export class AuthLayoutComponent {
  /** Which illustration keeps the visitor company. */
  @Input() bip = 'MB-05';
  @Input() claim = 'Tu agenda se llena sola.';

  /**
   * The animated cut-up of `bip`, when there is one; otherwise the page falls
   * back to the flat render. Keeps the two in step: a code gets its animation
   * here the moment `scripts/build-bip-rigs.mjs` learns to cut it.
   */
  get rig(): string | null {
    const name = this.bip.toLowerCase();
    return BIP_RIGS[name] ? name : null;
  }
}
