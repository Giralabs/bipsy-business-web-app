import { ChangeDetectionStrategy, ChangeDetectorRef, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Api } from '../core/api/api';
import { AuthService } from '../core/auth/auth.service';
import { BusinessDetail, BusinessSocialLinks, ResolvedAddress, ServiceMode, SocialNetwork } from '../core/api/models';
import { AgendaStore } from '../core/data/agenda.store';
import { ServicesStore } from '../core/data/services.store';
import { SetupStore } from '../core/data/setup.store';
import { ReviewsStore } from '../core/data/reviews.store';
import { message } from '../core/data/resource';
import { rating } from '../core/util/format';
import { PnAddressSearchComponent } from '../ui/address-search.component';
import { PnSwitchComponent } from '../ui/controls';
import { PnDialogComponent } from '../ui/dialog.component';
import { PnPhotoPickerComponent } from '../ui/photo-picker.component';
import { ToastService } from '../ui/toast.service';

/** «Dónde atiendes», with the app's labels (`service_mode_sheet.dart`). */
export const SERVICE_MODES: { id: ServiceMode; title: string; sub: string; icon: string }[] = [
  { id: 'AT_BUSINESS', title: 'Tengo un local', sub: 'Los clientes vienen a mi establecimiento.', icon: 'storefront' },
  {
    id: 'AT_CUSTOMER',
    title: 'Voy a domicilio',
    sub: 'Solo trabajo desplazándome: no tengo local al que puedan venir.',
    icon: 'directions_car',
  },
  { id: 'BOTH', title: 'Las dos cosas', sub: 'Tengo local y además me desplazo a casa del cliente.', icon: 'swap_horiz' },
];

/**
 * The six networks of `social_links_group.dart`, in the order the app offers
 * them. `max` is the app's `GipsiInputLimits`; what is stored is the handle,
 * and the backend is the one that pulls it out of a pasted address.
 */
export const SOCIAL_NETWORKS: {
  id: SocialNetwork;
  label: string;
  placeholder: string;
  max: number;
  /** The server accepts a whole URL here and keeps the handle. */
  pasteUrl: boolean;
}[] = [
  { id: 'website', label: 'Web', placeholder: 'tunegocio.es', max: 255, pasteUrl: false },
  { id: 'instagram', label: 'Instagram', placeholder: '@tuusuario', max: 120, pasteUrl: true },
  { id: 'facebook', label: 'Facebook', placeholder: '@tuusuario', max: 120, pasteUrl: true },
  { id: 'x', label: 'X', placeholder: '@tuusuario', max: 120, pasteUrl: true },
  { id: 'tiktok', label: 'TikTok', placeholder: '@tuusuario', max: 120, pasteUrl: true },
  { id: 'whatsapp', label: 'WhatsApp', placeholder: '600 000 000', max: 30, pasteUrl: false },
];

/**
 * «Zona de desplazamiento» (`service_area_sheet.dart`). The starting radius
 * for a business that had none: 10 km is a whole mid-sized city, and it is
 * easier to lower it than to find out it has to go up. The cap is the server's
 * (`Business.MAX_SERVICE_RADIUS_KM`).
 */
export const SERVICE_AREA = { defaultRadiusKm: 10, maxRadiusKm: 100 } as const;

/** The three columns the area is stored in, wherever they are read from. */
type AreaSource = {
  serviceAreaLatitude?: number | null;
  serviceAreaLongitude?: number | null;
  serviceRadiusKm?: number | null;
};

/**
 * `/panel/negocio` — the public face of the shop: what a customer sees before
 * booking. It merges `edit_business_screen.dart` with the hub part of
 * `profile_screen.dart`, because on a desk «edit your details» and «where the
 * rest of your page lives» is one screen.
 */
@Component({
  selector: 'app-panel-negocio',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    PnDialogComponent,
    PnPhotoPickerComponent,
    PnAddressSearchComponent,
    PnSwitchComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './negocio.component.html',
  styleUrl: './negocio.component.css',
})
export class NegocioComponent {
  readonly auth = inject(AuthService);
  readonly setup = inject(SetupStore);
  readonly services = inject(ServicesStore);
  readonly reviews = inject(ReviewsStore);
  readonly agenda = inject(AgendaStore);
  private readonly api = inject(Api);
  private readonly toasts = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly rating = rating;
  readonly modes = SERVICE_MODES;
  readonly networks = SOCIAL_NETWORKS;

