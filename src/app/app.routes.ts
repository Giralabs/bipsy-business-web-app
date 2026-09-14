import { Routes } from '@angular/router';

/**
 * Every page is lazy: whoever lands on the home page does not need to download
 * the legal texts, the blog or the pricing table before seeing anything.
 *
 * Pages with a `:slug` set their own title, because it depends on the data.
 */
export const routes: Routes = [
  {
    path: '',
    title: 'Bipsy Business · Agenda, reservas y gestión para tu negocio',
    loadComponent: () => import('./pages/home/home.component').then((m) => m.HomeComponent),
  },
  {
    path: 'funcionalidades',
    title: 'Funcionalidades · Bipsy Business',
    loadComponent: () => import('./pages/features/features.component').then((m) => m.FeaturesComponent),
  },
  {
    path: 'funcionalidades/:slug',
    loadComponent: () =>
      import('./pages/feature-detail/feature-detail.component').then((m) => m.FeatureDetailComponent),
  },
  {
    path: 'precios',
    title: 'Precios · Bipsy Business',
    loadComponent: () => import('./pages/pricing/pricing.component').then((m) => m.PricingComponent),
  },
  {
    path: 'por-que-bipsy',
    title: 'Por qué Bipsy · Bipsy Business',
    loadComponent: () => import('./pages/why/why.component').then((m) => m.WhyComponent),
  },
  {
    path: 'negocios',
    title: 'Tipos de negocio · Bipsy Business',
    loadComponent: () =>
      import('./pages/business-types/business-types.component').then((m) => m.BusinessTypesComponent),
  },
  {
    path: 'negocios/:slug',
    loadComponent: () =>
      import('./pages/business-type/business-type.component').then((m) => m.BusinessTypeComponent),
  },
  {
    path: 'app-para-clientes',
    title: 'Bipsy, la app de tus clientes · Bipsy Business',
    loadComponent: () => import('./pages/clients-app/clients-app.component').then((m) => m.ClientsAppComponent),
  },
  {
    path: 'blog',
    title: 'Blog · Bipsy Business',
    loadComponent: () => import('./pages/blog/blog.component').then((m) => m.BlogComponent),
  },
  {
    path: 'blog/:slug',
    loadComponent: () => import('./pages/blog-post/blog-post.component').then((m) => m.BlogPostComponent),
  },
  {
    path: 'ayuda',
    title: 'Centro de ayuda · Bipsy Business',
    loadComponent: () => import('./pages/help/help.component').then((m) => m.HelpComponent),
  },
  { path: 'legal', redirectTo: 'legal/aviso-legal', pathMatch: 'full' },
  {
    path: 'legal/:slug',
    loadComponent: () => import('./pages/legal/legal.component').then((m) => m.LegalComponent),
  },
  // Sign-up and login are not built yet: the buttons already point here so
  // nothing has to change in the header when they are.
  {
    path: 'registro',
    title: 'Probar gratis · Bipsy Business',
    data: { kind: 'signup' },
    loadComponent: () => import('./pages/soon/soon.component').then((m) => m.SoonComponent),
  },
  {
    path: 'acceder',
    title: 'Iniciar sesión · Bipsy Business',
    data: { kind: 'login' },
    loadComponent: () => import('./pages/soon/soon.component').then((m) => m.SoonComponent),
  },
  { path: '**', redirectTo: '' },
];
