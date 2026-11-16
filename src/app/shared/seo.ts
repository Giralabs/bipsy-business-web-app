import { DOCUMENT } from '@angular/common';
import { ExperimentalPendingTasks, Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { NavigationEnd, Router, RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { filter } from 'rxjs/operators';
import { noindexHeld } from './noindex';

/**
 * The page data (titles, descriptions, schema.org) lives in seo-routes.ts and
 * is fetched on the first navigation: it reads the blog and every feature,
 * which would otherwise weigh on the initial bundle of every visit. When the
 * pages are rendered to HTML at build time, Angular waits for this import.
 */
const loadRoutes = () => import('./seo-routes');

type SeoRoutes = Awaited<ReturnType<typeof loadRoutes>>;

/**
 * Loads the page data and runs `use` with it as one pending task: the
 * build-time render waits until <head> is written (a bare dynamic import is
 * not something Angular knows to wait for).
 */
async function withRoutes(tasks: ExperimentalPendingTasks, use: (routes: SeoRoutes) => void): Promise<void> {
  const done = tasks.add();
  try {
    use(await loadRoutes());
  } finally {
    done();
  }
}

const pathOf = (url: string) => url.split(/[?#]/)[0].replace(/\/+$/, '') || '/';

/**
 * The document title of every navigation. Public pages take theirs from
 * `seoFor`; the rest (sign-in, panel…) keep the `title` of their route.
 * Without this, Angular's default strategy would put the route title back
 * after SeoService, on pages like the home or the pricing.
 */
@Injectable({ providedIn: 'root' })
export class SeoTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly tasks = inject(ExperimentalPendingTasks);

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const fallback = this.buildTitle(snapshot);
    const path = pathOf(snapshot.url);
    void withRoutes(this.tasks, ({ seoFor }) => {
      const seo = seoFor(path);
      const title = seo.index && !noindexHeld() ? seo.title : fallback;
      if (title) this.title.setTitle(title);
    });
  }
}

/**
 * Keeps <head> in step with the page: description, canonical, robots, Open
 * Graph / X cards and the JSON-LD block. Started once from the root
 * component; it runs on every navigation, so what search engines read always
 * comes from `seoFor`.
 */
@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly router = inject(Router);
  private readonly meta = inject(Meta);
  private readonly doc = inject(DOCUMENT);
  private readonly tasks = inject(ExperimentalPendingTasks);
  private started = false;
  /** Ignores the answer of a slower load that a newer navigation overtook. */
  private seq = 0;

  start(): void {
    if (this.started) return;
    this.started = true;
    this.apply(this.router.url);
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => this.apply(e.urlAfterRedirects));
  }

  private apply(url: string): void {
    const ticket = ++this.seq;
    void withRoutes(this.tasks, (routes) => {
      if (ticket === this.seq) this.write(url, routes);
    });
  }

  private write(url: string, { seoFor, SITE_URL, DEFAULT_IMAGE, ORGANIZATION, WEBSITE }: SeoRoutes): void {
    const path = pathOf(url);
    const seo = seoFor(path);
    const canonical = SITE_URL + (path === '/' ? '/' : path);
    // A screen holding noindex (maintenance, an error) wins over the route
    const index = seo.index && !noindexHeld();

    this.meta.updateTag({ name: 'robots', content: index ? 'index, follow, max-image-preview:large' : 'noindex' });

    if (!index) {
      this.setCanonical(null);
      this.setJsonLd(null);
      return;
    }

    this.meta.updateTag({ name: 'description', content: seo.description });
    this.meta.updateTag({ property: 'og:title', content: seo.title });
    this.meta.updateTag({ property: 'og:description', content: seo.description });
    this.meta.updateTag({ property: 'og:url', content: canonical });
    this.meta.updateTag({ property: 'og:type', content: seo.type ?? 'website' });
    this.meta.updateTag({ property: 'og:image', content: DEFAULT_IMAGE });
    this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    this.meta.updateTag({ name: 'twitter:title', content: seo.title });
    this.meta.updateTag({ name: 'twitter:description', content: seo.description });
    this.meta.updateTag({ name: 'twitter:image', content: DEFAULT_IMAGE });
    this.setCanonical(canonical);
    this.setJsonLd({
      '@context': 'https://schema.org',
      '@graph': [ORGANIZATION, WEBSITE, ...(seo.jsonLd ?? [])],
    });
  }

  private setCanonical(href: string | null): void {
    let link = this.doc.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!href) {
      link?.remove();
      return;
    }
    if (!link) {
      link = this.doc.createElement('link');
      link.setAttribute('rel', 'canonical');
      this.doc.head.appendChild(link);
    }
    link.setAttribute('href', href);
  }

  private setJsonLd(data: object | null): void {
    let script = this.doc.head.querySelector<HTMLScriptElement>('script#seo-jsonld');
    if (!data) {
      script?.remove();
      return;
    }
    if (!script) {
      script = this.doc.createElement('script');
      script.id = 'seo-jsonld';
      script.type = 'application/ld+json';
      this.doc.head.appendChild(script);
    }
    script.textContent = JSON.stringify(data);
  }
}
