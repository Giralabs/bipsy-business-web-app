import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';
import { MyWorkStore } from '../core/data/my-work.store';
import { message } from '../core/data/resource';
import { PnAvatarComponent, PnSwitchComponent } from '../ui/controls';
import { PnPhotoPickerComponent } from '../ui/photo-picker.component';
import { ToastService } from '../ui/toast.service';

/**
 * `/panel/mi-perfil` — el perfil de un trabajador: `edit_worker_screen.dart`,
 * `worker_avatar_picker_sheet.dart` y el bloque `_WorkerSelfSettingsSection`
 * de `profile_screen.dart`, más el código de invitación del negocio, que el
 * trabajador puede compartir pero no cambiar.
 */
@Component({
  selector: 'app-mi-perfil',
  standalone: true,
  imports: [FormsModule, RouterLink, PnAvatarComponent, PnSwitchComponent, PnPhotoPickerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="pn-main">
      <div class="pn-head pf-head">
        <pn-avatar [name]="auth.user()?.name ?? ''" [url]="auth.profile()?.profileImageUrl ?? null" size="xl" />
        <div class="pn-head__text">
          <p class="pn-head__greet">{{ auth.businessName() ? 'Trabajas en ' + auth.businessName() : 'Tu cuenta de trabajador' }}</p>
          <h1>{{ auth.user()?.name }}</h1>
        </div>
      </div>

      <div class="pn-grid">
        <section class="pn-card pn-col-7">
          <div class="pn-block__head">
            <span class="material-symbols-rounded">person</span>
            <h2>Tus datos</h2>
          </div>

          <label class="pn-field">
            <span class="pn-field__label">Nombre y apellidos</span>
            <input class="pn-input" name="name" autocomplete="name" [(ngModel)]="name" />
          </label>
          <label class="pn-field">
            <span class="pn-field__label">Teléfono</span>
            <input class="pn-input" type="tel" name="phone" autocomplete="tel" [(ngModel)]="phone" />
          </label>
          <label class="pn-field">
            <span class="pn-field__label">Correo</span>
            <input class="pn-input" [value]="auth.user()?.email ?? ''" disabled />
            <span class="pn-field__hint">El correo no se puede cambiar desde aquí.</span>
          </label>

          <button type="button" class="pn-btn pn-btn--primary" [disabled]="saving()" (click)="save()">
            @if (saving()) { <span class="pn-spinner"></span> } @else { Guardar cambios }
          </button>
        </section>

        <section class="pn-card pn-col-5">
          <div class="pn-block__head">
            <span class="material-symbols-rounded">add_a_photo</span>
            <h2>Tu foto</h2>
          </div>
          <pn-photo-picker class="pf-photo" label="Cambiar la foto" [current]="auth.profile()?.profileImageUrl ?? null"
                           [busy]="uploading()" (picked)="upload($event)" />
          @if (auth.profile()?.profileImageUrl) {
            <button type="button" class="pn-btn pn-btn--text pn-btn--sm pf-remove" (click)="removePhoto()">
              Quitar la foto
            </button>
          }
          <p class="pn-field__hint">La ven tus clientes al reservar contigo.</p>
        </section>

        <section class="pn-card pn-col-7">
          <div class="pn-block__head">
            <span class="material-symbols-rounded">tune</span>
            <h2>Preferencias</h2>
          </div>
          <div class="pn-group__body pf-rows">
            <div class="pn-row">
              <span class="material-symbols-rounded pn-row__icon">event_available</span>
              <span class="pn-row__main">
                <span class="pn-row__title">Disponible para reservas</span>
                <span class="pn-row__sub">Apágalo y no te entrarán citas nuevas hasta que lo vuelvas a encender.</span>
              </span>
              <pn-switch [checked]="auth.profile()?.available !== false" label="Disponible para reservas"
                         (toggle)="setting('available', $event)" />
            </div>
            <div class="pn-row">
              <span class="material-symbols-rounded pn-row__icon">done_all</span>
              <span class="pn-row__main">
                <span class="pn-row__title">Aceptar citas automáticamente</span>
                <span class="pn-row__sub">Tus reservas entran confirmadas, sin que tengas que aceptarlas una a una.</span>
              </span>
              <pn-switch [checked]="auth.profile()?.autoAccept === true" label="Aceptar citas automáticamente"
                         (toggle)="setting('autoAccept', $event)" />
            </div>
          </div>
        </section>

        <section class="pn-card pn-col-5">
          <div class="pn-block__head">
            <span class="material-symbols-rounded">card_giftcard</span>
            <h2>Código del negocio</h2>
          </div>
          @if (code(); as value) {
            <p class="pf-code pn-tabular">{{ value }}</p>
            <button type="button" class="pn-btn pn-btn--secondary pn-btn--sm" (click)="copy(value)">
              <span class="material-symbols-rounded">content_copy</span>Copiar
            </button>
            <p class="pn-field__hint">Compártelo con tus clientes: Bipsy lo tiene en cuenta para ofertas y recompensas.</p>
          } @else {
            <p class="pn-dim">Tu negocio todavía no ha elegido su código.</p>
          }
        </section>

        <section class="pn-card pn-col-12 pf-links">
          <a class="pn-row" routerLink="/panel/ajustes/cuenta">
            <span class="material-symbols-rounded pn-row__icon">lock</span>
            <span class="pn-row__main">
              <span class="pn-row__title">Contraseña y sesiones</span>
              <span class="pn-row__sub">Cambia tu contraseña o cierra la sesión en todos tus dispositivos.</span>
            </span>
            <span class="material-symbols-rounded pn-row__chev">arrow_forward_ios</span>
          </a>
          <a class="pn-row" routerLink="/panel/ajustes/notificaciones">
            <span class="material-symbols-rounded pn-row__icon">notifications</span>
            <span class="pn-row__main">
              <span class="pn-row__title">Notificaciones</span>
              <span class="pn-row__sub">Qué te avisamos en este ordenador.</span>
            </span>
            <span class="material-symbols-rounded pn-row__chev">arrow_forward_ios</span>
          </a>
          <a class="pn-row" routerLink="/panel/soporte">
            <span class="material-symbols-rounded pn-row__icon">support_agent</span>
            <span class="pn-row__main"><span class="pn-row__title">Soporte</span></span>
            <span class="material-symbols-rounded pn-row__chev">arrow_forward_ios</span>
          </a>
        </section>
      </div>
    </main>
  `,
  styles: [
    `
      :host { display: block; }
      .pf-head { align-items: center; }
      .pf-photo { margin-bottom: 10px; }
      .pf-remove { margin: 0 0 6px -12px; }
      .pf-rows { background: transparent; box-shadow: none; margin: 0 -20px; }
      .pf-code {
        margin: 4px 0 14px;
        font-family: var(--ff-display);
        font-size: 2rem;
        font-weight: 800;
        letter-spacing: 3px;
      }
      .pf-links { padding: 6px 0; overflow: hidden; }
    `,
  ],
})
export class MiPerfilComponent {
  readonly auth = inject(AuthService);
  private readonly work = inject(MyWorkStore);
  private readonly toasts = inject(ToastService);

  name = this.auth.user()?.name ?? '';
  phone = this.auth.user()?.phone ?? '';

  readonly saving = signal(false);
  readonly uploading = signal(false);
  readonly code = signal<string | null>(null);

  constructor() {
    this.work
      .referral()
      .then((referral) => this.code.set(referral.code || null))
      .catch(() => this.code.set(null));
  }

  async save(): Promise<void> {
    if (!this.name.trim() || !this.phone.trim()) {
      this.toasts.error('El nombre y el teléfono son obligatorios.');
      return;
    }
    this.saving.set(true);
    try {
      await this.work.updateProfile(this.name.trim(), this.phone.trim());
      this.toasts.show('Datos guardados');
    } catch (cause) {
      this.toasts.error(message(cause));
    } finally {
      this.saving.set(false);
    }
  }

  async setting(key: 'available' | 'autoAccept', value: boolean): Promise<void> {
    try {
      await this.work.updateSettings({ [key]: value });
    } catch {
      this.toasts.error('No se ha podido guardar. Inténtalo otra vez.');
    }
  }

  async upload(file: File): Promise<void> {
    this.uploading.set(true);
    try {
      await this.work.uploadAvatar(file);
      this.toasts.show('Foto actualizada');
    } catch (cause) {
      this.toasts.error(message(cause));
    } finally {
      this.uploading.set(false);
    }
  }

  async removePhoto(): Promise<void> {
    try {
      await this.work.removeAvatar();
      this.toasts.show('Foto quitada');
    } catch (cause) {
      this.toasts.error(message(cause));
    }
  }

  async copy(value: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      this.toasts.show('Código copiado');
    } catch {
      this.toasts.error('No se ha podido copiar.');
    }
  }
}
