import { ChangeDetectionStrategy, Component, Input, computed, signal } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { StatusPageComponent } from '../../components/status-page/status-page.component';
import { noindex } from '../../shared/noindex';

/** What went wrong, as it travels in `?tipo=` (or in the route data). */
export type ErrorKind = 'inesperado' | 'conexion' | 'version';

interface ErrorView {
  /** Browser tab. */
  tab: string;
  bip: string;
  pose: string;
  icon: string;
  eyebrow: string;
  heading: string;
  lead: string;
  /** The main button: always a full reload, never a navigation inside the app. */
  action: string;
  actionIcon: string;
}

const VIEWS: Record<ErrorKind, ErrorView> = {
  inesperado: {
    tab: 'Algo ha fallado',
    bip: 'MB-30',
    pose: 'con un brazo en cabestrillo y el pulgar arriba',
    icon: 'error',
    eyebrow: 'Algo ha fallado',
    heading: 'Esto no tenía que pasar',
    lead: 'Ha habido un error inesperado y no es cosa tuya. Vuelve a intentarlo; si sigue igual, escríbenos y lo miramos.',
    action: 'Reintentar',
    actionIcon: 'refresh',
  },
  conexion: {
    tab: 'Sin conexión',
    bip: 'MB-15',
    pose: 'sentado en un sillón leyendo el periódico, con un café al lado',
    icon: 'wifi_off',
    eyebrow: 'Sin conexión',
    heading: 'No llegamos al servidor',
    lead: 'Puede ser tu conexión o que nuestro servidor esté tardando en contestar. Comprueba tu red y vuelve a intentarlo.',
    action: 'Reintentar',
    actionIcon: 'refresh',
  },
  version: {
    tab: 'Nueva versión disponible',
    bip: 'MB-07',
    pose: 'con los brazos cruzados y el pulgar arriba, seguro de sí mismo',
    icon: 'system_update_alt',
    eyebrow: 'Nueva versión',
    heading: 'Hemos actualizado Bipsy',
    lead: 'Mientras tenías esta pestaña abierta hemos publicado una versión nueva de la web. Recarga para seguir donde estabas.',
    action: 'Recargar',
    actionIcon: 'refresh',
  },
};

/** Anything that is not a known kind is the generic one. */
export function errorKind(value: unknown): ErrorKind {
  return value === 'conexion' || value === 'version' ? value : 'inesperado';
}

/** The tab title depends on the kind, so the route resolves it. */
export const errorTitle: ResolveFn<string> = (route) =>
  `${VIEWS[errorKind(route.data['tipo'] ?? route.queryParamMap.get('tipo'))].tab} · Bipsy Business`;

/**
 * `/error` — where the site sends people when it cannot go on: an unexpected
 * failure, no connection, or a deploy that left this tab holding files that no
 * longer exist (`?tipo=version`, see `app-error-handler.ts`).
 *
 * It is NOT lazy, and it must stay that way: it is the page shown when a lazy
 * chunk fails to load, so it cannot be one. For the same reason its buttons
 * reload the page instead of navigating: after a deploy, any route of the old
 * build may be gone.
 */
@Component({
  selector: 'app-error',
  standalone: true,
  imports: [StatusPageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (view(); as v) {
      <app-status-page
        standalone
        [bip]="v.bip"
        [pose]="v.pose"
        [icon]="v.icon"
        [eyebrow]="v.eyebrow"
        [heading]="v.heading"
        [lead]="v.lead"
      >
        <ng-container ngProjectAs="[actions]">
          <button type="button" class="btn btn--primary btn--lg" (click)="reload()">
            <span class="material-symbols-rounded">{{ v.actionIcon }}</span>
            {{ v.action }}
          </button>
          @if (kind() !== 'version') {
            <a href="/" class="btn btn--secondary btn--lg">
              <span class="material-symbols-rounded">arrow_back</span>
              Volver al inicio
            </a>
          }
        </ng-container>
      </app-status-page>
    }
  `,
  styles: [':host { display: block; }'],
})
export class ErrorComponent {
  readonly kind = signal<ErrorKind>('inesperado');
  readonly view = computed(() => VIEWS[this.kind()]);

  /** Where the person was going when it broke. */
  private back = '/';

  constructor() {
    noindex();
  }

  /** `?tipo=` or the route data, through the router's input binding. */
  @Input()
  set tipo(value: string | undefined) {
    this.kind.set(errorKind(value));
  }

  /**
   * `?desde=`: the URL to go back to. Only paths of this site — it comes from
   * the address bar, so anything else would be an open redirect — and never
   * this page itself.
   */
  @Input()
  set desde(value: string | undefined) {
    const path = value ?? '';
    // A backslash counts too: browsers read `/\host` as `//host`.
    const safe = /^\/(?![/\\])/.test(path) && !path.includes('\\') && !path.startsWith('/error');
    this.back = safe ? path : '/';
  }

  reload(): void {
    location.assign(this.back);
  }
}
