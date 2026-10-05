import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { TimeoutError, firstValueFrom, timeout } from 'rxjs';
import { Api } from '../panel/core/api/api';
import { API_URL } from '../panel/core/api/api.config';

/** Which of the Bipsy sites this is, for the maintenance endpoints. */
export const MAINTENANCE_SITE = 'BUSINESS_WEB';

/** Carries the team's bypass token on the status check. */
export const MAINTENANCE_HEADER = 'X-Bipsy-Maintenance';

/** `GET /maintenance/status?site=…` */
interface MaintenanceStatus {
  site: string;
  maintenance: boolean;
  /** Maintenance is on, but the token sent lets this person in. */
  bypass: boolean;
  message: string | null;
}

/** `POST /maintenance/unlock` */
interface UnlockResponse {
  token: string;
  expiresAt: string;
}

/** What is known about the site right now. */
interface Known {
  maintenance: boolean;
  bypass: boolean;
  message: string | null;
}

/**
 * Closed to the public. It is where the site starts and where it goes back to
 * whenever the server cannot be asked: while the backend only runs on the
 * team's machines, «nobody answers» means «this visitor is not the team».
 */
const CLOSED: Known = { maintenance: true, bypass: false, message: null };

/** The last answer of the server, so a reload starts from it. */
const STATE_KEY = 'bipsy.maintenance.state';
/** The team's bypass token. */
const TOKEN_KEY = 'bipsy.maintenance.token';

const POLL_MS = 60_000;
/**
 * Shorter than the panel's 20 s: with a remembered «in maintenance» this is
 * how long a visitor looks at the maintenance page before the site gives up
 * asking and opens.
 */
const CHECK_TIMEOUT_MS = 10_000;
/** Coming back to the tab re-checks, but not on every flick between two tabs. */
const MIN_GAP_MS = 10_000;
/** Re-checks in a row that may go unanswered before a confirmed state is dropped. */
const MAX_MISSES = 3;

/**
 * Whether the web is closed for maintenance, and whether this browser is let
 * in anyway.
 *
 * The rule is FAIL CLOSED: the site is in maintenance until the server says
 * otherwise, and whenever it cannot be asked. The backend is not hosted yet —
 * it runs on the team's machines — so for the public there is nobody to ask
 * and the maintenance page is all they see; the team, with the backend
 * running, gets the real answer and enters through /admin with the password.
 * The page starts from the last answer remembered in `localStorage` and the
 * server's answer replaces it as soon as it arrives.
 *
 * Only the web is gated. The app keeps working during maintenance.
 */
