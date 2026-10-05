import { ChangeDetectionStrategy, Component, Input, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CustomersStore } from '../core/data/customers.store';
import { InboxStore } from '../core/data/inbox.store';
import { AuthService } from '../core/auth/auth.service';
import { BookingResponse, BusinessCustomerDetail, CustomerSource } from '../core/api/models';
import { STATE_LOOK, stateOf } from '../core/agenda/booking-state';
import { fromInstant, hhmm, longDate, relativeDay, toDate } from '../core/util/dates';
import { money, plural } from '../core/util/format';
import {
  PnAvatarComponent,
  PnEmptyComponent,
  PnSegmentedComponent,
  PnSwitchComponent,
  SegmentOption,
} from '../ui/controls';
import { PnDialogComponent } from '../ui/dialog.component';
import { ConfirmService } from '../ui/confirm.service';
import { ToastService } from '../ui/toast.service';

/**
 * `/panel/clientes/:id` — the customer file of `customer_detail_screen.dart`,
 * with the same four tabs: Info, Citas, Reseñas and Pagos.
 *
 * The private notes are the piece that earns the screen: they are the only
 * place in Bipsy where the shop writes something only it will read.
 */
@Component({
  selector: 'app-panel-cliente',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    PnAvatarComponent,
    PnEmptyComponent,
    PnSegmentedComponent,
    PnSwitchComponent,
    PnDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './cliente-detalle.component.html',
  styleUrl: './cliente-detalle.component.css',
})
export class ClienteDetalleComponent implements OnInit {
  @Input() id = '';

  private readonly store = inject(CustomersStore);
  private readonly inbox = inject(InboxStore);
  private readonly confirm = inject(ConfirmService);
  private readonly toasts = inject(ToastService);
  private readonly router = inject(Router);
  readonly auth = inject(AuthService);

  readonly hhmm = hhmm;
  readonly toDate = toDate;
  readonly fromInstant = fromInstant;
  readonly longDate = longDate;
  readonly relativeDay = relativeDay;
  readonly money = money;
  readonly look = STATE_LOOK;

  readonly detail = signal<BusinessCustomerDetail | null>(null);
  readonly loading = signal(true);
  readonly tab = signal('info');
  readonly editing = signal(false);
  readonly busy = signal(false);
  readonly savingTrust = signal(false);

  form = { name: '', phone: '', email: '', notes: '' };

  readonly tabs = computed<SegmentOption[]>(() => {
    const detail = this.detail();
    return [
      { id: 'info', label: 'Info' },
      { id: 'citas', label: 'Citas', badge: detail?.bookings.length },
      { id: 'resenas', label: 'Reseñas', badge: detail?.reviews.length },
      { id: 'pagos', label: 'Pagos' },
    ];
  });

  readonly upcoming = computed(() => {
    const now = new Date();
    return (this.detail()?.bookings ?? [])
      .filter((booking) => toDate(booking.startDateTime) >= now && booking.status !== 'CANCELED')
      .sort((a, b) => a.startDateTime.localeCompare(b.startDateTime));
  });

  readonly past = computed(() =>
    (this.detail()?.bookings ?? [])
      .filter((booking) => toDate(booking.startDateTime) < new Date() || booking.status === 'CANCELED')
      .sort((a, b) => b.startDateTime.localeCompare(a.startDateTime)),
  );

  async ngOnInit(): Promise<void> {
    await this.reload();
  }

  private async reload(): Promise<void> {
    this.loading.set(true);
    try {
      const detail = await this.store.detail(Number(this.id));
      this.detail.set(detail);
      this.form = {
        name: detail.customer.name,
        phone: detail.customer.phone ?? '',
        email: detail.customer.email ?? '',
        notes: detail.customer.notes ?? '',
      };
    } catch {
      this.toasts.error('No hemos podido abrir la ficha.');
    } finally {
      this.loading.set(false);
    }
  }

  stateOf = stateOf;

  count(n: number, one: string, many: string): string {
    return plural(n, one, many);
  }

  /** Where the card came from, in the words of the app's «Origen» row. */
  sourceLabel(source: CustomerSource): string {
    switch (source) {
      case 'CONTACTS':
        return 'Importado de contactos';
      case 'BOOKING':
        return 'Te encontró en Bipsy';
      default:
        return 'Añadido a mano';
    }
  }

  sourceIcon(source: CustomerSource): string {
    switch (source) {
      case 'CONTACTS':
        return 'contacts';
      case 'BOOKING':
        return 'phone_iphone';
      default:
        return 'edit';
    }
  }

  /**
   * Who the appointment is for when the customer booked it for someone else.
   * In a customer's file, an appointment their mother came to cannot read as
   * a visit of theirs.
   */
  attendee(booking: BookingResponse): string | null {
    return booking.attendeeName?.trim() || null;
  }

  get phoneHref(): string {
    return `tel:${(this.detail()?.customer.phone ?? '').replace(/\s/g, '')}`;
  }

