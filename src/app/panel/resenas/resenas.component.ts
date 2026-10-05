import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../core/auth/auth.service';
import { ReviewsStore } from '../core/data/reviews.store';
import { ReviewResponse } from '../core/api/models';
import { longDate, toDate } from '../core/util/dates';
import { plural, rating } from '../core/util/format';
import { PnAvatarComponent, PnEmptyComponent } from '../ui/controls';
import { PnDialogComponent } from '../ui/dialog.component';
import { ToastService } from '../ui/toast.service';

/** Reviews painted per «Ver más». */
const PAGE = 20;

/**
 * `/panel/resenas` — `reviews_screen.dart`.
 *
 * The average and the breakdown up top, then each review with its reply. Only
 * the owner can reply, and a reply can be edited or removed, same as the app.
 */
@Component({
  selector: 'app-panel-resenas',
  standalone: true,
  imports: [FormsModule, PnAvatarComponent, PnEmptyComponent, PnDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './resenas.component.html',
  styleUrl: './resenas.component.css',
})
export class ResenasComponent {
  readonly store = inject(ReviewsStore);
  /** Un trabajador las lee; responder es cosa del dueño (`/reviews/{id}/reply` es BUSINESS). */
  readonly canReply = inject(AuthService).isBusiness;
  private readonly toasts = inject(ToastService);

  readonly longDate = longDate;
  readonly toDate = toDate;
  readonly rating = rating;

  readonly replying = signal<ReviewResponse | null>(null);
  readonly busy = signal(false);

  /**
   * The store holds every review (the stats need them all); the list paints
   * them twenty at a time so a long history does not become one endless page.
   */
  readonly shown = signal(PAGE);
  readonly visible = computed(() => this.store.all().slice(0, this.shown()));
  readonly hidden = computed(() => Math.max(this.store.count() - this.shown(), 0));

  showMore(): void {
    this.shown.update((n) => n + PAGE);
  }

  draft = '';

  constructor() {
    void this.store.load();
  }

  count(n: number, one: string, many: string): string {
    return plural(n, one, many);
  }

  /** Width of a bar in the breakdown, as a percentage of the busiest score. */
  barWidth(count: number): number {
    const top = Math.max(...this.store.breakdown().map((row) => row.count), 1);
    return (count / top) * 100;
  }

  startReply(review: ReviewResponse): void {
    this.draft = review.reply ?? '';
    this.replying.set(review);
  }

  async save(): Promise<void> {
    const review = this.replying();
    if (!review || !this.draft.trim()) return;
    this.busy.set(true);
    try {
      await this.store.reply(review.id, this.draft.trim());
      this.replying.set(null);
      this.toasts.show('Respuesta publicada');
    } catch {
      this.toasts.error('No se ha podido publicar.');
    } finally {
      this.busy.set(false);
    }
  }

  async removeReply(review: ReviewResponse): Promise<void> {
    try {
      await this.store.removeReply(review.id);
      this.replying.set(null);
      this.toasts.show('Respuesta eliminada');
    } catch {
      this.toasts.error('No se ha podido eliminar.');
    }
  }
}
