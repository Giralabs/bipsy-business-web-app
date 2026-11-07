import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { SubscriptionPlan, SubscriptionStatus } from '../core/api/models';
import { money } from '../core/util/format';
import {
  PLAN_CODES,
  businessSummary,
  chargeNote,
  diamondOf,
  hasFreeMonth,
  offerTerm,
  qualityPerks,
  visibleOffer,
} from './plan-terms';

/**
 * One plan on sale, as the approved design draws it: the diamond, the name,
 * the free month or offer pill, the price (struck through under an offer),
 * what it brings and the button with its charge note underneath.
 *
 * Shared by the plan wall and Mi plan, so both say the same thing.
 */
@Component({
  selector: 'app-plan-option',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="pn-card po" [class.po--on]="highlighted">
      <header class="po__head">
        <img class="po__diamond" [src]="diamond" alt="" width="48" height="48" />
        <div class="po__title">
          <h2>{{ plan.name }}</h2>
          <span class="po__pills">
            @if (badge) {
              <span class="pn-status pn-status--success">{{ badge }}</span>
            }
            @if (offer; as o) {
              <span class="po__pill po__pill--offer">{{ o.label }}</span>
            } @else if (freeMonth) {
              <span class="po__pill">Primer mes gratis</span>
            }
          </span>
        </div>
      </header>

      @if (offer; as o) {
        <p class="po__price pn-tabular">
          <s [attr.aria-label]="'Antes ' + money(plan.priceCents)">{{ money(plan.priceCents) }}</s>
          {{ money(o.priceCents) }}<span>/mes</span>
        </p>
        <p class="po__term">{{ offerTerm(o, freeMonth) }}</p>
      } @else {
        <p class="po__price pn-tabular">{{ money(plan.priceCents) }}<span>/mes</span></p>
      }

      @if (isQuality) {
        <ul class="po__perks">
          @for (perk of perks; track perk.title) {
            <li>
              <span class="material-symbols-rounded" aria-hidden="true">{{ perk.icon }}</span>
              <span><strong>{{ perk.title }}</strong><span>{{ perk.text }}</span></span>
            </li>
          }
        </ul>
      } @else {
        <p class="po__summary">{{ summary }}</p>
      }

      @if (cta) {
        <button type="button" class="pn-btn pn-btn--block po__cta"
                [class.pn-btn--primary]="highlighted || !secondary" [class.pn-btn--secondary]="secondary && !highlighted"
                [disabled]="disabled" (click)="choose.emit(plan)">
          @if (busy) { <span class="pn-spinner"></span> } @else { {{ cta }} }
        </button>
        @if (showNote) {
          <p class="po__note">{{ note }}</p>
        }
      }
    </section>
  `,
  styles: [
    `
      :host { display: block; }
      .po { display: flex; flex-direction: column; height: 100%; padding: 28px; text-align: left; }
      .po--on { box-shadow: var(--pn-rim), inset 0 0 0 2px var(--clr-success); }
      .po__head { display: flex; align-items: center; gap: 14px; }
      .po__diamond { width: 48px; height: 48px; flex: none; object-fit: contain; }
      .po__title { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; min-width: 0; }
      .po__title h2 { font-family: var(--ff-display); font-size: 1.375rem; font-weight: 800; letter-spacing: -0.5px; }
      .po__pills { display: flex; flex-wrap: wrap; gap: 6px; }
      .po__pill {
        display: inline-flex;
        align-items: center;
        padding: 3px 10px;
        border-radius: 99px;
        font-size: 0.75rem;
        font-weight: 700;
        background: var(--pn-accent-soft);
        color: var(--clr-text-2);
      }
      .po__pill--offer { background: var(--clr-accent); color: var(--clr-on-accent); }
      .po__price {
        margin-top: 18px;
        font-family: var(--ff-display);
        font-size: 2.25rem;
        font-weight: 800;
        letter-spacing: -1.4px;
      }
      .po__price s {
        margin-right: 6px;
        font-size: 1.125rem;
        font-weight: 600;
        letter-spacing: 0;
        color: var(--clr-text-3);
      }
      .po__price > span { font-size: 0.9375rem; font-weight: 600; color: var(--clr-text-3); letter-spacing: 0; }
      .po__term { margin-top: 2px; font-size: 0.875rem; color: var(--clr-text-2); }
      .po__summary { margin-top: 14px; font-size: 0.9375rem; color: var(--clr-text-2); line-height: 1.55; }
      .po__perks { margin-top: 18px; display: grid; gap: 14px; }
      .po__perks li { display: flex; gap: 12px; align-items: flex-start; font-size: 0.9375rem; }
      .po__perks .material-symbols-rounded { font-size: 22px; color: var(--clr-success); flex: none; }
      .po__perks strong { display: block; font-weight: 700; }
      .po__perks strong + span { display: block; margin-top: 2px; font-size: 0.8125rem; color: var(--clr-text-3); }
      .po__cta { margin-top: auto; }
      .po__perks + .po__cta, .po__summary + .po__cta { margin-top: 24px; }
      .po__note { margin-top: 10px; font-size: 0.8125rem; color: var(--clr-text-3); line-height: 1.5; }
    `,
  ],
})
export class PlanOptionComponent {
  @Input({ required: true }) plan!: SubscriptionPlan;
  @Input() status: SubscriptionStatus | null = null;
  /** Button text; no text, no button (a plan that cannot be chosen from here). */
  @Input() cta: string | null = null;
  @Input() busy = false;
  @Input() disabled = false;
  @Input() highlighted = false;
  /** A secondary button for a plan that is not the obvious next step. */
  @Input() secondary = false;
  /** «Tu plan» and the like, next to the name. */
  @Input() badge: string | null = null;
  /** The charge note: what is charged and when, if this plan is chosen now. */
  @Input() showNote = true;
  @Output() choose = new EventEmitter<SubscriptionPlan>();

  readonly money = money;
  readonly offerTerm = offerTerm;

  get isQuality(): boolean {
    return this.plan.code === PLAN_CODES.QUALITY;
  }

  get diamond(): string {
    return diamondOf(this.plan.code);
  }

  get perks() {
    return qualityPerks(this.plan);
  }

  get summary(): string {
    return businessSummary(this.plan);
  }

  get offer() {
    return visibleOffer(this.plan, this.status);
  }

  get freeMonth(): boolean {
    return hasFreeMonth(this.plan, this.status);
  }

  get note(): string {
    return chargeNote(this.plan, this.status, new Date());
  }
}
