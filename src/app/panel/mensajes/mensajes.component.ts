import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  ViewChild,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ATTACHMENT_ACCEPT, InboxStore, ThreadMessage } from '../core/data/inbox.store';
import { ago, fromInstant, hhmm, isSameDay, relativeDay, shortDate, toDate, toIso } from '../core/util/dates';
import { PnAvatarComponent, PnEmptyComponent, PnErrorComponent } from '../ui/controls';
import { ToastService } from '../ui/toast.service';
import { ChatAttachments } from './chat-attachments';

/** The image being looked at full size. */
interface Viewing {
  message: ThreadMessage;
  url: string;
}

/**
 * `/panel/mensajes` — `chat_inbox_screen.dart` and `chat_thread_screen.dart`
 * side by side, which is what a wide screen is for: the list never disappears
 * to read a message.
 *
 * Live through `InboxStore` (WebSocket, with polling as the fallback).
 * Attachments are private, so `ChatAttachments` fetches them with the token
 * and hands out object URLs that die with this screen.
 */
@Component({
  selector: 'app-panel-mensajes',
  standalone: true,
  imports: [FormsModule, PnAvatarComponent, PnEmptyComponent, PnErrorComponent],
  providers: [ChatAttachments],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './mensajes.component.html',
  styleUrl: './mensajes.component.css',
})
export class MensajesComponent {
  readonly inbox = inject(InboxStore);
  readonly files = inject(ChatAttachments);
  private readonly toasts = inject(ToastService);

  readonly hhmm = hhmm;
  readonly fromInstant = fromInstant;
  readonly relativeDay = relativeDay;
  readonly accept = ATTACHMENT_ACCEPT;

  @ViewChild('thread') private threadRef?: ElementRef<HTMLElement>;
  @ViewChild('picker') private pickerRef?: ElementRef<HTMLInputElement>;

  draft = '';
  readonly dragging = signal(false);
  readonly viewing = signal<Viewing | null>(null);

  constructor() {
    void this.inbox.load();

    // Coming from a customer's file, the thread is already chosen: open it.
    const preselected = this.inbox.openId();
    if (preselected) this.open(preselected);

    // New message at the bottom: follow it, unless the user is reading far up.
    effect(() => {
      this.inbox.appended();
      // After the view has painted the new bubble.
      untracked(() => setTimeout(() => this.followBottom()));
    });
  }

  /**
   * Chat timestamps are instants (UTC, with a `Z`); `ago()` reads wall-clock
   * strings, so the instant is turned into local wall-clock time first.
   */
  agoInstant(value: string): string {
    return ago(toIso(fromInstant(value)));
  }

  open(id: number): void {
    this.draft = this.inbox.openId() === id ? this.draft : '';
    this.forceBottom = true;
    void this.inbox.openThread(id);
  }

  async send(): Promise<void> {
    const text = this.draft.trim();
    if (!text) return;
    this.draft = '';
    this.forceBottom = true;
    await this.inbox.send(text);
  }

