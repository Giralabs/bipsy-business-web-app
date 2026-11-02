import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';

export interface CoachStep {
  icon: string;
  title: string;
  body: string;
  /** `[data-coach]` value of the element to cut out, or null for a centred card. */
  target: string | null;
  /** Where the tour walks before showing the step. */
  route: string;
  /** The last step of the tour offers two ways out instead of one. */
  kind?: 'invite';
  /** Mr. Bip showing over the card, for the steps that do not point at anything. */
  art?: string;
  /** Only with a team: working alone that screen has nothing but a switch. */
  teamOnly?: boolean;
  /** Its target may rightly not be there (a finished checklist): the step is dropped. */
  optional?: boolean;
}

/**
 * The guided tour, grown from `features/welcome/coach_controller.dart`.
 *
 * The app's steps, plus two it does not have because they are newer than its
 * tour: Cobros and the shareable link. The differences are deliberate:
 *
 * - «Tu equipo» really points at something here. In the app nobody registers
 *   the `nav:team` target, so that step is always skipped.
 * - The last step asked to read the phone's contacts. A browser cannot, so it
 *   leads to the import screen.
 *
 * Both are written down in `docs/PANEL-SYNC.md`.
 */
@Injectable({ providedIn: 'root' })
export class CoachService {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  private static readonly STEPS: CoachStep[] = [
    {
      icon: 'celebration',
      title: '¡Ya estás dentro!',
      body: 'Te enseño el panel por encima en menos de un minuto. Vas a ir viendo las pantallas de verdad, no dibujos.',
      target: null,
      route: '/panel',
      art: 'MB-05',
    },
    {
      icon: 'calendar_month',
      title: 'Aquí está tu día',
      body: 'Las reservas entran solas y las ves por semana, por día o en lista. Desde una cita puedes confirmarla, cambiarla de hora, cobrarla o marcar que no se presentó.',
      target: 'nav:agenda',
      route: '/panel/agenda',
    },
    {
      icon: 'format_list_bulleted',
      title: 'Lo que ofreces',
      body: 'Añade tus servicios con precio y duración. Sin al menos uno, tus clientes no tienen nada que reservar.',
      target: 'nav:servicios',
      route: '/panel/servicios',
    },
    {
      icon: 'contacts',
      title: 'Tus clientes',
      body: 'Su historial, sus reseñas y sus cobros en una ficha. Con WhatsApp, teléfono y mensaje a un clic. Puedes traerte la agenda que ya tienes.',
      target: 'nav:clientes',
      route: '/panel/clientes',
    },
    {
      icon: 'group',
      title: 'Tu equipo',
      body: 'Invita a tus trabajadores. Cada uno gestiona su horario, sus ausencias y su fichaje, y Bipsy reparte las citas sin solaparlas.',
      target: 'nav:equipo',
      route: '/panel/equipo',
      teamOnly: true,
    },
    {
      icon: 'storefront',
      title: 'Tu ficha pública',
      body: 'Aquí decides cómo te ven: foto, portada, portfolio de trabajos y tu código de invitación, que Bipsy tiene en cuenta para ofertas y recompensas.',
      target: 'nav:negocio',
      route: '/panel/negocio',
    },
    {
      icon: 'payments',
      title: 'Tus cobros',
      body: 'Cobra con tarjeta en tu salón y al reservar. El dinero va directo a tu cuenta bancaria: Bipsy no se queda ninguna comisión.',
      target: 'nav:ajustes',
      route: '/panel/ajustes/cobros',
    },
    {
      icon: 'ios_share',
      title: 'Tu enlace',
      body: 'Compártelo en Instagram o por WhatsApp, o imprime el cartel con su código QR. Quien lo abre llega directo a tu ficha para pedirte cita.',
      target: 'enlace:qr',
      route: '/panel/enlace',
    },
    {
      icon: 'checklist',
      title: 'Lo que te falta, aquí',
      body: 'Esta lista se va tachando sola con lo que ya tienes hecho. Es el camino más corto para empezar a recibir reservas.',
      target: 'setup:checklist',
      route: '/panel',
      optional: true,
    },
    {
      icon: 'contact_phone',
      title: '¿Traemos a tus clientes de siempre?',
      body: 'Los que ya te llaman por teléfono también pueden estar aquí, con su historial y sus notas. Súbelos desde un archivo o, en el móvil, desde tu agenda.',
      target: null,
      route: '/panel',
      kind: 'invite',
      art: 'MB-11',
    },
  ];

  /** Same rule as `TeamStore.enabled`, which cannot be injected from here without a cycle risk. */
  private readonly hasTeam = computed(() => {
    const profile = this.auth.profile();
    if (profile?.teamEnabled != null) return profile.teamEnabled;
    return !this.auth.isAutonomous();
  });

  /** A step dropped along the way, so the count and the way back agree with what was seen. */
  private readonly dropped = signal<ReadonlySet<string>>(new Set());

  private readonly steps = computed(() =>
    CoachService.STEPS.filter(
      (step) => (!step.teamOnly || this.hasTeam()) && !this.dropped().has(step.title),
    ),
  );

  readonly index = signal(0);
  readonly running = signal(false);

  readonly step = computed<CoachStep | null>(() => (this.running() ? (this.steps()[this.index()] ?? null) : null));
  readonly total = computed(() => this.steps().length);
  readonly isFirst = computed(() => this.index() === 0);
  readonly isLast = computed(() => this.index() === this.steps().length - 1);

  /** True when this business has never finished (or skipped) the tour in this browser. */
  get pending(): boolean {
    const id = this.auth.user()?.id;
    if (id == null) return false;
    try {
      return localStorage.getItem(this.key(id)) !== 'true';
    } catch {
      return false;
    }
  }

  /** A worker has no services, team or public page of their own to be shown. */
  start(): void {
    if (!this.auth.isBusiness()) return;
    this.dropped.set(new Set());
    this.index.set(0);
    this.running.set(true);
    this.walk();
  }

  next(): void {
    if (this.isLast()) {
      this.finish();
      return;
    }
    this.index.set(this.index() + 1);
    this.walk();
  }

  back(): void {
    if (this.isFirst()) return;
    this.index.set(this.index() - 1);
    this.walk();
  }

  /** The current step has nothing to point at: the next one takes its place. */
  dropCurrent(): void {
    const step = this.step();
    if (!step) return;
    this.dropped.set(new Set([...this.dropped(), step.title]));
    this.walk();
  }

  /** Skipping still counts as seen: nobody wants it again on the next login. */
  skip(): void {
    this.finish();
  }

  finish(): void {
    this.running.set(false);
    const id = this.auth.user()?.id;
    if (id == null) return;
    try {
      localStorage.setItem(this.key(id), 'true');
    } catch {
      // Without storage the tour comes back next time; harmless.
    }
  }

  private walk(): void {
    const step = this.step();
    if (step) void this.router.navigateByUrl(step.route);
  }

  private key(actorId: number): string {
    return `bipsy.business_tour_seen.${actorId}`;
  }
}
