import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { LEGAL_DOCUMENTS } from '../../data/legal/legal.content';
import { BUSINESS_LEGAL_DOCUMENTS } from '../../data/legal/business-legal.content';
import { LegalDocument, LEGAL_COMPANY_INCOMPLETE } from '../../data/legal/legal.models';
import { HELP_INDEX, LEGAL_GROUPS, LEGAL_INDEX } from '../../data/legal/legal.index';

const ALL_DOCUMENTS: Record<string, LegalDocument> = { ...LEGAL_DOCUMENTS, ...BUSINESS_LEGAL_DOCUMENTS };

/**
 * A legal or company document. One component for all of them: they share the
 * layout and only the content changes. Port of bipsy-web-app's legal page with
 * the two business documents added.
 */
@Component({
  selector: 'app-legal',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './legal.component.html',
  styleUrl: './legal.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LegalComponent {
  doc: LegalDocument | null = null;

  readonly groups = LEGAL_GROUPS;
  private readonly allPages = [...LEGAL_INDEX, ...HELP_INDEX];

  constructor(
    private readonly title: Title,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  @Input()
  set slug(value: string) {
    this.doc = ALL_DOCUMENTS[value] ?? null;
    this.title.setTitle(`${this.doc?.title ?? 'Documento no encontrado'} · Bipsy Business`);
    this.cdr.markForCheck();
  }

  get otherDocs(): { slug: string; title: string }[] {
    return this.allPages.filter((entry) => entry.slug !== this.doc?.slug);
  }

  get isDraft(): boolean {
    return this.doc?.version.includes('borrador') ?? false;
  }

  get companyIncomplete(): boolean {
    return LEGAL_COMPANY_INCOMPLETE;
  }
}
