import { AgendaState, BookingAddress, BookingResponse } from '../api/models';
import { fromInstant, toDate } from '../util/dates';

/**
 * The seven states of an appointment, ported from `BookingStateAction` in
 * `apps/gipsi_business/lib/features/home/widgets/booking_card.dart`.
 *
 * They are not a field: they are derived, and the order of the checks is the
 * whole logic — cancelled beats no-show beats awaiting the customer beats paid
 * beats pending beats past. Change it and the colours start lying.
 */
export function stateOf(booking: BookingResponse, now = new Date()): AgendaState {
  if (booking.status === 'CANCELED') return 'cancelada';
  if (booking.status === 'NO_SHOW') return 'noVino';
  // Before everything else: it is the only one with a deadline running, and
  // while it runs it can be neither paid nor pending on this side.
  if (booking.status === 'AWAITING_CUSTOMER') return 'esperandoCliente';
  if (booking.prepaidCents > 0) return 'pagada';
  if (booking.status === 'PENDING') return 'pendiente';
  if (toDate(booking.endDateTime) < now) return 'pasada';
  return 'confirmada';
}

export interface StateLook {
  label: string;
  icon: string;
  /** CSS custom property holding the colour of the stripe. */
  color: string;
}

/** Name, icon and colour of each state, from `BookingStateAction.describe`. */
export const STATE_LOOK: Record<AgendaState, StateLook> = {
  pendiente: { label: 'Pendiente', icon: 'schedule', color: 'var(--clr-warn)' },
  // Blue and not amber: amber asks the business for something, and here there
  // is nothing to do but wait.
  esperandoCliente: {
    label: 'Esperando al cliente',
    icon: 'hourglass_top',
    color: 'var(--pn-state-await)',
  },
  confirmada: { label: 'Confirmada', icon: 'check', color: 'var(--clr-success)' },
  pagada: { label: 'Pagada', icon: 'check_circle', color: 'var(--clr-success)' },
  pasada: { label: 'Pasada', icon: 'history', color: 'var(--clr-grey-state)' },
  cancelada: { label: 'Cancelada', icon: 'close', color: 'var(--clr-danger)' },
  noVino: { label: 'No vino', icon: 'person_off', color: 'var(--clr-danger)' },
};

/** The order of `status_legend_sheet.dart`: the path of an appointment, and what goes wrong last. */
export const LEGEND: AgendaState[] = [
  'pendiente',
  'esperandoCliente',
  'confirmada',
  'pagada',
  'pasada',
  'cancelada',
  'noVino',
];

/**
 * Only what waits for the BUSINESS. One the business gave and the customer
 * has not accepted is not confirmable from here: that would skip the card and
 * the policy consent, and the server answers no anyway.
 */
export function canConfirm(booking: BookingResponse): boolean {
  return booking.status === 'PENDING';
}

/** Confirmed, already started, and within 48 h of finishing. */
export function canMarkNoShow(booking: BookingResponse, now = new Date()): boolean {
  if (booking.status !== 'CONFIRMED') return false;
  const start = toDate(booking.startDateTime);
  const end = toDate(booking.endDateTime);
  return start <= now && now.getTime() - end.getTime() < 48 * 3600 * 1000;
}

export function canCancel(booking: BookingResponse): boolean {
  return booking.status !== 'CANCELED' && booking.status !== 'NO_SHOW';
}

export function durationMinutes(booking: BookingResponse): number {
  return Math.round(
    (toDate(booking.endDateTime).getTime() - toDate(booking.startDateTime).getTime()) / 60_000,
  );
}

// ----- who and where -------------------------------------------------------

/** Someone WITHOUT a Bipsy account: told by email, nothing that needs an account works. */
export function isGuest(booking: BookingResponse): boolean {
  return booking.customerId == null;
}

/** The account booked it for another person. */
export function isForSomeoneElse(booking: BookingResponse): boolean {
  return (booking.attendeeName ?? '').trim().length > 0;
}

/**
 * Who walks through the door: what the agenda shows at a glance. Everything
 * else — charging, chat, bans, no-show — is done with `customerName`.
 */
export function whoAttends(booking: BookingResponse): string {
  return isForSomeoneElse(booking) ? booking.attendeeName!.trim() : booking.customerName;
}

export function isAtHome(booking: BookingResponse): boolean {
  return booking.servicePlace === 'AT_CUSTOMER';
}

/**
 * The address in one line. The server sends it composed (`oneLine`); the
 * fallback follows `BookingAddress.oneLine` in `booking_models.dart`.
 */
export function addressLine(address: BookingAddress): string {
  const fromServer = address.oneLine?.trim();
  if (fromServer) return fromServer;

  const clean = (value?: string | null) => (value ?? '').trim();
  const street = [clean(address.address), clean(address.details)].filter(Boolean).join(', ');
  const city = clean(address.city);
  const province = clean(address.province);
  const zone = [clean(address.postalCode), city].filter(Boolean).join(' ');
  // The province only when it adds something: «Madrid, Madrid» does not.
  const tail = province && province.toLowerCase() !== city.toLowerCase() ? province : '';
  return [street, [zone, tail].filter(Boolean).join(', ')].filter(Boolean).join(' · ');
}

/** What is handed to the map: without the floor, which only confuses the search. */
export function mapQuery(address: BookingAddress): string {
  return [address.address, address.postalCode, address.city]
    .map((value) => (value ?? '').trim())
    .filter(Boolean)
    .join(', ');
}

export function mapsHref(address: BookingAddress): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery(address))}`;
}

/**
 * How long the customer has left to accept, in words (`_plazoTexto` in
 * `booking_sheets.dart`). Rounded to minutes; once it is over it says so,
 * because the job takes up to a minute to close the appointment.
 */
export function confirmDeadlineText(booking: BookingResponse, now = new Date()): string {
  if (!booking.confirmExpiresAt) return 'Está esperando a que el cliente la acepte.';
  const left = fromInstant(booking.confirmExpiresAt).getTime() - now.getTime();
  if (left < 0) {
    return 'Se le ha pasado el plazo. La cita se cancelará sola en un momento y el hueco volverá a quedar libre.';
  }
  const minutes = Math.floor(left / 60_000);
  if (minutes < 1) return 'Le queda menos de un minuto para aceptarla.';
  return `Le quedan ${minutes} min para aceptarla. Si no contesta, se cancela y el hueco vuelve a quedar libre.`;
}
