import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Api } from '../core/api/api';
import { CategoryRef } from '../core/api/models';
import { AuthService } from '../core/auth/auth.service';
import { BUSINESS_TYPES } from '../../data/business-types.data';
import { BipRigComponent } from '../../components/bip-rig/bip-rig.component';
import { BIP_RIGS } from '../../components/bip-rig/bip-rigs.data';

interface BusinessMe { categories?: CategoryRef[] }

/**
 * Mr. Bip vestido del oficio del negocio.
 *
 * Cada categoría del catálogo tiene su ilustración en
 * `business-types.data.ts` —la peluquería con tijeras, el tatuador con la
 * máquina—, las mismas que usa la web pública. Aquí se elige por el código
 * de categoría del negocio: `GET /businesses/me` para el dueño y la ficha
 * pública (`GET /businesses/{id}`, ya leída por la sesión) para un
 * trabajador, que no puede leer la primera.
 *
 * Si el negocio está en una categoría sin ilustración propia sale el Mr. Bip
 * de siempre, y cuando la ilustración tiene versión animada (`BIP_RIGS`) se
 * usa esa.
 *
 * Solo pinta la figura, a lo ancho de su caja; el encuadre (de medio cuerpo,
 * asomando por el borde de la tarjeta) lo decide quien lo coloca.
 */
@Component({
  selector: 'app-bip-negocio',
  standalone: true,
  imports: [BipRigComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (art(); as bip) {
      @if (bip.rig) {
        <app-bip-rig class="bipn" [rig]="bip.rig" [label]="bip.alt" />
      } @else {
        <img class="bipn" [src]="'mr_bip/' + bip.code + '.webp'" [alt]="bip.alt"
             decoding="async" />
      }
    }
  `,
  host: { '[attr.data-bip]': 'art()?.code ?? null' },
  styles: [`
    :host { display: block; }
    .bipn {
      display: block;
      width: 100%;
      height: auto;
      pointer-events: none;
      user-select: none;
      animation: bipn-in 700ms var(--ease-out) both;
    }
    @keyframes bipn-in {
      from { opacity: 0; transform: translateY(24px); }
      to { opacity: 1; transform: none; }
    }
    @media (prefers-reduced-motion: reduce) { .bipn { animation: none; } }
  `],
})
export class BipNegocioComponent {
  private readonly api = inject(Api);
  private readonly auth = inject(AuthService);
  private readonly own = signal<CategoryRef[] | null>(null);

  private readonly categories = computed<CategoryRef[] | null>(() => {
    if (this.auth.isWorker()) {
      const employer = this.auth.employer();
      return employer ? (employer.categories ?? []) : null;
    }
    return this.own();
  });

  /** El Bip del oficio, o el genérico si esa categoría no tiene uno. */
  readonly art = computed(() => {
    const list = this.categories();
    if (list === null) return null;   // todavía no se sabe: mejor nada que un parpadeo
    const code = (list.find((c) => c.primary) ?? list[0])?.code;
    const type = code ? BUSINESS_TYPES.find((t) => t.code === code) : undefined;
    const bip = type
      ? { code: type.bip.code, alt: `Mr. Bip: ${type.bip.pose}` }
      : { code: 'MB-00', alt: 'Mr. Bip, la mascota de Bipsy Business' };
    const rig = bip.code.toLowerCase();
    return { ...bip, rig: BIP_RIGS[rig] ? rig : null };
  });

  constructor() {
    if (this.auth.isBusiness()) void this.load();
  }

  private async load(): Promise<void> {
    try {
      this.own.set((await this.api.get<BusinessMe>('/businesses/me')).categories ?? []);
    } catch {
      // Sin categorías no hay Bip del oficio; el genérico sigue valiendo.
      this.own.set([]);
    }
  }
}