  onKey(event: KeyboardEvent): void {
    // Enter sends, Shift+Enter breaks the line: what everyone expects.
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      void this.send();
    }
  }

  // === ATTACHMENTS ===========================================================

  pick(): void {
    this.pickerRef?.nativeElement.click();
  }

  onPicked(event: Event): void {
    const input = event.target as HTMLInputElement;
    const picked = Array.from(input.files ?? []);
    input.value = '';
    void this.upload(picked);
  }

  /** A screenshot pasted into the box goes as an image, like in any desk chat. */
  onPaste(event: ClipboardEvent): void {
    const pasted = Array.from(event.clipboardData?.files ?? []);
    if (pasted.length === 0) return;
    event.preventDefault();
    void this.upload(pasted);
  }

  onDragOver(event: DragEvent): void {
    if (!this.canWrite() || !event.dataTransfer?.types.includes('Files')) return;
    event.preventDefault();
    this.dragging.set(true);
  }

  onDragLeave(event: DragEvent): void {
    const target = event.currentTarget as HTMLElement;
    if (!target.contains(event.relatedTarget as Node | null)) this.dragging.set(false);
  }

  onDrop(event: DragEvent): void {
    this.dragging.set(false);
    if (!this.canWrite()) return;
    event.preventDefault();
    void this.upload(Array.from(event.dataTransfer?.files ?? []));
  }

  retry(message: ThreadMessage): void {
    void this.inbox.retry(message).then((reason) => {
      if (typeof reason === 'string') this.toasts.error(reason);
    });
  }

  /** Thumbnail of an image: the local file while it uploads, the server's after. */
  imageUrl(message: ThreadMessage): string | null {
    if (message.localFile) return this.files.local(message.localFile);
    const id = this.inbox.openId();
    if (!id || message.id <= 0) return null;
    const state = this.files.get(id, message.id)();
    return state.status === 'ready' ? state.url : null;
  }

  imageFailed(message: ThreadMessage): boolean {
    const id = this.inbox.openId();
    if (!id || message.id <= 0 || message.localFile) return false;
    return this.files.get(id, message.id)().status === 'error';
  }

  retryImage(message: ThreadMessage): void {
    const id = this.inbox.openId();
    if (id) this.files.retry(id, message.id);
  }

  view(message: ThreadMessage): void {
    const url = this.imageUrl(message);
    if (url) this.viewing.set({ message, url });
  }

  /** Files are downloaded through the same authenticated blob, with their own name. */
  async download(message: ThreadMessage): Promise<void> {
    const id = this.inbox.openId();
    if (!message.attachment) return;
    let url: string | null = null;
    if (message.localFile) url = this.files.local(message.localFile);
    else if (id && message.id > 0) url = await this.files.url(id, message.id);
    if (!url) {
      this.toasts.error('No se ha podido descargar el archivo.');
      return;
    }
    const link = document.createElement('a');
    link.href = url;
    link.download = message.attachment.filename;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  @HostListener('document:keydown.escape')
  closeViewer(): void {
    this.viewing.set(null);
  }

  // === VIEW HELPERS ==========================================================

  canWrite(): boolean {
    return !!this.inbox.openId() && this.inbox.open()?.canWrite !== false;
  }

  /** A day separator above the first message of each day, like the app. */
  startsDay(index: number): boolean {
    const list = this.inbox.messages();
    if (index === 0) return !this.inbox.hasMore();
    return !isSameDay(fromInstant(list[index].createdAt), fromInstant(list[index - 1].createdAt));
  }

  /** «3 mar · 10:30» — the booking a message quotes is wall-clock time. */
  bookingWhen(startDateTime: string): string {
    const date = toDate(startDateTime);
    return `${shortDate(date)} · ${hhmm(date)}`;
  }

  sizeLabel(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
  }

  fileIcon(contentType: string): string {
    if (contentType === 'application/pdf') return 'picture_as_pdf';
    if (contentType.startsWith('text/')) return 'description';
    return 'draft';
  }

  trackMessage(message: ThreadMessage): string | number {
    return message.clientMessageId && (message.pending || message.failed) ? message.clientMessageId : message.id;
  }

  // === SCROLL ================================================================

  /** Set when the user acts (open, send): then the thread always goes down. */
  private forceBottom = false;

  private followBottom(): void {
    const element = this.threadRef?.nativeElement;
    // Nothing painted yet: keep the intent for when the thread arrives.
    if (!element || this.inbox.messages().length === 0) return;
    const nearBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 160;
    if (this.forceBottom || nearBottom) element.scrollTop = element.scrollHeight;
    this.forceBottom = false;
  }

  /** Older messages go on top without moving what the user is reading. */
  async loadOlder(): Promise<void> {
    const element = this.threadRef?.nativeElement;
    const before = element ? element.scrollHeight - element.scrollTop : 0;
    await this.inbox.loadMore();
    setTimeout(() => {
      if (element) element.scrollTop = element.scrollHeight - before;
    });
  }

  /** A thumbnail that arrives grows the thread: stay at the bottom if we were there. */
  onImageLoad(event: Event): void {
    const element = this.threadRef?.nativeElement;
    const image = event.target as HTMLElement;
    if (!element) return;
    const gap = element.scrollHeight - element.scrollTop - element.clientHeight;
    if (gap < image.offsetHeight + 160) element.scrollTop = element.scrollHeight;
  }

  private async upload(picked: File[]): Promise<void> {
    if (!this.canWrite()) return;
    // One file per request, as the backend wants; in order.
    for (const file of picked) {
      this.forceBottom = true;
      const reason = await this.inbox.sendAttachment(file);
      if (reason) this.toasts.error(reason);
    }
  }
}
