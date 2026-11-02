import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { serverReason } from '../core/data/resource';
import { WaitlistStore } from '../core/data/waitlist.store';
import { AuthService } from '../core/auth/auth.service';
import { BusinessWaitlistEntry, TimeBand, WaitlistNotifyMode } from '../core/api/models';
import { dayKey, fromInstant, longDate, shortDate, toIso } from '../core/util/dates';
import { duration as durationText } from '../core/util/format';
import { PnEmptyComponent } from '../ui/controls';
import { PnDialogComponent } from '../ui/dialog.component';
import { PnDateComponent } from '../ui/date.component';
import { PnOption, PnSelectComponent } from '../ui/select.component';
import { ConfirmService } from '../ui/confirm.service';
import { ToastService } from '../ui/toast.service';

const BAND_LABEL: Record<TimeBand, string> = {
  MORNING: 'Mañanas',
  AFTERNOON: 'Tardes',
  EVENING: 'Noches',
};

/**
 * The waiting list, as the app's «Espera» tab plus the thing the app cannot
 * do: offer a freed slot. The endpoint exists (`POST …/waitlist/offer`) and
 * so does the Dart repository, but no screen calls it — on a desk the freed
 * hole is right there, so here it is a button in the entry's sheet.
 *
 * Order is changed with arrows rather than drag: a queue is reordered rarely
 * and by one position, and arrows work with a keyboard.
 */
@Component({
  selector: 'app-waitlist-panel',
  standalone: true,
  imports: [PnEmptyComponent, PnDialogComponent, FormsModule, PnSelectComponent, PnDateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './waitlist-panel.component.html',
  styleUrl: './waitlist-panel.component.css',
})
export class WaitlistPanelComponent {
  readonly store = inject(WaitlistStore);
  readonly auth = inject(AuthService);
  private readonly confirm = inject(ConfirmService);
  private readonly toasts = inject(ToastService);

  readonly shortDate = shortDate;
  readonly longDate = longDate;
  readonly fromInstant = fromInstant;

  readonly picked = signal<BusinessWaitlistEntry | null>(null);
  readonly settingsOpen = signal(false);
  readonly busy = signal(false);
  readonly offering = signal(false);
  /** What the server said after the last offer, shown in the sheet. */
  readonly offerResult = signal<string | null>(null);

  /** Day (`yyyy-MM-dd`) and time (`HH:mm`) of the slot to offer, picked apart. */
  slotDay: string | null = null;
  slotTime: string | null = null;
  readonly today = dayKey(new Date());
  /** Every quarter of an hour from 06:00: the grid the agenda works on. */
  readonly slotTimes = Array.from({ length: 72 }, (_, i) => {
    const minutes = 6 * 60 + i * 15;
    return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  });

  /** What `datetime-local` used to give: `yyyy-MM-ddTHH:mm`, or empty until both are chosen. */
  get slotStart(): string {
    return this.slotDay && this.slotTime ? `${this.slotDay}T${this.slotTime}` : '';
  }
  set slotStart(value: string) {
    this.slotDay = value ? value.slice(0, 10) : null;
    this.slotTime = value ? value.slice(11, 16) : null;
  }

  mode: WaitlistNotifyMode = this.auth.profile()?.waitlistNotifyMode ?? 'SEQUENTIAL';
  hours = this.auth.profile()?.waitlistResponseHours ?? 12;
  readonly hourOptions: PnOption<number>[] = [6, 12, 24, 48, 72].map((h) => ({ value: h, label: `${h} horas` }));

  constructor() {
    void this.store.load();
  }

  bands(entry: BusinessWaitlistEntry): string {
    if (entry.timeBands.length === 0) return 'Cualquier hora';
    return entry.timeBands.map((band) => BAND_LABEL[band]).join(' · ');
  }

  window(entry: BusinessWaitlistEntry): string {
    const from = shortDate(new Date(`${entry.dateFrom}T00:00:00`));
    const to = shortDate(new Date(`${entry.dateTo}T00:00:00`));
    return from === to ? from : `${from} – ${to}`;
  }

  length(entry: BusinessWaitlistEntry): string {
    return durationText(entry.serviceDuration);
  }

  pick(entry: BusinessWaitlistEntry | null): void {
    this.slotStart = '';
    this.offerResult.set(null);
    this.picked.set(entry);
  }

  /**
   * Offers the chosen slot for this entry's service (and worker, if they asked
   * for one). The server decides who in the queue fits and tells them.
   */
  async offer(entry: BusinessWaitlistEntry): Promise<void> {
    if (!this.slotStart) {
      this.toasts.error('Elige el día y la hora del hueco.');
      return;
    }
    const start = new Date(this.slotStart);
    if (Number.isNaN(start.getTime())) return;
    this.offering.set(true);
    try {
      // A worker offers a hole in their own agenda when the customer did not
      // ask for anyone (the server needs the professional in a team business).
      const workerId = entry.workerId ?? (this.auth.isWorker() ? (this.auth.profile()?.id ?? null) : null);
      const result = await this.store.offer(entry.serviceId, workerId, toIso(start));
      const text =
        result.message ||
        (result.notified > 0
          ? `Hemos avisado a ${result.notified} ${result.notified === 1 ? 'persona' : 'personas'}.`
          : 'No hay nadie en la lista a quien le encaje ese hueco.');
      this.offerResult.set(text);
      this.picked.set(this.store.all().find((item) => item.id === entry.id) ?? entry);
    } catch (cause) {
      this.toasts.error(serverReason(cause) || 'No se ha podido ofrecer el hueco.');
    } finally {
      this.offering.set(false);
    }
  }

  async move(entry: BusinessWaitlistEntry, direction: -1 | 1): Promise<void> {
    const ids = this.store.all().map((item) => item.id);
    const index = ids.indexOf(entry.id);
    const target = index + direction;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    try {
      await this.store.reorder(ids);
    } catch {
      this.toasts.error('No se ha podido cambiar el orden.');
    }
  }

  async remove(entry: BusinessWaitlistEntry): Promise<void> {
    // Mandatory: the customer hears about it, and this text is the only thing
    // they will read, because their entry disappears from their own list.
    const answer = await this.confirm.ask({
      title: '¿Quitar de la lista?',
      message: `${entry.customerName} dejará de estar en la lista y no recibirá avisos de huecos libres.`,
      confirmLabel: 'Quitar',
      destructive: true,
      reason: {
        label: 'Motivo',
        placeholder: 'Ej.: cerramos esa semana',
        hint: 'Se lo decimos con tu motivo dentro: es lo único que va a leer, porque su espera desaparece de su lista.',
        required: true,
      },
    });
    if (!answer.ok) return;
    try {
      await this.store.remove(entry.id, answer.reason);
      this.pick(null);
      this.toasts.show('Fuera de la lista');
    } catch {
      this.toasts.error('No se ha podido quitar de la lista.');
    }
  }

  async saveSettings(): Promise<void> {
    this.busy.set(true);
    try {
      await this.store.saveSettings(this.mode, this.hours);
      this.settingsOpen.set(false);
      this.toasts.show('Guardado');
    } catch {
      this.toasts.error('No se pudo guardar. Revisa tu conexión.');
    } finally {
      this.busy.set(false);
    }
  }
}
