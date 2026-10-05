import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  HostListener,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../core/auth/auth.service';
import { AgendaStore } from '../core/data/agenda.store';
import { InboxStore } from '../core/data/inbox.store';
import { SetupStore } from '../core/data/setup.store';
import { WaitlistStore } from '../core/data/waitlist.store';
import { SessionEvents } from '../core/auth/session-events';
import { startDesktopNotifications } from '../core/data/desktop-notify.service';
import { CoachService } from '../onboarding/coach.service';
import { CoachOverlayComponent } from '../onboarding/coach-overlay.component';
import { PnAvatarComponent } from '../ui/controls';
import { PnConfirmHostComponent } from '../ui/confirm.service';
import { PnToastsComponent } from '../ui/toast.service';
import { CommandPaletteComponent, PaletteItem } from './command-palette.component';
import {
  BUSINESS_DESTINATIONS,
  BUSINESS_SECTIONS,
  Section,
  WORKER_DESTINATIONS,
  WORKER_SECTIONS,
  sectionOf,
} from './sections';

const RAIL_KEY = 'bipsy.panel.rail';

/**
 * El marco del panel.
 *
 * Una barra lateral mínima a la izquierda —marca, secciones y la cuenta
 * abajo— y el contenido a la derecha, sin franja superior en escritorio. La
 * barra se puede plegar a un carril de iconos (se recuerda) y en un móvil se
 * convierte en un cajón. Todo lo que no cabe en la barra está en «Ir a…»
 * (⌘K / Ctrl+K).
 *
 * Lo que se ve depende de quién entra: el dueño ve el negocio entero y un
 * trabajador solo su día, su fichaje y sus ausencias (`WORKER_SECTIONS`).
 */
@Component({
  selector: 'app-panel-shell',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    PnAvatarComponent,
    PnToastsComponent,
    PnConfirmHostComponent,
    CoachOverlayComponent,
    CommandPaletteComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './panel-shell.component.html',
  styleUrl: './panel-shell.component.css',
})
export class PanelShellComponent {
  readonly auth = inject(AuthService);
  readonly coach = inject(CoachService);
  readonly agenda = inject(AgendaStore);
  readonly inbox = inject(InboxStore);
  private readonly waitlist = inject(WaitlistStore);
  private readonly setup = inject(SetupStore);
  private readonly session = inject(SessionEvents);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly menuOpen = signal(false);
  readonly drawerOpen = signal(false);
  readonly paletteOpen = signal(false);
  /** What the viewer chose (remembered). */
  private readonly railChoice = signal(readRail());
  /** Below 960 px the sidebar is a drawer, and a drawer is never folded. */
  readonly narrow = signal(false);
  readonly rail = computed(() => this.railChoice() && !this.narrow());
  private readonly url = signal(this.router.url);

  /** ⌘ en Mac, Ctrl en el resto: lo que se pinta en el atajo. */
  readonly modKey = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl';

  readonly sections = computed(() => {
    if (this.auth.isWorker()) {
      return WORKER_SECTIONS.filter((section) => {
        if (section.id === 'mensajes') return this.auth.canUseChat();
        if (section.id === 'fichar') return this.auth.clockInEnabled();
        return true;
      });
    }
    return BUSINESS_SECTIONS.filter((section) => {
      if (section.id === 'equipo') return !this.auth.isAutonomous();
      if (section.id === 'mensajes') return this.auth.canUseChat();
      return true;
    });
  });

  /** La sección en la que se está, para marcarla en la barra. */
  readonly here = computed(() => sectionOf(this.url(), this.sections()));

  /** Ajustes (y lo que cuelga de él: plan, cuenta, soporte) va abajo, aparte. */
  readonly isSettings = computed(() => {
    const url = this.url();
    return this.here() === null && ['/panel/ajustes', '/panel/plan', '/panel/soporte'].some((p) => url.startsWith(p));
  });

  readonly roleLabel = computed(() => {
    if (this.auth.isWorker()) return 'Trabajador';
    return this.auth.profile()?.subscription?.planName
      ? `Plan ${this.auth.profile()?.subscription?.planName}`
      : 'Negocio';
  });

  /** El nombre de quien entra: el negocio para el dueño, la persona para un trabajador. */
  readonly who = computed(() =>
    this.auth.isWorker() ? (this.auth.user()?.name ?? '') : this.auth.businessName(),
  );

