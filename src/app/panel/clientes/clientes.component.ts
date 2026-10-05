import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';
import { CustomersStore } from '../core/data/customers.store';
import { BusinessCustomer, CustomerOrigin } from '../core/api/models';
import { relativeDay, toDate } from '../core/util/dates';
import { plural } from '../core/util/format';
import {
  PnAvatarComponent,
  PnEmptyComponent,
  PnErrorComponent,
  PnSegmentedComponent,
  SegmentOption,
} from '../ui/controls';
import { PnDialogComponent } from '../ui/dialog.component';
import { ToastService } from '../ui/toast.service';

/** Segment id of «Todos»: the store keeps that one as null. */
const ALL = 'ALL';

/**
 * `/panel/clientes` — the shop's phone book, from `customers_screen.dart`.
 *
 * These are not Bipsy accounts: they are the people who call, the regulars,
 * the ones who never book online. The ones who do have an account show a badge
 * so it is obvious who can be messaged and who has to be phoned.
 */
@Component({
  selector: 'app-panel-clientes',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    PnAvatarComponent,
    PnEmptyComponent,
    PnErrorComponent,
    PnSegmentedComponent,
    PnDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './clientes.component.html',
  styleUrl: './clientes.component.css',
})
export class ClientesComponent {
  readonly store = inject(CustomersStore);
  private readonly auth = inject(AuthService);
  private readonly toasts = inject(ToastService);

  readonly relativeDay = relativeDay;
  readonly toDate = toDate;

  readonly creating = signal(false);
  readonly busy = signal(false);

  form = { name: '', phone: '', email: '', notes: '' };

  /**
   * Where the cards came from. A segmented control because the three exclude
   * each other and one is always chosen; «Mis contactos» joins typed and
   * imported, which is what the owner asks: how much clientele Bipsy brings.
   */
  readonly origins: SegmentOption[] = [
    { id: ALL, label: 'Todos' },
    { id: 'MINE', label: 'Mis contactos' },
    { id: 'BIPSY', label: 'De Bipsy' },
  ];

  readonly originValue = computed(() => this.store.origin() ?? ALL);

  /**
   * The trusted filter only makes sense where a card is asked for: if the shop
   * does not ask for one, trust takes nothing away from anybody and the filter
   * separates nothing.
   */
  readonly asksForCard = computed(() => this.auth.profile()?.requiresCard === true);

  constructor() {
    void this.store.load();
    // The term and the filters outlive the screen (the box comes back written);
    // what they found may not, so it is asked again on the way in.
    void this.store.search();
  }

  count(n: number, one: string, many: string): string {
    return plural(n, one, many);
  }

  setOrigin(id: string): void {
    this.store.setOrigin(id === ALL ? null : (id as CustomerOrigin));
  }

  /** Phone if there is one; if not, the e-mail; and if not, where the card came from. */
  contact(person: BusinessCustomer): string {
    const phone = person.phone?.trim();
    if (phone) return phone;
    const email = person.email?.trim();
    if (email) return email;
    switch (person.source) {
      case 'CONTACTS':
        return 'Importado de contactos';
      case 'BOOKING':
        return 'Te encontró en Bipsy';
      default:
        return 'Sin datos de contacto';
    }
  }

  lastVisit(person: BusinessCustomer): string {
    return person.lastBookingAt ? relativeDay(toDate(person.lastBookingAt)) : 'Nunca ha venido';
  }

  startCreate(): void {
    this.form = { name: '', phone: '', email: '', notes: '' };
    this.creating.set(true);
  }

  async save(): Promise<void> {
    if (!this.form.name.trim()) {
      this.toasts.error('Escribe al menos el nombre.');
      return;
    }
    this.busy.set(true);
    try {
      await this.store.create({
        name: this.form.name.trim(),
        phone: this.form.phone.trim() || null,
        email: this.form.email.trim() || null,
        notes: this.form.notes.trim() || null,
      });
      this.creating.set(false);
      this.toasts.show('Cliente añadido');
    } catch {
      this.toasts.error('No se pudo guardar. Revisa tu conexión.');
    } finally {
      this.busy.set(false);
    }
  }
}
