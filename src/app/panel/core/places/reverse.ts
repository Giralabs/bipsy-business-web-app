import { Api } from '../api/api';
import { ResolvedAddress } from '../api/models';

/**
 * What address there is under the map's pin (`GET /places/reverse`), or null
 * if Google does not say. The point is kept anyway: it is what places the venue.
 */
export async function addressAt(api: Api, latitude: number, longitude: number): Promise<ResolvedAddress | null> {
  try {
    const found = await api.get<ResolvedAddress>('/places/reverse', { lat: latitude, lng: longitude });
    return { ...found, latitude, longitude };
  } catch {
    return null;
  }
}
