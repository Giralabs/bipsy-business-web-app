import { signal } from '@angular/core';
import { ApiUnreachableError } from '../api/api';

/**
 * A slice of remote state: the value, whether it is loading and what went
 * wrong. It is the shape `FutureProvider.autoDispose` gives a Riverpod widget,
 * so screens read the same three things they read in the app.
 *
 * `load()` is idempotent on purpose — many components can ask for the agenda
 * and only the first call hits the network; `reload()` is what a mutation
 * calls, the twin of `ref.invalidate`.
 */
export function resource<T>(fetcher: () => Promise<T>, initial: T) {
  const value = signal<T>(initial);
  const loading = signal(false);
  const error = signal<string | null>(null);
  let loaded = false;
  let inFlight: Promise<void> | null = null;

  async function run(): Promise<void> {
    loading.set(true);
    error.set(null);
    try {
      value.set(await fetcher());
      loaded = true;
    } catch (cause) {
      error.set(message(cause));
    } finally {
      loading.set(false);
      inFlight = null;
    }
  }

  return {
    value,
    loading,
    error,
    get isLoaded(): boolean {
      return loaded;
    },
    load(): Promise<void> {
      if (loaded) return Promise.resolve();
      inFlight ??= run();
      return inFlight;
    },
    reload(): Promise<void> {
      loaded = false;
      inFlight = run();
      return inFlight;
    },
    /** Writes the value by hand, for optimistic switches. */
    set(next: T): void {
      value.set(next);
    },
  };
}

export type Resource<T> = ReturnType<typeof resource<T>>;

/** Turns whatever the HTTP layer threw into a sentence a shop owner reads. */
export function message(cause: unknown): string {
  // Una API que no contesta no es lo mismo que estar sin red, y decir «mira
  // tu conexión» cuando lo que pasa es que el servidor está dormido manda a
  // buscar el fallo al sitio equivocado.
  if (cause instanceof ApiUnreachableError) return cause.message;
  const status = (cause as { status?: number }).status;
  if (status === 0) return 'Sin conexión. Comprueba tu red.';
  if (status === 401 || status === 403) return 'Tu sesión ya no vale. Vuelve a entrar.';
  if (status === 402) return 'Tu plan no incluye esto.';
  if (status === 404) return 'Eso ya no está.';
  const detail = (cause as { error?: { message?: string } }).error?.message;
  return detail || 'Algo no ha ido bien.';
}