@Injectable({ providedIn: 'root' })
export class MaintenanceService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(Api);

  /** The token, only when the browser refuses to store it. */
  private memoryToken: string | null = null;
  /** True once the server has answered since this page loaded. */
  private confirmed = false;
  private misses = 0;
  private lastCheck = 0;
  private inFlight: Promise<void> | null = null;
  /** Navigations held at the gate until the site opens (see `maintenanceGate`). */
  private waiting: Array<() => void> = [];

  private readonly known = signal<Known>(readKnown());

  /** The site is in maintenance, whether or not this browser may pass. */
  readonly maintenance = computed(() => this.known().maintenance);
  /** In maintenance and inside anyway: the team, with a token the server honours. */
  readonly bypass = computed(() => this.known().maintenance && this.known().bypass);
  /** In maintenance and outside: the only thing to show is the maintenance page. */
  readonly blocked = computed(() => this.known().maintenance && !this.known().bypass);
  /** What the admin wrote for the visitors, if anything. */
  readonly message = computed(() => this.known().message);

  readonly checking = signal(false);
  /** The last check got no usable answer. */
  readonly lastCheckFailed = signal(false);

  constructor() {
    void this.check();

    // A hidden tab does not ask: it will when someone looks at it again.
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void this.check();
    }, POLL_MS);
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && Date.now() - this.lastCheck > MIN_GAP_MS) {
        void this.check();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    inject(DestroyRef).onDestroy(() => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    });
  }

  /** Asks the server. Never rejects; calls that overlap share one request. */
  check(): Promise<void> {
    this.inFlight ??= this.run().finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  /**
   * Trades the team password for a bypass token and lets this browser in.
   * Rejects with what the HTTP layer threw: 401 wrong password, 429 too many
   * attempts, 404 the site is not in maintenance (any more).
   */
  async unlock(password: string): Promise<void> {
    const answer = await this.api.post<UnlockResponse>('/maintenance/unlock', {
      site: MAINTENANCE_SITE,
      password,
    });
    if (!answer?.token) throw new Error('Unlock answered without a token');

    this.saveToken(answer.token);
    this.confirmed = true;
    this.misses = 0;
    this.set({ maintenance: true, bypass: true, message: this.known().message });
    // Confirms it with the server. A check already on its way was sent without
    // the token: it notices and asks again (see `ask`).
    void this.check();
  }

  /** «Salir»: forgets the token, so this browser sees what the public sees. */
  leave(): void {
    this.saveToken(null);
    this.set({ ...this.known(), bypass: false });
  }

  /** Resolves when the site is open to this browser; at once if it already is. */
  whenOpen(): Promise<void> {
    if (!this.blocked()) return Promise.resolve();
    return new Promise((resolve) => this.waiting.push(resolve));
  }

  private async run(): Promise<void> {
    this.checking.set(true);
    try {
      // More than one lap only when the token changed while the answer was on
      // its way (someone unlocked or left in the meantime).
      for (let lap = 0; lap < 3; lap++) {
        if (await this.ask()) break;
      }
    } finally {
      this.lastCheck = Date.now();
      this.checking.set(false);
    }
  }

  /** False when the answer was for a token that is no longer the current one. */
  private async ask(): Promise<boolean> {
    const token = this.readToken();
    let status: MaintenanceStatus;
    try {
      status = await firstValueFrom(
        this.http
          .get<MaintenanceStatus>(`${API_URL}/maintenance/status`, {
            params: { site: MAINTENANCE_SITE },
            headers: token ? { [MAINTENANCE_HEADER]: token } : {},
          })
          .pipe(timeout(CHECK_TIMEOUT_MS)),
      );
      // A 200 that is not the contract (a proxy answering with its own page)
      // closes nothing.
      if (typeof status?.maintenance !== 'boolean') throw new Error('Not a maintenance status');
    } catch (cause) {
      this.missed(cause);
      return true;
    }

    if (this.readToken() !== token) return false;

    const maintenance = status.maintenance;
    const bypass = maintenance && status.bypass === true;
    // The server stopped honouring the token (expired, or the password was
    // changed): it is of no use any more.
    if (maintenance && !bypass && token) this.saveToken(null);

    this.confirmed = true;
    this.misses = 0;
    this.lastCheckFailed.set(false);
    this.set({
      maintenance,
      bypass,
      message: maintenance ? status.message?.trim() || null : null,
    });
    return true;
  }

  /**
   * No usable answer: the site closes. The one exception is a call that got
   * lost right after the server did answer — then what it said is kept for a
   * couple of tries, so the team is not thrown out on every hiccup.
   */
  private missed(cause: unknown): void {
    this.lastCheckFailed.set(true);
    const lost =
      cause instanceof TimeoutError ||
      (cause instanceof HttpErrorResponse &&
        (cause.status === 0 || cause.status >= 500 || cause.status === 408 || cause.status === 429));

    if (lost && this.confirmed && ++this.misses < MAX_MISSES) return;

    this.confirmed = false;
    this.misses = 0;
    this.set({ ...CLOSED, message: this.known().message });
  }

  private set(next: Known): void {
    this.known.set(next);
    try {
      if (next.maintenance) localStorage.setItem(STATE_KEY, JSON.stringify(next));
      else localStorage.removeItem(STATE_KEY);
    } catch {
      // Without storage a reload during maintenance flashes the site for a
      // moment. Nothing else is lost.
    }

    if (!next.maintenance || next.bypass) {
      const waiting = this.waiting;
      this.waiting = [];
      for (const resolve of waiting) resolve();
    }
  }

  private readToken(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY) ?? this.memoryToken;
    } catch {
      return this.memoryToken;
    }
  }

  private saveToken(token: string | null): void {
    this.memoryToken = null;
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      // Blocked storage: the bypass lasts until the tab is closed.
      this.memoryToken = token;
    }
  }
}

function readKnown(): Known {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return CLOSED;
    const value = JSON.parse(raw) as Partial<Known> | null;
    if (value?.maintenance !== true) return CLOSED;
    return {
      maintenance: true,
      bypass: value.bypass === true,
      message: typeof value.message === 'string' ? value.message : null,
    };
  } catch {
    return CLOSED;
  }
}
