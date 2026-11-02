import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  HostListener,
  Input,
  OnDestroy,
  OnInit,
  Output,
  computed,
  inject,
  signal,
} from '@angular/core';
import { BookingResponse, CollectStatus } from '../core/api/models';
import { AgendaStore } from '../core/data/agenda.store';
import { message } from '../core/data/resource';
import { fromInstant } from '../core/util/dates';
import { money } from '../core/util/format';
import { PnErrorComponent } from '../ui/controls';
import { PnDialogComponent } from '../ui/dialog.component';

/** Standing at the counter, finding out ten seconds late is how something gets charged twice. */
const POLL_MS = 3000;

type Phase = 'elegir' | 'esperando' | 'hecho';

/** Still waiting NOW. Looks at the clock too: the job closing expired requests only runs every five minutes. */
function isWaiting(status: CollectStatus): boolean {
  const request = status.request;
  return request?.status === 'SENT' && fromInstant(request.expiresAt).getTime() > Date.now();
}

function isSettled(status: CollectStatus): boolean {
  return status.settledOffline || status.dueCents <= 0;
}

/**
 * Collect an appointment — `payments/widgets/collect_booking_sheet.dart`, minus
 * Tap to Pay. It takes the place of the appointment dialog instead of opening on
 * top of it.
 *
 * Three phases, and the middle one is why this has state: choosing, waiting for
 * the customer with the status polled while it is open (never otherwise: this is
 * a wait at the counter, not a channel), and how it ended.
 *
 * «Ya cobrada» is ALWAYS offered, with no account and with the switch off: a
 * shop that takes everything in cash needs to write it down just the same. What
 * goes grey, with the server's reason, is only the option that moves money.
 */
