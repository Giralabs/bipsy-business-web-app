import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../core/api/api';
import {
  ActivatePayoutsRequest,
  PayoutAccount,
  PayoutOwnerPrefill,
  UpdatePayoutDetailsRequest,
} from '../core/api/models';
import { AuthService } from '../core/auth/auth.service';
import { message } from '../core/data/resource';
import { dayKey } from '../core/util/dates';
import { ConfirmService } from '../ui/confirm.service';

/** The legal text the owner accepts. Opened outside the panel, on Stripe's own address. */
const STRIPE_TERMS_URL = 'https://stripe.com/es/legal/connect-account';

const PHONE = /^\+[0-9]{6,19}$/;

type Field = 'firstName' | 'lastName' | 'birth' | 'phone' | 'address' | 'city' | 'postalCode' | 'iban';

/**
 * The activation form of `payouts_screen.dart` (`_ActivationForm`).
 *
 * The whole onboarding is ours: no redirect to Stripe. The server opens the
 * connected account with these details, accepts Stripe's terms on the
 * owner's behalf (with the IP it sees) and answers with the final state.
 * Nothing typed here is stored by Bipsy.
 *
 * Con [prefill] el mismo formulario sirve para **corregir** una cuenta que ya
 * existe (`PUT /details`), que es lo que resuelve el rechazo más común —un
 * apellido o una fecha que no cuadran con el documento— sin fotos y sin salir
 * del panel. Entonces el IBAN pasa a ser opcional, las condiciones no se
 * vuelven a aceptar y cambiar de banco se pregunta antes.
 */
