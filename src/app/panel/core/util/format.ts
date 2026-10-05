/** Money, durations and names, written the way the app writes them. */

/** «22,00 €» — cents in, Spanish out. `formatCents` in `payment_models.dart`. */
export function money(cents: number | null | undefined): string {
  const value = (cents ?? 0) / 100;
  return `${value.toFixed(2).replace('.', ',')} €`;
}

/** «18 €» for round prices, «18,50 €» otherwise. */
export function price(euros: number): string {
  return Number.isInteger(euros) ? `${euros} €` : `${euros.toFixed(2).replace('.', ',')} €`;
}

/** «30min», «1h», «1h 30m» — the duration under the hour of an appointment. */
export function duration(minutes: number): string {
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

/** «4,8» — one decimal with a comma, as `GipsiRating` prints it. */
export function rating(value: number | null | undefined): string {
  return value == null ? 'Sin valoraciones' : value.toFixed(1).replace('.', ',');
}

/** Up to two initials for an avatar with no photo. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0][0] ?? '';
  const second = parts.length > 1 ? (parts[1][0] ?? '') : '';
  return (first + second).toUpperCase();
}

/** «1 pendiente» / «4 pendientes» — the plural rules the ARB file spells out. */
export function plural(count: number, one: string, many: string): string {
  return count === 1 ? `${count} ${one}` : `${count} ${many}`;
}
