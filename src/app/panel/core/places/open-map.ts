/**
 * The map to fall back on when Google refuses its own (see `google-maps.ts`):
 * MapLibre drawing OpenFreeMap's OpenStreetMap tiles. No key, no account and no
 * billing, and commercial use is allowed, so the pin can always be placed.
 *
 * Google stays the first choice: same look as the apps and the client web.
 * This only loads (≈1 MB, its own chunk) the day Google says no, which today is
 * every day: the browser key's Cloud project has no billing
 * (`BillingNotEnabledMapError`). Once billing is on, nobody downloads it.
 *
 * Its CSS and worker are copied to `/vendor/maplibre/` by angular.json: bundled
 * by esbuild, MapLibre cannot find its worker next to itself.
 */
const VENDOR = '/vendor/maplibre';
const STYLE_LIGHT = 'https://tiles.openfreemap.org/styles/positron';
const STYLE_DARK = 'https://tiles.openfreemap.org/styles/dark';

type MapLibre = typeof import('maplibre-gl');
let loader: Promise<MapLibre> | null = null;

/** MapLibre with its CSS in place, once per tab. */
export function loadOpenMap(): Promise<MapLibre> {
  if (loader) return loader;
  loader = (async () => {
    if (!document.querySelector('link[data-maplibre]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = `${VENDOR}/maplibre-gl.css`;
      link.dataset['maplibre'] = '';
      document.head.appendChild(link);
    }
    const lib = await import('maplibre-gl');
    lib.setWorkerUrl(`${VENDOR}/maplibre-gl-worker.mjs`);
    return lib;
  })().catch((error) => {
    loader = null;
    throw error;
  });
  return loader;
}

export function openMapStyle(dark: boolean): string {
  return dark ? STYLE_DARK : STYLE_LIGHT;
}
