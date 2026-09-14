import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import {
  provideRouter,
  withComponentInputBinding,
  withInMemoryScrolling,
  withViewTransitions,
} from '@angular/router';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(
      routes,
      // Back to the top on every page and to the exact spot when going back.
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled', anchorScrolling: 'enabled' }),
      // `:slug` arrives as an @Input of the page.
      withComponentInputBinding(),
      // Cross-fade between pages in browsers that support it; the rest simply
      // navigate as always.
      withViewTransitions({ skipInitialTransition: true }),
    ),
  ],
};
