import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  Output,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { MAP_STYLE_DARK, MAP_STYLE_LIGHT, loadGoogleMaps, googleMapsRefused, onGoogleMapsRefused } from '../core/places/google-maps';
import { loadOpenMap, openMapStyle } from '../core/places/open-map';

declare const google: any;

export interface MapPoint {
  latitude: number;
  longitude: number;
}

/** Centre of Spain: where the map starts while there is no address yet (`_spainCenter`). */
const SPAIN: MapPoint = { latitude: 40.4168, longitude: -3.7038 };

/**
 * `location_map_picker.dart`: the pin the business drags to its door.
 *
 * The pin can be dragged, and a click anywhere on the map moves it there.
 * Usually it is not needed: picking an address already drops it in place.
 * Google Maps, as the app's Android map and the client web. If Google refuses
 * it (no billing, key not allowed here) the same pin goes on an OpenStreetMap
 * map (`open-map.ts`), and only if that fails too does `available` emit
 * `false` and the screen stop asking for a pin it cannot offer.
 *
 * Either way what is saved is the same latitude and longitude (WGS84), which
 * the apps draw on Google Maps (Android) and Apple Maps (iPhone) at the very
 * same door: the coordinates do not depend on whose map placed them.
 */
@Component({
  selector: 'pn-location-map',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (failed()) {
      <div class="lm lm--off">
        <span class="material-symbols-rounded">map</span>
        <p>El mapa no está disponible ahora mismo. Puedes seguir con la dirección escrita.</p>
      </div>
    } @else {
      <div #canvas class="lm" aria-label="Mapa: mueve el punto hasta tu puerta"></div>
    }
  `,
  styles: [
    `
      :host { display: block; }
      .lm { height: 280px; border-radius: var(--pn-radius-field); overflow: hidden; background: var(--pn-field); }
      .lm--off {
        display: grid;
        place-content: center;
        justify-items: center;
        gap: 8px;
        height: 140px;
        padding: 0 24px;
        text-align: center;
        font-size: 0.875rem;
        color: var(--clr-text-2);
      }
      .lm--off .material-symbols-rounded { font-size: 26px; color: var(--clr-text-3); }
    `,
  ],
})
export class PnLocationMapComponent implements AfterViewInit, OnChanges, OnDestroy {
  /** Where the pin is, or null while there is no address. */
  @Input() point: MapPoint | null = null;
  @Input() disabled = false;
  @Output() moved = new EventEmitter<MapPoint>();
  /** `false` when Google refuses the map: then no pin can be asked for. */
  @Output() available = new EventEmitter<boolean>();

  @ViewChild('canvas') private canvas?: ElementRef<HTMLElement>;

  private readonly zone = inject(NgZone);
  private readonly cdr = inject(ChangeDetectorRef);
  readonly failed = signal(false);

  private map?: any;
  private marker?: any;
  private stopListening?: () => void;
  private stopObserving?: () => void;
  /** The OpenStreetMap fallback, when Google refused: map and pin. */
  private open?: { map: any; marker: any };
  private fallingBack = false;
  private destroyed = false;

  async ngAfterViewInit(): Promise<void> {
    this.stopListening = onGoogleMapsRefused(() => this.zone.run(() => this.fail()));
    try {
      await loadGoogleMaps();
    } catch {
      this.fail();
      return;
    }
    if (googleMapsRefused() || !this.canvas) {
      this.fail();
      return;
    }
    const at = this.point ?? SPAIN;
    const dark = matchMedia('(prefers-color-scheme: dark)').matches;
    this.map = new google.maps.Map(this.canvas.nativeElement, {
      center: { lat: at.latitude, lng: at.longitude },
      zoom: this.point ? 17 : 5,
      disableDefaultUI: true,
      zoomControl: true,
      gestureHandling: 'cooperative',
      clickableIcons: false,
      styles: dark ? MAP_STYLE_DARK : MAP_STYLE_LIGHT,
    });
    this.marker = new google.maps.Marker({
      map: this.map,
      position: { lat: at.latitude, lng: at.longitude },
      draggable: !this.disabled,
    });
    this.marker.addListener('dragend', () => this.zone.run(() => this.emit(this.marker.getPosition())));
    this.map.addListener('click', (event: any) =>
      this.zone.run(() => {
        if (this.disabled || !event.latLng) return;
        this.marker.setPosition(event.latLng);
        this.emit(event.latLng);
      }),
    );
    this.available.emit(true);
    this.watchForDegradedMap();
  }

  /**
   * Without billing Google does not call `gm_authFailure`: it draws the map
   * darkened, «For development purposes only», with a dialog on top. That is a
   * broken map, not one to place a door on, so it counts as refused.
   */
  private watchForDegradedMap(): void {
    const host = this.canvas?.nativeElement;
    if (!host) return;
    const degraded = () =>
      !!host.querySelector('.gm-err-container, .dismissButton') ||
      /For development purposes only/.test(host.innerText);
    const observer = new MutationObserver(() => {
      if (!degraded()) return;
      observer.disconnect();
      this.zone.run(() => this.fail());
    });
    observer.observe(host, { childList: true, subtree: true, characterData: true });
    this.stopObserving = () => observer.disconnect();
    if (degraded()) this.zone.run(() => this.fail());
  }

  ngOnChanges(): void {
    if (this.open) {
      this.open.marker.setDraggable(!this.disabled);
      if (!this.point) return;
      const here = this.open.marker.getLngLat();
      if (here.lat === this.point.latitude && here.lng === this.point.longitude) return;
      const at: [number, number] = [this.point.longitude, this.point.latitude];
      this.open.marker.setLngLat(at);
      this.open.map.jumpTo({ center: at, zoom: Math.max(this.open.map.getZoom(), 16) });
      return;
    }
    if (!this.map || !this.marker) return;
    this.marker.setDraggable(!this.disabled);
    if (!this.point) return;
    const here = this.marker.getPosition();
    if (here && here.lat() === this.point.latitude && here.lng() === this.point.longitude) return;
    const at = { lat: this.point.latitude, lng: this.point.longitude };
    this.marker.setPosition(at);
    this.map.setCenter(at);
    if (this.map.getZoom() < 17) this.map.setZoom(17);
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.stopListening?.();
    this.stopObserving?.();
    this.open?.map.remove();
  }

  /**
   * Google said no: the pin moves to an OpenStreetMap map in the same box.
   * Only if that cannot load either is the map given up.
   */
  private fail(): void {
    if (this.failed() || this.fallingBack || this.open) return;
    this.stopObserving?.();
    this.fallingBack = true;
    void this.fallBack();
  }

  private async fallBack(): Promise<void> {
    const host = this.canvas?.nativeElement;
    try {
      if (!host) throw new Error('Sin lienzo');
      const lib = await loadOpenMap();
      if (this.destroyed) return;
      // Google may have drawn its greyed-out map in the box: start clean.
      host.replaceChildren();
      const at = this.point ?? SPAIN;
      const center: [number, number] = [at.longitude, at.latitude];
      const dark = matchMedia('(prefers-color-scheme: dark)').matches;
      const map = new lib.Map({
        container: host,
        style: openMapStyle(dark),
        center,
        zoom: this.point ? 16 : 4.5,
        attributionControl: { compact: true },
        cooperativeGestures: true,
      });
      // Los nombres en español cuando OpenStreetMap los tiene («España», no
      // «Spain»); si no, el del sitio.
      map.on('style.load', () => {
        for (const layer of map.getStyle().layers ?? []) {
          if (layer.type === 'symbol' && map.getLayoutProperty(layer.id, 'text-field')) {
            map.setLayoutProperty(layer.id, 'text-field', ['coalesce', ['get', 'name:es'], ['get', 'name']]);
          }
        }
      });
      map.addControl(new lib.NavigationControl({ showCompass: false }), 'top-right');
      // Grafito sobre el mapa claro y menta sobre el oscuro, donde el grafito se perdía.
      const marker = new lib.Marker({ color: dark ? '#C0EED3' : '#2E343B', draggable: !this.disabled })
        .setLngLat(center)
        .addTo(map);
      marker.on('dragend', () => this.zone.run(() => this.emitOpen(marker.getLngLat())));
      map.on('click', (event: any) =>
        this.zone.run(() => {
          if (this.disabled) return;
          marker.setLngLat(event.lngLat);
          this.emitOpen(event.lngLat);
        }),
      );
      this.open = { map, marker };
      this.map = undefined;
      this.marker = undefined;
      this.available.emit(true);
    } catch {
      this.failed.set(true);
      this.available.emit(false);
    } finally {
      this.fallingBack = false;
      this.cdr.markForCheck();
    }
  }

  /** Same shape as the Google pin: what is saved does not know whose map it was. */
  private emitOpen(at: { lat: number; lng: number }): void {
    this.moved.emit({ latitude: at.lat, longitude: at.lng });
  }

  private emit(at: any): void {
    this.moved.emit({ latitude: at.lat(), longitude: at.lng() });
  }
}
