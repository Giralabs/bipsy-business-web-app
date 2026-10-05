import { Location } from '@angular/common';
import { ErrorHandler, Injectable, Injector, NgZone, inject } from '@angular/core';
import { NavigationError, Router } from '@angular/router';

/**
 * How each browser says «that file is not there»: Chrome, Firefox and Safari
 * for a native `import()`, plus webpack's wording in case the builder changes.
 */
const CHUNK_ERROR =
  /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk [\w-]+ failed/i;

/** A page load can only be sent to the error page this many times. */
const MAX_TRIPS = 3;

/**
 * True when what failed is the download of a lazy chunk. An unhandled promise
 * arrives wrapped by zone.js (`rejection`), so the wrappers are looked into.
 */
export function isChunkLoadError(error: unknown): boolean {
  const wrapped = error as { rejection?: unknown; ngOriginalError?: unknown; cause?: unknown } | null;
  return [error, wrapped?.rejection, wrapped?.ngOriginalError, wrapped?.cause].some((candidate) => {
    if (!candidate) return false;
    const { name, message } = candidate as { name?: unknown; message?: unknown };
    return CHUNK_ERROR.test(`${typeof name === 'string' ? name : ''} ${typeof message === 'string' ? message : String(candidate)}`);
  });
}

/**
 * What to do when a lazy chunk does not load.
 *
 * Every deploy renames the chunks, so a tab left open keeps asking for files
 * that are gone: the click does nothing and the console says «Failed to fetch
 * dynamically imported module». The only cure is a reload, and this takes the
 * person to the page that says so (`/error?tipo=version`) — or to the «no
 * connection» one when the browser is simply offline, which fails the same way.
 *
 * It cannot loop: `/error` is not lazy (nothing to fail on the way there), it
 * never leaves from the error page itself, one trip at a time, and no more
 * than `MAX_TRIPS` per page load whatever happens.
 */
@Injectable({ providedIn: 'root' })
export class ChunkRecovery {
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly zone = inject(NgZone);

  private going = false;
  private trips = 0;

  /** `from` is the URL that was being opened, to come back to it after reloading. */
  recover(from?: string): void {
    const here = this.location.path() || '/';
    if (this.going || this.trips >= MAX_TRIPS || here.split(/[?#]/)[0] === '/error') return;
    this.going = true;
    this.trips++;

    const tipo = navigator.onLine === false ? 'conexion' : 'version';
    // On the next task: the navigation that failed has to finish failing
    // first. In the zone, because `ErrorHandler` is called outside it.
    setTimeout(() =>
      this.zone.run(() => {
        this.router
          .navigate(['/error'], { queryParams: { tipo, desde: from ?? here } })
          .catch(() => false)
          .finally(() => {
            this.going = false;
          });
      }),
    );
  }
}

/**
 * The global handler. It keeps Angular's behaviour (log to the console) and
 * adds ONE thing: a chunk that failed to load goes to `ChunkRecovery`. Every
 * other runtime error stays where it happened — a broken widget is no reason
 * to take the whole page away from someone.
 */
@Injectable()
export class AppErrorHandler extends ErrorHandler {
  // The router is reached through the injector, and late: it does not exist
  // yet when the handler is created.
  private readonly injector = inject(Injector);

  override handleError(error: unknown): void {
    super.handleError(error);
    if (!isChunkLoadError(error)) return;
    try {
      this.injector.get(ChunkRecovery).recover();
    } catch {
      // The handler of last resort must not throw.
    }
  }
}

/**
 * The router's own hook (`withNavigationErrorHandler`), which runs first and
 * knows which URL was being opened. The rejected navigation reaches
 * `AppErrorHandler` right after; `ChunkRecovery` is already on its way by then
 * and ignores it.
 */
export function onNavigationError(event: NavigationError): void {
  if (isChunkLoadError(event.error)) inject(ChunkRecovery).recover(event.url);
}
