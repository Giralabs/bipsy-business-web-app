import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { BookingResponse } from '../core/api/models';
import {
  STATE_LOOK,
  addressLine,
  canCancel,
  canConfirm,
  canMarkNoShow,
  confirmDeadlineText,
  durationMinutes,
  isAtHome,
  isForSomeoneElse,
  isGuest,
  mapsHref,
  stateOf,
  whoAttends,
} from '../core/agenda/booking-state';
import { hhmm, longDateTime, toDate } from '../core/util/dates';
import { duration as durationText, money } from '../core/util/format';
import { AgendaStore } from '../core/data/agenda.store';
import { AuthService } from '../core/auth/auth.service';
import { TeamStore } from '../core/data/team.store';
import { PnDialogComponent } from '../ui/dialog.component';
import { ConfirmService } from '../ui/confirm.service';
import { ToastService } from '../ui/toast.service';

/**
 * Everything you can do with one appointment.
 *
 * The app splits this in two: tapping the card opens a read-only sheet, and
 * tapping the colour stripe opens an action sheet. On a desk there is room for
 * one dialog with both, which also removes the «where do I tap?» problem the
 * legend has to explain in the app.
 *
 * The app's action sheet also offers banning; the panel does that from the
 * customer's card, so a guest (no account) needs nothing hidden here — only
 * the block that says why there is no chat or charge.
 *
 * Reassigning is here too. In the app it only exists inside the absence
 * conflict resolver, but the endpoint is the same and from a desk it is the
 * natural fix when someone calls in sick.
 */
@Component({
  selector: 'app-booking-dialog',
  standalone: true,
  imports: [PnDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './booking-dialog.component.html',
  styleUrl: './booking-dialog.component.css',
})
export class BookingDialogComponent {
  @Input({ required: true }) booking!: BookingResponse;
  @Output() closed = new EventEmitter<void>();

  private readonly agenda = inject(AgendaStore);
  private readonly confirmService = inject(ConfirmService);
  private readonly toasts = inject(ToastService);
  readonly team = inject(TeamStore);
  readonly auth = inject(AuthService);

  readonly busy = signal(false);
  readonly reassigning = signal(false);
  readonly candidates = signal<{ id: number; name: string }[]>([]);

  get state() {
    return stateOf(this.booking);
  }

  get look() {
    return STATE_LOOK[this.state];
  }

  get when(): string {
    return longDateTime(toDate(this.booking.startDateTime));
  }

  get range(): string {
    return `${hhmm(toDate(this.booking.startDateTime))} – ${hhmm(toDate(this.booking.endDateTime))}`;
  }

  get length(): string {
    return durationText(durationMinutes(this.booking));
  }

  get amount(): string {
    return money(this.booking.priceCents);
  }

  get prepaid(): boolean {
    return this.booking.prepaidCents > 0;
  }

  get canConfirm(): boolean {
    return canConfirm(this.booking);
  }

  get canNoShow(): boolean {
    return canMarkNoShow(this.booking);
  }

  get canCancel(): boolean {
    return canCancel(this.booking);
  }

  /** Without a Bipsy account: told by email, and nothing that needs an account applies. */
  get guest(): boolean {
    return isGuest(this.booking);
  }

  /** Booked by one account for another person: two names, and both matter. */
  get forSomeoneElse(): boolean {
    return isForSomeoneElse(this.booking);
  }

  get attendee(): string {
    return whoAttends(this.booking);
  }

  get awaitingCustomer(): boolean {
    return this.booking.status === 'AWAITING_CUSTOMER';
  }

  get deadline(): string {
    return confirmDeadlineText(this.booking);
  }

  get atHome(): boolean {
    return isAtHome(this.booking);
  }

  get where(): string | null {
    return this.booking.address ? addressLine(this.booking.address) : null;
  }

  /** On a desk «Abrir en Maps» is a plain link: no app to look for, no question to ask. */
  get mapsHref(): string {
    return this.booking.address ? mapsHref(this.booking.address) : '';
  }

  get phoneHref(): string {
    return `tel:${(this.booking.customerPhone ?? '').replace(/\s/g, '')}`;
  }

  get whatsappHref(): string {
    const phone = (this.booking.customerPhone ?? '').replace(/\D/g, '');
    return `https://wa.me/${phone.startsWith('34') ? phone : '34' + phone}`;
  }

  async confirm(): Promise<void> {
    await this.run(() => this.agenda.confirm(this.booking.id), 'Cita confirmada');
  }

  async cancel(): Promise<void> {
    const answer = await this.confirmService.ask({
      title: 'Cancelar reserva',
      message: `Vas a cancelar la cita de ${this.booking.customerName}.`,
      confirmLabel: 'Cancelar la reserva',
      cancelLabel: 'Volver',
      destructive: true,
      reason: {
        label: 'Por qué cancelas',
        placeholder: 'Opcional',
        hint: 'Se lo enseñamos al cliente junto al aviso de que has cancelado.',
        maxLength: 300,
      },
    });
    if (!answer.ok) return;
    await this.run(() => this.agenda.cancel(this.booking.id, answer.reason), 'Reserva cancelada');
  }

  async noShow(): Promise<void> {
    const fee = this.auth.profile()?.cancellationFeePercent ?? 0;
    const requiresCard = this.auth.profile()?.requiresCard === true;
    const answer = await this.confirmService.ask({
      title: '¿No se presentó?',
      message:
        // A guest is exempt: there is no account to charge.
        requiresCard && fee > 0 && !this.guest
          ? `Se le cobrará la tarifa de cancelación (${fee} % del precio).`
          : 'Quedará marcada como plantón en su ficha.',
      confirmLabel: 'Sí, no vino',
      destructive: true,
    });
    if (!answer.ok) return;
    await this.run(() => this.agenda.markNoShow(this.booking.id), 'Marcada como no presentada');
  }

  async startReassign(): Promise<void> {
    this.reassigning.set(true);
    try {
      this.candidates.set(await this.agenda.availableWorkers(this.booking.id));
    } catch {
      this.candidates.set(this.team.available().map((worker) => ({ id: worker.id, name: worker.name })));
    }
  }

  async reassign(workerId: number): Promise<void> {
    await this.run(() => this.agenda.reassign(this.booking.id, workerId), 'Cita reasignada');
  }

  private async run(action: () => Promise<void>, ok: string): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      await action();
      this.toasts.show(ok);
      this.closed.emit();
    } catch {
      this.toasts.error('No se ha podido. Inténtalo otra vez.');
    } finally {
      this.busy.set(false);
    }
  }
}
