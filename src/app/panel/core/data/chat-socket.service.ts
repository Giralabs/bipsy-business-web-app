import { Injectable, NgZone, inject, signal } from '@angular/core';
import { Api } from '../api/api';
import { API_URL } from '../api/api.config';
import { ChatMessage, ChatSide } from '../api/models';
import { TokenStorage } from '../auth/token-storage';

/**
 * What travels down `/ws/chat` (`ChatSocketEvents.java`), plus two local
 * signals: `connected` (there may have been a gap, resync) and `down`.
 */
export type ChatSocketEvent =
  | { type: 'message.created'; conversationId: number; message: ChatMessage }
  | { type: 'conversation.read'; conversationId: number; side: ChatSide; at: string | null }
  | { type: 'conversation.delivered'; conversationId: number; side: ChatSide; at: string | null }
  | { type: 'connected' }
  | { type: 'down' };

export type ChatSocketState = 'idle' | 'connecting' | 'open' | 'down';

/**
 * The live chat channel, twin of `packages/gipsi_api/.../chat_socket.dart`.
 *
 * Protocol, read from the backend (`WebSocketConfig`, `ChatSocketHandler`,
 * `JwtAuthenticationFilter`): a raw WebSocket (no STOMP, no SockJS) at
 * `/ws/chat`, server → client only, one JSON object per text frame with a
 * `type` field. Sending always goes through REST. A browser cannot set an
 * `Authorization` header on the handshake, so the token rides as the second
 * item of the subprotocol list — `['bipsy-bearer', <jwt>]` — and the server
 * answers with `bipsy-bearer` alone.
 *
 * The handshake is the only moment the token is checked. When it has expired
 * the server answers 403, which a browser only reports as a close before
 * `open`: that is the cue to poke the API once, so the interceptor refreshes
 * the session, and retry with the new token.
 */
@Injectable({ providedIn: 'root' })
export class ChatSocketService {
  private readonly storage = inject(TokenStorage);
  private readonly api = inject(Api);
  private readonly zone = inject(NgZone);

  private static readonly PROTOCOL = 'bipsy-bearer';
  private static readonly MIN_BACKOFF_MS = 2_000;
  private static readonly MAX_BACKOFF_MS = 30_000;
  /** Idle proxies (Render included) drop quiet sockets; the server ignores what it receives. */
  private static readonly KEEPALIVE_MS = 25_000;

  readonly state = signal<ChatSocketState>('idle');

  private socket: WebSocket | null = null;
  private wanted = false;
  private backoff = ChatSocketService.MIN_BACKOFF_MS;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private keepAlive: ReturnType<typeof setInterval> | null = null;
  /** The token the last handshake was attempted with. */
  private lastToken: string | null = null;
  private readonly listeners = new Set<(event: ChatSocketEvent) => void>();

