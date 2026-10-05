import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Api } from '../core/api/api';
import { AuthService } from '../core/auth/auth.service';
import { InstagramMedia, InstagramStatus, PortfolioImage } from '../core/api/models';
import { SetupStore } from '../core/data/setup.store';
import { message } from '../core/data/resource';
import { ServicesStore } from '../core/data/services.store';
import { PnEmptyComponent } from '../ui/controls';
import { PnDialogComponent } from '../ui/dialog.component';
import { PnPhotoPickerComponent } from '../ui/photo-picker.component';
import { ConfirmService } from '../ui/confirm.service';
import { ToastService } from '../ui/toast.service';

/**
 * `/panel/negocio/portfolio` — `portfolio_screen.dart`.
 *
 * Dos grupos, como en la app: las diez primeras salen en la ficha y el resto
 * quedan en la galería. Se suben, se ordenan, se etiquetan por servicio y se
 * borran desde aquí.
 */
@Component({
  selector: 'app-panel-portfolio',
  standalone: true,
  imports: [FormsModule, RouterLink, PnEmptyComponent, PnDialogComponent, PnPhotoPickerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './portfolio.component.html',
  styleUrl: './portfolio.component.css',
})
export class PortfolioComponent {
  private readonly api = inject(Api);
  private readonly setup = inject(SetupStore);
  private readonly confirm = inject(ConfirmService);
  private readonly toasts = inject(ToastService);
  readonly services = inject(ServicesStore);
  readonly auth = inject(AuthService);

  readonly uploading = signal(false);
  readonly editing = signal<PortfolioImage | null>(null);
  readonly busy = signal(false);

  form = { caption: '', serviceId: null as number | null };

  /** The photo waiting for its caption before it is uploaded. */
  readonly adding = signal(false);
  readonly draftUrl = signal<string | null>(null);
  readonly pickerKey = signal(0);
  private draftFile: File | null = null;
  draftForm = { caption: '', serviceId: null as number | null };

  // ----- Instagram (`instagram_import_screen.dart`) -----------------------
  //
  // The app opens the authorisation in an external browser and asks the owner
  // to come back and press «Actualizar». A desktop browser does the same with
  // a second window: there is no deep link to come back through, and the
  // backend closes the loop with its own «vuelve a la app» page.
  readonly instagram = signal<InstagramStatus | null>(null);
  readonly igBusy = signal(false);
  readonly igError = signal<string | null>(null);
  /** True between opening the authorisation window and checking the status. */
  readonly igWaiting = signal(false);
  readonly importing = signal(false);
  readonly media = signal<InstagramMedia[]>([]);
  readonly picked = signal<Set<string>>(new Set());

  constructor() {
    void this.setup.portfolio.load();
    void this.services.load();
    void this.loadInstagram();
  }

  private async loadInstagram(): Promise<void> {
    try {
      this.instagram.set(await this.api.get<InstagramStatus>('/businesses/me/instagram/status'));
    } catch {
      // 503 = the server has no Meta app: nothing about Instagram is shown.
      this.instagram.set(null);
    }
  }

  igAccountLabel(): string {
    const username = this.instagram()?.username;
    return username ? `@${username}` : 'Instagram conectado';
  }

  async connect(): Promise<void> {
    this.igBusy.set(true);
    this.igError.set(null);
    try {
      const { authorizeUrl } = await this.api.post<{ authorizeUrl: string }>(
        '/businesses/me/instagram/connect-url',
      );
      const opened = window.open(authorizeUrl, '_blank', 'noopener,noreferrer');
      if (!opened) {
        this.igError.set('Tu navegador ha bloqueado la ventana de Instagram. Permítela y vuelve a intentarlo.');
        return;
      }
      this.igWaiting.set(true);
    } catch (cause) {
      this.igError.set(message(cause) || 'No se pudo conectar con Instagram. Inténtalo de nuevo.');
    } finally {
      this.igBusy.set(false);
    }
  }

  async refreshInstagram(): Promise<void> {
    this.igBusy.set(true);
    try {
      await this.loadInstagram();
      if (this.instagram()?.connected) {
        this.igWaiting.set(false);
        this.igError.set(null);
        this.toasts.show('Instagram conectado');
      } else {
        this.igError.set('No se pudo conectar con Instagram. Inténtalo de nuevo.');
      }
    } finally {
      this.igBusy.set(false);
    }
  }

  async disconnect(): Promise<void> {
    const answer = await this.confirm.ask({
      title: 'Desconectar Instagram',
      message: 'Dejaremos de poder traer tus fotos. Las que ya importaste se quedan en tu portfolio.',
      confirmLabel: 'Desconectar',
      destructive: true,
    });
    if (!answer.ok) return;
    try {
      await this.api.delete('/businesses/me/instagram');
      await this.loadInstagram();
    } catch {
      this.toasts.error('No se ha podido desconectar.');
    }
  }

  async openImport(): Promise<void> {
    this.importing.set(true);
    this.picked.set(new Set());
    this.media.set([]);
    this.igError.set(null);
    this.igBusy.set(true);
    try {
      this.media.set(await this.api.get<InstagramMedia[]>('/businesses/me/instagram/media'));
    } catch (cause) {
      this.igError.set(message(cause) || 'No se pudo conectar con Instagram. Inténtalo de nuevo.');
      this.importing.set(false);
    } finally {
      this.igBusy.set(false);
    }
  }

  togglePick(id: string): void {
    this.picked.update((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  /**
   * The server decides how many really fit: a plan with a cap imports what is
   * left and says so, instead of refusing the whole lot.
   */
  async importPicked(): Promise<void> {
    const mediaIds = [...this.picked()];
    if (mediaIds.length === 0) return;
    this.igBusy.set(true);
    try {
      const { imported } = await this.api.post<{ imported: number }>(
        '/businesses/me/instagram/import',
        { mediaIds },
      );
      await this.setup.portfolio.reload();
      // The quota travels in `/me`, so it has to be read again.
      await this.auth.refreshMe();
      this.importing.set(false);
      this.toasts.show(
        imported < mediaIds.length
          ? `Se importaron ${imported} fotos; el resto no cabe en tu plan.`
          : `Se importaron ${imported} ${imported === 1 ? 'foto' : 'fotos'}.`,
      );
    } catch (cause) {
      this.igError.set(message(cause) || 'No se han podido importar.');
    } finally {
      this.igBusy.set(false);
    }
  }

  readonly photos = this.setup.portfolio.value;
  readonly front = computed(() => this.photos().slice(0, 10));
  readonly rest = computed(() => this.photos().slice(10));
  readonly unlimited = computed(() => this.auth.hasFeature('PORTFOLIO_UNLIMITED'));
  readonly limit = computed(() => (this.unlimited() ? Infinity : 10));
  readonly full = computed(() => this.photos().length >= this.limit());

  limitLabel(): string {
    return this.unlimited() ? 'sin límite' : '10';
  }

  serviceName(photo: PortfolioImage): string {
    if (!photo.serviceId) return 'Sin servicio';
    return photo.serviceName ?? this.services.byId(photo.serviceId)?.name ?? 'Servicio';
  }

  /**
   * A picked photo is not uploaded straight away: first it gets its caption
   * and service, which `POST /businesses/me/portfolio` takes in the same
   * multipart request (`caption`, `serviceId`), so it never lands untagged.
   */
  pick(file: File): void {
    this.draftUrl.set(URL.createObjectURL(file));
    this.draftFile = file;
    this.draftForm = { caption: '', serviceId: null };
    this.adding.set(true);
  }

  cancelAdd(): void {
    this.adding.set(false);
    this.draftFile = null;
    this.draftUrl.set(null);
    // Recreate the picker so it forgets the preview of the discarded photo.
    this.pickerKey.update((key) => key + 1);
  }

  async add(): Promise<void> {
    const file = this.draftFile;
    if (!file) return;
    this.uploading.set(true);
    try {
      await this.api.upload('/businesses/me/portfolio', file, {
        caption: this.draftForm.caption.trim() || null,
        serviceId: this.draftForm.serviceId,
      });
      await this.setup.portfolio.reload();
      this.toasts.show('Foto subida');
      this.cancelAdd();
    } catch (cause) {
      this.toasts.error(message(cause) || 'No se ha podido subir la foto.');
    } finally {
      this.uploading.set(false);
    }
  }

  startEdit(photo: PortfolioImage): void {
    this.form = { caption: photo.caption ?? '', serviceId: photo.serviceId };
    this.editing.set(photo);
  }

  async saveEdit(): Promise<void> {
    const photo = this.editing();
    if (!photo) return;
    this.busy.set(true);
    try {
      await this.api.put(`/businesses/me/portfolio/${photo.id}`, {
        caption: this.form.caption.trim() || null,
        serviceId: this.form.serviceId,
      });
      await this.setup.portfolio.reload();
      this.editing.set(null);
      this.toasts.show('Foto guardada');
    } catch {
      this.toasts.error('No se ha podido guardar.');
    } finally {
      this.busy.set(false);
    }
  }

  async move(photo: PortfolioImage, direction: -1 | 1): Promise<void> {
    const ids = this.photos().map((item) => item.id);
    const index = ids.indexOf(photo.id);
    const target = index + direction;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    const before = this.photos();
    this.setup.portfolio.set([...before].sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id)));
    try {
      await this.api.put('/businesses/me/portfolio/order', { imageIds: ids });
    } catch {
      this.setup.portfolio.set(before);
      this.toasts.error('No se ha podido cambiar el orden.');
    }
  }

  async remove(photo: PortfolioImage): Promise<void> {
    const answer = await this.confirm.ask({
      title: 'Quitar la foto',
      message: 'Dejará de verse en tu ficha. No se puede deshacer.',
      confirmLabel: 'Quitar',
      destructive: true,
    });
    if (!answer.ok) return;
    try {
      await this.api.delete(`/businesses/me/portfolio/${photo.id}`);
      await this.setup.portfolio.reload();
      this.editing.set(null);
      this.toasts.show('Foto quitada');
    } catch {
      this.toasts.error('No se ha podido quitar.');
    }
  }
}
