import { Injectable, NgZone, computed, effect, inject, signal, untracked } from '@angular/core';
import { Api } from '../api/api';
import { ChatMessage, Conversation } from '../api/models';
import { AuthService } from '../auth/auth.service';
import { fromInstant } from '../util/dates';
import { ChatSocketEvent, ChatSocketService } from './chat-socket.service';
import { resource } from './resource';

/** How many messages a thread brings in one go (the backend caps it at 50). */
const PAGE_SIZE = 50;

/** Fallback when the socket cannot connect: re-read every 20 s. */
const POLL_MS = 20_000;

/** `PrivateMediaValidation.MAX_SIZE` in the backend. */
export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;

/** `PrivateMediaValidation.ALLOWED_TYPES`: MIME → extension. */
const ATTACHMENT_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'application/pdf': 'pdf',
  'text/plain': 'txt',
  'text/csv': 'csv',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
};

/** For the file picker's `accept`. */
export const ATTACHMENT_ACCEPT = [
  ...Object.keys(ATTACHMENT_TYPES),
  ...Object.values(ATTACHMENT_TYPES).map((ext) => `.${ext}`),
  '.jpeg',
].join(',');

/** A message as the thread paints it: the server's, or an optimistic one on its way. */
export interface ThreadMessage extends ChatMessage {
  pending?: boolean;
  failed?: boolean;
  /** The picked file, kept to retry and to preview an image before it uploads. */
  localFile?: File;
}

/** Clock → one tick → two ticks → two ticks in blue, like the app. */
export type Delivery = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';

/**
 * Messages with customers. Twin of `chat_providers.dart` plus the socket
 * wiring of `chat_thread_screen.dart`.
 *
 * Live updates come from `ChatSocketService`, opened while
 * `AuthService.canUseChat()` holds (owner with chat on, or a worker allowed to
 * use the shared inbox). When the socket is down the store polls every 20 s,
 * and every (re)connection resyncs, because there may have been a gap.
 */
@Injectable({ providedIn: 'root' })
export class InboxStore {
  private readonly api = inject(Api);
  private readonly auth = inject(AuthService);
  private readonly socket = inject(ChatSocketService);
  private readonly zone = inject(NgZone);

  // A plain list, not a page: `ChatController.inbox` returns `List<ConversationResponse>`.
  readonly conversations = resource<Conversation[]>(
    () => this.api.get<Conversation[]>('/conversations', { size: 100 }).then(sortByRecent),
    [],
  );

  readonly openId = signal<number | null>(null);
  /** Oldest first, the order the thread is painted in. */
  readonly messages = signal<ThreadMessage[]>([]);
  readonly loadingThread = signal(false);
  readonly threadError = signal(false);
  readonly hasMore = signal(false);
  readonly loadingMore = signal(false);
  readonly sending = signal(false);
  /** Bumps whenever a message is appended at the bottom, so the view can scroll. */
  readonly appended = signal(0);

  readonly all = this.conversations.value;
  readonly unread = computed(() => this.all().reduce((sum, c) => sum + c.unread, 0));
  readonly open = computed(() => this.all().find((c) => c.id === this.openId()) ?? null);
  readonly live = computed(() => this.socket.state() === 'open');
  /** The socket failed and the store is polling in the meantime. */
  readonly offline = computed(() => this.socket.state() === 'down');

  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private readTimer: ReturnType<typeof setTimeout> | null = null;
  private reloadTimer: ReturnType<typeof setTimeout> | null = null;
  /** Guards against a slow thread load landing after the user moved on. */
  private threadToken = 0;

