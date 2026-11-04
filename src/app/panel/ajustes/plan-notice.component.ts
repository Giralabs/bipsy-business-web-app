import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';
import { diamondOf, noticeText } from './plan-terms';

/**
 * The single, discreet plan reminder (`status.notice`): during the courtesy
 * days and in the last week of a gift with nothing ready. On purpose there is
 * no countdown and nothing on Inicio: the server decides when it shows and
 * this is the only place it does.
 */
@Component({
  selector: 'app-plan-notice',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (text(); as notice) {
      <div class="pn-group">
        <div class="pn-group__body">
          <a class="pn-row" routerLink="/panel/ajustes/suscripcion">
            <img class="pnn__diamond" [src]="diamond()" alt="" width="28" height="28" />
            <span class="pn-row__main">
              <span class="pn-row__title">{{ notice.title }}</span>
              <span class="pn-row__sub">{{ notice.sub }}</span>
            </span>
            <span class="material-symbols-rounded pn-row__chev">arrow_forward_ios</span>
          </a>
        </div>
      </div>
    }
  `,
  styles: [
    `
      :host { display: block; }
      .pnn__diamond { width: 28px; height: 28px; flex: none; object-fit: contain; }
    `,
  ],
})
export class PlanNoticeComponent {
  private readonly auth = inject(AuthService);
  private readonly status = computed(() => this.auth.profile()?.subscription ?? null);

  readonly text = computed(() => (this.auth.isWorker() ? null : noticeText(this.status(), new Date())));
  /** Courtesy has no plan of its own yet: it sells the first one. */
  readonly diamond = computed(() => diamondOf(this.status()?.notice === 'GIFT_ENDING' ? this.status()?.planCode : null));
}
