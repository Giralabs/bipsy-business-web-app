import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  Inject,
  NgZone,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import { FEATURE_GROUPS, Feature, FeatureGroup, featuresOf } from '../../data/features.data';
import { BUSINESS_TYPES } from '../../data/business-types.data';
import { TRIAL_LABEL } from '../../data/site.data';

type MenuId = 'features' | 'types' | 'resources';

interface ResourceLink {
  icon: string;
  title: string;
  text: string;
  link: string;
}

const RESOURCES: ResourceLink[] = [
  { icon: 'article', title: 'Blog', text: 'Guías para llenar la agenda y gestionar mejor', link: '/blog' },
  { icon: 'help', title: 'Centro de ayuda', text: 'Respuestas a las dudas más frecuentes', link: '/ayuda' },
  { icon: 'phone_iphone', title: 'Bipsy para tus clientes', text: 'La app gratuita con la que te reservan', link: '/app-para-clientes' },
  { icon: 'diversity_3', title: 'Quiénes somos', text: 'Qué es Bipsy y quién está detrás', link: '/legal/quienes-somos' },
  { icon: 'mail', title: 'Contacto', text: 'Escríbenos, te respondemos', link: '/legal/contacto' },
];

/** Promo strip dismissal, remembered in the browser (an interface preference). */
const PROMO_STORAGE_KEY = 'bipsy_business_promo';

/**
 * Top of every page: the trial strip, the sticky navigation with its mega
 * menus, and the full-screen menu on small screens.
 *
 * The bar is transparent over the hero and turns into the app's frosted
 * navigation bar as soon as the page scrolls or a menu opens: over content
 * that moves, the blur finally does something (same rule as bipsy-web-app).
 */
@Component({
  selector: 'app-site-header',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './site-header.component.html',
  styleUrl: './site-header.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SiteHeaderComponent implements OnInit, OnDestroy {
  readonly groups: Array<FeatureGroup & { items: Feature[] }> = FEATURE_GROUPS.map((g) => ({
    ...g,
    items: featuresOf(g.id),
  }));
  readonly types = BUSINESS_TYPES;
  readonly resources = RESOURCES;
  readonly trialLabel = TRIAL_LABEL;

  openMenu: MenuId | null = null;
  mobileOpen = false;
  /** Top of the mobile menu, measured when it opens. */
  menuTop = 64;
  scrolled = false;
  promoDismissed = this.readPromoDismissed();

  @ViewChild('progress', { static: true }) private progressRef!: ElementRef<HTMLElement>;

  private hoverTimer?: ReturnType<typeof setTimeout>;
  private routerSub?: Subscription;
  private removeScroll?: () => void;
  private readonly finePointer =
    typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  constructor(
    private readonly router: Router,
    private readonly zone: NgZone,
    private readonly cdr: ChangeDetectorRef,
    private readonly host: ElementRef<HTMLElement>,
    @Inject(DOCUMENT) private readonly document: Document,
  ) {}

  ngOnInit(): void {
    this.routerSub = this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(() => this.closeAll());

    if (typeof window === 'undefined') return;

    // Outside Angular: the scroll fires dozens of times per second and only two
    // things change — the progress bar (a style) and the scrolled flag, which
    // re-enters the zone only when it actually flips.
    this.zone.runOutsideAngular(() => {
      const onScroll = (): void => {
        const max = this.document.documentElement.scrollHeight - window.innerHeight;
        const progress = max > 0 ? Math.min(window.scrollY / max, 1) : 0;
        this.progressRef.nativeElement.style.transform = `scaleX(${progress.toFixed(4)})`;

        const scrolled = window.scrollY > 12;
        if (scrolled !== this.scrolled) {
          this.zone.run(() => {
            this.scrolled = scrolled;
            this.cdr.markForCheck();
          });
        }
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      this.removeScroll = () => window.removeEventListener('scroll', onScroll);
      onScroll();
    });
  }

  ngOnDestroy(): void {
    this.routerSub?.unsubscribe();
    this.removeScroll?.();
    clearTimeout(this.hoverTimer);
    this.setBodyLock(false);
  }

  // ----- MENUS --------------------------------------------------------------

  toggle(id: MenuId): void {
    clearTimeout(this.hoverTimer);
    this.openMenu = this.openMenu === id ? null : id;
  }

  // Hover opens with a short delay and closes with a longer one: crossing the
  // gap between the link and the panel must not close the panel.
  hoverOpen(id: MenuId): void {
    if (!this.finePointer) return;
    clearTimeout(this.hoverTimer);
    this.hoverTimer = setTimeout(() => {
      this.openMenu = id;
      this.cdr.markForCheck();
    }, this.openMenu ? 0 : 90);
  }

  hoverClose(): void {
    if (!this.finePointer) return;
    clearTimeout(this.hoverTimer);
    this.hoverTimer = setTimeout(() => {
      this.openMenu = null;
      this.cdr.markForCheck();
    }, 180);
  }

  toggleMobile(): void {
    if (!this.mobileOpen) {
      // Right under the bar as it is now: 104 px with the promo strip still on
      // screen, 64 without it. A fixed offset covered the bar in the first case.
      const bar = this.host.nativeElement.querySelector('.nav');
      this.menuTop = bar ? Math.round(bar.getBoundingClientRect().bottom) : 64;
    }
    this.mobileOpen = !this.mobileOpen;
    this.setBodyLock(this.mobileOpen);
  }

  closeAll(): void {
    clearTimeout(this.hoverTimer);
    this.openMenu = null;
    if (this.mobileOpen) {
      this.mobileOpen = false;
      this.setBodyLock(false);
    }
    this.cdr.markForCheck();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.openMenu || this.mobileOpen) this.closeAll();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.openMenu) return;
    const target = event.target as Node | null;
    if (target && !this.host.nativeElement.contains(target)) this.closeAll();
  }

  // ----- PROMO ----------------------------------------------------------------

  dismissPromo(): void {
    this.promoDismissed = true;
    try {
      localStorage.setItem(PROMO_STORAGE_KEY, 'hidden');
    } catch {
      // Private browsing or blocked storage: the strip closes for this visit
      // and comes back on the next one. Not a reason to break.
    }
  }

  skipToContent(): void {
    const main = this.document.getElementById('contenido');
    main?.focus();
    main?.scrollIntoView();
  }

  private readPromoDismissed(): boolean {
    try {
      return localStorage.getItem(PROMO_STORAGE_KEY) === 'hidden';
    } catch {
      return false;
    }
  }

  private setBodyLock(locked: boolean): void {
    this.document.body.style.overflow = locked ? 'hidden' : '';
  }
}
