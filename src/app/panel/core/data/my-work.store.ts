import { Injectable, computed, inject } from '@angular/core';
import { Api } from '../api/api';
import { Absence, AbsenceType, ClockEntry } from '../api/models';
import { AuthService } from '../auth/auth.service';
import { resource } from './resource';

export interface AbsenceRequest {
  type: AbsenceType;
  /** `yyyy-MM-dd`, both inclusive. */
  startDate: string;
  endDate: string;
  reason?: string | null;
}

/**
 * Lo de un trabajador sobre sí mismo: su fichaje, sus ausencias y sus
 * preferencias. Gemelo de `timeclock_providers.dart`, `absences_providers.dart`
 * (la parte de `/absences/me`) y `_WorkerSelfSettingsSection`.
 *
 * Todo cuelga de `/timeclock/**`, `/absences` y `/workers/me/**`, que el
 * backend reserva al rol WORKER.
 */
@Injectable({ providedIn: 'root' })
export class MyWorkStore {
  private readonly api = inject(Api);
  private readonly auth = inject(AuthService);

  /** El turno abierto, o null. El backend contesta 204 cuando no hay. */
  readonly openClock = resource<ClockEntry | null>(
    async () => (await this.api.get<ClockEntry | null>('/timeclock/me/open')) ?? null,
    null,
  );

  readonly clockHistory = resource<ClockEntry[]>(() => this.api.get<ClockEntry[]>('/timeclock/me'), []);

  readonly absences = resource<Absence[]>(() => this.api.get<Absence[]>('/absences/me'), []);

  readonly clockedIn = computed(() => this.openClock.value() !== null);
  readonly pendingAbsences = computed(() => this.absences.value().filter((a) => a.status === 'PENDING'));

  async checkIn(): Promise<void> {
    await this.api.post('/timeclock/check-in');
    await Promise.all([this.openClock.reload(), this.clockHistory.reload()]);
  }

  async checkOut(): Promise<void> {
    await this.api.post('/timeclock/check-out');
    await Promise.all([this.openClock.reload(), this.clockHistory.reload()]);
  }

  /** Se crea PENDIENTE: la aprueba o la rechaza el negocio. */
  async requestAbsence(request: AbsenceRequest): Promise<void> {
    await this.api.post('/absences', { ...request, reason: request.reason?.trim() || null });
    await this.absences.reload();
  }

  async cancelAbsence(id: number): Promise<void> {
    await this.api.delete(`/absences/${id}`);
    await this.absences.reload();
  }

  /**
   * «Disponible» y «Aceptar solas» (`PUT /workers/me/settings`). Se aplica en
   * local antes de preguntar al servidor, y se deshace si dice que no.
   */
  async updateSettings(patch: { available?: boolean; autoAccept?: boolean }): Promise<void> {
    const before = this.auth.profile();
    this.auth.patchProfile(patch);
    try {
      await this.api.put('/workers/me/settings', patch);
    } catch (cause) {
      if (before) this.auth.patchProfile({ available: before.available, autoAccept: before.autoAccept });
      throw cause;
    }
  }

  /** `PUT /workers/me`: nombre y teléfono. El correo no se cambia desde aquí. */
  async updateProfile(name: string, phone: string): Promise<void> {
    await this.api.put('/workers/me', { name, phone });
    await this.auth.refreshMe();
  }

  async uploadAvatar(file: File): Promise<void> {
    await this.api.upload('/workers/me/image', file);
    await this.auth.refreshMe();
  }

  async removeAvatar(): Promise<void> {
    await this.api.delete('/workers/me/image');
    await this.auth.refreshMe();
  }

  /** El código de invitación del negocio; el trabajador solo lo lee. */
  referral(): Promise<{ code: string | null; editable: boolean }> {
    return this.api.get('/workers/me/referral');
  }
}