@Component({
  selector: 'app-payouts-form',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="pn-grid">
      <div class="pn-col-7">
        <p class="intro">
          @if (editing) {
            Revisa que todo coincida con tu DNI. Un apellido o una fecha que no cuadren es el motivo
            más habitual de que no podamos verificarte.
          } @else {
            Cobra con tarjeta en tu salón y al reservar. El dinero va directo a tu cuenta bancaria:
            Bipsy no se queda ninguna comisión.
          }
        </p>

        <form (ngSubmit)="submit()" novalidate>
          <div class="pn-group">
            <p class="pn-group__head">Titular</p>
            <section class="pn-card">
              <div class="two">
                <label class="pn-field">
                  <span class="pn-field__label">Nombre</span>
                  <input class="pn-input" name="firstName" autocomplete="given-name" maxlength="100"
                         placeholder="Tu nombre" [class.pn-input--invalid]="bad('firstName')"
                         [(ngModel)]="firstName" />
                  @if (bad('firstName')) { <span class="pn-field__error">Campo obligatorio.</span> }
                </label>
                <label class="pn-field">
                  <span class="pn-field__label">Apellidos</span>
                  <input class="pn-input" name="lastName" autocomplete="family-name" maxlength="100"
                         placeholder="Tus apellidos" [class.pn-input--invalid]="bad('lastName')"
                         [(ngModel)]="lastName" />
                  @if (bad('lastName')) { <span class="pn-field__error">Campo obligatorio.</span> }
                </label>
              </div>
              <div class="two">
                <label class="pn-field">
                  <span class="pn-field__label">Fecha de nacimiento</span>
                  <input class="pn-input" type="date" name="birth" autocomplete="bday"
                         [min]="minBirth" [max]="maxBirth" [class.pn-input--invalid]="bad('birth')"
                         [(ngModel)]="birth" />
                  @if (bad('birth')) { <span class="pn-field__error">Falta la fecha de nacimiento.</span> }
                </label>
                <label class="pn-field">
                  <span class="pn-field__label">Teléfono</span>
                  <input class="pn-input" type="tel" name="phone" autocomplete="tel" maxlength="20"
                         placeholder="+34600000000" [class.pn-input--invalid]="bad('phone')"
                         [(ngModel)]="phone" />
                  @if (bad('phone')) {
                    <span class="pn-field__error">
                      {{ phone.trim() ? 'Escríbelo con el prefijo del país, por ejemplo +34600000000.' : 'Campo obligatorio.' }}
                    </span>
                  }
                </label>
              </div>
              <label class="pn-field last">
                <span class="pn-field__label">DNI o NIE</span>
                <input class="pn-input" name="idNumber" maxlength="20" placeholder="Opcional"
                       [(ngModel)]="idNumber" />
              </label>
            </section>
            <p class="pn-group__foot">El DNI solo hace falta si Stripe no logra verificarte.</p>
          </div>

          <div class="pn-group">
            <p class="pn-group__head">Domicilio del titular</p>
            <section class="pn-card">
              <label class="pn-field">
                <span class="pn-field__label">Dirección</span>
                <input class="pn-input" name="address" autocomplete="address-line1" maxlength="200"
                       placeholder="Calle y número" [class.pn-input--invalid]="bad('address')"
                       [(ngModel)]="address" />
                @if (bad('address')) { <span class="pn-field__error">Campo obligatorio.</span> }
              </label>
              <div class="two">
                <label class="pn-field last">
                  <span class="pn-field__label">Ciudad</span>
                  <input class="pn-input" name="city" autocomplete="address-level2" maxlength="100"
                         placeholder="Ciudad" [class.pn-input--invalid]="bad('city')" [(ngModel)]="city" />
                  @if (bad('city')) { <span class="pn-field__error">Campo obligatorio.</span> }
                </label>
                <label class="pn-field last">
                  <span class="pn-field__label">C. P.</span>
                  <input class="pn-input" name="postalCode" autocomplete="postal-code" inputmode="numeric"
                         maxlength="10" placeholder="00000" [class.pn-input--invalid]="bad('postalCode')"
                         [(ngModel)]="postalCode" />
                  @if (bad('postalCode')) { <span class="pn-field__error">Campo obligatorio.</span> }
                </label>
              </div>
            </section>
            <p class="pn-group__foot">Si vives en otro sitio que el salón, cámbialo.</p>
          </div>

          <div class="pn-group">
            <p class="pn-group__head">Dónde quieres el dinero</p>
            <section class="pn-card">
              <label class="pn-field last">
                <span class="pn-field__label">IBAN</span>
                <!-- 42: people paste it in groups of four; the spaces must not eat digits.
                     Corrigiendo, el hueco dice en qué cuenta se está cobrando AHORA: Stripe
                     solo devuelve los cuatro últimos dígitos. -->
                <input class="pn-input pn-tabular" name="iban" maxlength="42" autocomplete="off"
                       [placeholder]="ibanPlaceholder()" [class.pn-input--invalid]="bad('iban')"
                       [(ngModel)]="iban" />
                @if (bad('iban')) {
                  <span class="pn-field__error">{{ ibanClean() ? 'Parece incompleto.' : 'Campo obligatorio.' }}</span>
                }
              </label>
            </section>
            <p class="pn-group__foot">
              @if (editing) {
                Déjalo vacío para seguir cobrando en la cuenta que ya tienes. Si escribes otra, el
                dinero pasará a ir ahí.
              } @else {
                La cuenta donde Stripe te ingresará los cobros.
              }
            </p>
          </div>

          <!-- Las condiciones solo al crear la cuenta: ya se aceptaron, con su fecha y su IP, y
               volver a pedirlas ensuciaría esa prueba con una segunda fecha que no corresponde a
               nada. -->
          @if (!editing) {
            <label class="terms">
              <input type="checkbox" name="terms" [disabled]="sending()" [(ngModel)]="acceptedTerms" />
              <span>
                Acepto el acuerdo de cuenta conectada de Stripe, que es quien procesa los cobros.
                <a [href]="termsUrl" target="_blank" rel="noopener">Leerlo</a>
              </span>
            </label>
          }

          @if (error(); as text) {
            <p class="pn-field__error form-error" role="alert">{{ text }}</p>
          }

          <button type="submit" class="pn-btn pn-btn--primary pn-btn--lg submit"
                  [disabled]="(!editing && !acceptedTerms) || sending()">
            @if (sending()) { <span class="pn-spinner"></span> } @else {
              <span class="material-symbols-rounded">check</span>{{ editing ? 'Guardar cambios' : 'Activar cobros' }}
            }
          </button>
        </form>
      </div>

      <div class="pn-col-5">
        <!-- Said BEFORE starting: finding out half way that the IBAN is missing is where people give
             up. Corrigiendo no hace falta: ya pasó por aquí una vez. -->
        @if (!editing) {
          <section class="pn-card need">
            <h3>Ten a mano</h3>
            <ul class="pn-dim">
              <li>Tu fecha de nacimiento</li>
              <li>El IBAN de tu cuenta bancaria</li>
              <li>Tu DNI, por si Stripe lo pide</li>
            </ul>
          </section>
        }
        <div class="pn-notice pn-notice--info">
          <span class="material-symbols-rounded">shield_lock</span>
          <div>
            <strong>No guardamos estos datos</strong>
            <span class="pn-notice__body">
              Viajan una sola vez hasta Stripe, que es quien verifica tu identidad y quien los custodia.
            </span>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      :host { display: block; }
      .intro { font-size: 0.9375rem; line-height: 1.6; margin-bottom: 18px; }
      .two { display: grid; grid-template-columns: 1fr 1fr; gap: 0 12px; }
      .last { margin-bottom: 0; }
      .terms { display: flex; gap: 10px; align-items: flex-start; margin: 8px 0 18px; font-size: 0.875rem; line-height: 1.5; cursor: pointer; }
      .terms input { margin-top: 3px; width: 18px; height: 18px; flex: none; accent-color: var(--pn-accent, currentColor); }
      .terms a { color: inherit; text-decoration: underline; }
      .form-error { margin-bottom: 14px; }
      .submit { min-width: 200px; }
      .need { margin-bottom: 16px; }
      .need h3 { font-size: 1rem; margin-bottom: 8px; }
      .need ul { margin: 0; padding-left: 18px; line-height: 1.8; font-size: 0.875rem; }
      @media (max-width: 560px) { .two { grid-template-columns: 1fr; } .submit { width: 100%; } }
    `,
  ],
})
export class PayoutsFormComponent implements OnInit {
  private readonly api = inject(Api);
  private readonly auth = inject(AuthService);
  private readonly confirm = inject(ConfirmService);

  /**
   * Lo que Stripe ya tiene del titular. Con esto el formulario CORRIGE en vez
   * de dar de alta. Se pasa una sola vez, al crear el componente.
   */
  @Input() prefill: PayoutOwnerPrefill | null = null;

  /** Emits the account the server answered with, once it is open. */
  @Output() activated = new EventEmitter<PayoutAccount>();

  /** Corrigiendo: la cuenta ya releída después de guardar. */
  @Output() saved = new EventEmitter<PayoutAccount>();

  readonly termsUrl = STRIPE_TERMS_URL;

  /** Si se está corrigiendo una cuenta que ya existe. */
  get editing(): boolean {
    return this.prefill !== null;
  }

  // Stripe demands adulthood, so younger dates cannot even be picked; 120
  // years is Stripe's own lower bound.
  readonly maxBirth = yearsAgo(18);
  readonly minBirth = yearsAgo(120);

  firstName = '';
  lastName = '';
  birth = '';
  phone = '';
  idNumber = '';
  address = '';
  city = '';
  postalCode = '';
  iban = '';
  acceptedTerms = false;

  readonly sending = signal(false);
  readonly error = signal<string | null>(null);
  /** Validation only shows once the owner has tried to send. */
  private readonly tried = signal(false);

  ngOnInit(): void {
    const prefill = this.prefill;
    if (prefill) {
      // Corrigiendo: se enseña lo que Stripe tiene, que es lo que hay que
      // revisar. El DNI y el IBAN salen vacíos porque Stripe no los devuelve,
      // y dejarlos así no los cambia.
      this.firstName = prefill.firstName ?? '';
      this.lastName = prefill.lastName ?? '';
      this.phone = prefill.phone ?? '';
      this.address = prefill.addressLine1 ?? '';
      this.city = prefill.city ?? '';
      this.postalCode = prefill.postalCode ?? '';
      this.birth = prefill.dateOfBirth ?? '';
      return;
    }
    // Alta: prefilled with what the business already told us, and editable:
    // the owner's home need not be the shop.
    const profile = (this.auth.profile() ?? {}) as unknown as Record<string, unknown>;
    this.address = str(profile['address']);
    this.city = str(profile['city']);
    this.postalCode = str(profile['postalCode']);
    this.phone = withCountryPrefix(str(profile['phone']) || this.auth.user()?.phone || '');
  }

  ibanClean(): string {
    return this.iban.replace(/\s+/g, '').toUpperCase();
  }

  ibanPlaceholder(): string {
    const last4 = this.prefill?.bankLast4;
    return last4 ? `Acaba en ${last4}` : 'ES00 0000 0000 0000 0000 0000';
  }

  bad(field: Field): boolean {
    return this.tried() && this.invalid(field);
  }

  private invalid(field: Field): boolean {
    switch (field) {
      case 'firstName':
        return !this.firstName.trim();
      case 'lastName':
        return !this.lastName.trim();
      case 'birth':
        return !this.birth || this.birth > this.maxBirth || this.birth < this.minBirth;
      case 'phone':
        return !PHONE.test(this.phone.trim());
      case 'address':
        return !this.address.trim();
      case 'city':
        return !this.city.trim();
      case 'postalCode':
        return !this.postalCode.trim();
      case 'iban':
        // Corrigiendo, en blanco es «deja la cuenta que tengo»: Stripe no
        // devuelve el IBAN, así que no se puede traer puesto y obligar a
        // reescribirlo solo invita a equivocarse.
        if (this.editing && !this.ibanClean()) return false;
        // Only the shape: the real IBAN check is Stripe's, which knows every country.
        return this.ibanClean().length < 15;
    }
  }

  async submit(): Promise<void> {
    this.tried.set(true);
    const fields: Field[] = ['firstName', 'lastName', 'birth', 'phone', 'address', 'city', 'postalCode', 'iban'];
    if (fields.some((f) => this.invalid(f))) return;
    if (!this.editing && !this.acceptedTerms) return;

    // Cambiar de banco es lo único de este formulario que redirige DINERO. Se
    // pregunta solo cuando se ha escrito un IBAN nuevo: vacío no toca nada.
    if (this.editing && this.ibanClean()) {
      const answer = await this.confirm.ask({
        title: 'Vas a cambiar de cuenta',
        message:
          'El dinero de tus cobros pasará a ingresarse en la cuenta nueva. Comprueba el IBAN antes de seguir.',
        confirmLabel: 'Cambiar la cuenta',
      });
      if (!answer.ok) return;
    }

    this.sending.set(true);
    this.error.set(null);
    try {
      const account = this.editing ? await this.saveDetails() : await this.activate();
      (this.editing ? this.saved : this.activated).emit(account);
    } catch (cause) {
      const status = (cause as { status?: number }).status;
      this.error.set(status === 0 ? 'No se ha podido enviar. Revisa tu conexión.' : message(cause));
    } finally {
      this.sending.set(false);
    }
  }

  private activate(): Promise<PayoutAccount> {
    const body: ActivatePayoutsRequest = {
      firstName: this.firstName.trim(),
      lastName: this.lastName.trim(),
      dateOfBirth: this.birth,
      phone: this.phone.trim(),
      addressLine1: this.address.trim(),
      city: this.city.trim(),
      postalCode: this.postalCode.trim(),
      iban: this.ibanClean(),
      acceptedTerms: this.acceptedTerms,
    };
    const id = this.idNumber.trim();
    if (id) body.idNumber = id;
    return this.api.post<PayoutAccount>('/businesses/me/payouts/activate', body);
  }

  /** `PUT /details`: sin condiciones, y sin IBAN si no se ha escrito otro. */
  private saveDetails(): Promise<PayoutAccount> {
    const body: UpdatePayoutDetailsRequest = {
      firstName: this.firstName.trim(),
      lastName: this.lastName.trim(),
      dateOfBirth: this.birth,
      phone: this.phone.trim(),
      addressLine1: this.address.trim(),
      city: this.city.trim(),
      postalCode: this.postalCode.trim(),
    };
    const id = this.idNumber.trim();
    if (id) body.idNumber = id;
    const iban = this.ibanClean();
    if (iban) body.iban = iban;
    return this.api.put<PayoutAccount>('/businesses/me/payouts/details', body);
  }
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function yearsAgo(years: number): string {
  const now = new Date();
  return dayKey(new Date(now.getFullYear() - years, now.getMonth(), now.getDate()));
}

/**
 * Stripe rejects a bare number, and the business file keeps it without the
 * prefix because calling from Spain does not need it.
 */
function withCountryPrefix(raw: string): string {
  const digits = raw.replace(/[^0-9+]/g, '');
  if (!digits) return '';
  if (digits.startsWith('+')) return digits;
  return digits.length === 9 ? `+34${digits}` : digits;
}