  constructor() {
    if (typeof document !== 'undefined') {
      // Coming back to the tab: the OS may have killed the connection while it slept.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') this.retryNow();
      });
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.retryNow());
    }
  }

  /** Subscribe to events. Returns the unsubscribe function. */
  listen(handler: (event: ChatSocketEvent) => void): () => void {
    this.listeners.add(handler);
    return () => this.listeners.delete(handler);
  }

  /** Opens the channel and keeps it open until `disconnect()`. Idempotent. */
  connect(): void {
    if (this.wanted) return;
    this.wanted = true;
    this.backoff = ChatSocketService.MIN_BACKOFF_MS;
    this.open();
  }

  /** Closes and stops retrying: on logout, or when chat is switched off. */
  disconnect(): void {
    this.wanted = false;
    this.clearRetry();
    this.closeSocket();
    this.state.set('idle');
  }

  /** Tries now instead of waiting for the backoff. */
  retryNow(): void {
    if (!this.wanted || this.socket) return;
    this.clearRetry();
    this.backoff = ChatSocketService.MIN_BACKOFF_MS;
    this.open();
  }

  private open(): void {
    if (!this.wanted || this.socket || typeof WebSocket === 'undefined') return;
    const token = this.storage.accessToken;
    if (!token) {
      // No session, nothing to listen to. `connect()` is called again after login.
      this.wanted = false;
      this.state.set('idle');
      return;
    }
    this.lastToken = token;
    this.state.set('connecting');

    let socket: WebSocket;
    try {
      socket = new WebSocket(wsUrl(), [ChatSocketService.PROTOCOL, token]);
    } catch {
      this.onFailure(false);
      return;
    }
    this.socket = socket;
    let opened = false;

    // The socket lives outside Angular's zone: the keep-alive and the retries
    // must not keep change detection busy. Events re-enter the zone to emit.
    socket.onopen = () => {
      opened = true;
      this.backoff = ChatSocketService.MIN_BACKOFF_MS;
      this.zone.run(() => {
        this.state.set('open');
        this.emit({ type: 'connected' });
      });
      this.zone.runOutsideAngular(() => {
        this.keepAlive = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) socket.send('ping');
        }, ChatSocketService.KEEPALIVE_MS);
      });
    };
    socket.onmessage = (frame) => {
      if (typeof frame.data !== 'string') return;
      const event = parse(frame.data);
      if (event) this.zone.run(() => this.emit(event));
    };
    socket.onclose = () => {
      if (this.socket !== socket) return;
      this.socket = null;
      this.stopKeepAlive();
      this.zone.run(() => this.onFailure(!opened));
    };
    // `onerror` is always followed by `onclose`, which does the work.
    socket.onerror = () => undefined;
  }

  private onFailure(handshakeFailed: boolean): void {
    if (!this.wanted) return;
    this.state.set('down');
    this.emit({ type: 'down' });
    if (handshakeFailed) void this.refreshIfStale();
    this.scheduleRetry();
  }

  /**
   * A handshake that fails with the same token it was tried with is, most of
   * the time, an expired access token. Any authenticated REST call lets the
   * interceptor refresh it (with its single-flight lock); if the token changed,
   * retry at once instead of waiting.
   */
  private async refreshIfStale(): Promise<void> {
    const before = this.lastToken;
    try {
      await this.api.get('/conversations/unread-count');
    } catch {
      // Offline or the session is gone: the backoff (or the logout) takes over.
    }
    const now = this.storage.accessToken;
    if (now && now !== before) this.retryNow();
  }

  private scheduleRetry(): void {
    if (!this.wanted || this.retryTimer) return;
    const wait = this.backoff;
    this.backoff = Math.min(this.backoff * 2, ChatSocketService.MAX_BACKOFF_MS);
    this.zone.runOutsideAngular(() => {
      this.retryTimer = setTimeout(() => {
        this.retryTimer = null;
        this.zone.run(() => this.open());
      }, wait);
    });
  }

  private clearRetry(): void {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
  }

  private stopKeepAlive(): void {
    if (this.keepAlive) clearInterval(this.keepAlive);
    this.keepAlive = null;
  }

  private closeSocket(): void {
    const socket = this.socket;
    this.socket = null;
    this.stopKeepAlive();
    if (socket) {
      socket.onopen = socket.onmessage = socket.onclose = socket.onerror = null;
      try {
        socket.close(1000);
      } catch {
        // Already closing.
      }
    }
  }

  private emit(event: ChatSocketEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        // One broken listener must not take the channel with it.
        console.error('[bipsy] chat socket listener', error);
      }
    }
  }
}

/** Same base as the REST API, with ws/wss instead of http/https. */
function wsUrl(): string {
  return API_URL.replace(/\/$/, '').replace(/^http/i, 'ws') + '/ws/chat';
}

/** An event we cannot read is ignored, never fatal: probably a newer backend. */
function parse(raw: string): ChatSocketEvent | null {
  try {
    const json = JSON.parse(raw) as Record<string, unknown>;
    const conversationId = Number(json['conversationId']);
    if (!Number.isFinite(conversationId)) return null;
    switch (json['type']) {
      case 'message.created':
        if (!json['message']) return null;
        return { type: 'message.created', conversationId, message: json['message'] as ChatMessage };
      case 'conversation.read':
      case 'conversation.delivered':
        return {
          type: json['type'] as 'conversation.read' | 'conversation.delivered',
          conversationId,
          side: (json['side'] as ChatSide) ?? 'SYSTEM',
          at: (json['at'] as string | null) ?? null,
        };
      default:
        return null;
    }
  } catch {
    return null;
  }
}