@Component({
  selector: 'app-collect-booking-dialog',
  standalone: true,
  imports: [PnDialogComponent, PnErrorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './collect-booking-dialog.component.html',
  styleUrl: './collect-booking-dialog.component.css',
})
export class CollectBookingDialogComponent implements OnInit, OnDestroy {
  @Input({ required: true }) booking!: BookingResponse;
  @Output() closed = new EventEmitter<void>();
  /** Back to the appointment. */
  @Output() back = new EventEmitter<void>();
  /** What was collected changed, by us or by the customer paying. */
  @Output() changed = new EventEmitter<CollectStatus>();

  private readonly agenda = inject(AgendaStore);

  readonly money = money;

  readonly status = signal<CollectStatus | null>(null);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  private readonly phase = signal<Phase>('elegir');

  /** The option working, or the one just finished: its icon is what shows it. */
  readonly via = signal<'app' | 'mano' | null>(null);
  /** «Ya cobrada» went through: the options stay, with its tick, to show HOW it was collected. */
  readonly marked = signal(false);

  private poll: ReturnType<typeof setInterval> | null = null;
  private fetching = false;
  /** Bumped by every action: an answer that left before one says something already old. */
  private generation = 0;

  /** Already settled on opening: there is nothing to offer, and the buttons would answer 409. */
  readonly view = computed<Phase>(() => {
    const status = this.status();
    if (this.phase() === 'elegir' && status && isSettled(status) && this.via() === null) return 'hecho';
    return this.phase();
  });

  /** What is owed while it is owed; what it was worth when not, or a paid one reads as free. */
  readonly subtitle = computed(() => {
    const status = this.status();
    if (!status) return '';
    const name = this.booking.customerName;
    if (this.view() === 'hecho') return name;
    return `${name} · ${money(status.dueCents > 0 ? status.dueCents : status.amountCents)}`;
  });

  /** Rounded up to the minute: exact seconds change no decision. */
  readonly minutesLeft = computed(() => {
    const request = this.status()?.request;
    if (!request) return null;
    const left = fromInstant(request.expiresAt).getTime() - Date.now();
    return left <= 0 ? 0 : Math.ceil(left / 60_000);
  });

  readonly ending = computed(() => {
    const status = this.status();
    if (status && status.dueCents <= 0) return { icon: 'paid', text: 'Pagada', collected: true };
    if (status?.settledOffline) return { icon: 'payments', text: 'Cobrada en mano', collected: true };
    return { icon: 'timer_off', text: 'Se acabó el plazo sin pagar', collected: false };
  });

  ngOnInit(): void {
    void this.refresh(true);
  }

  ngOnDestroy(): void {
    this.syncPoll(false);
  }

  /** The twin of the app coming back to the foreground: first, whether they paid meanwhile. */
  @HostListener('document:visibilitychange')
  onVisibility(): void {
    if (!document.hidden) void this.refresh();
  }

  retry(): void {
    this.loading.set(true);
    this.error.set(null);
    void this.refresh(true);
  }

  private async refresh(initial = false): Promise<void> {
    if (this.fetching && !initial) return;
    this.fetching = true;
    const generation = this.generation;
    try {
      const status = await this.agenda.collectStatus(this.booking.id);
      if (generation !== this.generation) return;
      this.apply(status);
      this.error.set(null);
      if (initial) {
        // A request already running on opening is what the business needs to see.
        this.phase.set(isWaiting(status) ? 'esperando' : 'elegir');
      } else if (this.phase() === 'esperando' && !isWaiting(status)) {
        // Paid, expired or withdrawn: the outcome is what comes next in all three.
        this.phase.set('hecho');
      }
      this.syncPoll(this.phase() === 'esperando');
    } catch (cause) {
      if (generation === this.generation) this.error.set(message(cause));
    } finally {
      this.fetching = false;
      this.loading.set(false);
    }
  }

  private apply(status: CollectStatus): void {
    this.status.set(status);
    if (status.settledOffline !== (this.booking.settledOffline === true) || status.paidCents !== this.booking.prepaidCents) {
      this.changed.emit(status);
    }
  }

  /** Only while waiting: a live timer in the other phases would ask about something that no longer moves. */
  private syncPoll(on: boolean): void {
    if (on && this.poll === null) {
      this.poll = setInterval(() => {
        if (!document.hidden) void this.refresh();
      }, POLL_MS);
    } else if (!on && this.poll !== null) {
      clearInterval(this.poll);
      this.poll = null;
    }
  }

  private async act(body: () => Promise<void>, via: 'app' | 'mano' | null = null): Promise<void> {
    if (this.busy()) return;
    this.generation += 1;
    this.busy.set(true);
    this.error.set(null);
    this.via.set(via);
    try {
      await body();
    } catch (cause) {
      // A 409 is the normal answer to the customer paying in between: its message
      // is already written, and the refresh makes the dialog tell the truth.
      const text = message(cause);
      await this.refresh();
      this.error.set(text);
    } finally {
      this.busy.set(false);
      if (!this.marked()) this.via.set(null);
    }
  }

  ask(): Promise<void> {
    return this.act(async () => {
      await this.agenda.requestPayment(this.booking.id);
      this.phase.set('esperando');
      this.syncPoll(true);
      await this.refresh();
    }, 'app');
  }

  withdraw(): Promise<void> {
    return this.act(async () => {
      this.apply(await this.agenda.cancelPaymentRequest(this.booking.id));
      this.phase.set('elegir');
      this.syncPoll(false);
    });
  }

  markCollected(): Promise<void> {
    return this.act(async () => {
      const status = await this.agenda.settleOffline(this.booking.id);
      // Before `apply`, or the shortcut to «hecho» would take the tick away.
      this.marked.set(true);
      this.apply(status);
    }, 'mano');
  }

  /** Only the hand stamp: a real charge is refunded from Cobros, where the money is. */
  undo(): Promise<void> {
    return this.act(async () => {
      const status = await this.agenda.undoSettleOffline(this.booking.id);
      this.marked.set(false);
      this.apply(status);
      this.phase.set('elegir');
    });
  }
}
