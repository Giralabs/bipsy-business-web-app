import { Injectable, computed, inject, signal } from '@angular/core';
import { Api } from '../api/api';
import {
  BusinessVerification,
  VerificationRequirementCode,
  VerificationStatus,
} from '../api/models';
import { AuthService } from '../auth/auth.service';
import { resource } from './resource';

const STATUSES: VerificationStatus[] = ['NONE', 'PENDING', 'VERIFIED', 'REJECTED'];
const CODES: VerificationRequirementCode[] = [
  'PAYMENTS',
  'EMAIL_VERIFIED',
  'PROFILE_PHOTO',
  'COVER',
  'DESCRIPTION',
  'SERVICES',
  'SCHEDULE',
  'TEAM',
];

/** Same key as `welcome_state.dart`, per account. */
const BANNER_KEY = 'gipsi.business_verification_banner_dismissed';

/**
 * Unknown values map to an explicit one instead of a default that would lie
 * (`verification_models.dart`).
 */
function normalize(raw: BusinessVerification): BusinessVerification {
  return {
    status: STATUSES.includes(raw.status) ? raw.status : 'UNKNOWN',
    verified: raw.verified === true,
    requirements: (raw.requirements ?? []).map((requirement) => ({
      code: CODES.includes(requirement.code) ? requirement.code : 'UNKNOWN',
      met: requirement.met === true,
      missing: requirement.missing ?? [],
    })),
    canRequest: raw.canRequest === true,
    note: raw.note ?? null,
    requestedAt: raw.requestedAt ?? null,
    verifiedAt: raw.verifiedAt ?? null,
  };
}

/**
 * The Bipsy verification of the signed-in business —
 * `verification_providers.dart` and `verification_repository.dart`.
 *
 * Owner only: the endpoint answers 403 to a worker, so for them it stays null.
 * Granting, rejecting and revoking do not go through here: Bipsy's team does
 * that through the admin API.
 */
@Injectable({ providedIn: 'root' })
export class VerificationStore {
  private readonly api = inject(Api);
  private readonly auth = inject(AuthService);

  readonly state = resource<BusinessVerification | null>(async () => {
    if (!this.auth.isBusiness()) return null;
    return normalize(await this.api.get<BusinessVerification>('/businesses/me/verification'));
  }, null);

  /** Neither requested nor granted: there is still something to do with it. */
  readonly stillOpen = computed(() => {
    const status = this.state.value()?.status;
    return status != null && status !== 'PENDING' && status !== 'VERIFIED';
  });

  readonly rejected = computed(() => this.state.value()?.status === 'REJECTED');

  private readonly dismissedNow = signal(false);

  /** Whether the invitation to verify was closed for good on this browser. */
  readonly bannerDismissed = computed(() => {
    if (this.dismissedNow()) return true;
    const id = this.auth.user()?.id;
    if (id == null) return false;
    try {
      return localStorage.getItem(`${BANNER_KEY}.${id}`) === 'true';
    } catch {
      return false;
    }
  });

  /** Asks again if it was read before; the first call simply loads. */
  refresh(): Promise<void> {
    return this.state.isLoaded ? this.state.reload() : this.state.load();
  }

  /**
   * The server checks the requirements again: if one is missing, or there is
   * already a request or a grant, it answers 409 with a readable reason.
   */
  async request(): Promise<void> {
    this.state.set(normalize(await this.api.post<BusinessVerification>('/businesses/me/verification/request')));
  }

  dismissBanner(): void {
    this.dismissedNow.set(true);
    const id = this.auth.user()?.id;
    if (id == null) return;
    try {
      localStorage.setItem(`${BANNER_KEY}.${id}`, 'true');
    } catch {
      // Without storage it comes back on the next load; harmless.
    }
  }
}
