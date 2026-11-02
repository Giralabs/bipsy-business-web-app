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
 * it (no billing, key not allowed here) `available` emits `false` and the
 * screen stops asking for a pin it cannot offer.
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
    this.stopListening?.();
    this.stopObserving?.();
  }

  private fail(): void {
    if (this.failed()) return;
    this.stopObserving?.();
    this.failed.set(true);
    this.available.emit(false);
    this.cdr.markForCheck();
  }

  private emit(at: any): void {
    this.moved.emit({ latitude: at.lat(), longitude: at.lng() });
  }
}
