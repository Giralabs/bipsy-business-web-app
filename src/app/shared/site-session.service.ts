import { Injectable, computed, inject, signal } from '@angular/core';
import { AuthService } from '../panel/core/auth/auth.service';
import { TokenStorage } from '../panel/core/auth/token-storage';
import { initials } from '../panel/core/util/format';

/**
 * Whether whoever reads the marketing site is already signed in to the panel.
 *
 * With a session, «Iniciar sesión» and «Probar gratis» make no sense: every
 * call to action becomes «Tu panel». A stored token is trusted at once so the
 * header does not flash the guest buttons, and `/me` confirms it in the
 * background (an expired session goes back to the guest version).
 */
@Injectable({ providedIn: 'root' })
export class SiteSession {
  private readonly auth = inject(AuthService);
  private readonly hasToken = signal(!!inject(TokenStorage).accessToken);

  constructor() {
    if (this.hasToken()) {
      void this.auth.bootstrap().then(() => this.hasToken.set(this.auth.status() === 'authenticated'));
    }
  }

  readonly signedIn = computed(() =>
    this.auth.status() === 'authenticated' || (this.auth.status() === 'unknown' && this.hasToken()),
  );

  /** The business for an owner, the person for a worker. */
  readonly name = computed(() =>
    this.auth.isWorker() ? (this.auth.user()?.name ?? '') : this.auth.businessName(),
  );

  readonly initials = computed(() => initials(this.name() || 'Bipsy'));
  readonly photo = computed(() => this.auth.profile()?.profileImageUrl ?? null);
}
