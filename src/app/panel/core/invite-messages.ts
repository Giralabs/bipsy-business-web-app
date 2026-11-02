/**
 * What is sent when inviting someone. Twin of `core/invite_messages.dart`: each
 * message goes with its link on the next line, because a bare code makes whoever
 * gets it go looking for the app, and that is where half of the invitations fall.
 *
 * Without the app those links open the web, which is why they are absolute.
 */
export const WEB = 'https://bipsy.es';

/** `GipsiLinks.teamInvite`: opens the business app on the accept screen. */
export function teamInviteLink(token: string): string {
  return `${WEB}/equipo/${encodeURIComponent(token)}`;
}

/** `GipsiLinks.customerInvite`: opens the customer sign-up with the code filled in. */
export function customerInviteLink(code: string): string {
  return `${WEB}/invitacion/${encodeURIComponent(code)}`;
}

/** `GipsiLinks.download`: the web sends each phone to its store. */
export const DOWNLOAD_LINK = `${WEB}/descargar`;

/** The invitation to a worker. */
export function teamInviteMessage(token: string): string {
  return `Te invito a mi equipo en Bipsy. Entra desde este enlace (tu código es ${token}):\n${teamInviteLink(token)}`;
}

/** A business's invitation to its customers, with its referral code. */
export function customerInviteMessage(code: string): string {
  return `Crea tu cuenta en Bipsy desde este enlace, con mi código de invitación (${code}):\n${customerInviteLink(code)}`;
}

/**
 * The invitation sent to ONE customer from their card. Only to the app: that
 * customer is already the shop's, what is asked of them is to make an account.
 * With no code chosen yet, the download link.
 */
export function singleCustomerInviteMessage(code: string | null): string {
  return code ? customerInviteMessage(code) : `Descárgate Bipsy desde este enlace:\n${DOWNLOAD_LINK}`;
}

/**
 * What goes to the contacts just imported. With a code, the invitation and its
 * link; without one, the business's public page, which books without an account.
 */
export function importedContactsMessage(
  code: string | null,
  businessName: string | null | undefined,
  businessLink: string | null,
): string {
  const name = businessName?.trim() ?? '';
  if (code && name) {
    return `Reserva en ${name} con Bipsy. Crea tu cuenta desde este enlace, con mi código de invitación (${code}):\n${customerInviteLink(code)}`;
  }
  if (code) return customerInviteMessage(code);
  const greeting = name ? `Reserva en ${name} desde aquí:` : 'Reserva desde aquí:';
  return businessLink ? `${greeting}\n${businessLink}` : greeting;
}