  constructor() {
    this.socket.listen((event) => this.onEvent(event));

    // The socket lives exactly as long as the right to use chat.
    effect(
      () => {
        const allowed = this.auth.canUseChat();
        untracked(() => {
          if (allowed) {
            this.socket.connect();
          } else {
            this.socket.disconnect();
            this.stopPolling();
            this.openId.set(null);
            this.messages.set([]);
          }
        });
      },
      { allowSignalWrites: true },
    );

    if (typeof document !== 'undefined') {
      // Back on the tab with a thread open: what arrived meanwhile is now read.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && (this.open()?.unread ?? 0) > 0) this.scheduleRead();
      });
    }
  }

  load(): Promise<void> {
    return this.conversations.load();
  }

  // === THREAD ================================================================

  async openThread(id: number): Promise<void> {
    const token = ++this.threadToken;
    if (this.openId() !== id) {
      this.openId.set(id);
      this.messages.set([]);
    }
    this.loadingThread.set(true);
    this.threadError.set(false);
    try {
      // The history comes newest first (cursor pagination with `beforeId`).
      const page = await this.api.get<ChatMessage[]>(`/conversations/${id}/messages`, { size: PAGE_SIZE });
      if (token !== this.threadToken) return;
      this.messages.set(mergeMessages(this.messages().filter((m) => m.pending || m.failed), page));
      this.hasMore.set(page.length === PAGE_SIZE);
      this.appended.update((n) => n + 1);
      await this.markRead(id);
    } catch {
      if (token === this.threadToken) this.threadError.set(true);
    } finally {
      if (token === this.threadToken) this.loadingThread.set(false);
    }
  }

  close(): void {
    this.threadToken++;
    this.openId.set(null);
    this.messages.set([]);
  }

  /** Older messages, with the oldest one we have as the cursor. */
  async loadMore(): Promise<void> {
    const id = this.openId();
    const oldest = this.messages().find((m) => m.id > 0);
    if (!id || !oldest || this.loadingMore() || !this.hasMore()) return;
    this.loadingMore.set(true);
    try {
      const older = await this.api.get<ChatMessage[]>(`/conversations/${id}/messages`, {
        beforeId: oldest.id,
        size: PAGE_SIZE,
      });
      if (this.openId() !== id) return;
      this.messages.set(mergeMessages(this.messages(), older));
      this.hasMore.set(older.length === PAGE_SIZE);
    } catch {
      // Failing to page back must not break the thread already on screen.
      this.hasMore.set(false);
    } finally {
      this.loadingMore.set(false);
    }
  }

  // === SENDING ===============================================================

  /** Sends with an optimistic bubble; the client id swaps it for the real one. */
  async send(body: string, retryOf?: ThreadMessage): Promise<void> {
    const id = this.openId();
    const text = body.trim();
    if (!id || !text) return;
    const clientId = retryOf?.clientMessageId ?? newClientId();
    this.putPending(retryOf ?? pendingMessage(clientId, 'TEXT', text));
    this.sending.set(true);
    try {
      // The client id makes a retry after a timeout return the same message
      // instead of sending it twice.
      const saved = await this.api.post<ChatMessage>(`/conversations/${id}/messages`, {
        body: text,
        clientMessageId: clientId,
      });
      this.confirm(id, clientId, saved);
    } catch {
      this.markFailed(clientId);
    } finally {
      this.sending.set(false);
    }
  }

  /**
   * One file per request, like the backend wants. Checked here first with the
   * backend's own rules and words, so a 10 MB video does not travel for nothing.
   * Returns the reason when it is refused.
   */
  async sendAttachment(file: File, retryOf?: ThreadMessage): Promise<string | null> {
    const id = this.openId();
    if (!id) return null;
    const normalized = normalizeFile(file);
    if (!normalized) {
      return 'Tipo de archivo no permitido. Adjunta imágenes (JPG, PNG, WebP, HEIC) o documentos (PDF, Word, TXT, CSV)';
    }
    if (normalized.size > ATTACHMENT_MAX_BYTES) return 'El archivo supera el tamaño máximo de 10 MB';
    if (normalized.size === 0) return 'El archivo está vacío';

    const clientId = retryOf?.clientMessageId ?? newClientId();
    const kind = normalized.type.startsWith('image/') ? 'IMAGE' : 'FILE';
    this.putPending(
      retryOf ?? {
        ...pendingMessage(clientId, kind, null),
        attachment: { filename: normalized.name, contentType: normalized.type, sizeBytes: normalized.size, url: '' },
        localFile: normalized,
      },
    );
    try {
      const saved = await this.api.upload<ChatMessage>(
        `/conversations/${id}/messages/attachment?clientMessageId=${encodeURIComponent(clientId)}`,
        normalized,
      );
      this.confirm(id, clientId, saved);
      return null;
    } catch (cause) {
      this.markFailed(clientId);
      const detail = (cause as { error?: { message?: string } }).error?.message;
      return detail ?? null;
    }
  }

  /** Retries a failed send with the SAME client id: never two messages. */
  retry(message: ThreadMessage): Promise<unknown> {
    if (message.localFile) return this.sendAttachment(message.localFile, message);
    return this.send(message.body ?? '', message);
  }

  /** Starts (or reuses) the thread with a customer, from their file, and leaves it selected. */
  async openWithCustomer(customerId: number): Promise<number> {
    const conversation = await this.api.post<Conversation>('/conversations', { customerId });
    await this.conversations.reload();
    if (!this.all().some((c) => c.id === conversation.id)) {
      this.conversations.set(sortByRecent([conversation, ...this.all()]));
    }
    this.threadToken++;
    this.openId.set(conversation.id);
    this.messages.set([]);
    return conversation.id;
  }

  // === DELIVERY ==============================================================

  /** Derived from the conversation's two watermarks, not a per-message flag. */
  deliveryOf(message: ThreadMessage): Delivery {
    if (message.failed) return 'failed';
    if (message.pending) return 'pending';
    const conversation = this.open();
    if (!conversation) return 'sent';
    const at = fromInstant(message.createdAt).getTime();
    if (conversation.otherLastReadAt && fromInstant(conversation.otherLastReadAt).getTime() >= at) return 'read';
    if (conversation.otherLastDeliveredAt && fromInstant(conversation.otherLastDeliveredAt).getTime() >= at) {
      return 'delivered';
    }
    return 'sent';
  }

  // === SOCKET EVENTS =========================================================

  private onEvent(event: ChatSocketEvent): void {
    switch (event.type) {
      case 'connected':
        this.stopPolling();
        void this.resync();
        return;
      case 'down':
        this.startPolling();
        return;
      case 'message.created':
        this.onIncoming(event.conversationId, event.message);
        return;
      case 'conversation.read':
        // The customer read: our bubbles turn blue. A teammate read: the shared
        // inbox has nothing pending in that thread any more.
        this.patchConversation(event.conversationId, (c) =>
          event.side === 'CUSTOMER'
            ? { ...c, otherLastReadAt: latest(c.otherLastReadAt, event.at) }
            : event.side === 'BUSINESS'
              ? { ...c, unread: 0 }
              : c,
        );
        return;
      case 'conversation.delivered':
        if (event.side === 'CUSTOMER') {
          this.patchConversation(event.conversationId, (c) => ({
            ...c,
            otherLastDeliveredAt: latest(c.otherLastDeliveredAt, event.at),
          }));
        }
        return;
    }
  }

  private onIncoming(conversationId: number, message: ChatMessage): void {
    const isOpen = this.openId() === conversationId;
    if (isOpen) {
      const before = this.messages().length;
      this.messages.set(mergeMessages(this.messages(), [message]));
      if (this.messages().length !== before) this.appended.update((n) => n + 1);
    }

    const known = this.all().some((c) => c.id === conversationId);
    if (!known) {
      // A thread we did not have: the server knows its name and picture.
      this.scheduleReload();
    } else {
      const fromCustomer = message.side === 'CUSTOMER';
      const seen = isOpen && isVisible();
      this.patchConversation(conversationId, (c) => ({
        ...c,
        lastMessagePreview: previewOf(message),
        lastMessageSide: message.side,
        lastMessageAt: message.createdAt,
        unread: fromCustomer && !seen ? c.unread + 1 : c.unread,
      }));
      this.conversations.set(sortByRecent(this.all()));
    }

    if (isOpen && message.side === 'CUSTOMER' && isVisible()) this.scheduleRead();
  }

  /** After a (re)connection: re-read what is on screen, there may have been a gap. */
  private async resync(): Promise<void> {
    await this.conversations.reload();
    const id = this.openId();
    if (id) await this.refreshThread(id);
  }

  /** Polling tick: the list, and the newest page of the open thread merged in. */
  private async poll(): Promise<void> {
    if (!this.auth.canUseChat()) return;
    await this.conversations.reload();
    const id = this.openId();
    if (id && isVisible()) await this.refreshThread(id);
  }

  private async refreshThread(id: number): Promise<void> {
    try {
      const page = await this.api.get<ChatMessage[]>(`/conversations/${id}/messages`, { size: PAGE_SIZE });
      if (this.openId() !== id) return;
      const before = this.messages().length;
      this.messages.set(mergeMessages(this.messages(), page));
      if (this.messages().length !== before) this.appended.update((n) => n + 1);
      if ((this.open()?.unread ?? 0) > 0 && isVisible()) this.scheduleRead();
    } catch {
      // A courtesy refresh; the next tick or event corrects it.
    }
  }

  private startPolling(): void {
    if (this.pollTimer || !this.auth.canUseChat()) return;
    this.zone.runOutsideAngular(() => {
      this.pollTimer = setInterval(() => this.zone.run(() => void this.poll()), POLL_MS);
    });
  }

  private stopPolling(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = null;
  }

  // === READ ==================================================================

  /** Several messages in a burst make one `PUT /read`, not one each. */
  private scheduleRead(): void {
    if (this.readTimer) clearTimeout(this.readTimer);
    this.readTimer = setTimeout(() => {
      this.readTimer = null;
      const id = this.openId();
      if (id) void this.markRead(id);
    }, 400);
  }

  private async markRead(id: number): Promise<void> {
    try {
      await this.api.put(`/conversations/${id}/read`);
      this.patchConversation(id, (c) => ({ ...c, unread: 0 }));
    } catch {
      // Not worth bothering anyone: the next open marks it again.
    }
  }

  private scheduleReload(): void {
    if (this.reloadTimer) return;
    this.reloadTimer = setTimeout(() => {
      this.reloadTimer = null;
      void this.conversations.reload();
    }, 300);
  }

  // === HELPERS ===============================================================

  private patchConversation(id: number, fn: (c: Conversation) => Conversation): void {
    const list = this.all();
    if (!list.some((c) => c.id === id)) return;
    this.conversations.set(list.map((c) => (c.id === id ? fn(c) : c)));
  }

  private putPending(message: ThreadMessage): void {
    const clientId = message.clientMessageId;
    const rest = this.messages().filter((m) => m.clientMessageId !== clientId);
    this.messages.set([...rest, { ...message, pending: true, failed: false }]);
    this.appended.update((n) => n + 1);
  }

  /** Swaps the optimistic bubble for the server's, unless the socket beat us to it. */
  private confirm(conversationId: number, clientId: string, saved: ChatMessage): void {
    if (this.openId() === conversationId) {
      const withoutPending = this.messages().filter((m) => m.clientMessageId !== clientId);
      this.messages.set(mergeMessages(withoutPending, [saved]));
    }
    this.patchConversation(conversationId, (c) => ({
      ...c,
      lastMessagePreview: previewOf(saved),
      lastMessageSide: saved.side,
      lastMessageAt: saved.createdAt,
    }));
    this.conversations.set(sortByRecent(this.all()));
  }

  private markFailed(clientId: string): void {
    this.messages.set(
      this.messages().map((m) => (m.clientMessageId === clientId ? { ...m, pending: false, failed: true } : m)),
    );
  }
}

