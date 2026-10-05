import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { SiteSession } from '../../shared/site-session.service';
import { RouterLink } from '@angular/router';
import { PageHeroComponent } from '../../components/page-hero/page-hero.component';
import { BipSlotComponent } from '../../components/bip-slot/bip-slot.component';
import { PhoneComponent } from '../../components/phone/phone.component';
import { CtaBandComponent } from '../../components/cta-band/cta-band.component';
import { RevealDirective } from '../../shared/reveal.directive';
import { TiltDirective } from '../../shared/tilt.directive';

/**
 * Why Bipsy. Reasons, not superlatives: every one is a product decision that
 * can be checked in the app. No customer counts or percentages, because
 * there are none to show yet and inventing them would be false advertising.
 */
@Component({
  selector: 'app-why',
  standalone: true,
  imports: [RouterLink, PageHeroComponent, BipSlotComponent, PhoneComponent, CtaBandComponent, RevealDirective, TiltDirective],
  templateUrl: './why.component.html',
  styleUrl: './why.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WhyComponent {
  /** Signed in: the call to action goes to the panel, not to sign-up. */
  readonly session = inject(SiteSession);
  readonly reasons = [
    { icon: 'apps', title: 'Todo en una sola app', text: 'Agenda, clientes, mensajes, equipo, fichaje y finanzas. Sin saltar entre cinco herramientas que no se hablan.' },
    { icon: 'travel_explore', title: 'Con clientes buscando', text: 'Tu negocio aparece en Bipsy, la app gratuita donde la gente busca y reserva cita cerca de casa.' },
    { icon: 'group_add', title: 'Tu equipo, gratis', text: 'Un plan por negocio. Tus trabajadores entran con tu código de invitación sin pagar nada más.' },
    { icon: 'percent', title: 'Sin comisiones', text: 'Ni por reserva ni por los cobros de tarifas: Bipsy no se queda con una parte de tu trabajo.' },
    { icon: 'smartphone', title: 'Pensada para el móvil', text: 'Una app nativa para Android e iPhone que se siente como el resto de tu teléfono, no una web encogida.' },
    { icon: 'lock_open', title: 'Sin permanencia', text: 'Pruébala gratis y quédate porque te sirve. Cancelas desde la tienda cuando quieras.' },
  ];

  readonly before = [
    'El teléfono sonando en mitad de un servicio',
    'Citas apuntadas en papel, WhatsApp y la memoria',
    'Plantones que te dejan la tarde vacía',
    'Cuentas del mes en una hoja de cálculo',
    'Horarios del equipo en un grupo de mensajes',
  ];

  readonly after = [
    'Reservas online mientras trabajas o duermes',
    'Una agenda con todas las citas y su estado',
    'Tarjeta al reservar y lista de espera',
    'Caja, gastos y comisiones al día',
    'Horarios, ausencias y fichaje en la app',
  ];
}