  readonly paletteItems = computed<PaletteItem[]>(() => {
    const go = (route: string) => () => void this.router.navigateByUrl(route);
    const sections: PaletteItem[] = this.sections().map((section) => ({
      id: `s:${section.id}`,
      label: section.label,
      hint: section.blurb,
      icon: section.icon,
      kind: 'section',
      badge: this.badgeOf(section) || undefined,
      run: go(section.route),
    }));

    const destinations = (this.auth.isWorker() ? WORKER_DESTINATIONS : BUSINESS_DESTINATIONS)
      .filter((place) => {
        if (place.route.startsWith('/panel/equipo')) return !this.auth.isAutonomous();
        if (place.route.includes('vista=espera')) return this.auth.waitlistEnabled();
        return true;
      })
      .map<PaletteItem>((place) => ({
        id: `p:${place.route}`,
        label: place.label,
        hint: place.hint,
        icon: place.icon,
        keywords: place.keywords,
        kind: 'place',
        run: go(place.route),
      }));

    const actions: PaletteItem[] = [];
    if (this.auth.isBusiness()) {
      actions.push({
        id: 'a:tour',
        label: 'Ver el tutorial otra vez',
        hint: 'Un minuto',
        icon: 'school',
        kind: 'action',
        keywords: 'ayuda guía',
        run: () => this.replayTour(),
      });
    }
    if (!this.narrow()) {
      actions.push({
        id: 'a:rail',
        label: this.rail() ? 'Desplegar la barra lateral' : 'Plegar la barra lateral',
        hint: `${this.modKey} B`,
        icon: this.rail() ? 'left_panel_open' : 'left_panel_close',
        kind: 'action',
        keywords: 'menú lateral ocultar',
        run: () => this.toggleRail(),
      });
    }
    actions.push(
      {
        id: 'a:logout',
        label: 'Cerrar sesión',
        hint: this.auth.user()?.email ?? '',
        icon: 'logout',
        kind: 'action',
        keywords: 'salir',
        run: () => void this.logout(),
      },
    );

    return [...sections, ...destinations, ...actions];
  });

  constructor() {
    void this.agenda.load();
    if (this.auth.isBusiness()) {
      void this.setup.load();
      if (this.auth.waitlistEnabled()) void this.waitlist.load();
    }
    if (this.auth.canUseChat()) void this.inbox.load();

    // Desktop notifications react to the stores; a minute-by-minute re-read
    // of the agenda (the only thing that changes behind the owner's back) is
    // what makes them fire, and keeps an open panel honest on the till.
    startDesktopNotifications();
    const refresh = setInterval(() => void this.agenda.bookings.reload(), 60_000);
    inject(DestroyRef).onDestroy(() => clearInterval(refresh));

    const query = matchMedia('(max-width: 960px)');
    const onMedia = () => this.narrow.set(query.matches);
    onMedia();
    query.addEventListener('change', onMedia);
    inject(DestroyRef).onDestroy(() => query.removeEventListener('change', onMedia));

    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe((event) => {
        this.url.set(event.urlAfterRedirects);
        this.drawerOpen.set(false);
        this.menuOpen.set(false);
      });
  }

  @HostListener('document:keydown', ['$event'])
  onKey(event: KeyboardEvent): void {
    const mod = event.metaKey || event.ctrlKey;
    if (mod && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.togglePalette();
    } else if (mod && event.key.toLowerCase() === 'b') {
      event.preventDefault();
      this.toggleRail();
    } else if (event.key === 'Escape') {
      this.drawerOpen.set(false);
      this.menuOpen.set(false);
    }
  }

  badgeOf(section: Section): number {
    if (section.id === 'agenda') return this.agenda.pendingCount();
    if (section.id === 'mensajes') return this.inbox.unread();
    return 0;
  }

  togglePalette(): void {
    this.paletteOpen.set(!this.paletteOpen());
    this.menuOpen.set(false);
    // Render (and focus the input) now, not on the next frame: with event
    // coalescing the first letters typed right after ⌘K were lost.
    this.cdr.detectChanges();
  }

  toggleRail(): void {
    if (this.narrow()) return;
    const next = !this.railChoice();
    this.railChoice.set(next);
    try {
      localStorage.setItem(RAIL_KEY, next ? '1' : '0');
    } catch {
      // Sin almacenamiento la barra vuelve desplegada la próxima vez.
    }
  }

  toggleMenu(): void {
    this.menuOpen.set(!this.menuOpen());
  }

  closeMenu(): void {
    this.menuOpen.set(false);
  }

  replayTour(): void {
    this.closeMenu();
    this.coach.start('business');
  }

  /**
   * Recarga entera a propósito: los stores son singletons con lo que ya han
   * leído, y si después entra otra cuenta en este ordenador (el trabajador
   * tras el dueño, en el mostrador) vería la agenda de la anterior.
   */
  async logout(): Promise<void> {
    this.closeMenu();
    await this.auth.logout();
    location.assign('/acceder');
  }

  get expired(): boolean {
    return this.session.sessionExpired();
  }

  /**
   * Apartado con la cruz en ESTA sesión.
   *
   * En memoria a propósito, como el `StateProvider` de la app: al recargar el
   * panel el aviso vuelve si los cobros siguen sin configurar. Guardarlo en
   * `localStorage` convertiría un recordatorio en algo que se descarta una vez
   * y no se vuelve a ver nunca.
   */
  readonly payoutsBannerDismissed = signal(false);

  /**
   * Eligió pedir tarjeta y todavía no puede cobrar.
   *
   * Los dos datos salen del perfil, que ya está cargado: preguntarle a la
   * cuenta de cobros aquí sería una llamada a Stripe en cada arranque. Un
   * trabajador no configura los cobros de nadie.
   */
  readonly payoutsPending = computed(
    () =>
      !this.payoutsBannerDismissed() &&
      this.auth.isBusiness() &&
      this.auth.profile()?.requiresCardIntent === true &&
      this.auth.profile()?.payoutsReady !== true,
  );
}

function readRail(): boolean {
  try {
    return localStorage.getItem(RAIL_KEY) === '1';
  } catch {
    return false;
  }
}
