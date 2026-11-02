/**
 * Google Maps in the browser, the same way `bipsy-web-app` loads it
 * (`core/google-maps-loader.ts`) and with the same browser key.
 *
 * ⚠️ It is not the backend's key (`gipsi.google.maps-api-key`): that one is a
 * server key and must never leave the server. This one is public by design —it
 * travels in everyone's browser—, so what protects it is the HTTP referrer
 * restriction in Google Cloud Console, which has to list `http://localhost:*`
 * and the panel's domain. Maps JavaScript API has to be enabled for it, and the
 * project needs billing: without it Google refuses the map (`gm_authFailure`).
 */
export const GOOGLE_MAPS_BROWSER_KEY = 'AIzaSyAwY1YNRKma7gzcCx1wgvoCqC-PKFLfdk8';

declare const google: any;

const READY_CALLBACK = '__bipsyPanelMapsReady';
let loader: Promise<void> | null = null;
let authFailed = false;
const authListeners = new Set<() => void>();

/** True once Google has refused the key. It is only known after trying. */
export function googleMapsRefused(): boolean {
  return authFailed;
}

/** Called once if Google refuses the key, even after the map is drawn. */
export function onGoogleMapsRefused(listener: () => void): () => void {
  authListeners.add(listener);
  return () => authListeners.delete(listener);
}

/**
 * Loads the SDK once per tab. With `callback` and not the script's `onload`:
 * the file arriving is not the namespace being ready (see bipsy-web-app).
 */
export function loadGoogleMaps(): Promise<void> {
  if (loader) return loader;
  loader = new Promise<void>((resolve, reject) => {
    if (typeof google !== 'undefined' && google.maps?.Map) {
      resolve();
      return;
    }
    const scope = window as unknown as Record<string, unknown>;
    scope['gm_authFailure'] = () => {
      authFailed = true;
      authListeners.forEach((listener) => listener());
    };
    scope[READY_CALLBACK] = () => resolve();
    const script = document.createElement('script');
    script.src =
      `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_MAPS_BROWSER_KEY)}` +
      `&language=es&region=ES&v=weekly&callback=${READY_CALLBACK}`;
    script.async = true;
    script.onerror = () => {
      loader = null;
      reject(new Error('No se ha podido cargar Google Maps'));
    };
    document.head.appendChild(script);
  });
  return loader;
}

/** `GipsiMapStyle`, copied from bipsy-web-app: Google Maps does not follow the theme. */
export const MAP_STYLE_DARK = [
  { elementType: 'geometry', stylers: [{ color: '#2e343b' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#b5c3be' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#2e343b' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#f5f7f6' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#3f464e' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#7f8e89' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#454c54' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#4e565f' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#b5c3be' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#252a30' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#4e565f' }] },
];

export const MAP_STYLE_LIGHT = [
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
];
