import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Api } from '../core/api/api';
import { CreateTicketRequest, SupportTicket, SupportTicketKind } from '../core/api/models';
import { message } from '../core/data/resource';
import { SUPPORT_RESPONSE_TIME } from '../../data/site.data';
import { ToastService } from '../ui/toast.service';

/** `SupportTicketService.MAX_ATTACHMENTS` and `LocalPrivateFileStorage.MAX_SIZE`. */
const MAX_ATTACHMENTS = 4;
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'pdf', 'doc', 'docx', 'txt', 'csv'];

/**
 * `/panel/soporte` — `support_screen.dart` and `GipsiNewTicketScreen`.
 *
 * The same form serves «necesito ayuda» and «se me ocurre una mejora»: the kind
 * travels with the ticket, and only the words change.
 *
 * With files, the order matters: create with `deferNotice`, upload one by one,
 * then `POST …/notify`, or the copy to the support inbox leaves without them. If
 * that last call fails nothing is said: everything is saved and a server sweep
 * sends what was left halfway, while an error would make them send it twice.
 *
 * It is sent and done, with no list to come back to: the conversation goes on by
 * e-mail.
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
          @if (sent()) {
            <div class="pn-empty">
              <span class="material-symbols-rounded">check_circle</span>
              <h3>¡Gracias!</h3>
              <p>
                {{ kind() === 'IMPROVEMENT'
                  ? 'Tu idea ya está con nosotros. La leemos y cuenta para decidir en qué trabajamos.'
                  : 'Ya lo estamos mirando. Te hemos mandado una copia por correo y te contestamos ahí.' }}
              </p>
              @if (notUploaded(); as names) {
                <p class="pn-field__error" role="alert">No se pudieron subir: {{ names }}.</p>
              }
              <button type="button" class="pn-btn pn-btn--secondary" (click)="reset()">Enviar otro</button>
            </div>
          } @else {
            <div class="kinds">
              <button type="button" class="pn-chip" [attr.aria-pressed]="kind() === 'SUPPORT'" [disabled]="busy()"
                      (click)="kind.set('SUPPORT')">
                <span class="material-symbols-rounded">confirmation_number</span>Nuevo ticket
              </button>
              <button type="button" class="pn-chip" [attr.aria-pressed]="kind() === 'IMPROVEMENT'" [disabled]="busy()"
                      (click)="kind.set('IMPROVEMENT')">
                <span class="material-symbols-rounded">lightbulb</span>Nueva solicitud
              </button>
            </div>

            <p class="pn-dim lead">
              {{ kind() === 'IMPROVEMENT'
                ? 'Gracias por ayudarnos a mejorar Bipsy. Cuéntanos qué le falta para tu negocio: leemos todas las solicitudes. Si algo no funciona, abre un ticket de soporte.'
                : 'Cuéntanos qué ha pasado y te llegará una copia al correo de tu cuenta: por ahí te contestamos. Si es una idea para mejorar Bipsy, mejor mándala como solicitud.' }}
            </p>

            <label class="pn-field">
              <span class="pn-field__label">Asunto <span class="pn-muted">· opcional</span></span>
              <input class="pn-input" type="text" name="subject" maxlength="150" [disabled]="busy()"
                     [placeholder]="kind() === 'IMPROVEMENT' ? 'Resume tu idea' : 'Resume el problema'"
                     [ngModel]="subject()" (ngModelChange)="subject.set($event)" />
            </label>

            <label class="pn-field">
              <span class="pn-field__label">Descripción</span>
              <textarea class="pn-textarea" rows="7" name="body" maxlength="4000" [disabled]="busy()"
                        [placeholder]="kind() === 'IMPROVEMENT'
                          ? 'Cuéntanos qué necesitas y para qué te serviría en tu día a día. Cuanto más concreto, mejor.'
                          : 'Cuéntanos qué ha pasado, en qué pantalla y qué esperabas que ocurriera.'"
                        [ngModel]="body()" (ngModelChange)="body.set($event)"></textarea>
            </label>

            <div class="pn-group">
              <p class="pn-group__head">Adjuntos (opcional) · {{ files().length }}/{{ maxFiles }}</p>
              <div class="pn-group__body">
                @for (file of files(); track file) {
                  <div class="pn-row">
                    <span class="material-symbols-rounded pn-row__icon">
                      {{ file.type.startsWith('image/') ? 'image' : 'description' }}
                    </span>
                    <span class="pn-row__main">
                      <span class="pn-row__title">{{ file.name }}</span>
                      <span class="pn-row__sub">{{ size(file.size) }}</span>
                    </span>
                    <button type="button" class="pn-btn pn-btn--text pn-btn--sm" [disabled]="busy()"
                            [attr.aria-label]="'Quitar ' + file.name" (click)="remove(file)">
                      <span class="material-symbols-rounded">close</span>
                    </button>
                  </div>
                }
                @if (files().length < maxFiles) {
                  <label class="pn-row add">
                    <span class="material-symbols-rounded pn-row__icon">attach_file</span>
                    <span class="pn-row__main"><span class="pn-row__title">Añadir archivo</span></span>
                    <input type="file" hidden multiple [accept]="accept" [disabled]="busy()" (change)="pick($event)" />
                  </label>
                }
              </div>
              <p class="pn-group__foot">
                Imágenes (JPG, PNG, WebP, HEIC) o documentos (PDF, Word, TXT, CSV). Máximo 10 MB por archivo.
              </p>
            </div>

            @if (error(); as text) { <p class="pn-field__error" role="alert">{{ text }}</p> }

            <button type="button" class="pn-btn pn-btn--primary pn-btn--block"
                    [disabled]="!canSend()" (click)="send()">
              @if (busy() && files().length) {
                Subiendo {{ uploaded() }} de {{ files().length }}…
              } @else if (busy()) {
                <span class="pn-spinner"></span>
              } @else {
                {{ kind() === 'IMPROVEMENT' ? 'Enviar solicitud' : 'Enviar ticket' }}
              }
            </button>
          }
        </section>

        <section class="pn-col-5">
          <div class="pn-group">
            <p class="pn-group__head">Contacto directo</p>
            <div class="pn-group__body">
              <a class="pn-row" href="tel:+34601802122">
                <span class="material-symbols-rounded pn-row__icon">phone</span>
                <span class="pn-row__main">
                  <span class="pn-row__title">+34 601 80 21 22</span>
                  <span class="pn-row__sub">Lunes a viernes, 9:00 - 18:00</span>
                </span>
              </a>
              <a class="pn-row" href="mailto:soporte@bipsy.es">
                <span class="material-symbols-rounded pn-row__icon">mail</span>
                <span class="pn-row__main">
                  <span class="pn-row__title">soporte&#64;bipsy.es</span>
                  <span class="pn-row__sub">Respuesta en 24-48 h laborables</span>
                </span>
              </a>
            </div>
            <p class="pn-group__foot">Si prefieres, llámanos o escríbenos directamente.</p>
          </div>

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
      .kinds { display: flex; gap: 8px; margin-bottom: 14px; flex-wrap: wrap; }
      .lead { font-size: 0.875rem; line-height: 1.55; margin-bottom: 18px; }
      .add { cursor: pointer; }
    `,
  ],
})
export class SoporteComponent {
  private readonly api = inject(Api);
  private readonly toasts = inject(ToastService);

  readonly responseTime = SUPPORT_RESPONSE_TIME;
  readonly maxFiles = MAX_ATTACHMENTS;
  readonly accept = ACCEPTED_EXTENSIONS.map((extension) => `.${extension}`).join(',');

  readonly kind = signal<SupportTicketKind>('SUPPORT');
  readonly subject = signal('');
  readonly body = signal('');
  readonly files = signal<File[]>([]);
  readonly uploaded = signal(0);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly sent = signal(false);
  /** Files left behind on a ticket that did go through: said by name, not as an error. */
  readonly notUploaded = signal('');

  readonly canSend = computed(() => !this.busy() && !!this.body().trim());

  pick(event: Event): void {
    const input = event.target as HTMLInputElement;
    const chosen = Array.from(input.files ?? []);
    // So that choosing the same file again after removing it fires `change`.
    input.value = '';
    this.error.set(null);
    for (const file of chosen) {
      if (this.files().length >= MAX_ATTACHMENTS) break;
      const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
      if (!ACCEPTED_EXTENSIONS.includes(extension)) {
        this.toasts.error('Formato no admitido. Usa PDF, Word, TXT o CSV.');
      } else if (file.size > MAX_ATTACHMENT_BYTES) {
        this.toasts.error(`El archivo pesa ${this.size(file.size)}. El máximo es 10 MB.`);
      } else {
        this.files.update((list) => [...list, file]);
      }
    }
  }

  remove(file: File): void {
    this.files.update((list) => list.filter((entry) => entry !== file));
  }

  size(bytes: number): string {
    return bytes < 1024 * 1024
      ? `${Math.max(1, Math.round(bytes / 1024))} KB`
      : `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
  }

  async send(): Promise<void> {
    if (!this.canSend()) return;
    this.busy.set(true);
    this.uploaded.set(0);
    this.error.set(null);
    const files = this.files();
    try {
      const subject = this.subject().trim();
      const request: CreateTicketRequest = {
        ...(subject ? { subject } : {}),
        description: this.body().trim(),
        kind: this.kind(),
        ...(files.length ? { deferNotice: true } : {}),
      };
      const ticket = await this.api.post<SupportTicket>('/support/tickets', request);

      // The ticket exists now: a file that fails does not lose the message.
      const failed: string[] = [];
      for (const file of files) {
        try {
          await this.api.upload(`/support/tickets/${ticket.id}/attachments`, file);
          this.uploaded.update((done) => done + 1);
        } catch {
          failed.push(file.name);
        }
      }
      if (files.length) {
        try {
          await this.api.post(`/support/tickets/${ticket.id}/notify`);
        } catch {
          // See the class comment: the server's sweep covers this.
        }
      }
      this.notUploaded.set(failed.join(', '));
      this.sent.set(true);
    } catch (cause) {
      this.error.set(message(cause) || 'No se pudo enviar. Inténtalo de nuevo.');
    } finally {
      this.busy.set(false);
    }
  }

  reset(): void {
    this.subject.set('');
    this.body.set('');
    this.files.set([]);
    this.notUploaded.set('');
    this.error.set(null);
    this.sent.set(false);
  }
}