// === PURE HELPERS ============================================================

/**
 * Merges messages into the thread, oldest first, without duplicates: a message
 * the sender got by REST also comes down the socket to the rest of the team.
 * Local bubbles (pending or failed) stay at the bottom.
 */
function mergeMessages(current: ThreadMessage[], incoming: ChatMessage[]): ThreadMessage[] {
  const byId = new Map<number, ThreadMessage>();
  const local: ThreadMessage[] = [];
  const incomingClientIds = new Set(incoming.map((m) => m.clientMessageId).filter(Boolean));
  for (const m of current) {
    if (m.pending || m.failed) {
      if (!m.clientMessageId || !incomingClientIds.has(m.clientMessageId)) local.push(m);
    } else {
      byId.set(m.id, m);
    }
  }
  for (const m of incoming) byId.set(m.id, m);
  const confirmed = [...byId.values()].sort(
    (a, b) => fromInstant(a.createdAt).getTime() - fromInstant(b.createdAt).getTime() || a.id - b.id,
  );
  return [...confirmed, ...local];
}

function sortByRecent(list: Conversation[]): Conversation[] {
  const time = (c: Conversation) => fromInstant(c.lastMessageAt ?? c.createdAt).getTime() || 0;
  return [...list].sort((a, b) => time(b) - time(a));
}

