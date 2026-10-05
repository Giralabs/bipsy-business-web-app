import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../core/api/api';
import { PaymentRefund, PaymentRefundable, PayoutPayment } from '../core/api/models';
import { message } from '../core/data/resource';
import { fromInstant } from '../core/util/dates';
import { money } from '../core/util/format';
import { PnDialogComponent } from '../ui/dialog.component';

/**
 * `payment_refund_sheet.dart`: give back money from a charge.
 *
 * The charge itself is never touched — a separate refund is created and the
 * history keeps telling what happened. Stripe's fee of the original charge
 * does not come back, so it is said in euros BEFORE confirming.
 */
@Component({
  selector: 'app-payout-refund-dialog',
  standalone: true,
  imports: [FormsModule, PnDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <pn-dialog title="Devolver" (closed)="closed.emit(false)">
      <p class="pn-dim subtitle">{{ payment.concept }}</p>

      @if (loadError(); as text) {
        <div class="pn-notice pn-notice--error">
          <span class="material-symbols-rounded">error</span>
          <div>
            <strong>No se ha podido consultar este cobro.</strong>
            <span class="pn-notice__body">{{ text }}</span>
          </div>
        </div>
      } @else if (!info()) {
        <div class="pn-skeleton" style="height:160px"></div>
      } @else if (!info()!.canRefund) {
        <p class="pn-dim body">{{ info()!.blockedReason || 'Este cobro no se puede devolver.' }}</p>
      } @else {
        <div class="pn-group">
          <div class="pn-group__body">
            <div class="pn-row">
              <span class="pn-row__main"><span class="pn-row__title pn-dim">Se cobró</span></span>
              <span class="pn-row__value pn-tabular">{{ money(info()!.amountCents) }}</span>
            </div>
            @if (info()!.alreadyRefundedCents > 0) {
              <div class="pn-row">
                <span class="pn-row__main"><span class="pn-row__title pn-dim">Ya devuelto</span></span>
                <span class="pn-row__value pn-tabular">{{ money(info()!.alreadyRefundedCents) }}</span>
              </div>
            }
            <div class="pn-row">
              <span class="pn-row__main"><span class="pn-row__title"><strong>Queda por devolver</strong></span></span>
              <span class="pn-row__value pn-tabular"><strong>{{ money(info()!.refundableCents) }}</strong></span>
            </div>
          </div>
          @if (footnote()) {
            <p class="pn-group__foot">{{ footnote() }}</p>
          }
        </div>

        <label class="pn-field">
          <span class="pn-field__label">Importe a devolver</span>
          <input class="pn-input pn-tabular" name="amount" inputmode="decimal" autocomplete="off"
                 [placeholder]="plain(info()!.refundableCents)" [disabled]="busy()"
                 [ngModel]="amountText()" (ngModelChange)="amountText.set($event)" />
          <button type="button" class="pn-btn pn-btn--text pn-btn--sm all" [disabled]="busy()"
                  (click)="amountText.set(plain(info()!.refundableCents))">
            Todo: {{ money(info()!.refundableCents) }}
          </button>
        </label>

        <label class="pn-field">
          <span class="pn-field__label">Motivo (opcional)</span>
          <textarea class="pn-textarea" rows="2" name="reason" maxlength="300" placeholder="Por qué se devuelve"
                    [disabled]="busy()" [(ngModel)]="reason"></textarea>
        </label>
      }

      @if (history().length > 0) {
        <p class="pn-group__head">Devoluciones</p>
        <div class="pn-group__body history">
          @for (refund of history(); track refund.id) {
            <div class="pn-row">
              <span class="pn-row__main">
                <span class="pn-row__title">{{ money(refund.amountCents) }}</span>
                <span class="pn-row__sub">
                  {{ day(refund.createdAt) }}@if (refund.reason) { · {{ refund.reason }} }
                  @if (refund.status !== 'SUCCEEDED' && refund.failureReason) { · {{ refund.failureReason }} }
                </span>
              </span>
              <span class="pn-status" [class]="'pn-status pn-status--' + refundTone(refund.status)">
                {{ refundLabel(refund.status) }}
              </span>
            </div>
          }
        </div>
      }

      @if (error(); as text) {
        <p class="pn-field__error" role="alert">{{ text }}</p>
      }

      <ng-container dialogActions>
        @if (info() && !info()!.canRefund) {
          <button type="button" class="pn-btn pn-btn--primary" (click)="closed.emit(false)">Entendido</button>
        } @else {
          <button type="button" class="pn-btn pn-btn--secondary" (click)="closed.emit(false)">Cancelar</button>
          @if (info()) {
            <button type="button" class="pn-btn pn-btn--danger" [disabled]="!valid() || busy()" (click)="submit()">
              @if (busy()) { <span class="pn-spinner"></span> } @else { Devolver {{ money(total()) }} }
            </button>
          }
        }
      </ng-container>
    </pn-dialog>
  `,
  styles: [
    `
      .subtitle { margin: -6px 0 16px; }
      .body { line-height: 1.55; }
      .all { margin-top: 6px; align-self: flex-start; }
      .history { margin-bottom: 14px; }
    `,
  ],
})
export class PayoutRefundDialogComponent implements OnInit {
  private readonly api = inject(Api);
  readonly money = money;

  @Input({ required: true }) payment!: PayoutPayment;
  /** True when some money went back. */
  @Output() closed = new EventEmitter<boolean>();

  readonly info = signal<PaymentRefundable | null>(null);
  readonly history = signal<PaymentRefund[]>([]);
  readonly loadError = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly busy = signal(false);

  /** Starts empty on purpose: refunding is a decision, not a default. */
  readonly amountText = signal('');
  reason = '';

  readonly total = computed(() => {
    const typed = toCents(this.amountText());
    return typed > 0 ? typed : (this.info()?.refundableCents ?? 0);
  });

  readonly valid = computed(() => {
    const info = this.info();
    return !!info && info.canRefund && this.total() > 0 && this.total() <= info.refundableCents;
  });

  readonly footnote = computed(() => {
    const info = this.info();
    if (!info) return '';
    const parts: string[] = [];
    if (info.feeLostCents > 0) {
      parts.push(
        `Tu cliente recibirá el importe íntegro. La comisión de ${money(info.feeLostCents)} del cobro ` +
          'original no vuelve: esa parte la pones tú.',
      );
    }
    if (info.warning) parts.push(info.warning);
    return parts.join(' ');
  });

  ngOnInit(): void {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      const [info, history] = await Promise.all([
        this.api.get<PaymentRefundable>(`/businesses/me/payouts/payments/${this.payment.id}/refundable`),
        this.api
          .get<PaymentRefund[]>(`/businesses/me/payouts/payments/${this.payment.id}/refunds`)
          .catch(() => [] as PaymentRefund[]),
      ]);
      this.info.set(info);
      this.history.set([...history].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    } catch (cause) {
      this.loadError.set(message(cause));
    }
  }

  async submit(): Promise<void> {
    const info = this.info();
    if (!info || !this.valid()) return;
    this.busy.set(true);
    this.error.set(null);
    const amount = this.total();
    const reason = this.reason.trim();
    try {
      // `amountCents` null means "all that is left"; sent only when partial.
      const result = await this.api.post<PaymentRefund>(
        `/businesses/me/payouts/payments/${this.payment.id}/refunds`,
        {
          ...(amount < info.refundableCents ? { amountCents: amount } : {}),
          ...(reason ? { reason } : {}),
        },
      );
      // A refund Stripe rejects still answers 200: the reason travels inside
      // and has to be shown here, not swallowed by closing the dialog.
      if (result.status !== 'SUCCEEDED') {
        this.error.set(result.failureReason || 'No se ha podido devolver el dinero.');
        this.history.set([result, ...this.history()]);
        return;
      }
      this.closed.emit(true);
    } catch (cause) {
      const status = (cause as { status?: number }).status;
      this.error.set(status === 0 ? 'Revisa tu conexión.' : message(cause));
    } finally {
      this.busy.set(false);
    }
  }

  /** «12,50», the value the amount box takes. */
  plain(cents: number): string {
    return (cents / 100).toFixed(2).replace('.', ',');
  }

  day(instant: string): string {
    return ddmmyyyy(fromInstant(instant));
  }

  refundLabel(status: string): string {
    return status === 'SUCCEEDED' ? 'Devuelto' : status === 'PENDING' ? 'En curso' : 'Fallida';
  }

  refundTone(status: string): string {
    return status === 'SUCCEEDED' ? 'success' : status === 'PENDING' ? 'warn' : 'danger';
  }
}

/** «12,5» / «12.50» / «12» → cents. Anything unreadable is 0. */
function toCents(text: string): number {
  const clean = text.replace(/[€\s]/g, '').replace(',', '.');
  if (!clean) return 0;
  const value = Number(clean);
  return Number.isFinite(value) && value > 0 ? Math.round(value * 100) : 0;
}

export function ddmmyyyy(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}
