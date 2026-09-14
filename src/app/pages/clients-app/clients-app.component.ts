import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PageHeroComponent } from '../../components/page-hero/page-hero.component';
import { PhoneComponent } from '../../components/phone/phone.component';
import { BipSlotComponent } from '../../components/bip-slot/bip-slot.component';
import { CtaBandComponent } from '../../components/cta-band/cta-band.component';
import { RevealDirective } from '../../shared/reveal.directive';
import { TiltDirective } from '../../shared/tilt.directive';
import { CLIENT_WEB_URL, STORE_LINKS } from '../../data/site.data';

/**
 * Bipsy, the customer app, explained to the business: what its clients can
 * do and how they get there. Everything listed exists in `apps/gipsi`.
 */
@Component({
  selector: 'app-clients-app',
  standalone: true,
  imports: [RouterLink, PageHeroComponent, PhoneComponent, BipSlotComponent, CtaBandComponent, RevealDirective, TiltDirective],
  templateUrl: './clients-app.component.html',
  styleUrl: './clients-app.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientsAppComponent {
  readonly stores = STORE_LINKS;
  readonly clientWeb = CLIENT_WEB_URL;

  readonly features = [
    { icon: 'travel_explore', title: 'Buscar cerca', text: 'Por nombre, servicio o categoría, con filtros de zona, fecha, a domicilio y mejor valorados, en lista o en el mapa.' },
    { icon: 'event_available', title: 'Reservar en cuatro toques', text: 'Profesional (o cualquiera disponible), día, hora y confirmar. Con las normas y la política de cancelación a la vista.' },
    { icon: 'edit_calendar', title: 'Cambiar o cancelar', text: 'Desde Mis citas, dentro de las reglas de tu negocio, sin llamar ni escribir.' },
    { icon: 'hourglass_top', title: 'Lista de espera', text: 'Si no hay hueco, se apunta con sus preferencias de fecha, franja y profesional, y recibe el aviso si se libera uno.' },
    { icon: 'replay', title: 'Volver a reservar', text: 'Tus clientes de siempre te encuentran en «Tus favoritos» y «Volver a reservar».' },
    { icon: 'notifications_active', title: 'Recordatorios', text: 'Aviso de cada confirmación o cambio, y recordatorio el día anterior a la cita.' },
    { icon: 'forum', title: 'Chat con el negocio', text: 'Para mandarte una foto de referencia o avisarte de un retraso.' },
    { icon: 'credit_card', title: 'Pagos seguros', text: 'Tarjetas guardadas con Stripe, solo cuando el negocio pide tarjeta para reservar.' },
  ];

  readonly ways = [
    { icon: 'contacts', title: 'Invítales desde tu agenda', text: 'Importa tus contactos y mándales la invitación con un mensaje ya escrito por WhatsApp o SMS.' },
    { icon: 'qr_code_2', title: 'Tu código de negocio', text: 'Eliges un código de invitación y tus clientes lo escriben al registrarse en Bipsy.' },
    { icon: 'new_releases', title: 'Te descubren en la app', text: 'Tu negocio lleva la insignia «Nuevo» durante 60 días y puede aparecer en Destacados de tu zona.' },
  ];
}
