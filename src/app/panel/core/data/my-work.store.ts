import { Injectable, computed, inject, signal } from '@angular/core';
import { Api } from '../api/api';
import { Absence, AbsenceType, ClockEntry, PageResponse } from '../api/models';
import { AuthService } from '../auth/auth.service';
import { resource } from './resource';

const CLOCK_PAGE_SIZE = 20;

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

  /**
   * Closed shifts, most recent first and by pages (`PageResponse`). The open one
   * is left out by the server, because the stopwatch already paints it, so
   * `clockTotal` is exactly «recorded shifts».
   */
  readonly clockHistory = resource<ClockEntry[]>(() => {
    this.clockPage = 0;
    return this.nextClockPage();
  }, []);

  private clockPage = 0;
  readonly clockTotal = signal(0);
  readonly clockHasMore = signal(false);
  readonly clockLoadingMore = signal(false);

  private async nextClockPage(): Promise<ClockEntry[]> {
    const page = await this.api.get<PageResponse<ClockEntry>>('/timeclock/me', {
      page: this.clockPage,
      size: CLOCK_PAGE_SIZE,
    });
    this.clockPage += 1;
    this.clockTotal.set(page.totalElements);
    this.clockHasMore.set(!page.last && page.content.length > 0);
    return page.content;
  }

  /** The next page of the history, on request. */
  async loadMoreClock(): Promise<void> {
    if (this.clockLoadingMore() || !this.clockHasMore()) return;
    this.clockLoadingMore.set(true);
    try {
      const more = await this.nextClockPage();
      this.clockHistory.set([...this.clockHistory.value(), ...more]);
    } finally {
      this.clockLoadingMore.set(false);
    }
  }

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
