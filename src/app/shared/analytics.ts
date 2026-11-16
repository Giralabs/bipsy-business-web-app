import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { GA_MEASUREMENT_ID } from '../data/site.data';

/** What the visitor chose about analytics cookies, remembered in this browser. */
type Choice = 'granted' | 'denied' | null;

const CHOICE_KEY = 'bipsy.cookies.analytics';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * Google Analytics 4, only with consent.
 *
 * Nothing from Google loads until the visitor presses «Aceptar» in the cookie
 * notice: no script, no cookie, no ping (no "advanced" Consent Mode). Rejecting
 * is as easy as accepting, the choice is remembered, and «Configurar cookies»
 * in the footer asks again. With `GA_MEASUREMENT_ID` empty none of this runs.
 *
 * GA4 counts the page changes of this single-page app by itself (enhanced
 * measurement, browser history events), so there is no manual page_view.
 */
@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly doc = inject(DOCUMENT);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly id = GA_MEASUREMENT_ID;
  private loaded = false;

  private readonly choice = signal<Choice>(this.readChoice());

  /** There is an ID to ask about. */
  readonly enabled = this.browser && !!this.id;
  /** The notice is due: an ID and no answer yet. */
  readonly needsChoice = computed(() => this.enabled && this.choice() === null);

  constructor() {
    if (this.enabled && this.choice() === 'granted') this.load();
  }

  accept(): void {
    this.save('granted');
    this.load();
  }

  reject(): void {
    this.save('denied');
    if (this.loaded) {
      // Stops collection in this tab and removes what GA already stored
      (window as unknown as Record<string, boolean>)[`ga-disable-${this.id}`] = true;
      this.clearGaCookies();
    }
  }

  /** «Configurar cookies»: forgets the answer so the notice asks again. */
  reopen(): void {
    this.save(null);
  }

  private load(): void {
    if (!this.enabled || this.loaded) return;
    this.loaded = true;
    (window as unknown as Record<string, boolean>)[`ga-disable-${this.id}`] = false;

    window.dataLayer = window.dataLayer || [];
    // gtag must push the `arguments` object itself, not an array
    window.gtag = function gtag() {
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer!.push(arguments);
    };
    window.gtag('js', new Date());
    window.gtag('config', this.id);

    const script = this.doc.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(this.id)}`;
    this.doc.head.appendChild(script);
  }

  private clearGaCookies(): void {
    const host = location.hostname;
    const domains = ['', host, `.${host}`, `.${host.split('.').slice(-2).join('.')}`];
    for (const cookie of this.doc.cookie.split(';')) {
      const name = cookie.split('=')[0].trim();
      if (name !== '_ga' && !name.startsWith('_ga_')) continue;
      for (const domain of domains) {
        this.doc.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${domain ? `; domain=${domain}` : ''}`;
      }
    }
  }

  private readChoice(): Choice {
    if (!this.browser) return null;
    try {
      const value = localStorage.getItem(CHOICE_KEY);
      return value === 'granted' || value === 'denied' ? value : null;
    } catch {
      return null;
    }
  }

  private save(value: Choice): void {
    this.choice.set(value);
    try {
      if (value) localStorage.setItem(CHOICE_KEY, value);
      else localStorage.removeItem(CHOICE_KEY);
    } catch {
      // Without storage the answer lasts until the tab is closed
    }
  }
}
