import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';
import { message } from '../core/data/resource';
import {
  BUSINESS_NOTIF_GROUPS,
  NotifGroup,
  NotifKeyValue,
  NotificationPrefs,
  WORKER_NOTIF_GROUPS,
} from '../core/data/desktop-notify.service';
import { PnSwitchComponent } from '../ui/controls';
import { ToastService } from '../ui/toast.service';

/**
 * `/panel/ajustes/notificaciones` — `notifications_screen_business.dart`.
 *
 * One row per group with its switch, and its notices unfold BELOW while it is
 * on. The group switch is a control, not a summary: it turns them all on or off.
 * It stays on while one is left, so turning off the last one folds the list. A
 * group of a single notice does not unfold: its row already is that notice.
 *
 * All of that belongs to the account and lives on the server. Only «Este
 * navegador» is local: `notif_web_desktop` and the browser's permission.
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
          <p class="pn-head__greet">Elige qué notificaciones quieres recibir.</p>
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
                    <pn-switch [checked]="prefs.desktopEnabled()" label="Avisos en el escritorio"
                               (toggle)="setDesktop($event)" />
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

          @switch (prefs.status()) {
            @case ('error') {
              <!-- Not painted as «all on»: that would lie about their settings. -->
              <div class="pn-empty">
                <span class="material-symbols-rounded">cloud_off</span>
                <p>No hemos podido cargar tus avisos.</p>
                <button type="button" class="pn-btn pn-btn--secondary" (click)="prefs.load(true)">Reintentar</button>
              </div>
            }
            @case ('ready') {
              @for (group of groups(); track group.title) {
                <div class="pn-group">
                  <div class="pn-group__body">
                    <div class="pn-row">
                      <span class="material-symbols-rounded pn-row__icon">{{ group.icon }}</span>
                      <span class="pn-row__main"><span class="pn-row__title">{{ group.title }}</span></span>
                      <pn-switch [checked]="groupOn(group)" [label]="group.title"
                                 (toggle)="setGroup(group, $event)" />
                    </div>
                    @if (group.notices.length > 1 && groupOn(group)) {
                      @for (notice of group.notices; track notice.key) {
                        <div class="pn-row notice">
                          <span class="material-symbols-rounded pn-row__icon">{{ notice.icon }}</span>
                          <span class="pn-row__main"><span class="pn-row__title">{{ notice.label }}</span></span>
                          <pn-switch [checked]="prefs.isEnabled(notice.key)" [label]="notice.label"
                                     (toggle)="save([notice.key], $event)" />
                        </div>
                      }
                    }
                  </div>
                </div>
              }
              <p class="pn-group__foot">
                Valen para tu cuenta, también en el móvil. Los avisos de cobros y de seguridad llegan siempre.
              </p>
            }
            @default {
              <div class="pn-skeleton" style="height:320px;margin-top:16px"></div>
            }
          }
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
      .denied { margin-top: 14px; }
      .notice { padding-left: 32px; }
    `,
  ],
})
export class NotificacionesComponent {
  readonly auth = inject(AuthService);
  readonly prefs = inject(NotificationPrefs);
  private readonly toasts = inject(ToastService);

  readonly groups = computed<NotifGroup[]>(() => {
    const base = this.auth.isWorker() ? WORKER_NOTIF_GROUPS : BUSINESS_NOTIF_GROUPS;
    // An autonomous business has no team: no absence requests, no clock-ins.
    return this.auth.isBusiness() && this.auth.isAutonomous()
      ? base.filter((g) => g.title !== 'Ausencias' && g.title !== 'Fichaje')
      : base;
  });

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

  constructor() {
    void this.prefs.load();
  }

  groupOn(group: NotifGroup): boolean {
    return group.notices.some((notice) => this.prefs.isEnabled(notice.key));
  }

  setGroup(group: NotifGroup, on: boolean): void {
    void this.save(group.notices.map((notice) => notice.key), on);
  }

  /** The service already undid it; all that is left is saying why it moved back. */
  async save(keys: NotifKeyValue[], on: boolean): Promise<void> {
    try {
      await this.prefs.setEnabled(keys, on);
    } catch (cause) {
      this.toasts.error(message(cause) || 'No hemos podido guardar el cambio.');
    }
  }

  setDesktop(on: boolean): void {
    if (!this.prefs.setDesktopEnabled(on)) this.toasts.error('Tu navegador no deja guardar esta preferencia.');
  }

  async ask(): Promise<void> {
    const answer = await this.prefs.requestPermission();
    if (answer === 'granted') {
      this.prefs.setDesktopEnabled(true);
      this.toasts.show('Avisos activados');
    } else if (answer === 'denied') {
      this.toasts.error('El navegador ha bloqueado los avisos.');
    }
  }
}
