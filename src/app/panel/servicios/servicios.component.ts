import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ServicesStore } from '../core/data/services.store';
import { TeamStore } from '../core/data/team.store';
import { AuthService } from '../core/auth/auth.service';
import { ServiceMode, ServiceResponse, SlotGrid } from '../core/api/models';
import { duration as durationText, price } from '../core/util/format';
import { PnEmptyComponent, PnSwitchComponent } from '../ui/controls';
import { PnDialogComponent } from '../ui/dialog.component';
import { PnPhotoPickerComponent } from '../ui/photo-picker.component';
import { ConfirmService } from '../ui/confirm.service';
import { ToastService } from '../ui/toast.service';
import { Api } from '../core/api/api';
import { PnServiceHoursComponent } from './service-hours.component';
import { BandsByDay, flattenBands, groupWindows, hhmm } from './service-hours';

/**
 * «Dónde se presta», with the labels the app uses when the subject is ONE
 * service and not the business (`servicePlaceLabel` in `service_mode_sheet.dart`).
 */
export const SERVICE_PLACES: { id: ServiceMode; title: string; sub: string; icon: string }[] = [
  { id: 'AT_BUSINESS', title: 'En mi local', sub: 'El cliente viene a tu establecimiento', icon: 'storefront' },
  { id: 'AT_CUSTOMER', title: 'Solo a domicilio', sub: 'Te desplazas a donde esté el cliente', icon: 'directions_car' },
  { id: 'BOTH', title: 'En local y domicilio', sub: 'El cliente elige al reservar', icon: 'swap_horiz' },
];

/** Two words for a row or a summary (`serviceModeShortLabel`). */
export const SERVICE_MODE_SHORT: Record<ServiceMode, string> = {
  AT_BUSINESS: 'Mi local',
  AT_CUSTOMER: 'A domicilio',
  BOTH: 'A domicilio / mi local',
};

/** The server's cap for the home surcharge (`MAX_HOME_SURCHARGE_CENTS`), in euros. */
const MAX_SURCHARGE_EUROS = 200;

/**
 * `/panel/servicios` — the catalogue, ported from `services_screen.dart` and
 * `service_form_screen.dart`.
 *
 * The order is the one customers see on the public page, so it is editable
 * here. The app does it by long-pressing and dragging; on a desk the arrows
 * are faster and survive a keyboard.
 */