  readonly editing = signal(false);
  readonly busy = signal(false);
  readonly uploading = signal<'profile' | 'cover' | null>(null);
  readonly formError = signal<string | null>(null);
  /**
   * What the address is missing, said on the field itself and not at the
   * foot of the dialog: down there it is out of sight and the button seems to
   * do nothing.
   */
  readonly addressError = signal<string | null>(null);
  /** Same, for the centre of the service area. */
  readonly centerError = signal<string | null>(null);
  readonly areaLimits = SERVICE_AREA;
  /** False once the backend says the address search is off: city/province go by hand. */
  readonly placesUp = signal(true);

  form = {
    name: '',
    phone: '',
    description: '',
    mode: 'AT_BUSINESS' as ServiceMode,
    address: '',
    city: '',
    province: '',
    /** One box per network; empty means «I don't have it». */
    social: {} as Record<SocialNetwork, string>,
    /**
     * How far the business travels. It is resent on EVERY location save: the
     * endpoint replaces, so whatever does not travel is erased.
     */
    area: emptyArea(),
    /** The search box for the centre. Only a picked suggestion counts. */
    centerText: '',
  };

  /** A centre was picked in this dialog, so the hint talks about that one. */
  private centerPicked = false;

  /**
   * Filled by the address search. Null while the address has not been
   * touched here: then they are not sent and the backend keeps what it had,
   * exactly like `_EditBusinessScreenState`.
   */
  private picked: { postalCode: string | null; placeId: string | null; latitude: number | null; longitude: number | null } | null =
    null;

  /** What `GET /businesses/me` said when the dialog opened. */
  private saved: BusinessDetail | null = null;

  constructor() {
    void this.setup.load();
    void this.reviews.load();
  }

  readonly profile = this.auth.profile;

  readonly hasSchedule = computed(() => this.agenda.schedule.value().length > 0);

  readonly isQuality = computed(() => this.auth.hasFeature('UNIQUE_ANIMATIONS'));

  get atCustomer(): boolean {
    return this.form.mode === 'AT_CUSTOMER';
  }

  /** A service area only means something for a business that travels. */
  get visitsCustomer(): boolean {
    return this.form.mode !== 'AT_BUSINESS';
  }

  /**
   * Where the distance is measured from. There is no map on the web, so the
   * centre is the venue unless another address is searched; the stored point
   * has no text of its own, hence a hint instead of a value in the box.
   */
  get centerHint(): string {
    if (this.centerPicked) return 'La distancia se medirá desde esta dirección.';
    if (this.form.area.latitude != null) {
      return 'Ya tienes un punto guardado. Busca otra dirección solo si quieres cambiarlo.';
    }
    return this.atCustomer
      ? 'Busca el sitio del que sales normalmente y elígelo de la lista.'
      : 'Si no eliges otra, la distancia se mide desde tu local.';
  }

  /** «Zona: Sevilla, Sevilla» under the street, as the app writes it. */
  get zoneHint(): string {
    if (this.atCustomer) return 'Sirve para que te encuentren los clientes de tu área.';
    const zone = [this.form.city, this.form.province].filter((part) => part.trim()).join(', ');
    return zone ? `Zona: ${zone}` : 'Escribe la calle y el número, y elígela de la lista.';
  }

  startEdit(): void {
    const profile = this.profile();
    this.form = {
      name: profile?.name ?? '',
      phone: this.auth.user()?.phone ?? '',
      description: profile?.description ?? '',
      // Mode and area are also in `/me`: read from there first, so a save
      // made before `GET /businesses/me` answers does not wipe either.
      mode: profile ? modeOf(profile) : 'AT_BUSINESS',
      address: '',
      city: '',
      province: '',
      social: emptySocial(),
      area: readArea(profile),
      centerText: '',
    };
    this.picked = null;
    this.saved = null;
    this.centerPicked = false;
    this.formError.set(null);
    this.addressError.set(null);
    this.centerError.set(null);
    this.editing.set(true);
    // Phone, address and mode live in `GET /businesses/me`, not in `/me`.
    void this.readBusiness()
      .then((business) => {
        this.saved = business;
        if (!this.editing()) return;
        this.form = {
          ...this.form,
          phone: business.phone || this.form.phone,
          mode: modeOf(business),
          address: business.address ?? '',
          city: business.city ?? '',
          province: business.province ?? '',
          social: readSocial(business.social),
          // Not over a centre already picked while this was on its way.
          area: this.centerPicked ? this.form.area : readArea(business),
        };
        this.cdr.markForCheck();
      })
      .catch(() => undefined);
  }

