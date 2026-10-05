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
  /** The last step of the business tour offers two ways out instead of one. */
  kind?: 'invite';
}

/**
 * The guided tour, ported from `features/welcome/coach_controller.dart`.
 *
 * Same eight steps and same words. Two honest differences from the app:
 *
 * - Step 5 («Tu equipo») really works here. In the app nobody registers the
 *   `nav:team` target, so that step is always skipped; on a desk the section
 *   is an item of the sidebar (`data-coach="nav:<id>"` in the shell) and can
 *   be pointed at.
 * - Step 8 asked to import the phone's contacts. A browser cannot read them,
 *   so it points at the import screen instead.
 *
 * Both are written down in `docs/PANEL-SYNC.md`.
 */
@Injectable({ providedIn: 'root' })
export class CoachService {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  private static readonly BUSINESS_STEPS: CoachStep[] = [
    {
      icon: 'celebration',
      title: '¡Ya estás dentro!',
      body: 'Te enseño el panel por encima en menos de un minuto. Vas a ir viendo las pantallas de verdad, no dibujos.',
      target: null,
      route: '/panel',
    },
    {
      icon: 'calendar_month',
      title: 'Aquí está tu día',
      body: 'Las reservas entran solas y las ves por semana, por día o en lista. Desde una cita puedes confirmarla, cambiarla de hora o marcar que no se presentó.',
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
    },
    {
      icon: 'storefront',
      title: 'Tu ficha pública',
      body: 'Aquí decides cómo te ven: foto, portada, portfolio de trabajos y tu código de invitación, que Bipsy tiene en cuenta para ofertas y recompensas.',
      target: 'nav:negocio',
      route: '/panel/negocio',
    },
    {
      icon: 'checklist',
      title: 'Lo que te falta, aquí',
      body: 'Esta lista te va tachando lo que ya tienes hecho. Ábrela cuando quieras: es el camino más corto para empezar a recibir reservas.',
      target: 'setup:checklist',
      route: '/panel',
    },
    {
      icon: 'contact_phone',
      title: '¿Traemos a tus clientes de siempre?',
      body: 'Los que ya te llaman por teléfono también pueden estar aquí, con su historial y sus notas. Puedes añadirlos a mano o pegar tu lista de una vez.',
      target: null,
      route: '/panel',
      kind: 'invite',
    },
  ];

  /**
   * The Quality tour, ported from `_qualitySteps` of `coach_controller.dart`.
   *
   * Still three steps and still the app's words. What changed on 23/09/2026 is
   * that neither app nor web has a «Personalización» screen any more, so the
   * second step no longer walks anywhere special: it stays on «Tu ficha» and
   * comes out as a loose card, exactly as the app leaves it on `profile`.
   */
  private static readonly QUALITY_STEPS: CoachStep[] = [
    {
      icon: 'auto_awesome',
      title: '¡Ya eres Quality!',
      body: 'A partir de ahora tu negocio puede verse distinto al resto. Te enseño dónde está todo en menos de un minuto.',
      target: null,
      route: '/panel/negocio',
    },
    {
      icon: 'palette',
      title: 'Aquí decides cómo te ven',
      body: 'Tu color, tu foto y tu portada animadas, los efectos de tu ficha y el orden de tus secciones. Lo vas viendo en vivo mientras eliges.',
      target: null,
      route: '/panel/negocio',
    },
    {
      icon: 'photo_library',
      title: 'Tu portfolio, sin tope',
      body: 'Con Quality puedes subir todas las fotos de tu trabajo que quieras. Es lo primero que mira un cliente antes de reservar.',
      target: null,
      route: '/panel/negocio/portfolio',
    },
  ];

  private steps: CoachStep[] = [];

  readonly index = signal(0);
  readonly running = signal(false);

  readonly step = computed<CoachStep | null>(() => (this.running() ? (this.steps[this.index()] ?? null) : null));
  readonly total = computed(() => this.steps.length);
  readonly isLast = computed(() => this.index() === this.steps.length - 1);

  /** True when this business has never finished (or skipped) the tour. */
  get pending(): boolean {
    const id = this.auth.user()?.id;
    if (id == null) return false;
    try {
      return localStorage.getItem(this.key(id)) !== 'true';
    } catch {
      return false;
    }
  }

  start(tour: 'business' | 'quality' = 'business'): void {
    this.steps = tour === 'quality' ? CoachService.QUALITY_STEPS : CoachService.BUSINESS_STEPS;
    this.index.set(0);
    this.running.set(true);
    void this.router.navigateByUrl(this.steps[0].route);
  }

  next(): void {
    if (this.isLast()) {
      this.finish();
      return;
    }
    this.index.set(this.index() + 1);
    const step = this.steps[this.index()];
    if (step) void this.router.navigateByUrl(step.route);
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

  private key(actorId: number): string {
    return `bipsy.business_tour_seen.${actorId}`;
  }
}
