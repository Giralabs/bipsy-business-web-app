import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { SiteSession } from '../../../../shared/site-session.service';
import { RouterLink } from '@angular/router';
import { BipRigComponent } from '../../../../components/bip-rig/bip-rig.component';
import { RevealDirective } from '../../../../shared/reveal.directive';

/**
 * How getting started works. The steps are the real sign-up of the business
 * app (five screens) and what the setup guide asks for afterwards.
 */
@Component({
  selector: 'app-home-steps',
  standalone: true,
  imports: [RouterLink, BipRigComponent, RevealDirective],
  templateUrl: './steps.component.html',
  styleUrl: './steps.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StepsSectionComponent {
  /** Signed in: the call to action goes to the panel, not to sign-up. */
  readonly session = inject(SiteSession);
  readonly steps = [
    {
      icon: 'person_add',
      title: 'Date de alta',
      text: 'Cinco pasos desde el móvil: tu cuenta (con correo o Google), tu negocio, el código de verificación y tu ubicación o a domicilio.',
    },
    {
      icon: 'tune',
      title: 'Configúralo a tu manera',
      text: 'Servicios con precio y duración, tu horario y tu política de cancelación. Un tutorial te enseña la app sobre la app.',
    },
    {
      icon: 'group_add',
      title: 'Invita a tu equipo y a tus clientes',
      text: 'Tu equipo entra gratis con el código de invitación. A tus clientes los importas de tus contactos y les mandas la invitación.',
    },
    {
      icon: 'celebration',
      title: 'Recibe tu primera reserva',
      text: 'Tu ficha ya está en Bipsy. Las reservas entran solas y tú solo tienes que atenderlas.',
    },
  ];
}
