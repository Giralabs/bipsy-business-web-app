import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ToastService } from './toast.service';

/**
 * La app de Windows (bipsy-business-desktop): un .exe de ~430 KB que abre este
 * mismo panel en su propia ventana. Se sirve como fichero estático de la web.
 */
export const DESKTOP_APP_URL = '/descargas/BipsyBusiness.exe';

/** Lo que la app añade al User-Agent: dentro de ella no se ofrece descargarla. */
const DESKTOP_APP_UA = 'BipsyBusinessDesktop';

const STORAGE_KEY = 'bipsy_desktop_app_prompt';

/**
 * Se ofrece en un Windows de escritorio y fuera de la propia app. «Mobile» deja
 * fuera los Windows que se hacen pasar por móvil y cualquier navegador de
 * teléfono que diga Windows en el UA.
 */
export function desktopAppOffered(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return /Windows NT/.test(ua) && !/Mobile|Android|iPhone|iPad/.test(ua) && !ua.includes(DESKTOP_APP_UA);
}

function wasAnswered(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}

function remember(answer: 'later' | 'downloaded'): void {
  try {
    localStorage.setItem(STORAGE_KEY, answer);
  } catch {
    // Almacenamiento bloqueado: volverá a salir la próxima vez, sin más.
  }
}

/**
 * La tira que ofrece la app de Windows, arriba del contenido del panel.
 *
 * Una tira y no un diálogo: un diálogo en medio de la pantalla al entrar
 * cortaba lo que el negocio venía a hacer, y José lo pidió así, como la de
 * «Añade ya tu negocio» de la web. Se cierra con la ✕ y no vuelve; descargar
 * también la quita. Después queda la entrada fija del menú de la cuenta.
 */
@Component({
  selector: 'pn-desktop-app-prompt',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open()) {
      <aside class="da" aria-label="App de Bipsy Business para Windows">
        <a class="da__link" [href]="url" download="BipsyBusiness.exe" (click)="downloaded()">
          <img class="da__icon" src="/descargas/bipsy-business-windows.png" width="24" height="24" alt="" />
          <span class="da__text">
            <strong>Bipsy Business para Windows.</strong>
            <span class="da__extra">Tu panel en su propia ventana y con avisos de cada cita.</span>
          </span>
          <span class="da__go">
            <span class="material-symbols-rounded" aria-hidden="true">download</span>
            Descargar
          </span>
        </a>
        <button type="button" class="da__close" (click)="dismiss()" aria-label="Ocultar el aviso de la app de Windows">
          <span class="material-symbols-rounded">close</span>
        </button>
      </aside>
    }
  `,
  styles: [
    `
      :host { display: block; }
      /* La misma tira que la de «Añade ya tu negocio» de la web: grafito liso
         y el menta como único acento, igual en claro y en oscuro. */
      .da {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 48px;
        padding: 0 48px;
        background: #1F2428;
        color: #F5F7F6;
      }
      .da__link {
        display: inline-flex;
        align-items: center;
        gap: 12px;
        padding-block: 8px;
        min-width: 0;
        color: inherit;
        text-decoration: none;
        font-size: 0.9375rem;
        line-height: 1.35;
      }
      .da__icon { flex: none; border-radius: 6px; }
      .da__text { min-width: 0; color: #C9D4CF; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .da__text strong { color: #C0EED3; font-weight: 800; margin-right: 6px; }
      .da__go {
        flex: none;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        margin-left: 4px;
        padding: 6px 14px 6px 12px;
        border-radius: 999px;
        background: #C0EED3;
        color: #1B2420;
        font-size: 0.875rem;
        font-weight: 800;
        white-space: nowrap;
        transition: background-color 0.2s ease;
      }
      .da__go .material-symbols-rounded { font-size: 18px; }
      .da__link:hover .da__go { background: #D4F4E1; }
      .da__link:focus-visible { outline: none; }
      .da__link:focus-visible .da__go { outline: 2px solid #C0EED3; outline-offset: 3px; }
      .da__close {
        position: absolute;
        right: 10px;
        top: 50%;
        transform: translateY(-50%);
        display: grid;
        place-items: center;
        width: 32px;
        height: 32px;
        border: 0;
        border-radius: 50%;
        background: transparent;
        color: #9FB0A8;
        cursor: pointer;
      }
      .da__close:hover { background: rgb(255 255 255 / 0.1); color: #F5F7F6; }
      .da__close:focus-visible { outline: 2px solid #C0EED3; outline-offset: 1px; }
      .da__close .material-symbols-rounded { font-size: 18px; }
      @media (max-width: 900px) {
        .da { justify-content: flex-start; padding-left: 16px; }
        .da__extra { display: none; }
      }
    `,
  ],
})
export class PnDesktopAppPromptComponent {
  readonly url = DESKTOP_APP_URL;
  readonly open = signal(desktopAppOffered() && !wasAnswered());
  private readonly toast = inject(ToastService);

  dismiss(): void {
    remember('later');
    this.open.set(false);
  }

  /** El enlace descarga solo; aquí se quita la tira y se dice qué hacer con el fichero. */
  downloaded(): void {
    remember('downloaded');
    this.open.set(false);
    this.toast.show('Abre BipsyBusiness.exe desde tus descargas para instalar la app.');
  }
}
