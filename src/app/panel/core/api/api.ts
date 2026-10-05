import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, TimeoutError, catchError, firstValueFrom, throwError, timeout } from 'rxjs';
import { API_URL } from './api.config';

type Params = Record<string, string | number | boolean | undefined | null>;

/**
 * Cuánto se espera a la API antes de darla por muerta.
 *
 * Sin esto, una API que no contesta —dormida, caída, o sencillamente la URL
 * equivocada— deja el botón girando para siempre y sin decir nada: el
 * usuario no distingue «va lento» de «esto no va a pasar nunca». 20 s es de
 * sobra para cualquier llamada normal; las subidas de fotos tienen el suyo.
 */
const TIMEOUT_MS = 20_000;
const UPLOAD_TIMEOUT_MS = 90_000;

/** Lo que se ve cuando la API no está. */
export class ApiUnreachableError extends Error {
  readonly status = 0;
  constructor(readonly url: string) {
    super('No hemos podido hablar con el servidor. Comprueba tu conexión e inténtalo otra vez.');
    this.name = 'ApiUnreachableError';
  }
}

/**
 * The single door to the API, the web twin of `ApiClient` (Dio) in
 * `packages/gipsi_api/lib/src/client/api_client.dart`.
 *
 * Everything returns a promise because the panel reads data into signals, and
 * a promise reads better than a subscription that nobody unsubscribes.
 * Authorization and refresh live in `auth.interceptor.ts`, not here.
 */
@Injectable({ providedIn: 'root' })
export class Api {
  private readonly http = inject(HttpClient);

  get<T>(path: string, params?: Params): Promise<T> {
    return this.run(this.http.get<T>(API_URL + path, { params: toParams(params) }), path);
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.run(this.http.post<T>(API_URL + path, body ?? {}), path);
  }

  put<T>(path: string, body?: unknown): Promise<T> {
    return this.run(this.http.put<T>(API_URL + path, body ?? {}), path);
  }

  delete<T>(path: string): Promise<T> {
    return this.run(this.http.delete<T>(API_URL + path), path);
  }

  /**
   * Multipart upload, for the photo endpoints (`file` is the field name).
   * `fields` go as extra `@RequestParam` parts (e.g. the portfolio's
   * `caption` and `serviceId`); empty ones are left out.
   */
  upload<T>(path: string, file: File, fields?: Params): Promise<T> {
    const form = new FormData();
    form.append('file', file);
    for (const [key, value] of Object.entries(fields ?? {})) {
      if (value !== undefined && value !== null && value !== '') form.append(key, String(value));
    }
    return this.run(this.http.post<T>(API_URL + path, form), path, UPLOAD_TIMEOUT_MS);
  }

  private run<T>(call: Observable<T>, path: string, ms = TIMEOUT_MS): Promise<T> {
    return firstValueFrom(call.pipe(
      timeout(ms),
      catchError((error: unknown) => throwError(() =>
        error instanceof TimeoutError ? new ApiUnreachableError(API_URL + path) : error)),
    ));
  }
}

function toParams(params?: Params): HttpParams | undefined {
  if (!params) return undefined;
  let out = new HttpParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') out = out.set(key, String(value));
  }
  return out;
}
