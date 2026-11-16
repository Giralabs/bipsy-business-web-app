import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api } from '../core/api/api';
import { BusinessProfile } from '../core/api/models';
import { AuthService } from '../core/auth/auth.service';
import { businessLink, businessLinkLabel, businessLinkMessage } from '../core/business-link';
import { shareOrCopy } from '../core/util/share';
import { ToastService } from '../ui/toast.service';
import { PnQrComponent } from './qr.component';

/** GET /businesses/me/subdomain/check. */
interface SubdomainCheck {
  subdomain: string;
  available: boolean;
  reason: string | null;
}

/**
 * `/panel/enlace` — `share_link_screen.dart`: the link a business hands out on
 * its Instagram, over WhatsApp or on the door, and its QR.
 *
 * The link is its subdomain, `esteticaluna.bipsy.es` (backend V131), which
 * redirects to its page. It is written out under the QR, and the owner can
 * change it here: what is typed is checked as it goes, and the old one keeps
 * leading to the business, so posters already printed still work.
 *
 * A worker sees it too, on purpose: the link belongs to the business they work
 * at, and it hands out appointments that land in their own agenda. Only the
 * owner can change it.
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

          <!-- The address itself, to read out or copy from the bio. -->
          @if (!editing()) {
            <p class="lk__address">
              <span>{{ label() }}</span>
              @if (auth.isBusiness()) {
                <button type="button" class="pn-btn pn-btn--text pn-btn--sm" (click)="startEdit()">
                  <span class="material-symbols-rounded">edit</span>Cambiar
                </button>
              }
            </p>
            <p class="lk__foot">Ponlo en la bio de Instagram, en tus historias o en WhatsApp: desde ahí te piden cita sin descargar nada.</p>
          } @else {
            <form class="lk__edit" (submit)="$event.preventDefault(); save()">
              <label class="pn-field__label" for="lk-subdomain">Tu enlace en Bipsy</label>
              <div class="lk__input">
                <input id="lk-subdomain" class="pn-input" [class.pn-input--invalid]="check() && !check()!.available"
                  autocomplete="off" autocapitalize="none" spellcheck="false" maxlength="40"
                  [value]="draft()" (input)="onDraft($any($event.target).value)" />
                <span class="lk__suffix">.bipsy.es</span>
              </div>
              @if (check(); as c) {
                @if (c.available) {
                  <p class="lk__ok"><span class="material-symbols-rounded">check_circle</span>{{ c.subdomain }}.bipsy.es está libre</p>
                } @else {
                  <p class="pn-field__error">{{ c.reason }}</p>
                }
              } @else {
                <p class="pn-field__hint">Minúsculas y números (y guiones si quieres). Lo corto y fácil de decir funciona mejor.</p>
              }
              <div class="lk__edit-actions">
                <button type="button" class="pn-btn pn-btn--secondary" (click)="editing.set(false)" [disabled]="saving()">Cancelar</button>
                <button type="submit" class="pn-btn pn-btn--primary" [disabled]="saving() || !check()?.available">
                  {{ saving() ? 'Guardando…' : 'Guardar' }}
                </button>
              </div>
              <p class="pn-field__hint">El de ahora seguirá llevando a tu negocio, así que los carteles ya impresos no se pierden.</p>
            </form>
          }

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
      .lk__address {
        display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 4px 8px;
        margin-top: 18px; font-size: 1.125rem; font-weight: 800; letter-spacing: -0.2px; word-break: break-all;
      }
      .lk__foot { margin-top: 8px; font-size: 0.9375rem; line-height: 1.5; color: var(--clr-text-2); }
      .lk__edit { margin-top: 18px; text-align: left; }
      .lk__input { display: flex; align-items: center; gap: 0; }
      .lk__suffix { padding-left: 6px; font-weight: 700; color: var(--clr-text-2); white-space: nowrap; }
      .lk__input .pn-input { flex: 1; min-width: 0; }
      .lk__ok { display: flex; align-items: center; gap: 6px; margin-top: 9px; font-size: 0.8125rem; font-weight: 600; color: var(--clr-success-text, var(--clr-text)); }
      .lk__ok .material-symbols-rounded { font-size: 18px; }
      .lk__edit-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 14px; }
      .lk__actions { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 20px; }
      .lk__poster { margin-top: 24px; text-align: left; }
    `,
  ],
})
export class EnlaceComponent {
  readonly auth = inject(AuthService);
  private readonly api = inject(Api);
  private readonly toasts = inject(ToastService);

  readonly copied = signal(false);
  readonly editing = signal(false);
  readonly draft = signal('');
  readonly check = signal<SubdomainCheck | null>(null);
  readonly saving = signal(false);

  readonly link = computed(() => {
    const id = this.auth.businessId();
    return id == null ? null : businessLink(id, this.auth.businessName(), this.auth.businessSubdomain());
  });

  /** `esteticaluna.bipsy.es`, without the protocol. */
  readonly label = computed(() => {
    const id = this.auth.businessId();
    return id == null ? '' : businessLinkLabel(id, this.auth.businessName(), this.auth.businessSubdomain());
  });

  private revert?: ReturnType<typeof setTimeout>;
  private checkTimer?: ReturnType<typeof setTimeout>;
  /** Only the answer to the last thing typed counts. */
  private checkSeq = 0;
  /** One at a time: the second call dies with an error nobody sees. */
  private sharing = false;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(this.revert);
      clearTimeout(this.checkTimer);
    });
  }

  startEdit(): void {
    this.draft.set(this.auth.businessSubdomain() ?? '');
    this.check.set(null);
    this.editing.set(true);
  }

  /** Checked as it is typed, a moment after the last key. */
  onDraft(value: string): void {
    this.draft.set(value);
    this.check.set(null);
    clearTimeout(this.checkTimer);
    const typed = value.trim();
    if (!typed || typed.toLowerCase() === this.auth.businessSubdomain()) return;
    const seq = ++this.checkSeq;
    this.checkTimer = setTimeout(async () => {
      try {
        const result = await this.api.get<SubdomainCheck>('/businesses/me/subdomain/check', { value: typed });
        if (seq === this.checkSeq) this.check.set(result);
      } catch {
        if (seq === this.checkSeq) this.check.set({ subdomain: typed, available: false, reason: 'No se ha podido comprobar. Inténtalo otra vez.' });
      }
    }, 350);
  }

  async save(): Promise<void> {
    const c = this.check();
    if (!c?.available || this.saving()) return;
    this.saving.set(true);
    try {
      const updated = await this.api.put<BusinessProfile>('/businesses/me/subdomain', { subdomain: c.subdomain });
      const sub = updated.subdomain ?? c.subdomain;
      this.auth.patchProfile({ subdomain: sub });
      this.editing.set(false);
      this.toasts.show(`Tu enlace ahora es ${sub}.bipsy.es. El anterior sigue funcionando.`);
    } catch {
      this.toasts.error('No se ha podido guardar. Puede que alguien lo haya cogido justo ahora: prueba con otro.');
    } finally {
      this.saving.set(false);
    }
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
      const outcome = await shareOrCopy(
        businessLinkMessage(id, this.auth.businessName(), this.auth.businessSubdomain()),
        'Pide cita en Bipsy',
      );
      if (outcome === 'copied') this.toasts.show('Mensaje copiado. Pégalo donde quieras.');
      if (outcome === 'failed') this.toasts.error('No se ha podido abrir el menú de compartir.');
    } finally {
      this.sharing = false;
    }
  }
}
