import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Api } from '../core/api/api';
import { AuthService } from '../core/auth/auth.service';
import { ServicesStore } from '../core/data/services.store';
import { PnSwitchComponent } from '../ui/controls';
import { PnPhotoPickerComponent } from '../ui/photo-picker.component';
import { ToastService } from '../ui/toast.service';

/**
 * `/panel/ajustes/reservas` — `booking_settings_screen.dart`.
 *
 * Every field writes to `PUT /businesses/me/settings`. The summaries under
 * each one are not decoration: they are the app's own sentences, because a
 * number like «120 minutes» means nothing until it reads «se podrá reservar a
 * partir de 2 horas desde ahora».
 */
@Component({
  selector: 'app-panel-reservas',
  standalone: true,
  imports: [FormsModule, RouterLink, PnSwitchComponent, PnPhotoPickerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reservas.component.html',
  styles: [
    `
      :host { display: block; }
      .back { margin: 0 0 14px -12px; text-decoration: none; }
      .field-row { display: flex; align-items: center; gap: 12px; }
      .field-row input, .field-row select { width: 120px; }
      .field-row input[name='ownerName'] { width: 200px; }
      .unit { font-size: 0.875rem; color: var(--clr-text-3); }
      .owner-photo {
        display: grid;
        place-items: center;
        width: 44px;
        height: 44px;
        border-radius: 50%;
        overflow: hidden;
        background: var(--clr-surface-2, rgba(128, 128, 128, 0.12));
        color: var(--clr-text-3);
      }
      .owner-photo img { width: 100%; height: 100%; object-fit: cover; }
      .owner-picker { display: flex; flex-direction: column; gap: 6px; align-items: flex-start; }
      .travel { display: flex; flex-direction: column; gap: 8px; padding: 16px 20px; }
      .travel__head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
      .travel__value { font-weight: 800; }
      .travel__slider { width: 100%; accent-color: var(--pn-accent); }
      .travel__slider:disabled { opacity: 0.45; }
    `,
  ],
})
export class ReservasComponent {
  private readonly api = inject(Api);
  private readonly services = inject(ServicesStore);
  private readonly toasts = inject(ToastService);
  readonly auth = inject(AuthService);

  readonly busy = signal(false);
  readonly uploading = signal(false);

  /**
   * Does this business have a team at all? `teamEnabled` is what the app
   * reads; `autonomous` is the panel's older name for the opposite, and it is
   * the fallback while an old `/me` does not carry the new flag.
   */
  readonly hasTeam = computed(() => {
    const profile = this.auth.profile();
    if (profile?.teamEnabled != null) return profile.teamEnabled;
    return !this.auth.isAutonomous();
  });

  ownerPerforms = this.auth.profile()?.ownerPerforms ?? false;
  /** Never starts empty: without a personal name, the shop's name stands in. */
  ownerDisplayName =
    (this.auth.profile()?.ownerDisplayName || '').trim() || (this.auth.profile()?.name ?? '');

  horizon = this.auth.profile()?.availabilityHorizonDays ?? 60;
  notice = this.auth.profile()?.minBookingNoticeMinutes ?? 0;
  noticeUnit: 'min' | 'h' | 'd' = 'h';
  slot = this.auth.profile()?.slotMinutes ?? 15;
  autoAccept = this.auth.profile()?.autoAccept ?? false;
  limitEnabled = this.auth.profile()?.bookingLimitEnabled ?? false;
  limit = this.auth.profile()?.bookingLimitPerCustomer ?? 3;
  allowOvertime = this.auth.profile()?.allowOvertime ?? false;

  /**
   * Whether the business goes to the customer's home: the round-trip margin
   * only means something then, and a slider that does nothing is worse than
   * no slider.
   */
  readonly travels = computed(() => (this.auth.profile()?.serviceMode ?? 'AT_BUSINESS') !== 'AT_BUSINESS');

  /** Minutes kept free around an AT-HOME appointment. Zero = none. */
  travelBuffer = this.auth.profile()?.travelBufferMinutes ?? 0;
  /**
   * The same value, but only updated on release (`change`, not `input`). The
   * footer is written with this one: a sentence that changes with every pixel
   * of the drag jumps lines and tells nothing.
   */
  travelBufferSettled = this.travelBuffer;

  get travelSummary(): string {
    const minutes = Number(this.travelBufferSettled);
    return minutes === 0
      ? 'Sin margen pueden darte dos domicilios seguidos aunque estén lejos.'
      : `Se reservan ${minutes} min antes y después de cada domicilio. No afecta a tu local ni a las citas ya dadas.`;
  }

  /** What the interval was when the screen opened, to notice a real change. */
  private savedSlot = this.auth.profile()?.slotMinutes ?? 15;

  constructor() {
    void this.services.load();
    // Show the notice in the biggest unit that divides it cleanly.
    const minutes = this.notice;
    if (minutes % 1440 === 0 && minutes > 0) {
      this.noticeUnit = 'd';
      this.notice = minutes / 1440;
    } else if (minutes % 60 === 0 && minutes > 0) {
      this.noticeUnit = 'h';
      this.notice = minutes / 60;
    } else {
      this.noticeUnit = 'min';
    }
  }

  readonly noticeMinutes = computed(() => 0);

  get noticeInMinutes(): number {
    const factor = this.noticeUnit === 'd' ? 1440 : this.noticeUnit === 'h' ? 60 : 1;
    return Math.max(0, Math.round(this.notice * factor));
  }

  get noticeSummary(): string {
    const minutes = this.noticeInMinutes;
    if (minutes === 0) return 'Se puede reservar para ahora mismo.';
    if (minutes < 60) return `Se podrá reservar a partir de ${minutes} minutos desde ahora.`;
    if (minutes < 1440) {
      const hours = Math.round(minutes / 60);
      return `Se podrá reservar a partir de ${hours} ${hours === 1 ? 'hora' : 'horas'} desde ahora.`;
    }
    const days = Math.round(minutes / 1440);
    return `Se podrá reservar a partir de ${days} ${days === 1 ? 'día' : 'días'} desde ahora.`;
  }

  get horizonSummary(): string {
    return `Podrán reservarte hasta ${this.horizon} días por delante.`;
  }

  get limitSummary(): string {
    return `Cada cliente podrá tener ${this.limit} citas sin pasar. Las canceladas y las ya pasadas no cuentan.`;
  }

  /**
   * The owner's own photo as a professional
   * (`POST|DELETE /businesses/me/images/owner`). It saves on its own, not with
   * the form's button, exactly like the business photos: a picked file is
   * already a decision.
   */
  async uploadOwnerPhoto(file: File): Promise<void> {
    this.uploading.set(true);
    try {
      await this.api.upload('/businesses/me/images/owner', file);
      await this.auth.refreshMe();
      this.toasts.show('Foto actualizada');
    } catch {
      this.toasts.error('No se ha podido subir. Vuelve a intentarlo en un momento.');
    } finally {
      this.uploading.set(false);
    }
  }

  async removeOwnerPhoto(): Promise<void> {
    try {
      await this.api.delete('/businesses/me/images/owner');
      await this.auth.refreshMe();
      this.toasts.show('Foto quitada');
    } catch {
      this.toasts.error('La foto sigue puesta. Vuelve a intentarlo en un momento.');
    }
  }

  async save(): Promise<void> {
    if (this.hasTeam() && this.ownerPerforms && !this.ownerDisplayName.trim()) {
      this.toasts.error('Escribe tu nombre.');
      return;
    }
    this.busy.set(true);
    try {
      const patch = {
        availabilityHorizonDays: Math.min(365, Math.max(1, this.horizon)),
        minBookingNoticeMinutes: Math.min(43200, this.noticeInMinutes),
        slotMinutes: Math.min(240, Math.max(5, this.slot)),
        autoAccept: this.autoAccept,
        allowOvertime: this.allowOvertime,
        bookingLimitEnabled: this.limitEnabled,
        bookingLimitPerCustomer: this.limitEnabled ? Math.min(100, Math.max(1, this.limit)) : null,
        // Always sent: taking it down to zero is as valid as raising it, and
        // with an `if (> 0)` there would be no way to turn it off.
        travelBufferMinutes: Math.min(120, Math.max(0, Math.round(Number(this.travelBuffer)))),
        ...(this.hasTeam()
          ? {
              ownerPerforms: this.ownerPerforms,
              // Only when the owner attends: otherwise the name means nothing.
              ...(this.ownerPerforms ? { ownerDisplayName: this.ownerDisplayName.trim() } : {}),
            }
          : {}),
      };
      const slotChanged = patch.slotMinutes !== this.savedSlot;
      await this.api.put('/businesses/me/settings', patch);
      this.auth.patchProfile(patch);
      await this.services.services.reload();
      this.savedSlot = patch.slotMinutes;
      // The server realigns every service duration to the new interval, so
      // saying just «Guardado» would hide a change the owner did not ask for.
      this.toasts.show(
        slotChanged
          ? 'Intervalo actualizado. Se ajustó la duración de tus servicios al nuevo intervalo.'
          : 'Guardado',
      );
    } catch {
      this.toasts.error('No se pudo guardar. Revisa tu conexión.');
    } finally {
      this.busy.set(false);
    }
  }
}
