import { signal, untracked } from '@angular/core';
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
  // A signal because templates branch on `isLoaded` alone: read from a plain
  // variable, an OnPush screen never hears the answer and stays on its skeleton.
  const loaded = signal(false);
  let inFlight: Promise<void> | null = null;

  async function run(): Promise<void> {
    loading.set(true);
    error.set(null);
    try {
      value.set(await fetcher());
      loaded.set(true);
    } catch (cause) {
      loaded.set(false);
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
      return loaded();
    },
    load(): Promise<void> {
      if (inFlight) return inFlight;
      if (untracked(loaded)) return Promise.resolve();
      inFlight = run();
      return inFlight;
    },
    // Keeps `isLoaded` while it re-reads, so a save does not blink the skeleton.
    reload(): Promise<void> {
      inFlight = run();
      return inFlight;
    },
    /**
     * Re-reads behind the screen: no loading flag, and a failure keeps what is
     * already painted. For what nobody asked for, like a live event: a list that
     * blinks every time something changes elsewhere cannot be read.
     */
    async refresh(): Promise<void> {
      try {
        const next = await fetcher();
        // A mutation's `reload()` started meanwhile knows more than this answer.
        if (inFlight) return;
        value.set(next);
        loaded.set(true);
        error.set(null);
      } catch {
        // The next event, or the next reload, will try again.
      }
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
  if (status === 401) return 'Tu sesión ya no vale. Vuelve a entrar.';
  // A 403 is a rule, not an expired session: the server says which one
  // («Tu negocio no tiene el fichaje activo»).
  if (status === 403) return serverReason(cause) || 'No tienes permiso para hacer esto.';
  if (status === 402) return 'Tu plan no incluye esto.';
  if (status === 404) return 'Eso ya no está.';
  return serverReason(cause) || 'Algo no ha ido bien.';
}

/** What the server says went wrong, if it said anything. */
export function serverReason(cause: unknown): string | undefined {
  // A validation 400 says «Error de validacion» at the top and the real reason
  // per field: showing the top one reads as a broken app, not a wrong value.
  return (
    fieldErrors(cause)[0]?.message ||
    (cause as { error?: { message?: string } } | null)?.error?.message
  );
}

/** One field the server rejected: `ApiError.FieldError` in the backend. */
export interface ApiFieldError {
  /** The DTO's field name, as is: `password`, `newPassword`, `phone`. */
  field: string;
  message: string;
}

/**
 * The `errors` of an error body, in the order of the DTO's fields. Twin of
 * `ApiException.fieldErrors`: empty except on a validation 400.
 */
export function fieldErrors(cause: unknown): ApiFieldError[] {
  const raw = (cause as { error?: { errors?: unknown } } | null)?.error?.errors;
  if (!Array.isArray(raw)) return [];
  const out: ApiFieldError[] = [];
  for (const entry of raw as unknown[]) {
    if (typeof entry === 'string') {
      if (entry) out.push({ field: '', message: entry });
    } else if (entry && typeof entry === 'object') {
      const { field, message: text } = entry as { field?: unknown; message?: unknown };
      if (typeof text === 'string' && text) {
        out.push({ field: typeof field === 'string' ? field : '', message: text });
      }
    }
  }
  return out;
}

/** The server's reason for one field, to hang it under that field. */
export function fieldError(cause: unknown, field: string): string | null {
  return fieldErrors(cause).find((entry) => entry.field === field)?.message ?? null;
}
