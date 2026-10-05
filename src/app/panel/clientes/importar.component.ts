import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api } from '../core/api/api';
import { CustomersStore } from '../core/data/customers.store';
import { plural } from '../core/util/format';
import { PnEmptyComponent } from '../ui/controls';
import { ToastService } from '../ui/toast.service';
import {
  CONTACT_FILE_ACCEPT,
  RawContact,
  addressBookAvailable,
  contactKey,
  looksLikeContactFile,
  parseContacts,
  pickFromAddressBook,
  readContactFile,
} from './contacts-source';

/** A contact ready to be reviewed: what was read, plus what the panel knows. */
interface Row extends RawContact {
  keep: boolean;
  /** Already in the agenda — the server would skip it anyway. */
  known: boolean;
}

/** What `POST /businesses/me/customers/import` answers. */
interface ImportResult {
  imported: number;
  skipped: number;
}

/**
 * `/panel/clientes/importar` — the web twin of `import_contacts_screen.dart`.
 *
 * The app reads the phone's address book straight away. A desktop browser
 * cannot, so there are two ways in and no typing at all:
 *
 *  1. The Contact Picker API, when the browser has it (Chrome on Android over
 *     https). That is the phone's real address book, same as the app.
 *  2. A file: the vCard or the CSV that Google Contacts, Outlook or the old
 *     booking program exports. Dropped in or picked, parsed here.
 *
 * From there it is the app's flow: everything lands ticked except what is
 * already in the agenda, and only what stays ticked is sent.
 */
@Component({
  selector: 'app-panel-importar',
  standalone: true,
  imports: [RouterLink, PnEmptyComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './importar.component.html',
  styleUrl: './importar.component.css',
})
export class ImportarComponent {
  /** The backend takes 500 per request (`ImportContactsRequest`). */
  private static readonly MAX_PER_IMPORT = 500;

  private readonly api = inject(Api);
  private readonly store = inject(CustomersStore);
  private readonly toasts = inject(ToastService);

  readonly accept = CONTACT_FILE_ACCEPT;
  readonly max = ImportarComponent.MAX_PER_IMPORT;

  /** Hidden where the browser cannot open an address book. */
  readonly canUseAddressBook = addressBookAvailable();

  readonly rows = signal<Row[]>([]);
  /** Where the list came from, to head the review column. */
  readonly origin = signal<string | null>(null);
  /** Read but unusable: no phone and no e-mail, so nobody to reach. */
  readonly dropped = signal(0);
  readonly reading = signal(false);
  readonly over = signal(false);
  readonly busy = signal(false);
  readonly result = signal<ImportResult | null>(null);

  readonly keeping = computed(() => this.rows().filter((row) => row.keep).length);
  readonly known = computed(() => this.rows().filter((row) => row.known).length);
  readonly overLimit = computed(() => this.keeping() > this.max);

  constructor() {
    // The duplicate flags need the agenda; it is cached, so this is free when
    // the list was already open.
    void this.store.load();
  }

  count(n: number, one: string, many: string): string {
    return plural(n, one, many);
  }

  // ----- 1. THE PHONE'S ADDRESS BOOK --------------------

  async fromAddressBook(): Promise<void> {
    this.reading.set(true);
    try {
      const contacts = await pickFromAddressBook();
      // An empty pick is the sheet being dismissed, not a failure.
      if (contacts.length === 0) return;
      this.take(contacts, 0, 'Agenda del móvil');
    } catch {
      this.toasts.error('No hemos podido abrir tu agenda. Prueba con un archivo.');
    } finally {
      this.reading.set(false);
    }
  }

  // ----- 2. A FILE --------------------

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.over.set(true);
  }

  onDragLeave(): void {
    this.over.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.over.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) void this.readFile(file);
  }

  onPick(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    // Cleared so picking the same file twice still fires a change.
    input.value = '';
    if (file) void this.readFile(file);
  }

  private async readFile(file: File): Promise<void> {
    if (!looksLikeContactFile(file)) {
      this.toasts.error('Usa un archivo .vcf o .csv exportado de tus contactos.');
      return;
    }

    this.reading.set(true);
    try {
      const { contacts, dropped } = parseContacts(await readContactFile(file));
      if (contacts.length === 0) {
        this.toasts.error('No hemos encontrado contactos en ese archivo.');
        return;
      }
      this.take(contacts, dropped, file.name);
    } catch {
      this.toasts.error('No hemos podido leer ese archivo.');
    } finally {
      this.reading.set(false);
    }
  }

  // ----- REVIEW --------------------

  /**
   * Turns what was read into the review list: the same person twice in one
   * file collapses into one row, and whoever is already in the agenda comes
   * unticked, because importing them again does nothing.
   */
  private take(contacts: RawContact[], dropped: number, origin: string): void {
    const inAgenda = new Set(this.store.all().map(contactKey));
    const seen = new Set<string>();
    const rows: Row[] = [];
    let ticked = 0;

    for (const contact of contacts) {
      const key = contactKey(contact);
      if (seen.has(key)) continue;
      seen.add(key);
      const known = inAgenda.has(key);
      // Past the server's limit they come unticked instead of failing later.
      const keep = !known && ticked < this.max;
      if (keep) ticked++;
      rows.push({ ...contact, known, keep });
    }

    this.result.set(null);
    this.dropped.set(dropped);
    this.origin.set(origin);
    this.rows.set(rows);
  }

  toggle(index: number): void {
    this.rows.set(
      this.rows().map((row, i) => (i === index ? { ...row, keep: !row.keep } : row)),
    );
  }

  toggleAll(keep: boolean): void {
    this.rows.set(this.rows().map((row) => ({ ...row, keep })));
  }

  /** Back to the two ways in, without reloading the screen. */
  startOver(): void {
    this.rows.set([]);
    this.origin.set(null);
    this.dropped.set(0);
    this.result.set(null);
  }

  // ----- IMPORT --------------------

  async save(): Promise<void> {
    const contacts = this.rows()
      .filter((row) => row.keep)
      .map((row) => ({ name: row.name, phone: row.phone, email: row.email }));
    if (contacts.length === 0) return;
    if (contacts.length > this.max) {
      this.toasts.error(`Puedes importar hasta ${this.max} contactos de una vez.`);
      return;
    }

    this.busy.set(true);
    try {
      const result = await this.api.post<ImportResult>('/businesses/me/customers/import', {
        contacts,
      });
      await this.store.customers.reload();
      this.result.set(result);
      this.rows.set([]);
    } catch {
      this.toasts.error('No se han podido importar. Inténtalo otra vez.');
    } finally {
      this.busy.set(false);
    }
  }
}
