import { inject } from '@angular/core';
import { CanActivateChildFn } from '@angular/router';
import { MaintenanceService } from './maintenance.service';

/**
 * Holds every navigation into the site while it is closed for maintenance.
 *
 * Not rendering the router outlet hides the pages, but the router navigates
 * with or without an outlet: on a deep link to `/panel/agenda` it would still
 * run `panelGuard`, call `/me` and start loading the panel under the
 * maintenance page. As `canActivateChild` of the parent of the whole site this
 * runs BEFORE the guards of each route, so none of that happens.
 *
 * It WAITS instead of answering `false` on purpose. A rejected first
 * navigation makes the router rewrite the address bar to `/`, losing the page
 * the visitor asked for; a pending one leaves the URL alone and simply goes on
 * when the maintenance ends, so the site comes back on the page it was asked
 * for, by itself. And since the only thing it ever answers is `true`, it
 * cannot take part in a redirect loop with the other guards (see the note on
 * `guestGuard`).
 *
 * When nothing is known yet —first visit, no answer from the server— the site
 * counts as open and this does not wait for the check.
 */
export const maintenanceGate: CanActivateChildFn = async () => {
  await inject(MaintenanceService).whenOpen();
  return true;
};
