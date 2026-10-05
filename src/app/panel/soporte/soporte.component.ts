import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Api } from '../core/api/api';
import { CreateTicketRequest, SupportTicket } from '../core/api/models';
import { SUPPORT_RESPONSE_TIME } from '../../data/site.data';
import { ToastService } from '../ui/toast.service';

/**
 * `/panel/soporte` — `support_screen.dart` and `new_ticket_screen.dart`.
 *
 * The same screen serves «necesito ayuda» and «se me ocurre una mejora»: the
 * kind travels with the ticket, which is how the app tells them apart
 * (`SupportTicketKind.improvement`).
 */
@Component({
  selector: 'app-panel-soporte',
  standalone: true,
  imports: [FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="pn-main">
      <div class="pn-head">
        <div class="pn-head__text">
          <p class="pn-head__greet">Te contestamos en {{ responseTime }}</p>
          <h1>Soporte</h1>
        </div>
      </div>

      <div class="pn-grid">
        <section class="pn-card pn-col-7">
          <div class="pn-block__head">
            <span class="material-symbols-rounded">edit_note</span>
            <h2>Cuéntanos qué pasa</h2>
          </div>

          <div class="kinds">
            <button type="button" class="pn-chip" [attr.aria-pressed]="kind === 'SUPPORT'"
                    (click)="kind = 'SUPPORT'">
              <span class="material-symbols-rounded">help</span>Necesito ayuda
            </button>
            <button type="button" class="pn-chip" [attr.aria-pressed]="kind === 'IMPROVEMENT'"
                    (click)="kind = 'IMPROVEMENT'">
              <span class="material-symbols-rounded">lightbulb</span>Propongo una mejora
            </button>
          </div>

          <label class="pn-field">
            <span class="pn-field__label">Asunto</span>
            <input class="pn-input" type="text" name="subject" maxlength="150"
                   placeholder="No me llegan los avisos de reserva" [(ngModel)]="subject" />
          </label>

          <label class="pn-field">
            <span class="pn-field__label">Cuéntanoslo</span>
            <textarea class="pn-textarea" rows="7" name="body" maxlength="4000"
                      placeholder="Cuanto más concreto, antes lo resolvemos: qué hacías, qué esperabas y qué pasó."
                      [(ngModel)]="body"></textarea>
          </label>

          <button type="button" class="pn-btn pn-btn--primary pn-btn--block"
                  [disabled]="busy()" (click)="send()">
            @if (busy()) { <span class="pn-spinner"></span> } @else { Enviar }
          </button>
        </section>

        <section class="pn-col-5">
          <div class="pn-group">
            <p class="pn-group__head">Antes de escribirnos</p>
            <div class="pn-group__body">
              <a class="pn-row" routerLink="/ayuda">
                <span class="material-symbols-rounded pn-row__icon">help_center</span>
                <span class="pn-row__main">
                  <span class="pn-row__title">Centro de ayuda</span>
                  <span class="pn-row__sub">Las dudas más frecuentes, ya contestadas.</span>
                </span>
                <span class="material-symbols-rounded pn-row__chev">arrow_forward_ios</span>
              </a>
              <a class="pn-row" routerLink="/panel/ajustes/reservas">
                <span class="material-symbols-rounded pn-row__icon">event_available</span>
                <span class="pn-row__main">
                  <span class="pn-row__title">Reglas de reserva</span>
                  <span class="pn-row__sub">Muchas dudas de «no me pueden reservar» se resuelven aquí.</span>
                </span>
                <span class="material-symbols-rounded pn-row__chev">arrow_forward_ios</span>
              </a>
            </div>
          </div>
        </section>
      </div>
    </main>
  `,
  styles: [
    `
      :host { display: block; }
      .kinds { display: flex; gap: 8px; margin-bottom: 18px; flex-wrap: wrap; }
    `,
  ],
})
export class SoporteComponent {
  private readonly api = inject(Api);
  private readonly toasts = inject(ToastService);

  readonly responseTime = SUPPORT_RESPONSE_TIME;

  kind: 'SUPPORT' | 'IMPROVEMENT' = 'SUPPORT';
  subject = '';
  body = '';
  readonly busy = signal(false);

  async send(): Promise<void> {
    if (!this.subject.trim() || !this.body.trim()) {
      this.toasts.error('Pon un asunto y cuéntanos qué pasa.');
      return;
    }
    if (this.subject.trim().length > 150 || this.body.trim().length > 4000) {
      this.toasts.error('El asunto admite 150 caracteres y el mensaje 4000.');
      return;
    }
    this.busy.set(true);
    try {
      const request: CreateTicketRequest = {
        subject: this.subject.trim(),
        description: this.body.trim(),
        kind: this.kind,
      };
      await this.api.post<SupportTicket>('/support/tickets', request);
      this.subject = '';
      this.body = '';
      this.toasts.show('Enviado. Te contestamos por correo.');
    } catch {
      this.toasts.error('No se ha podido enviar. Inténtalo otra vez.');
    } finally {
      this.busy.set(false);
    }
  }
}
