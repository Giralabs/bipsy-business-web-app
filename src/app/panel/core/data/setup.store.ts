import { Injectable, computed, inject } from '@angular/core';
import { Api } from '../api/api';
import { PortfolioImage, ReferralCode, VerificationRequirement, VerificationRequirementCode } from '../api/models';
import { AuthService } from '../auth/auth.service';
import { AgendaStore } from './agenda.store';
import { ServicesStore } from './services.store';
import { TeamStore } from './team.store';
import { VerificationStore } from './verification.store';
import { resource } from './resource';

export interface SetupStep {
  id: string;
  icon: string;
  title: string;
  route: string;
  done: boolean;
}

/** What is asked for, in order, while the server has not answered. */
const REQUIRED_WHILE_LOADING: VerificationRequirementCode[] = [
  'PROFILE_PHOTO',
  'COVER',
  'DESCRIPTION',
  'SERVICES',
  'SCHEDULE',
  'TEAM',
];

/**
 * «Completar mi perfil» — the checklist from `welcome_providers.dart`
 * (`setupStepsProvider`) and the sheet in `setup_guide_sheet.dart`.
 *
 * The steps are the server's verification requirements: the same rule that
 * validates the request. Computing them here again is how they stopped matching
 * (only the owner's schedule, workers without a photo accepted). It is what
 * leaves the PROFILE complete, not what it takes to verify, so payments stay
 * out, and the confirmed email too: that has its own notice.
 *
 * The other stores keep loading from here because Inicio and «Tu ficha» read
 * them, not because any step depends on them.
 */
@Injectable({ providedIn: 'root' })
export class SetupStore {
  private readonly api = inject(Api);
  private readonly auth = inject(AuthService);
  private readonly services = inject(ServicesStore);
  private readonly team = inject(TeamStore);
  private readonly agenda = inject(AgendaStore);
  private readonly verification = inject(VerificationStore);

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

  /**
   * Decided by the mode, not by how many people were invited: whoever just
   * turned the team on has nobody yet, and that step is exactly theirs.
   */
  private readonly worksAlone = computed(() => this.auth.profile()?.teamEnabled === false);

  readonly steps = computed<SetupStep[]>(() => {
    const worksAlone = this.worksAlone();
    const requirements: VerificationRequirement[] =
      this.verification.state.value()?.requirements ??
      REQUIRED_WHILE_LOADING.filter((code) => code !== 'TEAM' || !worksAlone).map((code) => ({
        code,
        met: false,
        missing: [],
      }));
    return requirements.flatMap((requirement) => stepFor(requirement, worksAlone) ?? []);
  });

  /** False until the server answers: a complete profile would flash «0 of 6». */
  readonly ready = computed(() => this.verification.state.value() != null);

  readonly doneCount = computed(() => this.steps().filter((step) => step.done).length);
  readonly total = computed(() => this.steps().length);
  readonly complete = computed(() => this.total() > 0 && this.doneCount() === this.total());
  readonly progress = computed(() => (this.total() === 0 ? 0 : this.doneCount() / this.total()));

  /**
   * With the profile complete its place goes to the invitation to verify, even
   * if payments are still missing: they are the next step, and the screen says
   * so. Requested or granted there is nothing to invite to.
   */
  readonly offerVerification = computed(
    () => this.ready() && this.complete() && this.verification.stillOpen() && !this.verification.bannerDismissed(),
  );

  async load(): Promise<void> {
    await Promise.all([
      this.services.load(),
      this.team.load(),
      this.agenda.schedule.load(),
      this.portfolio.load(),
      this.referral.load(),
      this.verification.state.load(),
    ]);
  }
}

/** The guide's step for a requirement; null for the ones not shown here. */
function stepFor(requirement: VerificationRequirement, worksAlone: boolean): SetupStep | null {
  const done = requirement.met;
  switch (requirement.code) {
    case 'PROFILE_PHOTO':
      return { id: 'foto', icon: 'account_circle', title: 'Pon tu foto de perfil', route: '/panel/negocio', done };
    case 'COVER':
      return { id: 'portada', icon: 'image', title: 'Añade una portada', route: '/panel/negocio', done };
    case 'DESCRIPTION':
      return { id: 'descripcion', icon: 'notes', title: 'Cuenta quién eres', route: '/panel/negocio', done };
    case 'SERVICES':
      return { id: 'servicios', icon: 'format_list_bulleted', title: 'Publica tus servicios', route: '/panel/servicios', done };
    case 'SCHEDULE':
      // With a team, each person's schedule is set from their card in Equipo.
      return {
        id: 'horario',
        icon: 'schedule',
        title: worksAlone ? 'Configura tu horario' : 'Configura el horario',
        route: worksAlone ? '/panel/negocio/horario' : '/panel/equipo',
        done,
      };
    case 'TEAM':
      return { id: 'equipo', icon: 'group', title: 'Tu equipo, con foto', route: '/panel/equipo', done };
    default:
      return null;
  }
}
