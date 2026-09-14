import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BipSlotComponent } from '../../../../components/bip-slot/bip-slot.component';
import { RevealDirective } from '../../../../shared/reveal.directive';

/**
 * The two apps and how they meet: customers book in Bipsy, the business
 * receives it in Bipsy Business. It is what sets Bipsy apart from agenda
 * software that is only a calendar — the business also gets a shop window
 * where people are already looking for an appointment.
 */
@Component({
  selector: 'app-home-marketplace',
  standalone: true,
  imports: [RouterLink, BipSlotComponent, RevealDirective],
  templateUrl: './marketplace.component.html',
  styleUrl: './marketplace.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MarketplaceSectionComponent {
  readonly clientPoints = [
    'Busca por zona, servicio o categoría, en lista o en el mapa',
    'Reserva con el profesional que prefiera, a cualquier hora',
    'Cambia la hora o cancela sin llamar',
    'Se apunta a la lista de espera si no hay hueco',
  ];

  readonly businessPoints = [
    'La reserva entra en tu agenda al momento',
    'Aceptas sola o confirmas con un toque',
    'El cliente recibe el recordatorio el día antes',
    'Si cancela, el hueco se ofrece a la lista de espera',
  ];
}