/** Same words the backend uses for the push and the inbox preview. */
function previewOf(message: ChatMessage): string | null {
  if (message.kind === 'IMAGE') return message.attachment?.filename ?? 'Foto';
  if (message.kind === 'FILE') return message.attachment?.filename ?? 'Archivo';
  const body = message.body ?? '';
  return body.length > 120 ? `${body.slice(0, 120)}…` : body || null;
}

function latest(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return fromInstant(b).getTime() > fromInstant(a).getTime() ? b : a;
}

function pendingMessage(clientId: string, kind: ChatMessage['kind'], body: string | null): ThreadMessage {
  return {
    id: -Date.now(),
    side: 'BUSINESS',
    kind,
    body,
    senderId: null,
    senderName: null,
    attachment: null,
    booking: null,
    clientMessageId: clientId,
    createdAt: new Date().toISOString(),
    pending: true,
  };
}

/**
 * Browsers leave `type` empty for HEIC, and Windows calls a CSV
 * `application/vnd.ms-excel`; the backend only reads the part's content type.
 * The extension fills the gap.
 */
function normalizeFile(file: File): File | null {
  const type = file.type.split(';')[0].trim().toLowerCase();
  if (type in ATTACHMENT_TYPES) return file;
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  const byExt = ext === 'jpeg' ? 'image/jpeg' : Object.keys(ATTACHMENT_TYPES).find((k) => ATTACHMENT_TYPES[k] === ext);
  return byExt ? new File([file], file.name, { type: byExt }) : null;
}

function isVisible(): boolean {
  return typeof document === 'undefined' || document.visibilityState === 'visible';
}

function newClientId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}