@Component({
  selector: 'app-panel-servicios',
  standalone: true,
  imports: [
    FormsModule,
    PnEmptyComponent,
    PnSwitchComponent,
    PnDialogComponent,
    PnPhotoPickerComponent,
    PnServiceHoursComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './servicios.component.html',
  styleUrl: './servicios.component.css',
})
export class ServiciosComponent {
  readonly store = inject(ServicesStore);
  readonly team = inject(TeamStore);
  readonly auth = inject(AuthService);
  private readonly confirm = inject(ConfirmService);
  private readonly toasts = inject(ToastService);

  readonly price = price;
  readonly durationText = durationText;

  private readonly api = inject(Api);

  readonly editing = signal<ServiceResponse | null>(null);
  readonly creating = signal(false);
  readonly busy = signal(false);
  readonly uploading = signal(false);
  readonly hoursError = signal<string | null>(null);
  readonly surchargeError = signal<string | null>(null);

  readonly places = SERVICE_PLACES;
  readonly modeShort = SERVICE_MODE_SHORT;

  form = {
    name: '',
    description: '',
    price: null as number | null,
    duration: 30,
    workerIds: [] as number[],
    /**
     * Where this service is given. It is what the owner CHOSE
     * (`serviceModeIntent`), not what is in force: with a business that only
     * does one thing it is saved anyway and applies again the day it does both.
     */
    serviceMode: 'AT_BUSINESS' as ServiceMode,
    /** Home surcharge in euros; empty = costs the same as at the venue. */
    surcharge: null as number | null,
    /** «Solo a ciertas horas»: off means «whenever the shop is open». */
    onlySomeHours: false,
    bands: {} as BandsByDay,
  };

  /**
   * The shop's own start times per weekday (`GET /businesses/me/slot-grid`).
   * A band is picked from these, never typed: a band that starts at a time
   * the shop does not offer would do nothing.
   */
  readonly slotGrid = signal<SlotGrid>({});

  /** Foto elegida antes de que el servicio exista: se sube tras crearlo. */
  private pendingPhoto: File | null = null;

  constructor() {
    void this.store.load();
    void this.team.load();
    void this.loadGrid();
  }

  /** A failed grid is not fatal: the editor says so and the rest still saves. */
  private async loadGrid(): Promise<void> {
    try {
      const grid = await this.api.get<Record<string, string[]>>('/businesses/me/slot-grid');
      const trimmed: SlotGrid = {};
      for (const [day, times] of Object.entries(grid ?? {})) {
        trimmed[day as keyof SlotGrid] = (times ?? []).map(hhmm);
      }
      this.slotGrid.set(trimmed);
    } catch {
      this.slotGrid.set({});
    }
  }

  readonly step = computed(() => this.auth.profile()?.slotMinutes ?? 15);

  readonly open = computed(() => this.creating() || this.editing() !== null);

  /**
   * Where the business attends. Only one that does both things shares out its
   * catalogue, so only then can a service choose — and only then does the
   * list say where each one is given.
   */
  readonly businessMode = computed<ServiceMode>(() => this.auth.profile()?.serviceMode ?? 'AT_BUSINESS');
  readonly canChoosePlace = computed(() => this.businessMode() === 'BOTH');

  /**
   * Whether this service, as the form stands right now, goes to the
   * customer's home. The surcharge only means something then.
   */
  get travels(): boolean {
    const business = this.businessMode();
    return (business === 'BOTH' ? this.form.serviceMode : business) !== 'AT_BUSINESS';
  }

  /** The list reads the mode IN FORCE: it is what the customer is offered. */
  placeOf(service: ServiceResponse): string | null {
    const mode = service.serviceMode ?? 'AT_BUSINESS';
    return this.canChoosePlace() && mode !== 'AT_BUSINESS' ? SERVICE_MODE_SHORT[mode] : null;
  }

  setPlace(mode: ServiceMode): void {
    this.form.serviceMode = mode;
    this.surchargeError.set(null);
  }

  workersOf(service: ServiceResponse): string {
    if (service.workerIds.length === 0) return 'Sin personal';
    if (this.auth.isAutonomous()) return 'Tú';
    const names = service.workerIds
      .map((id) => this.team.byId(id)?.name.split(' ')[0])
      .filter(Boolean);
    return names.length > 2 ? `${names.slice(0, 2).join(', ')} +${names.length - 2}` : names.join(', ');
  }

  startCreate(): void {
    this.form = {
      name: '',
      description: '',
      price: null,
      duration: this.step() * 2,
      workerIds: [],
      serviceMode: this.businessMode(),
      surcharge: null,
      onlySomeHours: false,
      bands: {},
    };
    this.pendingPhoto = null;
    this.hoursError.set(null);
    this.surchargeError.set(null);
    this.creating.set(true);
  }

  /**
   * Turning the switch off sends `timeWindows: []` — the backend reads an
   * empty list as «no restriction». The bands stay in memory so turning it
   * back on does not lose the work, exactly as `didUpdateWidget` does.
   */
  setOnlySomeHours(on: boolean): void {
    this.form.onlySomeHours = on;
    if (!on) this.hoursError.set(null);
  }

  /**
   * En edición la foto sube al momento; al crear no hay id todavía, así que se
   * guarda y se sube justo después de guardar el servicio.
   */
  async pickPhoto(file: File): Promise<void> {
    const service = this.editing();
    if (!service) {
      this.pendingPhoto = file;
      return;
    }
    this.uploading.set(true);
    try {
      await this.api.upload(`/services/${service.id}/image`, file);
      await this.store.services.reload();
      this.editing.set(this.store.byId(service.id) ?? null);
      this.toasts.show('Foto subida');
    } catch {
      this.toasts.error('No se ha podido subir la foto.');
    } finally {
      this.uploading.set(false);
    }
  }

  async removePhoto(service: ServiceResponse): Promise<void> {
    try {
      await this.api.delete(`/services/${service.id}/image`);
      await this.store.services.reload();
      this.editing.set(this.store.byId(service.id) ?? null);
    } catch {
      this.toasts.error('No se ha podido quitar la foto.');
    }
  }

  startEdit(service: ServiceResponse): void {
    const bands = groupWindows(service.timeWindows);
    this.form = {
      name: service.name,
      description: service.description ?? '',
      price: service.price,
      duration: service.duration,
      workerIds: [...service.workerIds],
      // The intent, not the mode in force. Without the field — a backend older
      // than V93 — the venue, which is what everybody did before.
      serviceMode: service.serviceModeIntent ?? 'AT_BUSINESS',
      surcharge: service.homeSurchargeCents ? service.homeSurchargeCents / 100 : null,
      onlySomeHours: (service.timeWindows?.length ?? 0) > 0,
      bands,
    };
    this.hoursError.set(null);
    this.surchargeError.set(null);
    this.editing.set(service);
  }

  close(): void {
    this.creating.set(false);
    this.editing.set(null);
  }

  toggleWorker(id: number): void {
    this.form.workerIds = this.form.workerIds.includes(id)
      ? this.form.workerIds.filter((item) => item !== id)
      : [...this.form.workerIds, id];
  }

  /** Durations move in slot steps: anything else cannot be offered anyway. */
  bumpDuration(delta: number): void {
    this.form.duration = Math.max(this.step(), this.form.duration + delta * this.step());
  }

  async save(): Promise<void> {
    if (!this.form.name.trim() || this.form.price == null) {
      this.toasts.error('Pon al menos un nombre y un precio.');
      return;
    }
    // `timeWindows` always travels: an empty list is how the restriction is
    // lifted, while leaving the field out would mean «don't touch it».
    const timeWindows = this.form.onlySomeHours ? flattenBands(this.form.bands) : [];
    if (this.form.onlySomeHours && timeWindows.length === 0) {
      this.hoursError.set('Pon al menos una franja, o desactiva «Solo a ciertas horas».');
      return;
    }
    this.hoursError.set(null);
    // Zero when it does not travel: keeping an amount that will not be
    // charged only raises doubts when the service is opened again.
    const surcharge = this.travels ? (this.form.surcharge ?? 0) : 0;
    if (!Number.isFinite(surcharge) || surcharge < 0) {
      this.surchargeError.set('Precio no válido.');
      return;
    }
    // The server's own cap, said before saving and not after.
    if (surcharge > MAX_SURCHARGE_EUROS) {
      this.surchargeError.set('Como mucho 200 €.');
      return;
    }
    this.surchargeError.set(null);
    this.busy.set(true);
    try {
      const payload = {
        name: this.form.name.trim(),
        description: this.form.description.trim() || null,
        price: this.form.price,
        duration: this.form.duration,
        workerIds: this.form.workerIds,
        timeWindows,
        // Both always travel, as in the app: on update null would mean
        // «don't touch», and 0 is how a surcharge is removed.
        serviceMode: this.form.serviceMode,
        homeSurchargeCents: Math.round(surcharge * 100),
      };
      const current = this.editing();
      if (current) {
        await this.store.update(current.id, payload);
      } else {
        const created = await this.store.create(payload);
        if (this.pendingPhoto) {
          await this.api.upload(`/services/${created.id}/image`, this.pendingPhoto);
          await this.store.services.reload();
        }
      }
      this.pendingPhoto = null;
      this.close();
      this.toasts.show(current ? 'Servicio guardado' : 'Servicio creado');
    } catch {
      this.toasts.error('No se pudo guardar. Revisa tu conexión.');
    } finally {
      this.busy.set(false);
    }
  }

  async setActive(service: ServiceResponse, active: boolean): Promise<void> {
    try {
      await this.store.setActive(service.id, active);
    } catch {
      this.toasts.error('No se ha podido cambiar.');
    }
  }

  async move(service: ServiceResponse, direction: -1 | 1): Promise<void> {
    const ids = this.store.all().map((item) => item.id);
    const index = ids.indexOf(service.id);
    const target = index + direction;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    try {
      await this.store.reorder(ids);
    } catch {
      this.toasts.error('No se ha podido cambiar el orden.');
    }
  }

  async remove(service: ServiceResponse): Promise<void> {
    const answer = await this.confirm.ask({
      title: 'Eliminar servicio',
      message: `«${service.name}» dejará de poder reservarse. Las citas que ya tengas siguen en pie.`,
      confirmLabel: 'Eliminar',
      destructive: true,
    });
    if (!answer.ok) return;
    try {
      await this.store.remove(service.id);
      this.close();
      this.toasts.show('Servicio eliminado');
    } catch {
      this.toasts.error('No se ha podido eliminar.');
    }
  }
}