  get whatsappHref(): string {
    const phone = (this.detail()?.customer.phone ?? '').replace(/\D/g, '');
    return `https://wa.me/${phone.startsWith('34') ? phone : '34' + phone}`;
  }

  get mailHref(): string {
    return `mailto:${this.detail()?.customer.email ?? ''}`;
  }

  async saveEdit(): Promise<void> {
    this.busy.set(true);
    try {
      await this.store.update(Number(this.id), {
        name: this.form.name.trim(),
        phone: this.form.phone.trim() || null,
        email: this.form.email.trim() || null,
        notes: this.form.notes.trim() || null,
      });
      await this.reload();
      this.editing.set(false);
      this.toasts.show('Ficha guardada');
    } catch {
      this.toasts.error('No se pudo guardar.');
    } finally {
      this.busy.set(false);
    }
  }

  async message(): Promise<void> {
    const customerId = this.detail()?.customer.linkedCustomerId;
    if (!customerId) return;
    try {
      await this.inbox.openWithCustomer(customerId);
      await this.router.navigateByUrl('/panel/mensajes');
    } catch {
      this.toasts.error('No se ha podido abrir la conversación.');
    }
  }

  /**
   * The «Cliente de confianza» switch: stop asking this person for a card.
   *
   * It shows the state IN FORCE (`trusted`), whether the shop or the customer's
   * history put it there. The difference shows when turning it off: what was
   * earned with the history is not taken away from here, so instead of going
   * off it is explained where it comes from and where it is disabled.
   */
  async setTrusted(value: boolean): Promise<void> {
    const person = this.detail()?.customer;
    if (!person || this.savingTrust()) return;
    if (!value && person.trusted && !person.trustedManually) {
      await this.explainAutomaticTrust();
      return;
    }
    this.savingTrust.set(true);
    try {
      const updated = await this.store.setTrusted(person.id, value);
      this.detail.update((detail) => (detail ? { ...detail, customer: updated } : detail));
      // Removing the mark does not always remove the trust: with the streak and
      // the automatism on, the switch would turn itself back on. It is said,
      // instead of letting it look like a failure.
      if (!value && updated.trusted) await this.explainAutomaticTrust();
    } catch {
      this.toasts.error('No se ha podido guardar.');
    } finally {
      this.savingTrust.set(false);
    }
  }

  /** Nothing is turned off: it offers going where it IS changed, Funcionalidades. */
  private async explainAutomaticTrust(): Promise<void> {
    const answer = await this.confirm.ask({
      title: 'Lo es por su historial',
      message:
        'Este cliente se ha definido de confianza de forma automática. Si no quieres esto, puedes ' +
        'desactivar los clientes de confianza automáticos en Funcionalidades.',
      confirmLabel: 'Ir a Funcionalidades',
      cancelLabel: 'Entendido',
    });
    if (answer.ok) await this.router.navigateByUrl('/panel/ajustes/funcionalidades');
  }

  async ban(): Promise<void> {
    const person = this.detail()?.customer;
    // The ban goes on the Bipsy account: without one there is nothing to ban.
    if (!person || person.linkedCustomerId == null) return;
    const customerId = person.linkedCustomerId;
    const answer = await this.confirm.ask({
      title: 'Vetar cliente',
      message: `${person.name} no podrá volver a reservar contigo.`,
      confirmLabel: 'Vetar',
      destructive: true,
      reason: {
        label: 'Motivo',
        placeholder: 'Solo lo ves tú',
        hint: 'Nos ayuda a entender qué ha pasado si más adelante lo revisamos.',
      },
    });
    if (!answer.ok) return;
    try {
      await this.store.ban(customerId, answer.reason, false);
      await this.reload();
      this.toasts.show('Cliente vetado');
    } catch {
      this.toasts.error('No se ha podido vetar.');
    }
  }

  async remove(): Promise<void> {
    const person = this.detail()?.customer;
    if (!person) return;
    const question = `¿Seguro que quieres quitar a ${person.name} de tu agenda? Sus citas y sus reseñas no se borran.`;
    const answer = await this.confirm.ask({
      title: 'Eliminar cliente',
      // Whoever can book is warned that the card will come back by itself:
      // what is lost for good are the notes and the trusted mark.
      message:
        person.linkedCustomerId != null
          ? `${question} Si vuelve a reservar reaparecerá en tu agenda, sin sus notas ni la marca de confianza.`
          : question,
      confirmLabel: 'Eliminar',
      destructive: true,
    });
    if (!answer.ok) return;
    try {
      await this.store.remove(person.id);
      this.toasts.show('Cliente eliminado');
      await this.router.navigateByUrl('/panel/clientes');
    } catch (cause) {
      // The server's own message: the likeliest reason is appointments in the
      // history, and it says how many and what to do about them.
      const detail = (cause as { error?: { message?: string } }).error?.message;
      this.toasts.error(detail || 'El cliente sigue en tu agenda. Vuelve a intentarlo.');
    }
  }
}
