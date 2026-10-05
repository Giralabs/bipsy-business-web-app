import { Injectable } from '@angular/core';

interface StoredSession {
  accessToken: string;
  refreshToken: string;
  actorId: number;
  role: string;
}

/**
 * The session, kept in `localStorage`.
 *
 * The mobile app uses `flutter_secure_storage`; a browser has no such vault, so
 * the access token is short lived (30 min) and every read is guarded: private
 * windows and blocked site data throw on access instead of returning null.
 */
@Injectable({ providedIn: 'root' })
export class TokenStorage {
  private static readonly KEY = 'bipsy_business_session';

  private cache: StoredSession | null | undefined;

  read(): StoredSession | null {
    if (this.cache !== undefined) return this.cache;
    try {
      const raw = localStorage.getItem(TokenStorage.KEY);
      this.cache = raw ? (JSON.parse(raw) as StoredSession) : null;
    } catch {
      this.cache = null;
    }
    return this.cache;
  }

  write(session: StoredSession): void {
    this.cache = session;
    try {
      localStorage.setItem(TokenStorage.KEY, JSON.stringify(session));
    } catch {
      // A session that only lives in memory still works until the tab closes.
    }
  }

  clear(): void {
    this.cache = null;
    try {
      localStorage.removeItem(TokenStorage.KEY);
    } catch {
      // Nothing to do: the cache is already empty.
    }
  }

  get accessToken(): string | null {
    return this.read()?.accessToken ?? null;
  }

  get refreshToken(): string | null {
    return this.read()?.refreshToken ?? null;
  }
}
