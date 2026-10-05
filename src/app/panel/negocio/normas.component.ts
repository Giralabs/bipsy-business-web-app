import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../core/api/api';
import { BusinessPolicy, PolicyGroup } from '../core/api/models';
import { message, resource } from '../core/data/resource';
import { PnEmptyComponent } from '../ui/controls';
import { PnDialogComponent } from '../ui/dialog.component';
import { ConfirmService } from '../ui/confirm.service';
import { ToastService } from '../ui/toast.service';

/** `PolicyTemplateResponse`: a ready-written policy from Bipsy's catalogue. */
interface CatalogTemplate {
  id: number;
  code: string;
  text: string;
  displayOrder: number;
}

/** `PolicyCatalogCategoryResponse`. */
interface CatalogCategory {
  id: number;
  code: string | null;
  name: string;
  icon: string | null;
  displayOrder: number;
  templates: CatalogTemplate[];
}

/** `GET /policies/catalog` is an object, not a list. */
interface PolicyCatalog {
  categories: CatalogCategory[];
}

/** A category a policy can go into: Bipsy's or one the business made. */
interface CategoryOption {
  id: number;
  name: string;
}

/**
 * The icon codes the server stores (`GipsiPolicyIcons.choices`), in the
 * order of the app's picker, with the Material Symbol that draws each one.
 */
const POLICY_ICONS: ReadonlyArray<readonly [string, string, string]> = [
  ['BOOKING', 'event_available', 'Reservas'],
  ['CANCELLATION', 'schedule', 'Cancelaciones'],
  ['PAYMENT', 'payments', 'Pagos'],
  ['HEALTH', 'health_and_safety', 'Salud'],
  ['ACCESSIBILITY', 'accessible', 'Accesibilidad'],
  ['HOUSE_RULES', 'rule', 'Normas de la casa'],
  ['PETS', 'pets', 'Mascotas'],
  ['CHILDREN', 'child_care', 'Niños'],
  ['PARKING', 'local_parking', 'Aparcamiento'],
  ['WIFI', 'wifi', 'Wifi'],
  ['ECO', 'eco', 'Ecología'],
  ['INFO', 'info', 'Información'],
];

type DialogKind = 'catalog' | 'policy' | 'category' | null;

/**
 * `/panel/negocio/normas` — `policies_screen.dart` with its three sheets
 * (`policy_catalog_sheet.dart`, `custom_policy_sheet.dart`,
 * `policy_category_sheet.dart`).
 *
 * Catalogue policies are ticked on and off (published instantly); the
 * business's own ones are written, edited and moved between categories. Both
 * policies inside a category and the categories themselves can be reordered,
 * and that order only applies to this business's page.
 */
