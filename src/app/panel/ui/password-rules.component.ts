import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { PASSWORD_MIN_LENGTH, checkPassword } from '../core/auth/password-policy';

/**
 * `<pn-password-rules>` — `GipsiPasswordRules`: the three rules with their tick,
 * under a field where a password is CHOSEN, while it is being typed.
 *
 * Never under a sign-in field: unticked requirements there would claim that an
 * existing password is wrong.
 */
@Component({
  selector: 'pn-password-rules',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (password) {
      <ul class="rules">
        <li [class.ok]="check.hasMinLength">
          <span class="material-symbols-rounded" aria-hidden="true">{{ check.hasMinLength ? 'check_circle' : 'radio_button_unchecked' }}</span>
          Al menos {{ minLength }} caracteres
        </li>
        <li [class.ok]="check.hasLetterAndDigit">
          <span class="material-symbols-rounded" aria-hidden="true">{{ check.hasLetterAndDigit ? 'check_circle' : 'radio_button_unchecked' }}</span>
          Combina letras y números
        </li>
        <li [class.ok]="!check.isCommon">
          <span class="material-symbols-rounded" aria-hidden="true">{{ check.isCommon ? 'radio_button_unchecked' : 'check_circle' }}</span>
          Evita contraseñas muy comunes
        </li>
      </ul>
    }
  `,
  styles: [
    `
      .rules { list-style: none; margin: 8px 0 0; padding: 0; display: grid; gap: 3px; }
      li {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 0.75rem;
        color: var(--clr-text-3);
      }
      li.ok { color: var(--clr-text); }
      .material-symbols-rounded { font-size: 14px; }
      li.ok .material-symbols-rounded { color: var(--clr-success); }
    `,
  ],
})
export class PnPasswordRulesComponent {
  @Input() password = '';

  readonly minLength = PASSWORD_MIN_LENGTH;

  get check() {
    return checkPassword(this.password);
  }
}
