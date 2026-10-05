import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, NavigationStart, Router, RouterOutlet } from '@angular/router';
import { SiteHeaderComponent } from './components/site-header/site-header.component';
import { SiteFooterComponent } from './components/site-footer/site-footer.component';
import { MaintenanceBadgeComponent } from './maintenance/maintenance-badge.component';
import { MaintenancePageComponent } from './maintenance/maintenance-page.component';
import { MaintenanceService } from './maintenance/maintenance.service';

/**
 * Routes that are the product, not the brochure: they bring their own chrome.
 * `/error` is here too because it has to stand on its own.
 */
const APP_ROUTES = ['/acceder', '/registro', '/recuperar-contrasena', '/error'];

const pathOf = (url: string) => url.split(/[?#]/)[0];

/**
 * `/panel` owns everything under it. The others are single pages: something
 * like `/acceder/typo` is an unknown URL like any other and keeps the header
 * and footer around its «not found».
 */
function bringsOwnChrome(url: string): boolean {
  const path = pathOf(url);
  return path === '/panel' || path.startsWith('/panel/') || APP_ROUTES.includes(path);
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    SiteHeaderComponent,
    SiteFooterComponent,
    MaintenancePageComponent,
    MaintenanceBadgeComponent,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  private readonly router = inject(Router);
  readonly maintenance = inject(MaintenanceService);

  /**
   * The page on screen. It starts from the address bar and not from the
   * router, which says `/` until its first navigation ends — and during
   * maintenance that navigation is held at the gate and does not end.
   */
  private readonly url = signal(inject(Location).path() || '/');
  /** Where the router is heading: the same, but known as soon as a navigation starts. */
  private readonly target = signal(this.url());

  /** `/admin` is the team's door during maintenance, and only then. */
  private readonly atTeamDoor = computed(
    () => this.maintenance.maintenance() && pathOf(this.url()) === '/admin',
  );

  /**
   * The marketing header and footer belong to the public site. Inside the
   * panel they would fight its own top bar — and the footer would hang a legal
   * wall under an agenda. The team's door has no chrome either; when there is
   * no maintenance `/admin` is a «not found» like any other, chrome included.
   */
  readonly showSiteChrome = computed(() => !bringsOwnChrome(this.url()) && !this.atTeamDoor());

  /**
   * In maintenance the maintenance page replaces EVERYTHING — site, access
   * pages and panel — on every URL but the team's door. The router outlet is
   * not rendered at all, so nothing of the site lives underneath.
   */
  readonly showMaintenance = computed(
    () => this.maintenance.blocked() && pathOf(this.target()) !== '/admin',
  );

  constructor() {
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationStart) {
        this.target.set(event.url);
      } else if (event instanceof NavigationEnd) {
        this.url.set(event.urlAfterRedirects);
        this.target.set(event.urlAfterRedirects);
      }
    });
  }
}
