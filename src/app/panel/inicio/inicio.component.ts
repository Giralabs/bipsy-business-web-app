import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';
import { AgendaStore } from '../core/data/agenda.store';
import { ReviewsStore } from '../core/data/reviews.store';
import { SetupStore } from '../core/data/setup.store';
import { TeamStore } from '../core/data/team.store';
import { WaitlistStore } from '../core/data/waitlist.store';
import { ServicesStore } from '../core/data/services.store';
import { InboxStore } from '../core/data/inbox.store';
import { AgendaState, BookingResponse } from '../core/api/models';
import { stateOf, STATE_LOOK, whoAttends } from '../core/agenda/booking-state';
import { fromInstant, hhmm, isoWeekday, longDate, relativeDay, toDate } from '../core/util/dates';
import { money, plural, rating } from '../core/util/format';
import { ToastService } from '../ui/toast.service';
import { PnAvatarComponent, PnEmptyComponent } from '../ui/controls';
import { PnDeskHeroComponent } from '../ui/desk-hero.component';

/** Algo que pide atención, dicho con palabras y con a dónde ir a resolverlo. */
interface DeskAlert {
  id: string;
  title: string;
  sub: string;
  icon: string;
  route: string;
  query?: Record<string, string>;
}

/**
 * `/panel` — el inicio del dueño.
 *
 * Las secciones ya viven en la barra lateral, así que aquí no se repiten: el
 * saludo con Mr. Bip, el día, y lo que hay que atender (pendientes, avisos,
 * quién ha fichado, lo que falta de la ficha).
 */
@Component({
  selector: 'app-panel-inicio',
  standalone: true,
  imports: [RouterLink, PnEmptyComponent, PnAvatarComponent, PnDeskHeroComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './inicio.component.html',
  styleUrl: './inicio.component.css',
})
export class InicioComponent {
  readonly auth = inject(AuthService);
  readonly agenda = inject(AgendaStore);
  readonly setup = inject(SetupStore);
  readonly team = inject(TeamStore);
  readonly waitlist = inject(WaitlistStore);
  readonly reviews = inject(ReviewsStore);
  readonly services = inject(ServicesStore);
  readonly inbox = inject(InboxStore);
  private readonly toasts = inject(ToastService);

  readonly hhmm = hhmm;
  readonly toDate = toDate;
  readonly fromInstant = fromInstant;
  readonly relativeDay = relativeDay;
  readonly money = money;
  readonly rating = rating;
  readonly look = STATE_LOOK;
  /** Who shows up, which may not be the account that booked. */
  readonly who = whoAttends;

  constructor() {
    void this.reviews.load();
    void this.waitlist.load();
    void this.services.load();
    if (!this.auth.isAutonomous()) {
      void this.team.activeClocks.load();
      void this.team.absences.load();
    }
  }

  readonly today = this.agenda.today;
  readonly pending = this.agenda.pending;

  readonly upcoming = computed(() => {
    const now = new Date();
    return this.today().filter((booking) => toDate(booking.endDateTime) >= now);
  });

  readonly doneToday = computed(() => this.today().length - this.upcoming().length);

  readonly expectedToday = computed(() =>
    this.today().reduce((sum, booking) => sum + (booking.priceCents ?? 0), 0),
  );

  readonly todayHours = computed(() => {
    const entries = this.agenda.hoursOf(isoWeekday(new Date()));
    if (entries.length === 0) return null;
    return entries.map((entry) => `${entry.startTime} – ${entry.endTime}`).join(' · ');
  });

  readonly nextBooking = computed(() => this.upcoming()[0] ?? null);
  readonly todayLabel = computed(() => longDate(new Date()));

  /** Cuánto llevas del día, para la barra. */
  readonly progress = computed(() => {
    const total = this.today().length;
    return total === 0 ? 0 : this.doneToday() / total;
  });

  readonly greeting = computed(() => {
    const hour = new Date().getHours();
    if (hour < 6) return 'Buenas noches';
    if (hour < 14) return 'Buenos días';
    if (hour < 21) return 'Buenas tardes';
    return 'Buenas noches';
  });

  /** «8 citas hoy · la siguiente, a las 10:30 con Marta». */
  readonly summary = computed(() => {
    const count = this.today().length;
    if (count === 0) return 'Hoy no tienes citas. Buen día para completar tu ficha.';
    const next = this.nextBooking();
    const head = plural(count, 'cita hoy', 'citas hoy');
    return next
      ? `${head} · la siguiente, a las ${hhmm(toDate(next.startDateTime))} con ${whoAttends(next).split(' ')[0]}`
      : `${head} · ya has terminado por hoy`;
  });

  /**
   * Lo que antes eran avisos sueltos en los bloques de secciones: cada uno
   * dice qué pasa y lleva a donde se arregla.
   */
  readonly alerts = computed<DeskAlert[]>(() => {
    const alerts: DeskAlert[] = [];

    const unread = this.auth.canUseChat() ? this.inbox.unread() : 0;
    if (unread > 0) {
      alerts.push({
        id: 'chat',
        title: plural(unread, 'mensaje sin leer', 'mensajes sin leer'),
        sub: 'Tus clientes te han escrito',
        icon: 'forum',
        route: '/panel/mensajes',
      });
    }

    const absences = this.auth.isAutonomous() ? 0 : this.team.pendingAbsences().length;
    if (absences > 0) {
      alerts.push({
        id: 'ausencias',
        title: plural(absences, 'ausencia por aprobar', 'ausencias por aprobar'),
        sub: 'Tu equipo espera respuesta',
        icon: 'beach_access',
        route: '/panel/equipo/ausencias',
      });
    }

    const unanswered = this.reviews.unanswered().length;
    if (unanswered > 0) {
      alerts.push({
        id: 'resenas',
        title: plural(unanswered, 'reseña sin responder', 'reseñas sin responder'),
        sub: this.reviews.count() ? `${rating(this.reviews.average())} de media` : 'Contestar suma confianza',
        icon: 'star',
        route: '/panel/resenas',
      });
    }

    const noStaff = this.services.withoutStaff().length;
    if (noStaff > 0 && !this.auth.isAutonomous()) {
      alerts.push({
        id: 'servicios',
        title: plural(noStaff, 'servicio sin personal', 'servicios sin personal'),
        sub: 'Nadie puede atenderlos todavía',
        icon: 'content_cut',
        route: '/panel/servicios',
      });
    }

    const subscription = this.auth.profile()?.subscription;
    if (subscription?.daysLeft != null && subscription.daysLeft <= 5 &&
        (subscription.state === 'TRIAL' || subscription.state === 'WELCOME_TRIAL')) {
      alerts.push({
        id: 'plan',
        title: subscription.daysLeft <= 0
          ? 'Tu prueba termina hoy'
          : `Te ${subscription.daysLeft === 1 ? 'queda 1 día' : `quedan ${subscription.daysLeft} días`} de prueba`,
        sub: 'Elige un plan para no perder nada',
        icon: 'workspace_premium',
        route: '/panel/ajustes/suscripcion',
      });
    }

    return alerts;
  });

  stateOf(booking: BookingResponse): AgendaState {
    return stateOf(booking);
  }

  countLabel(count: number, one: string, many: string): string {
    return plural(count, one, many);
  }

  async confirm(booking: BookingResponse, event: Event): Promise<void> {
    event.stopPropagation();
    try {
      await this.agenda.confirm(booking.id);
      this.toasts.show('Cita confirmada');
    } catch {
      this.toasts.error('No se ha podido confirmar la reserva.');
    }
  }
}
