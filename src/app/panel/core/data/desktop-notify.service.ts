import { Injectable, Injector, computed, effect, inject, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import {
  Absence,
  ActiveWorkerClock,
  BookingResponse,
  BusinessWaitlistEntry,
  Conversation,
  ReviewResponse,
} from '../api/models';
import { Api } from '../api/api';
import { NotificationPrefsResponse } from '../api/models';
import { AuthService } from '../auth/auth.service';
import { longDateTime, toDate } from '../util/dates';
import { AgendaStore } from './agenda.store';
import { InboxStore } from './inbox.store';
import { MyWorkStore } from './my-work.store';
import { ReviewsStore } from './reviews.store';
import { TeamStore } from './team.store';
import { WaitlistStore } from './waitlist.store';

/**
 * The preference keys of `notification_prefs_provider_business.dart`
 * (`NotifPref`), spelled the same so both clients talk about the same thing.
 * Every key defaults to true, like the app.
 *
 * They are a CONTRACT with the backend too: each one is, letter by letter, the
 * `notifKey` a push carries (`NotifKeys.java`). The prefix says WHO is told,
 * not what about — the same new appointment is `notif_worker_new_booking` for
 * the worker and `notif_biz_new_booking` for the business, and each turns
 * theirs off. Until 1/10/2026 the backend sent unprefixed keys and no role
 * switch of the app did anything; the panel never stored those, so there is
 * nothing to migrate here.
 */
export const NotifKey = {
  // Worker
  workerNewBooking: 'notif_worker_new_booking',
  workerAbsenceDecided: 'notif_worker_absence_decided',
  workerCustomerCancel: 'notif_worker_customer_cancel',
  workerDirectAbsence: 'notif_worker_direct_absence',
  workerClockReminder: 'notif_worker_clock_reminder',
  workerNewReview: 'notif_worker_new_review',
  // Business
  bizNewBooking: 'notif_biz_new_booking',
  bizAbsenceRequest: 'notif_biz_absence_request',
  bizWorkerClockIn: 'notif_biz_worker_clock_in',
  bizWorkerClockOut: 'notif_biz_worker_clock_out',
  bizNewReview: 'notif_biz_new_review',
  bizBookingStateChange: 'notif_biz_booking_state_change',
  // Both
  chatMessage: 'notif_chat_message',
  /** Somebody joins the waiting list, or a slot gets covered from it. */
  waitlistState: 'notif_waitlist_state',
  /** Team moves: someone joins, an invitation lapses, someone is taken off. */
  team: 'notif_team',
  /** The day's summary and the first appointment. */
  dayAgenda: 'notif_day_agenda',
  /** News about the business that is neither appointments nor money. */
  insights: 'notif_biz_insights',
} as const;

export type NotifKeyValue = (typeof NotifKey)[keyof typeof NotifKey];

/** Not a server key: the master switch of this browser, kept in `localStorage`. */
const WEB_DESKTOP_KEY = 'notif_web_desktop';

export interface NotifNotice {
  key: NotifKeyValue;
  label: string;
  icon: string;
}

/** `NotifGrupo`: what is turned on or off at once. Its notices unfold below it. */
export interface NotifGroup {
  title: string;
  icon: string;
  notices: NotifNotice[];
}

/**
 * The notices of the team block, for both roles.
 *
 * Payouts, payments, subscription, account, set-up and verification are in no
 * catalog on purpose: `NotifKeys.NEVER_MUTED`, the server refuses to mute them.
 */
const COMMON_NOTICES: NotifNotice[] = [
  { key: NotifKey.team, label: 'Movimientos del equipo', icon: 'groups' },
  { key: NotifKey.dayAgenda, label: 'Resumen del día', icon: 'wb_sunny' },
  { key: NotifKey.insights, label: 'Sobre tu negocio', icon: 'insights' },
];

/** `_negocio` in `notification_groups.dart`, texts from `app_es.arb`. */
export const BUSINESS_NOTIF_GROUPS: NotifGroup[] = [
  {
    title: 'Citas',
    icon: 'calendar_month',
    notices: [
      { key: NotifKey.bizNewBooking, label: 'Nueva cita pendiente', icon: 'calendar_today' },
      { key: NotifKey.bizBookingStateChange, label: 'Cambios de estado de cita', icon: 'swap_horiz' },
    ],
  },
  {
    title: 'Ausencias',
    icon: 'beach_access',
    notices: [{ key: NotifKey.bizAbsenceRequest, label: 'Solicitud de ausencia', icon: 'beach_access' }],
  },
  {
    title: 'Fichaje',
    icon: 'timer',
    notices: [
      { key: NotifKey.bizWorkerClockIn, label: 'Trabajador pica entrada', icon: 'login' },
      { key: NotifKey.bizWorkerClockOut, label: 'Trabajador pica salida', icon: 'logout' },
    ],
  },
  {
    title: 'Reseñas',
    icon: 'star',
    notices: [{ key: NotifKey.bizNewReview, label: 'Nueva reseña recibida', icon: 'star' }],
  },
  { title: 'Equipo y resúmenes', icon: 'storefront', notices: COMMON_NOTICES },
];

/** `_trabajador`: not a filter of the above, each role hears about different things. */
export const WORKER_NOTIF_GROUPS: NotifGroup[] = [
  {
    title: 'Citas',
    icon: 'calendar_month',
    notices: [
      { key: NotifKey.workerNewBooking, label: 'Nueva cita asignada', icon: 'calendar_today' },
      { key: NotifKey.workerCustomerCancel, label: 'Cliente cancela una cita', icon: 'cancel' },
    ],
  },
  {
    title: 'Ausencias',
    icon: 'beach_access',
    notices: [
      { key: NotifKey.workerAbsenceDecided, label: 'Respuesta a solicitud de ausencia', icon: 'check_circle' },
      { key: NotifKey.workerDirectAbsence, label: 'Ausencia asignada por el negocio', icon: 'beach_access' },
    ],
  },
  {
    title: 'Fichaje',
    icon: 'timer',
    notices: [{ key: NotifKey.workerClockReminder, label: 'Recordatorio de fichaje', icon: 'access_alarm' }],
  },
  {
    title: 'Reseñas',
    icon: 'star',
    notices: [{ key: NotifKey.workerNewReview, label: 'Nueva reseña recibida', icon: 'star' }],
  },
  { title: 'Equipo y resúmenes', icon: 'storefront', notices: COMMON_NOTICES },
];

export type DesktopPermission = NotificationPermission | 'unsupported';

/**
 * What this account wants to hear about — `NotifPrefsController` — plus the one
 * thing that belongs to this browser.
 *
 * The kinds live on the SERVER (`GET|PUT /me/notification-prefs`): only what is
 * off travels, and anything not in `muted` is on. A preference kept here could
 * not reach the push, which the phone's system draws without asking anyone.
 * `notif_web_desktop` and the permission stay local: another browser has its own.
 */
@Injectable({ providedIn: 'root' })
export class NotificationPrefs {
  private readonly api = inject(Api);
  private readonly auth = inject(AuthService);

  readonly permission = signal<DesktopPermission>(currentPermission());

  private readonly mutedKeys = signal<ReadonlySet<string>>(new Set());
  /** Never painted as «all on» on a failure: that would lie about the settings. */
  readonly status = signal<'idle' | 'loading' | 'ready' | 'error'>('idle');
  private loadedFor: number | null = null;
  /** Only the newest write's answer may replace what is on screen. */
  private lastWrite = 0;

  private readonly desktopVersion = signal(0);
  /** `notif_web_desktop` of this browser. On unless it was turned off. */
  readonly desktopEnabled = computed(() => {
    this.desktopVersion();
    return readDesktop(this.storageKey()) !== false;
  });

  constructor() {
    // The browser can change the permission from its own settings.
    try {
      void navigator.permissions
        ?.query({ name: 'notifications' as PermissionName })
        .then((status) => {
          status.onchange = () => this.permission.set(currentPermission());
        })
        .catch(() => undefined);
    } catch {
      // Older browsers: the value read on start is what there is.
    }
  }

  /** Idempotent per account, so whoever needs the prefs just asks. */
  async load(force = false): Promise<void> {
    const userId = this.auth.user()?.id ?? null;
    if (userId == null) return;
    if (!force && this.loadedFor === userId && this.status() !== 'error') return;
    this.loadedFor = userId;
    this.status.set('loading');
    this.mutedKeys.set(new Set());
    try {
      const prefs = await this.api.get<NotificationPrefsResponse>('/me/notification-prefs');
      this.mutedKeys.set(new Set(prefs.muted));
      this.status.set('ready');
    } catch {
      this.status.set('error');
    }
  }

  isEnabled(key: NotifKeyValue): boolean {
    return !this.mutedKeys().has(key);
  }

  /**
   * Partial `PUT`, one call for a whole group, painted before the answer because
   * a switch that takes half a second reads as broken. On failure only these
   * keys go back and the error is rethrown for the screen to say so: a switch
   * moving back with no word reads as the panel ignoring you.
   *
   * Never the full set: a client that does not know a key would turn it back on.
   */
  async setEnabled(keys: readonly NotifKeyValue[], on: boolean): Promise<void> {
    if (!keys.length) return;
    const before = new Map(keys.map((key) => [key, this.isEnabled(key)]));
    this.applyLocally(keys.map((key) => [key, on]));
    const write = ++this.lastWrite;
    try {
      const saved = await this.api.put<NotificationPrefsResponse>('/me/notification-prefs', {
        prefs: Object.fromEntries(keys.map((key) => [key, on])),
      });
      if (write === this.lastWrite) this.mutedKeys.set(new Set(saved.muted));
    } catch (cause) {
      this.applyLocally([...before]);
      throw cause;
    }
  }

  private applyLocally(changes: ReadonlyArray<readonly [string, boolean]>): void {
    const next = new Set(this.mutedKeys());
    for (const [key, on] of changes) {
      if (on) next.delete(key);
      else next.add(key);
    }
    this.mutedKeys.set(next);
  }

  /** Returns false when the browser would not keep it. */
  setDesktopEnabled(on: boolean): boolean {
    try {
      const key = this.storageKey();
      const stored = JSON.parse(localStorage.getItem(key) ?? '{}');
      localStorage.setItem(key, JSON.stringify({ ...(stored && typeof stored === 'object' ? stored : {}), [WEB_DESKTOP_KEY]: on }));
      this.desktopVersion.update((v) => v + 1);
      return true;
    } catch {
      return false;
    }
  }

  /** Asks the browser once. Must run from a click, or browsers ignore it. */
  async requestPermission(): Promise<DesktopPermission> {
    if (typeof Notification === 'undefined') return 'unsupported';
    try {
      const answer = await Notification.requestPermission();
      this.permission.set(answer);
      return answer;
    } catch {
      this.permission.set(currentPermission());
      return this.permission();
    }
  }

  private storageKey(): string {
    return `bipsy.notif.${this.auth.user()?.id ?? 0}`;
  }
}

/**
 * Desktop notifications while the panel is open.
 *
 * No polling: it watches the signals the stores already hold (agenda,
 * inbox, absences, reviews, time clock, waiting list) and, each time one of
 * them is read again, tells apart what is new. The first read of each list is
 * the baseline and never notifies.
 *
 * Each notification opens the screen `FcmService._routeFor` sends that kind of
 * push to in the app: appointments to the agenda, a request to the team's
 * absences, a decision to the worker's own, a clock-in to the log, a review to
 * the reviews, the waiting list to its view and a message to its thread.
 *
 * It only speaks when the panel is NOT in front of the owner (tab hidden or
 * window without focus): while they are looking, the screen already says it,
 * and a mutation they made themselves (confirming, cancelling) must not come
 * back as a notification.
 */
@Injectable({ providedIn: 'root' })
export class DesktopNotifyService {
  private readonly injector = inject(Injector);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly prefs = inject(NotificationPrefs);
  private readonly agenda = inject(AgendaStore);
  private readonly inbox = inject(InboxStore);
  private readonly team = inject(TeamStore);
  private readonly work = inject(MyWorkStore);
  private readonly reviews = inject(ReviewsStore);
  private readonly waitlist = inject(WaitlistStore);

  private started = false;
  private primed = false;

  // Snapshots of what was already seen. Null = no baseline yet.
  private bookings: Map<number, Pick<BookingResponse, 'status' | 'startDateTime'>> | null = null;
  private teamAbsences: Set<number> | null = null;
  private myAbsences: Map<number, Absence> | null = null;
  private unread: Map<number, number> | null = null;
  private reviewIds: Set<number> | null = null;
  private clocks: Map<number, string> | null = null;
  private waiting: Map<number, BusinessWaitlistEntry['status']> | null = null;

  start(): void {
    if (this.started) return;
    this.started = true;
    const injector = this.injector;

    effect(() => this.onBookings(this.agenda.bookings.value()), { injector });
    effect(() => this.onTeamAbsences(this.team.absences.value()), { injector });
    effect(() => this.onMyAbsences(this.work.absences.value()), { injector });
    effect(() => this.onInbox(this.inbox.conversations.value()), { injector });
    effect(() => this.onReviews(this.reviews.reviews.value()), { injector });
    effect(() => this.onClocks(this.team.activeClocks.value()), { injector });
    effect(() => this.onWaitlist(this.waitlist.entries.value()), { injector });

    // Once allowed, make sure every list it watches has been read once, so
    // there is a baseline to compare with (idempotent loads, no timers).
    effect(
      () => {
        if (this.prefs.permission() === 'granted' && this.auth.status() === 'authenticated') {
          untracked(() => this.prime());
        }
      },
      { injector },
    );
  }

  private prime(): void {
    if (this.primed) return;
    this.primed = true;
    void this.prefs.load();
    void this.agenda.bookings.load();
    void this.reviews.load();
    if (this.auth.canUseChat()) void this.inbox.load();
    // Asks nothing unless the waiting list is on (and, for a worker, allowed).
    void this.waitlist.load();
    if (this.auth.isWorker()) {
      void this.work.absences.load();
    } else if (this.team.enabled()) {
      void this.team.absences.load();
      if (this.auth.clockInEnabled()) void this.team.activeClocks.load();
    }
  }

  // ----- watchers ----------------------------------------------------------

  private onBookings(list: BookingResponse[]): void {
    if (!this.agenda.bookings.isLoaded) return;
    const before = this.bookings;
    this.bookings = new Map(list.map((b) => [b.id, { status: b.status, startDateTime: b.startDateTime }]));
    if (!before) return;
    const worker = this.auth.isWorker();

    for (const booking of list) {
      const seen = before.get(booking.id);
      const was = seen?.status;
      const when = longDateTime(toDate(booking.startDateTime));
      const body = `${booking.customerName} · ${booking.serviceName} · ${when}`;
      if (was === undefined) {
        if (worker && booking.status !== 'CANCELED') {
          this.notify(NotifKey.workerNewBooking, 'Nueva cita asignada', body, '/panel/agenda', `b${booking.id}`);
        } else if (!worker && booking.status === 'PENDING') {
          this.notify(NotifKey.bizNewBooking, 'Nueva cita pendiente', body, '/panel/agenda?vista=pendientes', `b${booking.id}`);
        }
      } else if (was !== booking.status) {
        if (worker) {
          if (booking.status === 'CANCELED') {
            this.notify(NotifKey.workerCustomerCancel, 'Cita cancelada', body, '/panel/agenda', `b${booking.id}`);
          }
        } else {
          this.notify(NotifKey.bizBookingStateChange, STATUS_TITLE[booking.status], body, '/panel/agenda', `b${booking.id}`);
        }
      } else if (seen?.startDateTime !== booking.startDateTime && booking.status !== 'CANCELED') {
        // The customer moved it. Same keys the backend puts on BOOKING_RESCHEDULED.
        this.notify(
          worker ? NotifKey.workerNewBooking : NotifKey.bizBookingStateChange,
          'Cita cambiada',
          body,
          '/panel/agenda',
          `b${booking.id}`,
        );
      }
    }
  }

  private onTeamAbsences(list: Absence[]): void {
    if (!this.team.absences.isLoaded || this.auth.isWorker()) return;
    const before = this.teamAbsences;
    this.teamAbsences = new Set(list.map((a) => a.id));
    if (!before) return;
    for (const absence of list) {
      if (absence.status === 'PENDING' && !before.has(absence.id)) {
        this.notify(
          NotifKey.bizAbsenceRequest,
          'Solicitud de ausencia',
          `${absence.workerName} · ${range(absence)}`,
          '/panel/equipo/ausencias',
          `a${absence.id}`,
        );
      }
    }
  }

  private onMyAbsences(list: Absence[]): void {
    if (!this.work.absences.isLoaded || !this.auth.isWorker()) return;
    const before = this.myAbsences;
    this.myAbsences = new Map(list.map((a) => [a.id, a]));
    if (!before) return;
    for (const [id, absence] of before) {
      // Gone after being decided: the business took it away (ABSENCE_WITHDRAWN,
      // which travels under the same key as a decision). One still pending
      // that disappears is the worker withdrawing their own request.
      if (absence.status !== 'PENDING' && !this.myAbsences.has(id)) {
        this.notify(NotifKey.workerAbsenceDecided, 'Ausencia retirada', range(absence), '/panel/mis-ausencias', `a${id}`);
      }
    }
    for (const absence of list) {
      const was = before.get(absence.id)?.status;
      if (was === 'PENDING' && absence.status !== 'PENDING') {
        const approved = absence.status === 'APPROVED';
        this.notify(
          NotifKey.workerAbsenceDecided,
          approved ? 'Ausencia aprobada' : 'Ausencia rechazada',
          absence.decisionNote ? `${range(absence)} · ${absence.decisionNote}` : range(absence),
          '/panel/mis-ausencias',
          `a${absence.id}`,
        );
      } else if (was === undefined && absence.status === 'APPROVED') {
        // Created already approved: the business registered it directly.
        this.notify(NotifKey.workerDirectAbsence, 'Ausencia asignada por el negocio', range(absence), '/panel/mis-ausencias', `a${absence.id}`);
      }
    }
  }

  private onInbox(list: Conversation[]): void {
    if (!this.inbox.conversations.isLoaded) return;
    const before = this.unread;
    this.unread = new Map(list.map((c) => [c.id, c.unread]));
    if (!before) return;
    for (const conversation of list) {
      if (conversation.unread > (before.get(conversation.id) ?? 0)) {
        this.notify(
          NotifKey.chatMessage,
          conversation.otherPartyName,
          conversation.lastMessagePreview ?? 'Te ha escrito',
          '/panel/mensajes',
          `c${conversation.id}`,
          // Straight to that thread, like the app: the screen opens whichever
          // conversation the store already has chosen.
          () => void this.inbox.openThread(conversation.id),
        );
      }
    }
  }

  private onReviews(list: ReviewResponse[]): void {
    if (!this.reviews.reviews.isLoaded) return;
    const before = this.reviewIds;
    this.reviewIds = new Set(list.map((r) => r.id));
    if (!before) return;
    const worker = this.auth.isWorker();
    const mine = worker ? new Set(untracked(() => this.agenda.all()).map((b) => b.id)) : null;
    for (const review of list) {
      if (before.has(review.id)) continue;
      if (mine && !mine.has(review.bookingId)) continue;
      this.notify(
        worker ? NotifKey.workerNewReview : NotifKey.bizNewReview,
        'Nueva reseña recibida',
        `${review.customerName} · ${'★'.repeat(review.rating)}${review.comment ? ` · ${review.comment}` : ''}`,
        '/panel/resenas',
        `r${review.id}`,
      );
    }
  }

  private onClocks(list: ActiveWorkerClock[]): void {
    if (!this.team.activeClocks.isLoaded || this.auth.isWorker()) return;
    const before = this.clocks;
    this.clocks = new Map(list.map((c) => [c.workerId, c.workerName]));
    if (!before) return;
    for (const clock of list) {
      if (!before.has(clock.workerId)) {
        this.notify(NotifKey.bizWorkerClockIn, 'Trabajador pica entrada', `${clock.workerName} ha empezado su jornada.`, '/panel/equipo/fichajes', `in${clock.workerId}`);
      }
    }
    for (const [workerId, name] of before) {
      if (!this.clocks.has(workerId)) {
        this.notify(NotifKey.bizWorkerClockOut, 'Trabajador pica salida', `${name} ha terminado su jornada.`, '/panel/equipo/fichajes', `out${workerId}`);
      }
    }
  }

  /** `WAITLIST_JOINED` and `WAITLIST_BOOKED`, with the words the push uses. */
  private onWaitlist(list: BusinessWaitlistEntry[]): void {
    if (!this.waitlist.entries.isLoaded) return;
    const before = this.waiting;
    this.waiting = new Map(list.map((e) => [e.id, e.status]));
    if (!before) return;
    for (const entry of list) {
      const was = before.get(entry.id);
      if (was === undefined && entry.status === 'WAITING') {
        this.notify(
          NotifKey.waitlistState,
          'Lista de espera',
          `${entry.customerName} espera hueco para ${entry.serviceName}`,
          '/panel/agenda?vista=espera',
          `w${entry.id}`,
        );
      } else if (was !== undefined && was !== 'BOOKED' && entry.status === 'BOOKED') {
        this.notify(
          NotifKey.waitlistState,
          'Hueco cubierto',
          `${entry.customerName} ha cogido el hueco de ${entry.serviceName}`,
          '/panel/agenda?vista=espera',
          `w${entry.id}`,
        );
      }
    }
  }

  // ----- output ------------------------------------------------------------

  private notify(
    key: NotifKeyValue,
    title: string,
    body: string,
    route: string,
    tag: string,
    /** Runs on click, before navigating: what the route alone cannot say. */
    onOpen?: () => void,
  ): void {
    untracked(() => {
      if (this.prefs.permission() !== 'granted') return;
      if (!this.prefs.desktopEnabled() || !this.prefs.isEnabled(key)) return;
      if (inFront()) return;
      try {
        const notification = new Notification(title, { body, tag, icon: '/favicon.ico' });
        notification.onclick = () => {
          window.focus();
          onOpen?.();
          void this.router.navigateByUrl(route);
          notification.close();
        };
      } catch {
        // Some browsers (Android Chrome) only notify through a service worker.
      }
    });
  }
}

/**
 * Starts the desktop notifications. Call it once from an injection context —
 * the panel shell's constructor:
 *
 * ```ts
 * startDesktopNotifications();
 * ```
 */
export function startDesktopNotifications(): void {
  inject(DesktopNotifyService).start();
}

const STATUS_TITLE: Record<BookingResponse['status'], string> = {
  PENDING: 'Cita pendiente',
  CONFIRMED: 'Cita confirmada',
  // Never reached as a change: an appointment is born in this state.
  AWAITING_CUSTOMER: 'Cita esperando al cliente',
  CANCELED: 'Cita cancelada',
  NO_SHOW: 'Cita marcada como no vino',
};

function currentPermission(): DesktopPermission {
  try {
    return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission;
  } catch {
    return 'unsupported';
  }
}

/** Other `notif_*` left in that map by older versions are simply not read. */
function readDesktop(key: string): boolean | undefined {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? '{}');
    return parsed?.[WEB_DESKTOP_KEY];
  } catch {
    return undefined;
  }
}

/** The owner is looking at the panel right now. */
function inFront(): boolean {
  try {
    return document.visibilityState === 'visible' && document.hasFocus();
  } catch {
    return false;
  }
}

function range(absence: Absence): string {
  const fmt = (key: string) => {
    const [y, m, d] = key.split('-');
    return `${d}/${m}/${y}`;
  };
  return absence.startDate === absence.endDate
    ? fmt(absence.startDate)
    : `${fmt(absence.startDate)} – ${fmt(absence.endDate)}`;
}
