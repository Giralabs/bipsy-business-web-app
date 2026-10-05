import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { NOT_FOUND_TITLE } from '../pages/not-found/not-found.title';
import { MaintenanceService } from './maintenance.service';

export const ADMIN_TITLE = 'Acceso del equipo · Bipsy Business';

/**
 * The tab says what `/admin` shows: the team's door during maintenance, or
 * «not found» like any unknown URL. Apart from the component so the route
 * table does not import it.
 */
export const adminTitle: ResolveFn<string> = () =>
  inject(MaintenanceService).maintenance() ? ADMIN_TITLE : NOT_FOUND_TITLE;
