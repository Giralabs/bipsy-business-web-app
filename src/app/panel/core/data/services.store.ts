import { Injectable, computed, inject } from '@angular/core';
import { Api } from '../api/api';
import { ServicePayload, ServiceResponse } from '../api/models';
import { AuthService } from '../auth/auth.service';
import { resource } from './resource';

/** The catalogue. Twin of `services_providers.dart`. */
@Injectable({ providedIn: 'root' })
export class ServicesStore {
  private readonly api = inject(Api);
  private readonly auth = inject(AuthService);

  // `GET /services` is the public, paged search across every business; the
  // own catalogue (inactive ones included, in the saved order) hangs from the
  // business, like `myServicesProvider` reads it.
  readonly services = resource<ServiceResponse[]>(async () => {
    const businessId = this.auth.businessId();
    if (businessId == null) return [];
    return this.api.get<ServiceResponse[]>(`/businesses/${businessId}/services`);
  }, []);

  readonly all = this.services.value;
  readonly active = computed(() => this.all().filter((s) => s.active));
  readonly count = computed(() => this.all().length);

  /** A service with nobody assigned cannot be booked: the list warns about it. */
  readonly withoutStaff = computed(() => this.all().filter((s) => s.workerIds.length === 0));

  load(): Promise<void> {
    return this.services.load();
  }

  byId(id: number): ServiceResponse | undefined {
    return this.all().find((service) => service.id === id);
  }

  /**
   * `POST /services` takes the staff with it (empty for a one-person business).
   * `serviceMode` and `homeSurchargeCents` travel as given: left out, the new
   * service inherits the business's mode and has no surcharge.
   */
  async create(payload: ServicePayload): Promise<ServiceResponse> {
    const { workerIds, ...rest } = payload;
    const body = workerIds && workerIds.length > 0 ? { ...rest, workerIds } : rest;
    const created = await this.api.post<ServiceResponse>('/services', body);
    await this.services.reload();
    return created;
  }

  /**
   * `PUT /services/{id}` does not carry the staff: assignments have their own
   * endpoints, so the difference with what the service had is applied one by
   * one, like `syncServiceWorkers` does in the app.
   */
  async update(id: number, payload: ServicePayload): Promise<void> {
    const { workerIds } = payload;
    await this.api.put(`/services/${id}`, {
      name: payload.name,
      description: payload.description ?? null,
      price: payload.price,
      duration: payload.duration,
      // Undefined is dropped from the JSON: `null` there means «leave the windows alone».
      timeWindows: payload.timeWindows,
      // Same convention for these two: null/absent = «don't touch», so a
      // caller that does not know about them leaves both as they were.
      serviceMode: payload.serviceMode ?? undefined,
      homeSurchargeCents: payload.homeSurchargeCents ?? undefined,
    });
    if (workerIds) {
      const before = new Set(this.byId(id)?.workerIds ?? []);
      const after = new Set(workerIds);
      for (const workerId of after) {
        if (!before.has(workerId)) await this.api.put(`/services/${id}/workers/${workerId}`);
      }
      for (const workerId of before) {
        if (!after.has(workerId)) await this.api.delete(`/services/${id}/workers/${workerId}`);
      }
    }
    await this.services.reload();
  }

  /** Adds or removes one person from a service, from the team screen. */
  async setWorker(serviceId: number, workerId: number, on: boolean): Promise<void> {
    const path = `/services/${serviceId}/workers/${workerId}`;
    await (on ? this.api.put(path) : this.api.delete(path));
    await this.services.reload();
  }

  async remove(id: number): Promise<void> {
    await this.api.delete(`/services/${id}`);
    await this.services.reload();
  }

  /** Optimistic: the switch has to answer the click, not the network. */
  async setActive(id: number, active: boolean): Promise<void> {
    const before = this.all();
    this.services.set(before.map((s) => (s.id === id ? { ...s, active } : s)));
    try {
      await this.api.put(`/services/${id}/${active ? 'activate' : 'deactivate'}`);
    } catch (cause) {
      this.services.set(before);
      throw cause;
    }
  }

  /** The order the customer sees on the public page: every id, as shown. */
  async reorder(serviceIds: number[]): Promise<void> {
    const before = this.all();
    this.services.set([...before].sort((a, b) => serviceIds.indexOf(a.id) - serviceIds.indexOf(b.id)));
    try {
      await this.api.put('/services/order', { ids: serviceIds });
    } catch (cause) {
      this.services.set(before);
      throw cause;
    }
  }
}
