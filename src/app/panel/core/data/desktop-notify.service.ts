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
  /** Web only: the master switch for desktop notifications in this browser. */
  webDesktop: 'notif_web_desktop',
} as const;

export type NotifKeyValue = (typeof NotifKey)[keyof typeof NotifKey];

export interface NotifPrefDef {
  key: NotifKeyValue;
  title: string;
  sub: string;
  icon: string;
  /** False when only the phone can do it (the clock reminder runs off the phone's schedule). */
  web: boolean;
}

export interface NotifSection {
  title: string;
  prefs: NotifPrefDef[];
}

/** `_buildBusinessSections` in `notifications_screen_business.dart`, texts from `app_es.arb`. */
export const BUSINESS_NOTIF_SECTIONS: NotifSection[] = [
  {
    title: 'Citas',
    prefs: [
      { key: NotifKey.bizNewBooking, title: 'Nueva cita pendiente', sub: 'Cuando llega una reserva nueva de cualquier trabajador o del negocio.', icon: 'calendar_today', web: true },
      { key: NotifKey.bizBookingStateChange, title: 'Cambios de estado de cita', sub: 'Cancelaciones y otros cambios de estado. Puede ser ruidoso.', icon: 'swap_horiz', web: true },
    ],
  },
  {
    title: 'Ausencias',
    prefs: [
      { key: NotifKey.bizAbsenceRequest, title: 'Solicitud de ausencia', sub: 'Cuando un trabajador solicita vacaciones o días libres.', icon: 'beach_access', web: true },
    ],
  },
  {
    title: 'Fichajes',
    prefs: [
      { key: NotifKey.bizWorkerClockIn, title: 'Trabajador pica entrada', sub: 'Cuando un trabajador ficha el inicio de su jornada.', icon: 'login', web: true },
      { key: NotifKey.bizWorkerClockOut, title: 'Trabajador pica salida', sub: 'Cuando un trabajador ficha el fin de su jornada.', icon: 'logout', web: true },
    ],
  },
  {
    title: 'Reseñas',
    prefs: [
      { key: NotifKey.bizNewReview, title: 'Nueva reseña recibida', sub: 'Cuando un cliente deja una valoración sobre tu negocio.', icon: 'star', web: true },
    ],
  },
];

/** `_buildWorkerSections`. */
export const WORKER_NOTIF_SECTIONS: NotifSection[] = [
  {
    title: 'Citas',
    prefs: [
      { key: NotifKey.workerNewBooking, title: 'Nueva cita asignada', sub: 'Cuando el negocio o un cliente te asigna una nueva reserva.', icon: 'calendar_today', web: true },
      { key: NotifKey.workerCustomerCancel, title: 'Cliente cancela una cita', sub: 'Cuando un cliente cancela una reserva que tenías asignada.', icon: 'cancel', web: true },
    ],
  },
  {
    title: 'Ausencias',
    prefs: [
      { key: NotifKey.workerAbsenceDecided, title: 'Respuesta a solicitud de ausencia', sub: 'Cuando tu negocio aprueba o rechaza una solicitud.', icon: 'check_circle', web: true },
      { key: NotifKey.workerDirectAbsence, title: 'Ausencia asignada por el negocio', sub: 'Cuando el negocio te registra directamente un periodo de ausencia.', icon: 'beach_access', web: true },
    ],
  },
  {
    title: 'Fichaje',
    prefs: [
      { key: NotifKey.workerClockReminder, title: 'Recordatorio de fichaje', sub: 'Aviso antes de que empiece o termine tu turno para que no olvides picar.', icon: 'access_alarm', web: false },
    ],
  },
  {
    title: 'Reseñas',
    prefs: [
      { key: NotifKey.workerNewReview, title: 'Nueva reseña recibida', sub: 'Cuando un cliente deja una valoración sobre una de tus citas.', icon: 'star', web: true },
    ],
  },
];

/** `NotifPref.chatMessage`: the inbox is shared, so the same key serves both roles. */
export const CHAT_NOTIF_SECTION: NotifSection = {
  title: 'Mensajes',
  prefs: [
    { key: NotifKey.chatMessage, title: 'Mensajes', sub: 'Cuando un cliente te escribe.', icon: 'forum', web: true },
  ],
};

/**
 * `NotifPref.waitlistState`. The app has the key but no switch for it yet, so
 * the texts here are the panel's own; the key is shared for the same reason
 * as the chat one.
 */
export const WAITLIST_NOTIF_SECTION: NotifSection = {
  title: 'Lista de espera',
  prefs: [
    { key: NotifKey.waitlistState, title: 'Lista de espera', sub: 'Cuando alguien se apunta a la lista de espera o un hueco se cubre desde ella.', icon: 'hourglass_top', web: true },
  ],
};

export type DesktopPermission = NotificationPermission | 'unsupported';

/**
 * The notification preferences of this browser — the web twin of
 * `NotifPrefsController`. Like in the app they belong to the device, not the
 * account: they live in `localStorage`, one map per signed-in user.
 */
@Injectable({ providedIn: 'root' })
export class NotificationPrefs {
  private readonly auth = inject(AuthService);

  /** Bumped on every write, so `state` re-reads the storage. */
  private readonly version = signal(0);

  readonly permission = signal<DesktopPermission>(currentPermission());

  readonly state = computed<Record<string, boolean>>(() => {
    this.version();
    return readPrefs(this.storageKey(this.auth.user()?.id));
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

  isEnabled(key: NotifKeyValue): boolean {
    return this.state()[key] ?? true;
  }

  /** Returns false when the browser would not keep it. */
  set(key: NotifKeyValue, on: boolean): boolean {
    const next = { ...this.state(), [key]: on };
    try {
      localStorage.setItem(this.storageKey(this.auth.user()?.id), JSON.stringify(next));
      this.version.update((v) => v + 1);
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

  private storageKey(userId: number | undefined): string {
    return `bipsy.notif.${userId ?? 0}`;
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
    void this.agenda.bookings.load();
    void this.reviews.load();
    if (this.auth.canUseChat()) void this.inbox.load();
    // Asks nothing unless the waiting list is on (and, for a worker, allowed).
    void this.waitlist.load();
    if (this.auth.isWorker()) {
      void this.work.absences.load();
    } else if (!this.auth.isAutonomous()) {
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
      if (!this.prefs.isEnabled(NotifKey.webDesktop) || !this.prefs.isEnabled(key)) return;
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

function readPrefs(key: string): Record<string, boolean> {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
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
