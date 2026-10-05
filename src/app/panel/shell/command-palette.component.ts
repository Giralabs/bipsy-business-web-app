import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild,
  computed,
  signal,
} from '@angular/core';

export interface PaletteItem {
  id: string;
  label: string;
  hint: string;
  icon: string;
  /** Texto extra por el que también se encuentra. */
  keywords?: string;
  /** Lo que pasa al elegirlo: navegar o ejecutar algo. */
  run: () => void;
  /** Agrupa los resultados cuando no se ha escrito nada. */
  kind: 'section' | 'place' | 'action';
  badge?: number;
}

/** Quita tildes y mayúsculas: «reseñas» y «resenas» son lo mismo. */
function fold(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * «Ir a…» (⌘K / Ctrl+K): el buscador que sustituye al lanzador de bloques.
 *
 * La barra lateral solo tiene las secciones; todo lo que cuelga de ellas
 * (fichajes, cobros, normas…) se encuentra escribiendo dos letras. Con el
 * teclado se hace todo: flechas para moverse, Intro para abrir, Esc para salir.
 */
@Component({
  selector: 'pn-command-palette',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="cp" (click)="close.emit()">
      <div class="cp__box" role="dialog" aria-modal="true" aria-label="Ir a" (click)="$event.stopPropagation()">
        <div class="cp__search">
          <span class="material-symbols-rounded" aria-hidden="true">search</span>
          <input
            #input
            type="text"
            placeholder="Busca una sección, un ajuste o una acción…"
            autocomplete="off"
            spellcheck="false"
            role="combobox"
            aria-controls="cp-list"
            aria-expanded="true"
            [attr.aria-activedescendant]="results().length ? 'cp-' + active() : null"
            [value]="query()"
            (input)="onInput($event)"
            (keydown)="onKey($event)"
          />
          <kbd class="cp__esc">Esc</kbd>
        </div>

        <ul class="cp__list" id="cp-list" role="listbox">
          @for (item of results(); track item.id; let i = $index) {
            @if (showHeading(i)) {
              <li class="cp__heading" role="presentation">{{ heading(item.kind) }}</li>
            }
            <li
              class="cp__item"
              role="option"
              [id]="'cp-' + i"
              [attr.aria-selected]="i === active()"
              (mouseenter)="active.set(i)"
              (click)="pick(item)"
            >
              <span class="cp__icon"><span class="material-symbols-rounded">{{ item.icon }}</span></span>
              <span class="cp__label">{{ item.label }}</span>
              @if (item.badge) {
                <span class="cp__badge">{{ item.badge }}</span>
              }
              <span class="cp__hint">{{ item.hint }}</span>
            </li>
          } @empty {
            <li class="cp__none">Nada con «{{ query() }}». Prueba con otra palabra.</li>
          }
        </ul>

        <div class="cp__foot" aria-hidden="true">
          <span><kbd>↑</kbd><kbd>↓</kbd> moverse</span>
          <span><kbd>↵</kbd> abrir</span>
        </div>
      </div>
    </div>
  `,
  styleUrl: './command-palette.component.css',
})
export class CommandPaletteComponent implements AfterViewInit {
  @Input({ required: true }) set items(list: PaletteItem[]) {
    this.all.set(list);
  }
  @Output() close = new EventEmitter<void>();

  @ViewChild('input') private input?: ElementRef<HTMLInputElement>;

  private readonly all = signal<PaletteItem[]>([]);
  readonly query = signal('');
  readonly active = signal(0);

  readonly results = computed(() => {
    const words = fold(this.query().trim()).split(/\s+/).filter(Boolean);
    if (words.length === 0) return this.all();
    return this.all()
      .map((item) => {
        const label = fold(item.label);
        const haystack = `${label} ${fold(item.hint)} ${fold(item.keywords ?? '')}`;
        if (!words.every((word) => haystack.includes(word))) return null;
        // Lo que empieza por lo escrito va primero.
        const score = label.startsWith(words[0]) ? 0 : label.includes(words[0]) ? 1 : 2;
        return { item, score };
      })
      .filter((hit): hit is { item: PaletteItem; score: number } => hit !== null)
      .sort((a, b) => a.score - b.score)
      .map((hit) => hit.item);
  });

  /** Focused at once: whoever presses ⌘K starts typing straight away. */
  ngAfterViewInit(): void {
    this.input?.nativeElement.focus();
  }

  onInput(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
    this.active.set(0);
  }

  onKey(event: KeyboardEvent): void {
    const count = this.results().length;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (count) this.active.set((this.active() + 1) % count);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (count) this.active.set((this.active() - 1 + count) % count);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const item = this.results()[this.active()];
      if (item) this.pick(item);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.close.emit();
    }
    queueMicrotask(() =>
      document.getElementById(`cp-${this.active()}`)?.scrollIntoView({ block: 'nearest' }),
    );
  }

  pick(item: PaletteItem): void {
    this.close.emit();
    item.run();
  }

  /** Los títulos de grupo solo salen sin búsqueda: con ella manda la relevancia. */
  showHeading(index: number): boolean {
    if (this.query().trim()) return false;
    const list = this.results();
    return index === 0 || list[index - 1].kind !== list[index].kind;
  }

  heading(kind: PaletteItem['kind']): string {
    return kind === 'section' ? 'Secciones' : kind === 'place' ? 'Ir directamente a' : 'Acciones';
  }
}
