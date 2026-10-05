import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { API_URL } from '../api/api.config';
import { TokenStorage } from './token-storage';
import { SessionEvents } from './session-events';

/**
 * Signs every call and, when the 30-minute access token dies, refreshes once
 * and replays the request. The backend rotates BOTH tokens on refresh and
 * revokes the whole chain if an old one comes back (OWASP), so two parallel
 * refreshes would log the user out: `pending` makes every 401 in flight wait
 * for the same one.
 */
let pending: Promise<boolean> | null = null;

/**
 * Which app is asking, and so which account an email refers to: since V105 the
 * same address can hold a customer account and a professional one. Twin of
 * `GipsiAppScope.professional` (`api_client.dart`); the backend reads it as
 * `AccountScope` in `AuthController.SCOPE_HEADER`.
 */
export const SCOPE_HEADER = 'X-Bipsy-Scope';
export const APP_SCOPE = 'PROFESSIONAL';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(API_URL)) return next(req);

  const storage = inject(TokenStorage);
  const events = inject(SessionEvents);
  const router = inject(Router);

  // The maintenance endpoints are public and have nothing to do with the
  // session, so they go the way of the auth calls: no bearer, and above all no
  // refresh. The 401 of `/maintenance/unlock` means «wrong team password»;
  // taken for a dead access token it would rotate the tokens of whoever is
  // signed in and, if that refresh failed, sign them out and send them to
  // /acceder for mistyping a password that is not even theirs.
  const isAuthCall = req.url.includes('/auth/') || req.url.startsWith(`${API_URL}/maintenance/`);
  // The scope goes on EVERY call, like `ApiClient` does in the app: endpoints
  // that do not need it ignore it, and the ones that do (login, password
  // recovery, the sign-up steps) answer 400 without it.
  const sign = (token: string | null) =>
    req.clone({
      setHeaders:
        token && !isAuthCall
          ? { [SCOPE_HEADER]: APP_SCOPE, Authorization: `Bearer ${token}` }
          : { [SCOPE_HEADER]: APP_SCOPE },
    });

  return next(sign(storage.accessToken)).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse)) return throwError(() => error);

      // 402 is how the API says "your subscription does not cover this".
      if (error.status === 402) {
        events.subscriptionRequired();
        return throwError(() => error);
      }

      if (error.status !== 401 || isAuthCall || !storage.refreshToken) {
        return throwError(() => error);
      }

      pending ??= refresh(storage).finally(() => {
        pending = null;
      });

      return from(pending).pipe(
        switchMap((ok) => {
          if (!ok) {
            storage.clear();
            events.expired();
            void router.navigate(['/acceder'], { queryParams: { expirada: 1 } });
            return throwError(() => error);
          }
          return next(sign(storage.accessToken));
        }),
      );
    }),
  );
};

async function refresh(storage: TokenStorage): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', [SCOPE_HEADER]: APP_SCOPE },
      body: JSON.stringify({ refreshToken: storage.refreshToken }),
    });
    if (!response.ok) return false;
    const auth = (await response.json()) as {
      accessToken: string;
      refreshToken: string;
      actorId: number;
      role: string;
    };
    storage.write(auth);
    return true;
  } catch {
    return false;
  }
}
