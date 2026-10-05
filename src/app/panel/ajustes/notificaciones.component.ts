import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';
import {
  BUSINESS_NOTIF_SECTIONS,
  CHAT_NOTIF_SECTION,
  NotifKey,
  NotifKeyValue,
  NotifSection,
  NotificationPrefs,
  WAITLIST_NOTIF_SECTION,
  WORKER_NOTIF_SECTIONS,
} from '../core/data/desktop-notify.service';
import { WaitlistStore } from '../core/data/waitlist.store';
import { PnSwitchComponent } from '../ui/controls';
import { ToastService } from '../ui/toast.service';

/**
 * `/panel/ajustes/notificaciones` — `notifications_screen_business.dart`.
 *
 * In the app these preferences belong to the device, not the account. Same
 * here: they live in this browser (same keys as the app, `notif_*`, which are
 * also the `notifKey`s of the backend) and decide which desktop notifications
 * `DesktopNotifyService` shows while the panel is open. The owner and a worker
 * see their own kinds, as in the app.
 */
@Component({
  selector: 'app-panel-notificaciones',
  standalone: true,
  imports: [RouterLink, PnSwitchComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="pn-main">
      <a class="pn-btn pn-btn--text pn-btn--sm back"
         [routerLink]="auth.isWorker() ? '/panel/mi-perfil' : '/panel/ajustes'">
        <span class="material-symbols-rounded">arrow_back</span>{{ auth.isWorker() ? 'Mi perfil' : 'Ajustes' }}
      </a>

      <div class="pn-head">
        <div class="pn-head__text">
          <p class="pn-head__greet">Elige qué notificaciones quieres recibir en este dispositivo.</p>
          <h1>Notificaciones</h1>
        </div>
      </div>

      <div class="pn-grid">
        <div class="pn-col-7">
          <div class="pn-group">
            <p class="pn-group__head">Este navegador</p>
            <div class="pn-group__body">
              <div class="pn-row">
                <span class="material-symbols-rounded pn-row__icon">desktop_windows</span>
                <span class="pn-row__main">
                  <span class="pn-row__title">Avisos en el escritorio</span>
                  <span class="pn-row__sub">{{ permissionText() }}</span>
                </span>
                @switch (prefs.permission()) {
                  @case ('granted') {
                    <pn-switch [checked]="value(keys.webDesktop)" label="Avisos en el escritorio"
                               (toggle)="set(keys.webDesktop, $event)" />
                  }
                  @case ('default') {
                    <button type="button" class="pn-btn pn-btn--primary pn-btn--sm" (click)="ask()">Activar</button>
                  }
                  @case ('denied') {
                    <span class="pn-status pn-status--grey">Bloqueados</span>
                  }
                  @default {
                    <span class="pn-status pn-status--grey">No disponible</span>
                  }
                }
              </div>
            </div>
          </div>

          @for (section of sections(); track section.title) {
            <div class="pn-group">
              <p class="pn-group__head">{{ section.title }}</p>
              <div class="pn-group__body">
                @for (pref of section.prefs; track pref.key) {
                  <div class="pn-row" [class.off]="!live()">
                    <span class="material-symbols-rounded pn-row__icon">{{ pref.icon }}</span>
                    <span class="pn-row__main">
                      <span class="pn-row__title">{{ pref.title }}</span>
                      <span class="pn-row__sub">{{ pref.sub }}</span>
                    </span>
                    @if (pref.web) {
                      <pn-switch [checked]="value(pref.key)" [label]="pref.title"
                                 (toggle)="set(pref.key, $event)" />
                    } @else {
                      <span class="pn-status pn-status--grey">Solo en el móvil</span>
                    }
                  </div>
                }
              </div>
            </div>
          }
          <p class="pn-group__foot">
            Esto vale solo para este navegador. En tu móvil, los avisos se ajustan desde la app.
          </p>
        </div>

        <div class="pn-col-5">
          <div class="pn-notice pn-notice--info">
            <span class="material-symbols-rounded">notifications</span>
            <div>
              <strong>Mientras el panel está abierto</strong>
              <span class="pn-notice__body">
                Te avisamos cuando el panel está en otra pestaña o detrás de otra ventana. Si lo estás
                mirando, lo nuevo ya aparece en pantalla. Con el panel cerrado, los avisos te llegan al móvil.
              </span>
            </div>
          </div>
          @if (prefs.permission() === 'denied') {
            <div class="pn-notice pn-notice--warn denied">
              <span class="material-symbols-rounded">block</span>
              <div>
                <strong>El navegador los tiene bloqueados</strong>
                <span class="pn-notice__body">
                  Pulsa el candado junto a la dirección de la página, permite las notificaciones y vuelve
                  a cargar el panel.
                </span>
              </div>
            </div>
          }
        </div>
      </div>
    </main>
  `,
  styles: [
    `
      :host { display: block; }
      .back { margin: 0 0 14px -12px; text-decoration: none; }
      .off { opacity: 0.55; }
      .denied { margin-top: 14px; }
    `,
  ],
})
export class NotificacionesComponent {
  readonly auth = inject(AuthService);
  readonly prefs = inject(NotificationPrefs);
  private readonly waitlist = inject(WaitlistStore);
  private readonly toasts = inject(ToastService);

  readonly keys = NotifKey;

  readonly sections = computed<NotifSection[]>(() => {
    const base = this.auth.isWorker() ? WORKER_NOTIF_SECTIONS : BUSINESS_NOTIF_SECTIONS;
    // An autonomous business has no team: no absence requests, no clock-ins.
    const own = this.auth.isBusiness() && this.auth.isAutonomous()
      ? base.filter((s) => s.title !== 'Ausencias' && s.title !== 'Fichajes')
      : base;
    return [
      ...own,
      // Shared by both roles, and only where there is something to hear about.
      ...(this.waitlist.enabled() ? [WAITLIST_NOTIF_SECTION] : []),
      ...(this.auth.canUseChat() ? [CHAT_NOTIF_SECTION] : []),
    ];
  });

  /** The per-kind switches only matter once the browser shows notifications. */
  readonly live = computed(
    () => this.prefs.permission() === 'granted' && this.prefs.isEnabled(NotifKey.webDesktop),
  );

  readonly permissionText = computed(() => {
    switch (this.prefs.permission()) {
      case 'granted':
        return 'Este navegador te avisa aunque estés en otra pestaña.';
      case 'default':
        return 'Te pediremos permiso para enseñarte avisos en el ordenador.';
      case 'denied':
        return 'Has bloqueado los avisos de Bipsy en este navegador.';
      default:
        return 'Este navegador no puede enseñar avisos.';
    }
  });

  value(key: NotifKeyValue): boolean {
    return this.prefs.isEnabled(key);
  }

  set(key: NotifKeyValue, on: boolean): void {
    if (!this.prefs.set(key, on)) this.toasts.error('Tu navegador no deja guardar esta preferencia.');
  }

  async ask(): Promise<void> {
    const answer = await this.prefs.requestPermission();
    if (answer === 'granted') {
      this.prefs.set(NotifKey.webDesktop, true);
      this.toasts.show('Avisos activados');
    } else if (answer === 'denied') {
      this.toasts.error('El navegador ha bloqueado los avisos.');
    }
  }
}
