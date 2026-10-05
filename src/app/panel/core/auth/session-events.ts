import { Injectable, signal } from '@angular/core';

/**
 * Two things the interceptor learns and the panel has to react to, kept apart
 * from `AuthService` so the interceptor does not depend on it (and Angular
 * does not have to resolve a cycle).
 */
@Injectable({ providedIn: 'root' })
export class SessionEvents {
  /** Flips when the refresh token is gone: the shell shows the notice once. */
  readonly sessionExpired = signal(false);

  /** Flips on a 402: the shell sends the user to the plan wall. */
  readonly needsSubscription = signal(false);

  expired(): void {
    this.sessionExpired.set(true);
  }

  subscriptionRequired(): void {
    this.needsSubscription.set(true);
  }
}
