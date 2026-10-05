import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { BipNegocioComponent } from './bip-negocio.component';

/**
 * La cabecera del inicio: el saludo a la izquierda y Mr. Bip a la derecha,
 * de medio cuerpo, asomando por el borde de abajo de la tarjeta.
 *
 * Antes el render de cuerpo entero se metía en una miniatura de 78 × 94 con
 * un `scale(1.5)`: a ese tamaño solo se veía un trozo de cabeza con las orejas
 * cortadas. Ahora tiene sitio de verdad, se recorta por la cintura (que es
 * lo que menos se nota) y la luz de detrás lo separa del fondo.
 */
@Component({
  selector: 'pn-desk-hero',
  standalone: true,
  imports: [BipNegocioComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="hero">
      <div class="hero__text">
        <p class="hero__greet">{{ greet }}</p>
        <h1 class="hero__title">{{ title }}</h1>
        @if (line) {
          <p class="hero__line">{{ line }}</p>
        }
        <div class="hero__chips"><ng-content /></div>
      </div>

      <div class="hero__art" aria-hidden="true">
        <span class="hero__aura"></span>
        <app-bip-negocio class="hero__bip" />
      </div>
    </section>
  `,
  styles: [
    `
      :host { display: block; }

      .hero {
        position: relative;
        display: flex;
        align-items: stretch;
        min-height: 212px;
        margin: 8px 0 var(--pn-gap);
        border-radius: var(--pn-radius-card);
        background:
          radial-gradient(120% 140% at 100% 100%, var(--hero-glow) 0%, transparent 55%),
          var(--pn-card);
        box-shadow: var(--pn-rim);
        overflow: hidden;
        isolation: isolate;
        --hero-glow: rgba(192, 238, 211, 0.1);
      }
      @media (prefers-color-scheme: light) {
        .hero { --hero-glow: rgba(131, 163, 142, 0.16); }
      }

      .hero__text {
        position: relative;
        z-index: 1;
        display: flex;
        flex-direction: column;
        justify-content: center;
        flex: 1;
        min-width: 0;
        padding: 30px 0 30px 32px;
      }
      .hero__greet { font-size: 0.875rem; font-weight: 600; color: var(--clr-text-3); }
      .hero__title {
        margin-top: 8px;
        font-family: var(--ff-display);
        font-size: clamp(2rem, 3.4vw, 2.875rem);
        font-weight: 800;
        letter-spacing: -1.6px;
        line-height: 1;
        overflow-wrap: anywhere;
      }
      .hero__line { margin-top: 12px; font-size: 1rem; color: var(--clr-text-2); line-height: 1.5; }
      .hero__chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 18px; }
      .hero__chips:empty { display: none; }

      /* The figure: a fixed width, anchored to the top so the ears always
         fit, and cut by the card's bottom edge at the waist. */
      .hero__art { position: relative; flex: none; width: 250px; }
      .hero__aura {
        position: absolute;
        right: 10px;
        top: 26px;
        width: 230px;
        height: 230px;
        border-radius: 50%;
        background: radial-gradient(closest-side, var(--clr-mint-glow), transparent);
        opacity: 0.8;
      }
      .hero__bip {
        position: absolute;
        right: 36px;
        top: 20px;
        width: 180px;
        /* No drop-shadow: over the animated rig a filter re-rasterises the
           whole figure every frame. The aura already lifts him. */
      }
      /* MB-00 was redrawn on a narrower canvas (690 wide, not 959), so the
         same width would make his head a size bigger than the rest. */
      .hero__bip[data-bip='MB-00'] { width: 142px; right: 54px; top: 16px; }

      @media (max-width: 700px) {
        .hero__art { width: 150px; }
        .hero__aura { width: 160px; height: 160px; right: -10px; }
        .hero__bip { width: 132px; right: 6px; top: 26px; }
        .hero__bip[data-bip='MB-00'] { width: 104px; right: 18px; }
        .hero__text { padding: 24px 0 24px 22px; }
      }
      @media (max-width: 440px) {
        .hero__art { display: none; }
        .hero__text { padding-right: 22px; }
      }
    `,
  ],
})
export class PnDeskHeroComponent {
  @Input() greet = '';
  @Input() title = '';
  @Input() line = '';
}