  /**
   * The search changes its meaning ONLY when crossing between «I have a
   * venue» and «I don't»: with a venue it asks for a street, without one for
   * a zone, and one does not stand in for the other.
   *
   * Between «my venue» and «both» nothing is touched: both have a venue and
   * it is the same address. Clearing it there forced the owner to search it
   * again to say something that does not change it.
   */
  setMode(mode: ServiceMode): void {
    if (mode === this.form.mode) return;
    const crosses = (mode === 'AT_CUSTOMER') !== this.atCustomer;
    this.form = { ...this.form, mode, address: crosses ? '' : this.form.address };
    if (crosses) this.picked = null;
    this.formError.set(null);
    this.addressError.set(null);
    this.centerError.set(null);
  }

  setAreaLimit(on: boolean): void {
    this.form.area = { ...this.form.area, limit: on };
    if (!on) this.centerError.set(null);
  }

  /** The centre of the area: the point of whatever address was picked. */
  onCenterResolved(address: ResolvedAddress): void {
    if (address.latitude == null || address.longitude == null) return;
    this.form.area = { ...this.form.area, latitude: address.latitude, longitude: address.longitude };
    this.centerPicked = true;
    this.centerError.set(null);
    this.cdr.markForCheck();
  }

  onResolved(address: ResolvedAddress): void {
    // Street and number only: the city goes apart, and repeating it in the
    // address shows up doubled on the public page. Without a venue there is
    // no street to keep, only the zone.
    const street = address.address?.trim();
    this.form = {
      ...this.form,
      address: !this.atCustomer && street ? street : this.form.address,
      city: address.city ?? this.form.city,
      province: address.province ?? this.form.province,
    };
    this.picked = {
      postalCode: address.postalCode,
      placeId: address.placeId,
      latitude: address.latitude,
      longitude: address.longitude,
    };
    this.addressError.set(null);
    this.cdr.markForCheck();
  }

  private readBusiness(): Promise<BusinessDetail> {
    return this.api.get<BusinessDetail>('/businesses/me');
  }

  /** Sube la foto de perfil o la portada y refresca la ficha. */
  async upload(kind: 'profile' | 'cover', file: File): Promise<void> {
    this.uploading.set(kind);
    try {
      await this.api.upload(`/businesses/me/images/${kind}`, file);
      await this.auth.refreshMe();
      this.toasts.show(kind === 'profile' ? 'Foto de perfil actualizada' : 'Portada actualizada');
    } catch (cause) {
      this.toasts.error(message(cause));
    } finally {
      this.uploading.set(null);
    }
  }

  async removePhoto(kind: 'profile' | 'cover'): Promise<void> {
    try {
      await this.api.delete(`/businesses/me/images/${kind}`);
      await this.auth.refreshMe();
      this.toasts.show('Foto quitada');
    } catch {
      this.toasts.error('No se ha podido quitar.');
    }
  }

