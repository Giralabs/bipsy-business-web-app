import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CustomersStore } from '../core/data/customers.store';
import { BusinessCustomer } from '../core/api/models';
import { longDate, toDate } from '../core/util/dates';
import { PnAvatarComponent, PnEmptyComponent } from '../ui/controls';
import { ConfirmService } from '../ui/confirm.service';
import { ToastService } from '../ui/toast.service';

/**
 * `/panel/clientes/vetados` — `banned_customers_screen.dart`.
 *
 * Un veto no se borra: se levanta. Por eso esta pantalla existe aparte, para
 * que la lista de clientes no arrastre a quien ya no quieres que reserve.
 */
@Component({
  selector: 'app-panel-vetados',
  standalone: true,
  imports: [RouterLink, PnAvatarComponent, PnEmptyComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="pn-main">
      <div class="pn-head">
        <div class="pn-head__text">
          <p class="pn-head__greet">Quien está aquí no puede reservar contigo</p>
          <h1>Clientes vetados</h1>
        </div>
        <div class="pn-head__actions">
          <a class="pn-btn pn-btn--secondary" routerLink="/panel/clientes">Todos los clientes</a>
        </div>
      </div>

      <section class="pn-card">
        @if (store.banned().length === 0) {
          <pn-empty
            icon="person_check"
            title="Sin vetos activos"
            text="Si algún día vetas a alguien desde su ficha, aparecerá aquí y podrás levantarle el veto."
          />
        } @else {
          @for (person of store.banned(); track person.id) {
            <div class="row">
              <pn-avatar [name]="person.name" [url]="person.profileImageUrl" />
              <div class="row__main">
                <p class="row__name">{{ person.name }}</p>
                <p class="row__meta">
                  {{ person.phone ?? person.email ?? 'Sin contacto' }}
                  @if (person.lastBookingAt) {
                    · última cita el {{ longDate(toDate(person.lastBookingAt)) }}
                  }
                </p>
              </div>
              <button type="button" class="pn-btn pn-btn--secondary pn-btn--sm" (click)="unban(person)">
                Levantar el veto
              </button>
            </div>
          }
        }
      </section>
    </main>
  `,
  styles: [
    `
      :host { display: block; }
      .row { display: flex; align-items: center; gap: 16px; padding: 16px 4px; }
      .row + .row { border-top: 1px solid var(--pn-line); }
      .row__main { flex: 1; min-width: 0; }
      .row__name { font-size: 1rem; font-weight: 700; }
      .row__meta { margin-top: 3px; font-size: 0.875rem; color: var(--clr-text-3); }
    `,
  ],
})
export class VetadosComponent {
  readonly store = inject(CustomersStore);
  private readonly confirm = inject(ConfirmService);
  private readonly toasts = inject(ToastService);

  readonly longDate = longDate;
  readonly toDate = toDate;

  constructor() {
    void this.store.load();
  }

  async unban(person: BusinessCustomer): Promise<void> {
    const answer = await this.confirm.ask({
      title: 'Levantar el veto',
      message: `${person.name} volverá a poder reservar contigo.`,
      confirmLabel: 'Levantar',
    });
    // A ban always hangs from a Bipsy account; an entry without one cannot be banned.
    if (!answer.ok || person.linkedCustomerId == null) return;
    try {
      await this.store.unban(person.linkedCustomerId);
      this.toasts.show('Veto levantado');
    } catch {
      this.toasts.error('No se ha podido levantar.');
    }
  }
}
