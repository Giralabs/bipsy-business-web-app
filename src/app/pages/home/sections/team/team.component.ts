import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PhoneComponent } from '../../../../components/phone/phone.component';
import { RevealDirective } from '../../../../shared/reveal.directive';

/**
 * "Your team gets in for free". Its own section because it is the question
 * every business with staff asks before anything else —competitors charge per
 * seat— and in Bipsy the answer is zero: the plan is per business and workers
 * join with the invitation code.
 */
@Component({
  selector: 'app-home-team',
  standalone: true,
  imports: [RouterLink, PhoneComponent, RevealDirective],
  templateUrl: './team.component.html',
  styleUrl: './team.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeamSectionComponent {
  readonly digits = ['4', '8', '2', '9', '1', '3'];

  readonly steps = [
    { icon: 'pin', title: 'Genera el código', text: 'En Perfil › Equipo › Invitar. Son 6 dígitos y caducan en 12 horas.' },
    { icon: 'download', title: 'Tu trabajador lo escribe', text: 'Se descarga Bipsy Business gratis, elige «Soy trabajador» y pone el código.' },
    { icon: 'how_to_reg', title: 'Ya está en tu negocio', text: 'Con su agenda, sus servicios y los permisos que tú le des.' },
  ];

  readonly joined = [
    { initials: 'MA', name: 'María', role: 'Estilista' },
    { initials: 'JR', name: 'Javi', role: 'Barbero' },
    { initials: 'LM', name: 'Lucía', role: 'Recepción' },
  ];
}