  /**
   * Two calls, as in `edit_business_screen.dart`: `PUT /businesses/me` takes
   * name, phone, address, city, province and description (categories are
   * left out: `categoryId: null` means «don't touch»); coordinates and mode
   * only go through `PUT /businesses/me/location`, which REPLACES the whole
   * location, so what was not searched again travels back as it was.
   */
  async save(): Promise<void> {
    if (!this.form.name.trim() || !this.form.phone.trim()) {
      this.formError.set('El nombre y el teléfono son obligatorios.');
      return;
    }
    const street = this.form.address.trim();
    if (!this.atCustomer && !street) {
      this.addressError.set('Escribe la dirección de tu local.');
      return;
    }
    this.formError.set(null);
    this.addressError.set(null);
    this.centerError.set(null);
    this.busy.set(true);
    try {
      const current = this.saved ?? (await this.readBusiness());
      const city = this.form.city.trim();
      const province = this.form.province.trim();
      const picked = this.picked;
      // The venue's point, as it will be saved. Without a venue there is none.
      const venueLatitude = this.atCustomer ? null : (picked?.latitude ?? current.latitude ?? null);
      const venueLongitude = this.atCustomer ? null : (picked?.longitude ?? current.longitude ?? null);

      const area = this.form.area;
      const limited = this.visitsCustomer && area.limit;
      const radiusKm = limited
        ? Math.min(SERVICE_AREA.maxRadiusKm, Math.max(1, Math.round(Number(area.radiusKm))))
        : null;
      // A radius with no centre limits nothing: the server would store it and
      // go on accepting every address. The app cannot get here because its map
      // always has a point; without a map it has to be asked for.
      const hasCenter =
        (area.latitude != null && area.longitude != null) || (venueLatitude != null && venueLongitude != null);
      if (limited && !hasCenter) {
        this.centerError.set('Elige de la lista el sitio del que sales normalmente.');
        return;
      }
      await this.api.put('/businesses/me', {
        name: this.form.name.trim(),
        phone: this.form.phone.trim(),
        address: this.atCustomer ? '' : street,
        city,
        province,
        description: this.form.description.trim() || null,
        // The six keys always travel: an empty string is how a network is
        // removed, and leaving one out would keep the old value.
        social: writeSocial(this.form.social),
      });

      const modeChanged = this.form.mode !== modeOf(current);
      // ⚠️ The area has to be one of the reasons. Without it, whoever came in
      // only to set a radius saved and NOTHING happened: the request was never
      // sent (`hayQueGuardarLaUbicacion` in the app).
      const before = readArea(current);
      const areaChanged =
        radiusKm !== (before.limit ? before.radiusKm : null) ||
        area.latitude !== before.latitude ||
        area.longitude !== before.longitude;
      if ((picked?.latitude != null && picked.longitude != null) || modeChanged || areaChanged) {
        await this.api.put('/businesses/me/location', {
          serviceMode: this.form.mode,
          // For a backend older than V82, which only reads the boolean.
          worksAtHome: this.atCustomer,
          ...(this.atCustomer
            ? { city, province }
            : {
                address: street || current.address || '',
                city,
                province,
                postalCode: picked?.postalCode ?? current.postalCode ?? null,
                placeId: picked?.placeId ?? current.placeId ?? null,
                latitude: venueLatitude,
                longitude: venueLongitude,
              }),
          // The area is resent ALWAYS, for the same reason as the address: a
          // save that leaves it out erases it. With no centre of its own the
          // server falls back to the venue's point; radius 0 = no limit.
          ...(area.latitude != null && area.longitude != null
            ? { serviceAreaLatitude: area.latitude, serviceAreaLongitude: area.longitude }
            : {}),
          serviceRadiusKm: radiusKm ?? 0,
        });
        // The mode in force of every service hangs from the business's.
        if (modeChanged) void this.services.services.reload();
      }

      this.auth.patchProfile({
        name: this.form.name.trim(),
        description: this.form.description.trim() || null,
      });
      this.editing.set(false);
      this.toasts.show('Ficha guardada');
      void this.auth.refreshMe().catch(() => undefined);
    } catch (cause) {
      this.formError.set(message(cause));
    } finally {
      this.busy.set(false);
    }
  }
}

function emptySocial(): Record<SocialNetwork, string> {
  return Object.fromEntries(SOCIAL_NETWORKS.map((network) => [network.id, ''])) as Record<SocialNetwork, string>;
}

function readSocial(social: BusinessSocialLinks | null | undefined): Record<SocialNetwork, string> {
  const out = emptySocial();
  for (const network of SOCIAL_NETWORKS) out[network.id] = social?.[network.id] ?? '';
  return out;
}

function writeSocial(form: Record<SocialNetwork, string>): BusinessSocialLinks {
  const out: Record<string, string> = {};
  for (const network of SOCIAL_NETWORKS) out[network.id] = (form[network.id] ?? '').trim();
  return out as BusinessSocialLinks;
}

/** `serviceMode` is the good value; `worksAtHome` is what older rows carry. */
function modeOf(business: { serviceMode?: ServiceMode | null; worksAtHome?: boolean }): ServiceMode {
  return business.serviceMode ?? (business.worksAtHome ? 'AT_CUSTOMER' : 'AT_BUSINESS');
}

function emptyArea(): { limit: boolean; radiusKm: number; latitude: number | null; longitude: number | null } {
  return { limit: false, radiusKm: SERVICE_AREA.defaultRadiusKm, latitude: null, longitude: null };
}

/**
 * The area as the form holds it. «Limited» is the app's `ServiceArea.isDeclared`:
 * a radius above zero AND a centre. Without a limit the centre is kept anyway,
 * so turning it back on does not ask for the point again.
 */
function readArea(source: AreaSource | null | undefined): ReturnType<typeof emptyArea> {
  const latitude = source?.serviceAreaLatitude ?? null;
  const longitude = source?.serviceAreaLongitude ?? null;
  const radiusKm = source?.serviceRadiusKm ?? 0;
  return {
    limit: radiusKm > 0 && latitude != null && longitude != null,
    radiusKm: radiusKm > 0 ? radiusKm : SERVICE_AREA.defaultRadiusKm,
    latitude,
    longitude,
  };
}
