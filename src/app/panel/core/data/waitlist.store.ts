import { Injectable, computed, inject } from '@angular/core';
import { Api } from '../api/api';
import { BusinessWaitlistEntry, OfferSlotResult, WaitlistNotifyMode } from '../api/models';
import { AuthService } from '../auth/auth.service';
import { resource } from './resource';

/**
 * The queue of customers who did not find a slot. Twin of
 * `waitlist_providers.dart`.
 *
 * `POST /businesses/me/waitlist/offer` exists in the API and in the Dart
 * repository but no screen in the app calls it: on a desktop agenda a freed
 * slot is right there next to the queue, so the panel does use it.
 */
@Injectable({ providedIn: 'root' })
export class WaitlistStore {
  private readonly api = inject(Api);
  private readonly auth = inject(AuthService);

  readonly entries = resource<BusinessWaitlistEntry[]>(
    () => this.api.get<BusinessWaitlistEntry[]>('/businesses/me/waitlist'),
    [],
  );

  readonly all = this.entries.value;
  readonly count = computed(() => this.all().filter((e) => e.status !== 'BOOKED').length);
  /**
   * The owner sees the queue when the business has it on. A worker also needs
   * the owner's `waitlistManageEnabled`; their `/me` (`WorkerResponse`) does
   * not carry the business flag, so it is read from the employer's public page.
   */
  readonly enabled = computed(() => {
    if (this.auth.isBusiness()) return this.auth.waitlistEnabled();
    if (!this.auth.isWorker()) return false;
    return (
      this.auth.profile()?.waitlistManageEnabled === true &&
      this.auth.employer()?.waitlistEnabled === true
    );
  });

  load(): Promise<void> {
    return this.enabled() ? this.entries.load() : Promise.resolve();
  }

  async reorder(entryIds: number[]): Promise<void> {
    const before = this.all();
    this.entries.set(
      [...before]
        .sort((a, b) => entryIds.indexOf(a.id) - entryIds.indexOf(b.id))
        .map((entry, index) => ({ ...entry, position: index + 1 })),
    );
    try {
      // The server answers with the list already renumbered.
      this.entries.set(
        await this.api.put<BusinessWaitlistEntry[]>('/businesses/me/waitlist/reorder', { entryIds }),
      );
    } catch (cause) {
      this.entries.set(before);
      throw cause;
    }
  }

  async remove(id: number): Promise<void> {
    await this.api.delete(`/businesses/me/waitlist/${id}`);
    await this.entries.reload();
  }

  /**
   * Offers a slot to the queue; the mode decides who hears about it. The offer
   * is not tied to one entry: the server finds whoever fits service, worker
   * and time. `slotStart` is wall-clock time without a zone (`toIso()`).
   */
  async offer(serviceId: number, workerId: number | null, slotStart: string): Promise<OfferSlotResult> {
    const result = await this.api.post<OfferSlotResult>('/businesses/me/waitlist/offer', {
      serviceId,
      workerId,
      slotStart,
    });
    await this.entries.reload();
    return result;
  }

  async saveSettings(mode: WaitlistNotifyMode, responseHours: number): Promise<void> {
    await this.api.put('/businesses/me/settings', {
      waitlistNotifyMode: mode,
      waitlistResponseHours: responseHours,
    });
    this.auth.patchProfile({ waitlistNotifyMode: mode, waitlistResponseHours: responseHours });
  }
}
