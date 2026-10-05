import { HttpClient } from '@angular/common/http';
import { Injectable, OnDestroy, Signal, WritableSignal, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_URL } from '../core/api/api.config';

export type AttachmentState =
  | { status: 'loading' }
  | { status: 'ready'; url: string }
  | { status: 'error' };

interface Entry {
  state: WritableSignal<AttachmentState>;
  done: Promise<string | null>;
}

/**
 * Chat attachments are private: `GET /conversations/{id}/messages/{mid}/attachment`
 * wants the bearer token, so neither `<img src>` nor a plain link can load
 * them. They come as blobs through `HttpClient` (the interceptor signs and
 * refreshes) and are shown through object URLs, one download per message.
 *
 * Provided by the screen, so it dies with it and every URL is revoked.
 * The twin of `_attachments` in `chat_thread_screen.dart`.
 */
@Injectable()
export class ChatAttachments implements OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly remote = new Map<string, Entry>();
  private readonly locals = new Map<File, string>();
  private readonly urls = new Set<string>();
  private destroyed = false;

  /** State of a server attachment, fetched on first ask. */
  get(conversationId: number, messageId: number): Signal<AttachmentState> {
    return this.entry(conversationId, messageId).state;
  }

  /** Resolves with the object URL once the blob is there (null if it failed). */
  url(conversationId: number, messageId: number): Promise<string | null> {
    return this.entry(conversationId, messageId).done;
  }

  /** Tries a failed download again. */
  retry(conversationId: number, messageId: number): void {
    const key = `${conversationId}:${messageId}`;
    if (this.remote.get(key)?.state().status === 'error') this.remote.delete(key);
    this.entry(conversationId, messageId);
  }

  /** Object URL of a picked file, for the preview while it uploads. */
  local(file: File): string {
    let url = this.locals.get(file);
    if (!url) {
      url = this.track(URL.createObjectURL(file));
      this.locals.set(file, url);
    }
    return url;
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    for (const url of this.urls) URL.revokeObjectURL(url);
    this.urls.clear();
    this.remote.clear();
    this.locals.clear();
  }

  private entry(conversationId: number, messageId: number): Entry {
    const key = `${conversationId}:${messageId}`;
    let entry = this.remote.get(key);
    if (!entry) {
      const state = signal<AttachmentState>({ status: 'loading' });
      entry = { state, done: this.fetch(conversationId, messageId, state) };
      this.remote.set(key, entry);
    }
    return entry;
  }

  private async fetch(
    conversationId: number,
    messageId: number,
    state: WritableSignal<AttachmentState>,
  ): Promise<string | null> {
    try {
      const blob = await firstValueFrom(
        this.http.get(`${API_URL}/conversations/${conversationId}/messages/${messageId}/attachment`, {
          responseType: 'blob',
        }),
      );
      // The screen may have closed while it downloaded: nothing left to revoke it.
      if (this.destroyed) return null;
      const url = this.track(URL.createObjectURL(blob));
      state.set({ status: 'ready', url });
      return url;
    } catch {
      state.set({ status: 'error' });
      return null;
    }
  }

  private track(url: string): string {
    this.urls.add(url);
    return url;
  }
}
