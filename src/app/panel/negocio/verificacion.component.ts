import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BusinessVerification } from '../core/api/models';
import { message } from '../core/data/resource';
import { SetupStore } from '../core/data/setup.store';
import { VerificationStore } from '../core/data/verification.store';
import { fromInstant } from '../core/util/dates';
import { ConfirmService } from '../ui/confirm.service';
import { PnErrorComponent } from '../ui/controls';
import { PnDialogComponent } from '../ui/dialog.component';
import { PnSetupStepsComponent } from '../ui/setup-steps.component';
import { ToastService } from '../ui/toast.service';
import { PnVerifiedBadgeComponent } from '../ui/verified-badge.component';

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/**
 * `/panel/negocio/verificacion` — `verification_screen.dart`.
 *
 * It explains what the seal is and the three steps, lets the business ask for
 * it and then says where it stands. The requirements arrive evaluated and are
 * only grouped here: the profile on one side and payments on the other, which
 * is how the business understands them and where they get fixed.
 */
@Component({
  selector: 'app-panel-verificacion',
  standalone: true,
  imports: [RouterLink, PnDialogComponent, PnErrorComponent, PnSetupStepsComponent, PnVerifiedBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="pn-main">
      <a class="pn-btn pn-btn--text pn-btn--sm vf-back" routerLink="/panel/negocio">
        <span class="material-symbols-rounded">arrow_back</span>Tu ficha
      </a>

      <div class="pn-head">
        <div class="pn-head__text"><h1>Verificación</h1></div>
      </div>

      @if (store.state.value(); as verification) {
        <div class="vf">
          <section class="vf__status">
            <pn-verified-badge [size]="56" [tone]="sealTone()" [label]="header().title" />
            <h2>{{ header().title }}</h2>
            <p>{{ header().body }}</p>
          </section>

          @if (note(); as text) {
            <div class="pn-notice pn-notice--warn vf__note" role="status">
              <span class="material-symbols-rounded">info</span>
              <div>{{ text }}</div>
            </div>
          }

          <div class="pn-group vf__steps">
            <p class="pn-group__head">Cómo conseguirlo</p>
            <div class="pn-group__body">
              @if (profileDone()) {
                <div class="pn-row">
                  <span class="vf__mark vf__mark--done"><span class="material-symbols-rounded fill">check_circle</span></span>
                  <span class="pn-row__main"><span class="pn-row__title">Completa tu perfil</span></span>
                  <span class="sr-only">Hecho</span>
                </div>
              } @else {
                <button type="button" class="pn-row" (click)="guideOpen.set(true)">
                  <span class="vf__mark">1</span>
                  <span class="pn-row__main"><span class="pn-row__title">Completa tu perfil</span></span>
                  <span class="sr-only">Pendiente</span>
                  <span class="material-symbols-rounded pn-row__chev">arrow_forward_ios</span>
                </button>
              }

              @if (paymentsDone()) {
                <div class="pn-row">
                  <span class="vf__mark vf__mark--done"><span class="material-symbols-rounded fill">check_circle</span></span>
                  <span class="pn-row__main"><span class="pn-row__title">Activa los cobros</span></span>
                  <span class="sr-only">Hecho</span>
                </div>
              } @else {
                <a class="pn-row" routerLink="/panel/ajustes/cobros">
                  <span class="vf__mark">2</span>
                  <span class="pn-row__main"><span class="pn-row__title">Activa los cobros</span></span>
                  <span class="sr-only">Pendiente</span>
                  <span class="material-symbols-rounded pn-row__chev">arrow_forward_ios</span>
                </a>
              }

              <!-- Nothing to open: this step is done by Bipsy, on no screen. -->
              <div class="pn-row">
                @if (verification.status === 'VERIFIED') {
                  <span class="vf__mark vf__mark--done"><span class="material-symbols-rounded fill">check_circle</span></span>
                } @else {
                  <span class="vf__mark">3</span>
                }
                <span class="pn-row__main">
                  <span class="pn-row__title">Revisamos tu negocio</span>
                  @if (reviewState(); as state) {
                    <span class="pn-row__sub">{{ state }}</span>
                  }
                </span>
                <span class="sr-only">{{ verification.status === 'VERIFIED' ? 'Hecho' : 'Pendiente' }}</span>
              </div>
            </div>
          </div>

          @if (store.stillOpen()) {
            <button
              type="button"
              class="pn-btn pn-btn--primary pn-btn--block"
              [disabled]="!verification.canRequest || sending()"
              (click)="request()"
            >
              @if (sending()) {
                <span class="pn-spinner"></span>
              } @else {
                <span class="material-symbols-rounded">verified</span>Solicitar verificación
              }
            </button>
          }
        </div>
      } @else if (store.state.error()) {
        <pn-error title="No hemos podido cargar la verificación." [text]="store.state.error() ?? ''" (retry)="store.state.reload()" />
      } @else {
        <div class="pn-skeleton" style="height:360px"></div>
      }
    </main>

    @if (guideOpen()) {
      <pn-dialog
        [title]="setup.complete() ? 'Tu perfil está listo' : 'Completa el perfil de tu negocio'"
        (closed)="guideOpen.set(false)"
      >
        <div class="pn-fg vf__guide">
          <div class="pn-fg__body">
            <div class="vf__guide-top">
              <p class="vf__guide-sub">
                {{ setup.complete() ? 'No te falta nada.' : 'Un perfil completo se enseña más y se reserva más.' }}
              </p>
              <div class="vf__guide-bar" role="img" [attr.aria-label]="'Completado: ' + setup.doneCount() + ' de ' + setup.total()">
                <div class="pn-bar"><div class="pn-bar__fill" [style.width.%]="setup.progress() * 100"></div></div>
                <span class="pn-tabular">{{ setup.doneCount() }}/{{ setup.total() }}</span>
              </div>
            </div>
            <pn-setup-steps class="vf__guide-list" [steps]="setup.steps()" (opened)="guideOpen.set(false)" />
          </div>
        </div>
        <ng-container dialogActions>
          <button type="button" class="pn-btn pn-btn--secondary" (click)="guideOpen.set(false)">Hecho</button>
        </ng-container>
      </pn-dialog>
    }
  `,
  styles: [
    `
      :host { display: block; }
      .vf-back { margin: 0 0 14px -12px; text-decoration: none; }
      .vf { max-width: 560px; margin-inline: auto; }
      .vf__status { display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center; padding: 8px 0 4px; }
      .vf__status h2 {
        margin-top: 6px;
        font-family: var(--ff-display);
        font-size: 1.5rem;
        font-weight: 800;
        letter-spacing: -0.6px;
      }
      .vf__status p { font-size: 0.9375rem; line-height: 1.5; color: var(--clr-text-2); }
      .vf__note { margin-top: 18px; }
      .vf__steps { margin-top: 24px; margin-bottom: 20px; }
      .vf__mark {
        display: grid;
        place-items: center;
        flex: none;
        width: 26px;
        height: 26px;
        border-radius: 50%;
        background: var(--pn-field);
        font-size: 0.8125rem;
        font-weight: 800;
      }
      .vf__mark--done { background: transparent; color: var(--clr-success); }
      .vf__mark--done .material-symbols-rounded { font-size: 26px; }
      /* One card, as the app's checklist: how far along on top, the steps under it. */
      .vf__guide { margin-bottom: 0; }
      .vf__guide-top { padding: 14px 16px; border-bottom: 1px solid var(--pn-line); }
      .vf__guide-sub { font-size: 0.875rem; line-height: 1.5; color: var(--clr-text-2); }
      .vf__guide-bar { display: flex; align-items: center; gap: 12px; margin-top: 10px; font-size: 0.8125rem; font-weight: 700; color: var(--clr-text-2); }
      .vf__guide-bar .pn-bar { flex: 1; height: 6px; }
      .vf__guide-list { display: block; }
    `,
  ],
})
export class VerificacionComponent {
  readonly store = inject(VerificationStore);
  readonly setup = inject(SetupStore);
  private readonly confirm = inject(ConfirmService);
  private readonly toasts = inject(ToastService);

  readonly sending = signal(false);
  readonly guideOpen = signal(false);

  private readonly verification = this.store.state.value;

  constructor() {
    // The store outlives the screen: without this it would open on whatever
    // was true the last time it was asked.
    void this.store.refresh();
  }

  /**
   * Everything but payments is step 1. The confirmed email counts here even
   * though the guide does not list it: it is part of having the account in order.
   */
  readonly profileDone = computed(() =>
    (this.verification()?.requirements ?? []).filter((r) => r.code !== 'PAYMENTS').every((r) => r.met),
  );

  readonly paymentsDone = computed(() =>
    (this.verification()?.requirements ?? []).filter((r) => r.code === 'PAYMENTS').every((r) => r.met),
  );

  /** Granted and visible, what the customer sees; denied, red; otherwise off. */
  readonly sealTone = computed<'brand' | 'muted' | 'danger'>(() => {
    const verification = this.verification();
    if (verification?.verified) return 'brand';
    return verification?.status === 'REJECTED' ? 'danger' : 'muted';
  });

  readonly header = computed(() => headerOf(this.verification()));

  /** The reason for a rejection or revocation, or why the seal is not showing. */
  readonly note = computed<string | null>(() => {
    const verification = this.verification();
    if (!verification) return null;
    const note = verification.note?.trim();
    switch (verification.status) {
      case 'VERIFIED':
        return verification.verified
          ? null
          : 'El sello está oculto porque los cobros no están activos. En cuanto vuelvan, reaparecerá solo.';
      case 'REJECTED':
        return note ? `Motivo: ${note}` : null;
      case 'NONE':
        return note ? `Retiramos tu verificación: ${note}` : null;
      default:
        return null;
    }
  });

  readonly reviewState = computed(() => {
    const status = this.verification()?.status;
    if (status === 'PENDING') return 'En revisión';
    return status === 'REJECTED' ? 'Denegada' : null;
  });

  async request(): Promise<void> {
    const answer = await this.confirm.ask({
      title: '¿Solicitar la verificación?',
      message: 'Revisaremos tu perfil y te avisaremos de la respuesta.',
      confirmLabel: 'Solicitar verificación',
      cancelLabel: 'Cancelar',
    });
    if (!answer.ok) return;

    this.sending.set(true);
    try {
      await this.store.request();
      this.toasts.show('Solicitud enviada. Te avisaremos en cuanto la revisemos.');
    } catch (cause) {
      // A 409 carries the reason in plain words, and reading the state again
      // leaves the screen saying the same.
      void this.store.state.reload();
      this.toasts.error(message(cause));
    } finally {
      this.sending.set(false);
    }
  }
}

function headerOf(verification: BusinessVerification | null): { title: string; body: string } {
  switch (verification?.status) {
    case 'PENDING': {
      const at = verification.requestedAt ? fromInstant(verification.requestedAt) : null;
      return {
        title: 'Lo estamos revisando',
        body: at
          ? `La pediste el ${at.getDate()} de ${MONTHS[at.getMonth()]}. Te avisaremos en cuanto la revisemos.`
          : 'Te avisaremos en cuanto la revisemos.',
      };
    }
    case 'VERIFIED':
      return { title: 'Tu negocio está verificado', body: 'Tus clientes ven el sello junto a tu nombre.' };
    case 'REJECTED':
      return {
        title: 'No hemos podido verificarte',
        body: verification.canRequest
          ? 'Revisa lo que te indicamos y, cuando esté listo, vuelve a pedirla.'
          : 'Revisa lo que te indicamos y vuelve a pedirla cuando esté listo.',
      };
    default:
      return verification?.canRequest
        ? { title: 'Ya puedes pedirla', body: 'Lo tienes todo. Pide la verificación y revisaremos tu perfil.' }
        : {
            title: 'Verificado por Bipsy',
            body: 'Es un sello junto a tu nombre en tu ficha y en Explorar. Le dice al cliente que hemos revisado tu negocio y que puede reservar con confianza.',
          };
  }
}
