import { Injectable, computed, inject } from '@angular/core';
import { Api } from '../api/api';
import { PortfolioImage, ReferralCode } from '../api/models';
import { AuthService } from '../auth/auth.service';
import { AgendaStore } from './agenda.store';
import { ServicesStore } from './services.store';
import { TeamStore } from './team.store';
import { resource } from './resource';

export interface SetupStep {
  id: string;
  icon: string;
  title: string;
  subtitle: string;
  route: string;
  done: boolean;
}

/**
 * «Completar mi perfil» — the checklist from `welcome_providers.dart`
 * (`setupStepsProvider`) and the sheet in `setup_guide_sheet.dart`.
 *
 * Between six and eight steps: the portfolio one only appears when the plan
 * allows photos, the team one only when the business is not a one-person shop.
 * A step whose data has not loaded yet counts as pending, same as the app.
 */
@Injectable({ providedIn: 'root' })
export class SetupStore {
  private readonly api = inject(Api);
  private readonly auth = inject(AuthService);
  private readonly services = inject(ServicesStore);
  private readonly team = inject(TeamStore);
  private readonly agenda = inject(AgendaStore);

  readonly portfolio = resource<PortfolioImage[]>(
    () => this.api.get<PortfolioImage[]>('/businesses/me/portfolio'),
    [],
  );

  readonly referral = resource<ReferralCode>(
    () => this.api.get<ReferralCode>('/businesses/me/referral'),
    { code: null, editable: false },
  );

  /** The code is fixed once chosen: `editable` only stays true while there is none. */
  readonly referralSet = computed(() => {
    const referral = this.referral.value();
    return referral.code != null && !referral.editable;
  });

  readonly steps = computed<SetupStep[]>(() => {
    const profile = this.auth.profile();
    const autonomous = this.auth.isAutonomous();
    const canUsePortfolio = this.auth.hasFeature('PORTFOLIO');

    const steps: SetupStep[] = [
      {
        id: 'foto',
        icon: 'account_circle',
        title: 'Pon tu foto de perfil',
        subtitle: 'Es lo primero que ve el cliente al encontrarte.',
        route: '/panel/negocio',
        done: !!profile?.profileImageUrl,
      },
      {
        id: 'portada',
        icon: 'image',
        title: 'Añade una portada',
        subtitle: 'Una foto de tu local o de tu trabajo, en grande.',
        route: '/panel/negocio',
        done: !!profile?.coverImageUrl,
      },
    ];

    if (canUsePortfolio) {
      steps.push({
        id: 'portfolio',
        icon: 'photo_library',
        title: 'Sube tu portfolio',
        subtitle:
          'Fotos de trabajos tuyos, etiquetadas por servicio. Es lo que convence al cliente que aún no te conoce.',
        route: '/panel/negocio/portfolio',
        done: this.portfolio.value().length > 0,
      });
    }

    steps.push(
      {
        id: 'descripcion',
        icon: 'notes',
        title: 'Cuenta quién eres',
        subtitle: 'Una descripción corta de lo que haces y cómo trabajas.',
        route: '/panel/negocio',
        done: !!profile?.description,
      },
      {
        id: 'servicios',
        icon: 'format_list_bulleted',
        title: 'Publica tus servicios',
        subtitle: 'Nombre, precio y duración. Sin servicios no hay reservas.',
        route: '/panel/servicios',
        done: this.services.count() > 0,
      },
      {
        id: 'horario',
        icon: 'schedule',
        title: autonomous ? 'Configura tu horario' : 'Configura el horario',
        subtitle: 'Los clientes solo pueden reservar en los tramos que abras.',
        route: '/panel/negocio/horario',
        done: this.agenda.schedule.value().length > 0,
      },
    );

    if (!autonomous) {
      steps.push({
        id: 'equipo',
        icon: 'group',
        title: 'Invita a tu equipo',
        subtitle: 'Cada trabajador gestiona su horario y sus ausencias.',
        route: '/panel/equipo',
        done: this.team.count() > 0,
      });
    }

    steps.push({
      id: 'codigo',
      icon: 'card_giftcard',
      title: 'Elige tu código de invitación',
      subtitle:
        'Tus clientes lo usan al crear su cuenta y cuentan como invitados por ti: Bipsy lo tiene en cuenta para ofertas y recompensas.',
      route: '/panel/negocio/codigo',
      done: this.referralSet(),
    });

    return steps;
  });

  readonly doneCount = computed(() => this.steps().filter((step) => step.done).length);
  readonly total = computed(() => this.steps().length);
  readonly complete = computed(() => this.doneCount() === this.total());
  readonly progress = computed(() => (this.total() === 0 ? 0 : this.doneCount() / this.total()));

  async load(): Promise<void> {
    await Promise.all([
      this.services.load(),
      this.team.load(),
      this.agenda.schedule.load(),
      this.portfolio.load(),
      this.referral.load(),
    ]);
  }
}
