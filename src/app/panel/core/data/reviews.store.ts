import { Injectable, computed, inject } from '@angular/core';
import { Api } from '../api/api';
import { PageResponse, ReviewResponse } from '../api/models';
import { AuthService } from '../auth/auth.service';
import { resource } from './resource';

/** Reviews per request: the endpoint defaults to 20, which cut every average short. */
const PAGE_SIZE = 100;
/** Hard stop, so a runaway `last: false` can never loop forever (5,000 reviews). */
const MAX_PAGES = 50;

/**
 * Reviews received, and the replies. Twin of `reviews_providers.dart`.
 *
 * The backend has no stats endpoint for the owner, and the average, the count,
 * the star breakdown and «sin contestar» are all computed here, so every page
 * of `GET /reviews/business/{id}` (newest first) is read, not just the first.
 */
@Injectable({ providedIn: 'root' })
export class ReviewsStore {
  private readonly api = inject(Api);
  private readonly auth = inject(AuthService);

  readonly reviews = resource<ReviewResponse[]>(async () => {
    const id = this.auth.businessId() ?? 0;
    const all: ReviewResponse[] = [];
    for (let page = 0; page < MAX_PAGES; page++) {
      const chunk = await this.api.get<PageResponse<ReviewResponse>>(`/reviews/business/${id}`, {
        page,
        size: PAGE_SIZE,
      });
      all.push(...chunk.content);
      if (chunk.last || chunk.content.length === 0 || page + 1 >= chunk.totalPages) break;
    }
    return all;
  }, []);

  readonly all = this.reviews.value;
  readonly count = computed(() => this.all().length);

  readonly average = computed(() => {
    const list = this.all();
    if (list.length === 0) return null;
    return list.reduce((sum, review) => sum + review.rating, 0) / list.length;
  });

  /** How many reviews gave each score, for the bars in the header. */
  readonly breakdown = computed(() => {
    const counts = [0, 0, 0, 0, 0];
    for (const review of this.all()) counts[review.rating - 1] += 1;
    return counts.map((value, index) => ({ stars: index + 1, count: value })).reverse();
  });

  readonly unanswered = computed(() => this.all().filter((review) => !review.reply));

  load(): Promise<void> {
    return this.reviews.load();
  }

  async reply(id: number, text: string): Promise<void> {
    // `ReplyRequest(text)` en el backend: con otra clave responde 400.
    await this.api.post(`/reviews/${id}/reply`, { text });
    await this.reviews.reload();
  }

  async removeReply(id: number): Promise<void> {
    await this.api.delete(`/reviews/${id}/reply`);
    await this.reviews.reload();
  }
}
