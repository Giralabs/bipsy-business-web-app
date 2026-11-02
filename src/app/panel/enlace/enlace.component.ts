import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';
import { businessLink, businessLinkMessage } from '../core/business-link';
import { shareOrCopy } from '../core/util/share';
import { ToastService } from '../ui/toast.service';
import { PnQrComponent } from './qr.component';

/**
 * `/panel/enlace` — `share_link_screen.dart`: the link a business hands out on
 * its Instagram, over WhatsApp or on the door, and its QR.
 *
 * A worker sees it too, on purpose: the link belongs to the business they work
 * at, and it hands out appointments that land in their own agenda. The name is
 * the one whoever gets the link will see; while it is not known yet, the short
 * form opens the same page.
 */
@Component({
  selector: 'app-panel-enlace',
  standalone: true,
  imports: [RouterLink, PnQrComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="pn-main">
      <a class="pn-btn pn-btn--text pn-btn--sm lk-back" [routerLink]="auth.isWorker() ? '/panel/mi-perfil' : '/panel/negocio'">
        <span class="material-symbols-rounded">arrow_back</span>{{ auth.isWorker() ? 'Mi perfil' : 'Tu ficha' }}
      </a>

      <div class="pn-head">
        <div class="pn-head__text"><h1>Mi enlace</h1></div>
      </div>

      @if (link(); as url) {
        <div class="lk" data-coach="enlace:qr">
          <!-- White always, also with the panel in dark: fewer phones read a negative. -->
          <div class="lk__qr"><pn-qr [data]="url" label="Código QR de tu enlace" /></div>
          <p class="lk__foot">Puedes usar este código, copiar o compartir el enlace a tu negocio.</p>

          <div class="lk__actions">
            <button type="button" class="pn-btn pn-btn--primary" (click)="share()">
              <span class="material-symbols-rounded">ios_share</span>Compartir
            </button>
            <!-- The notice goes on the button itself: seeing the change where you
                 just clicked says more than a toast at the far end of the screen. -->
            <button type="button" class="pn-btn pn-btn--secondary" (click)="copy(url)">
              <span class="material-symbols-rounded">{{ copied() ? 'check' : 'content_copy' }}</span>
              {{ copied() ? 'Copiado' : 'Copiar' }}
            </button>
          </div>

          <div class="pn-group lk__poster">
            <div class="pn-group__body">
              <a class="pn-row" routerLink="/panel/enlace/cartel">
                <span class="material-symbols-rounded pn-row__icon">qr_code_2</span>
                <span class="pn-row__main"><span class="pn-row__title">Cartel para imprimir</span></span>
                <span class="material-symbols-rounded pn-row__chev">arrow_forward_ios</span>
              </a>
            </div>
            <p class="pn-group__foot">Para el mostrador, el escaparate o una tarjeta.</p>
          </div>
        </div>
      } @else {
        <div class="pn-skeleton" style="height:360px"></div>
      }
    </main>
  `,
  styles: [
    `
      :host { display: block; }
      .lk-back { margin: 0 0 14px -12px; text-decoration: none; }
      .lk { max-width: 480px; margin-inline: auto; text-align: center; }
      .lk__qr { width: min(280px, 100%); margin-inline: auto; padding: 12px; border-radius: 24px; background: #fff; }
      .lk__foot { margin-top: 18px; font-size: 0.9375rem; line-height: 1.5; color: var(--clr-text-2); }
      .lk__actions { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 20px; }
      .lk__poster { margin-top: 24px; text-align: left; }
    `,
  ],
})
export class EnlaceComponent {
  readonly auth = inject(AuthService);
  private readonly toasts = inject(ToastService);

  readonly copied = signal(false);

  readonly link = computed(() => {
    const id = this.auth.businessId();
    return id == null ? null : businessLink(id, this.auth.businessName());
  });

  private revert?: ReturnType<typeof setTimeout>;
  /** One at a time: the second call dies with an error nobody sees. */
  private sharing = false;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.revert));
  }

  async copy(url: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(url);
      this.copied.set(true);
      clearTimeout(this.revert);
      this.revert = setTimeout(() => this.copied.set(false), 2000);
    } catch {
      this.toasts.error('Cópialo a mano: ' + url);
    }
  }

  async share(): Promise<void> {
    const id = this.auth.businessId();
    if (id == null || this.sharing) return;
    this.sharing = true;
    try {
      const outcome = await shareOrCopy(businessLinkMessage(id, this.auth.businessName()), 'Pide cita en Bipsy');
      if (outcome === 'copied') this.toasts.show('Mensaje copiado. Pégalo donde quieras.');
      if (outcome === 'failed') this.toasts.error('No se ha podido abrir el menú de compartir.');
    } finally {
      this.sharing = false;
    }
  }
}