@Component({
  selector: 'app-panel-normas',
  standalone: true,
  imports: [FormsModule, PnEmptyComponent, PnDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './normas.component.html',
  styleUrl: './normas.component.css',
})
export class NormasComponent {
  private readonly api = inject(Api);
  private readonly confirm = inject(ConfirmService);
  private readonly toasts = inject(ToastService);

  readonly icons = POLICY_ICONS;

  readonly groups = resource<PolicyGroup[]>(
    () => this.api.get<PolicyGroup[]>('/businesses/me/policies'),
    [],
  );

  readonly catalog = resource<CatalogCategory[]>(
    async () => (await this.api.get<PolicyCatalog>('/policies/catalog')).categories ?? [],
    [],
  );

  readonly dialog = signal<DialogKind>(null);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  /** Working copy while the categories are being moved (`_workingGroups`). */
  readonly workingGroups = signal<PolicyGroup[] | null>(null);
  /** The category whose policies are being moved, with its working copy. */
  readonly orderingPolicies = signal<{ categoryId: number; policies: BusinessPolicy[] } | null>(null);

  /** Templates whose toggle is still waiting for the server. */
  readonly pending = signal<ReadonlySet<number>>(new Set());

  readonly editingPolicy = signal<BusinessPolicy | null>(null);
  readonly editingCategory = signal<PolicyGroup | null>(null);

  policyForm = { categoryId: null as number | null, text: '' };
  categoryForm = { name: '', icon: null as string | null };

  constructor() {
    void this.groups.load();
    void this.catalog.load();
  }

  readonly orderingCategories = computed(() => this.workingGroups() !== null);

  /** What is painted: the working copy while ordering, the server otherwise. */
  readonly shown = computed(() => this.workingGroups() ?? this.groups.value());

  /** `usablePolicyCategoriesProvider`: Bipsy's categories plus the business's own. */
  readonly categoryOptions = computed<CategoryOption[]>(() => [
    ...this.catalog.value().map((c) => ({ id: c.id, name: c.name })),
    ...this.groups
      .value()
      .filter((g) => g.custom)
      .map((g) => ({ id: g.categoryId, name: g.name })),
  ]);

  /** templateId → id of the published policy, to tick it in the catalogue. */
  readonly published = computed(() => {
    const map = new Map<number, number>();
    for (const group of this.groups.value()) {
      for (const policy of group.policies) {
        if (policy.templateId != null) map.set(policy.templateId, policy.id);
      }
    }
    return map;
  });

  iconFor(code: string | null | undefined): string {
    return POLICY_ICONS.find(([c]) => c === code)?.[1] ?? 'verified';
  }

  policiesOf(group: PolicyGroup): BusinessPolicy[] {
    const ordering = this.orderingPolicies();
    return ordering && ordering.categoryId === group.categoryId ? ordering.policies : group.policies;
  }

  isOrdering(group: PolicyGroup): boolean {
    return this.orderingPolicies()?.categoryId === group.categoryId;
  }

  countLabel(group: PolicyGroup): string {
    const n = group.policies.length;
    return n === 0 ? 'Sin normas' : n === 1 ? '1 norma' : `${n} normas`;
  }

  // ----- Catalogue ----------------------------------------------------------

  openCatalog(): void {
    this.dialog.set('catalog');
  }

  /** Saved on each tap, not on close: closing must never lose ten ticks. */
  async toggle(template: CatalogTemplate): Promise<void> {
    if (this.pending().has(template.id)) return;
    this.pending.update((set) => new Set(set).add(template.id));
    try {
      const publishedId = this.published().get(template.id);
      if (publishedId != null) {
        await this.api.delete(`/businesses/me/policies/${publishedId}`);
      } else {
        await this.api.post('/businesses/me/policies', { templateId: template.id });
      }
      await this.groups.reload();
    } catch (cause) {
      this.toasts.error(serverMessage(cause));
    } finally {
      this.pending.update((set) => {
        const next = new Set(set);
        next.delete(template.id);
        return next;
      });
    }
  }

  // ----- Own policies -------------------------------------------------------

  startWrite(categoryId?: number): void {
    this.policyForm = { categoryId: categoryId ?? null, text: '' };
    this.editingPolicy.set(null);
    this.error.set(null);
    this.dialog.set('policy');
  }

  startEditPolicy(policy: BusinessPolicy, categoryId: number): void {
    // Catalogue wording is fixed for every business: only own ones open.
    if (!policy.custom) return;
    this.policyForm = { categoryId, text: policy.text };
    this.editingPolicy.set(policy);
    this.error.set(null);
    this.dialog.set('policy');
  }

  async savePolicy(): Promise<void> {
    const text = this.policyForm.text.trim();
    if (!text) {
      this.error.set('Escribe la norma');
      return;
    }
    if (this.policyForm.categoryId == null) {
      this.error.set('Elige en qué categoría va');
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    try {
      const policy = this.editingPolicy();
      const body = { categoryId: this.policyForm.categoryId, text };
      if (policy) {
        await this.api.put(`/businesses/me/policies/${policy.id}`, body);
      } else {
        await this.api.post('/businesses/me/policies', body);
      }
      await this.groups.reload();
      this.close();
      this.toasts.show('Norma guardada');
    } catch (cause) {
      this.error.set(serverMessage(cause));
    } finally {
      this.busy.set(false);
    }
  }

  async removePolicy(policy: BusinessPolicy): Promise<void> {
    const answer = await this.confirm.ask({
      title: 'Quitar norma',
      message: `«${policy.text}»\n\nDejará de verse en tu ficha.`,
      confirmLabel: 'Quitar',
      destructive: true,
    });
    if (!answer.ok) return;
    try {
      await this.api.delete(`/businesses/me/policies/${policy.id}`);
      await this.groups.reload();
      if (this.editingPolicy()?.id === policy.id) this.close();
      this.toasts.show('Norma quitada');
    } catch (cause) {
      this.toasts.error(serverMessage(cause));
    }
  }

  // ----- Own categories -----------------------------------------------------

  startCreateCategory(): void {
    this.categoryForm = { name: '', icon: null };
    this.editingCategory.set(null);
    this.error.set(null);
    this.dialog.set('category');
  }

  startEditCategory(group: PolicyGroup): void {
    if (!group.custom) return;
    this.categoryForm = { name: group.name, icon: group.icon };
    this.editingCategory.set(group);
    this.error.set(null);
    this.dialog.set('category');
  }

  /** Tapping the chosen icon again clears it, as in the app's picker. */
  pickIcon(code: string): void {
    this.categoryForm.icon = this.categoryForm.icon === code ? null : code;
  }

  async saveCategory(): Promise<void> {
    const name = this.categoryForm.name.trim();
    if (!name) {
      this.error.set('Ponle un nombre a la categoría');
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    try {
      const body = { name, icon: this.categoryForm.icon };
      const group = this.editingCategory();
      if (group) {
        await this.api.put(`/businesses/me/policy-categories/${group.categoryId}`, body);
      } else {
        await this.api.post('/businesses/me/policy-categories', body);
      }
      await this.groups.reload();
      this.close();
      this.toasts.show('Categoría guardada');
    } catch (cause) {
      // A repeated name comes back as 409 with its sentence: shown in place.
      this.error.set(serverMessage(cause));
    } finally {
      this.busy.set(false);
    }
  }

  async deleteCategory(group: PolicyGroup): Promise<void> {
    try {
      await this.api.delete(`/businesses/me/policy-categories/${group.categoryId}`);
      await this.groups.reload();
      if (this.editingCategory()?.categoryId === group.categoryId) this.close();
      this.toasts.show('Categoría borrada');
    } catch (cause) {
      // With policies inside, the server answers 400 and says to empty it first.
      this.toasts.error(serverMessage(cause));
    }
  }

  // ----- Ordering -----------------------------------------------------------

  startOrderingCategories(): void {
    this.orderingPolicies.set(null);
    this.workingGroups.set([...this.groups.value()]);
  }

  async stopOrderingCategories(): Promise<void> {
    this.workingGroups.set(null);
    await this.groups.reload();
  }

  /** Painted at once and saved behind: waiting for the server makes arrows feel broken. */
  async moveCategory(index: number, delta: number): Promise<void> {
    const list = this.workingGroups();
    if (!list) return;
    const target = index + delta;
    if (target < 0 || target >= list.length) return;
    const next = [...list];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    this.workingGroups.set(next);
    try {
      // The whole page goes, Bipsy's categories included: the order is this
      // business's and does not touch the catalogue others see.
      await this.api.put('/businesses/me/policy-categories/order', {
        categoryIds: next.map((g) => g.categoryId),
      });
    } catch (cause) {
      this.toasts.error(serverMessage(cause));
      this.workingGroups.set(null);
      await this.groups.reload();
    }
  }

  startOrderingPolicies(group: PolicyGroup): void {
    this.orderingPolicies.set({ categoryId: group.categoryId, policies: [...group.policies] });
  }

  async stopOrderingPolicies(): Promise<void> {
    this.orderingPolicies.set(null);
    await this.groups.reload();
  }

  async movePolicy(index: number, delta: number): Promise<void> {
    const ordering = this.orderingPolicies();
    if (!ordering) return;
    const target = index + delta;
    if (target < 0 || target >= ordering.policies.length) return;
    const policies = [...ordering.policies];
    const [item] = policies.splice(index, 1);
    policies.splice(target, 0, item);
    this.orderingPolicies.set({ categoryId: ordering.categoryId, policies });
    try {
      await this.api.put('/businesses/me/policies/order', {
        categoryId: ordering.categoryId,
        policyIds: policies.map((p) => p.id),
      });
    } catch (cause) {
      // Leave ordering mode: never show an order that is not saved anywhere.
      this.toasts.error(serverMessage(cause));
      this.orderingPolicies.set(null);
      await this.groups.reload();
    }
  }

  close(): void {
    const wasCatalog = this.dialog() === 'catalog';
    this.dialog.set(null);
    this.editingPolicy.set(null);
    this.editingCategory.set(null);
    this.error.set(null);
    if (wasCatalog) void this.groups.reload();
  }
}

/**
 * The server's own sentence when it sends one (its 403s here mean "not
 * yours", not an expired session), otherwise the generic translation.
 */
function serverMessage(cause: unknown): string {
  const detail = (cause as { error?: { message?: string } }).error?.message;
  return detail || message(cause);
}
