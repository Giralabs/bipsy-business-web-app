import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LEGAL_COMPANY } from '../../data/legal/legal.models';
import { LEGAL_INDEX } from '../../data/legal/legal.index';
import { FEATURES } from '../../data/features.data';
import { BUSINESS_TYPES, FEATURED_TYPE_SLUGS } from '../../data/business-types.data';
import { SOCIAL_LINKS, STORE_LINKS, TRIAL_DAYS } from '../../data/site.data';

interface FooterLink {
  label: string;
  link: string;
  fragment?: string;
}

interface FooterColumn {
  title: string;
  links: FooterLink[];
}

const TOP_FEATURES = [
  'agenda-y-reservas-online',
  'lista-de-espera',
  'proteccion-contra-plantones',
  'finanzas',
  'gestion-de-equipo',
  'fichaje',
];

/**
 * Footer of every page.
 *
 * Beyond navigation, it carries what the LSSI-CE requires to be reachable from
 * any page —who provides the service, how to contact them and the legal
 * documents— plus what the stores and the subscription need to be visible:
 * automatic renewal and where to cancel. Linking all that only from the
 * sign-up leaves out whoever comes to look and does not sign up, which is most
 * visitors.
 */
@Component({
  selector: 'app-site-footer',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './site-footer.component.html',
  styleUrl: './site-footer.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SiteFooterComponent {
  readonly company = LEGAL_COMPANY;
  readonly year = new Date().getFullYear();
  readonly stores = STORE_LINKS;
  readonly socials = SOCIAL_LINKS;
  readonly trialDays = TRIAL_DAYS;

  readonly columns: FooterColumn[] = [
    {
      title: 'Producto',
      links: [
        { label: 'Funcionalidades', link: '/funcionalidades' },
        { label: 'Precios', link: '/precios' },
        { label: 'Por qué Bipsy', link: '/por-que-bipsy' },
        { label: 'Plan Quality', link: '/funcionalidades/plan-quality' },
        { label: 'Bipsy para tus clientes', link: '/app-para-clientes' },
      ],
    },
    {
      title: 'Funcionalidades',
      links: TOP_FEATURES.map((slug) => {
        const feature = FEATURES.find((f) => f.slug === slug);
        return { label: feature?.name ?? slug, link: `/funcionalidades/${slug}` };
      }),
    },
    {
      title: 'Negocios',
      links: [
        ...BUSINESS_TYPES.filter((t) => FEATURED_TYPE_SLUGS.includes(t.slug)).map((t) => ({
          label: t.name,
          link: `/negocios/${t.slug}`,
        })),
        { label: 'Todos los negocios', link: '/negocios' },
      ],
    },
    {
      title: 'Recursos',
      links: [
        { label: 'Blog', link: '/blog' },
        { label: 'Centro de ayuda', link: '/ayuda' },
        { label: 'Quiénes somos', link: '/legal/quienes-somos' },
        { label: 'Contacto', link: '/legal/contacto' },
        { label: 'Seguridad', link: '/legal/seguridad' },
      ],
    },
    {
      title: 'Legal',
      links: [
        ...LEGAL_INDEX.map((d) => ({ label: d.title, link: `/legal/${d.slug}` })),
        // Required by the Digital Services Act for any hosting service.
        { label: 'Aviso de contenidos ilícitos', link: '/legal/terminos', fragment: 'ilicitos' },
        { label: 'Reclamaciones', link: '/legal/contacto', fragment: 'reclamaciones' },
      ],
    },
  ];
}
