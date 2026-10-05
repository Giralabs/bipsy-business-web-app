import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, ErrorHandler, provideZoneChangeDetection } from '@angular/core';
import {
  provideRouter,
  withComponentInputBinding,
  withInMemoryScrolling,
  withNavigationErrorHandler,
  withViewTransitions,
} from '@angular/router';

import { routes } from './app.routes';
import { authInterceptor } from './panel/core/auth/auth.interceptor';
import { AppErrorHandler, onNavigationError } from './shared/app-error-handler';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    // Angular's handler plus one rule: a lazy chunk that fails to load (a
    // deploy while the tab was open) leads to /error instead of a dead click.
    { provide: ErrorHandler, useClass: AppErrorHandler },
    provideHttpClient(withInterceptors([authInterceptor])),
    provideRouter(
      routes,
      // Back to the top on every page and to the exact spot when going back.
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled', anchorScrolling: 'enabled' }),
      // `:slug` arrives as an @Input of the page.
      withComponentInputBinding(),
      // Cross-fade between pages in browsers that support it; the rest simply
      // navigate as always.
      withViewTransitions({ skipInitialTransition: true }),
      // Same rule from the router's side, where the URL that failed is known.
      withNavigationErrorHandler(onNavigationError),
    ),
  ],
};
