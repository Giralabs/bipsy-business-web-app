import { Routes } from '@angular/router';
import { adminTitle } from './maintenance/admin.title';
import { maintenanceGate } from './maintenance/maintenance.guard';
import { ErrorComponent, errorTitle } from './pages/error/error.component';
import { NOT_FOUND_TITLE } from './pages/not-found/not-found.title';
import { guestGuard } from './panel/core/auth/auth.guard';

/**
 * Every page is lazy: whoever lands on the home page does not need to download
 * the legal texts, the blog or the pricing table before seeing anything.
 *
 * Pages with a `:slug` set their own title, because it depends on the data.
 */
const siteRoutes: Routes = [
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
  // The way in. Everything from here on is the product, not the brochure, so
  // it lives in `src/app/panel/` and loads only when someone signs in.
  {
    path: 'registro',
    title: 'Crea tu negocio · Bipsy Business',
    canActivate: [guestGuard],
    loadComponent: () => import('./panel/auth/signup.component').then((m) => m.SignupComponent),
  },
  {
    path: 'acceder',
    title: 'Iniciar sesión · Bipsy Business',
    canActivate: [guestGuard],
    loadComponent: () => import('./panel/auth/login.component').then((m) => m.LoginComponent),
  },
  // Los trabajadores entran con el código de 6 cifras que les da su negocio.
  {
    path: 'unirse',
    title: 'Únete a tu equipo · Bipsy Business',
    loadComponent: () => import('./panel/auth/join.component').then((m) => m.JoinComponent),
  },
  {
    path: 'invitacion/:token',
    title: 'Invitación · Bipsy Business',
    loadComponent: () => import('./panel/auth/accept-invite.component').then((m) => m.AcceptInviteComponent),
  },
  {
    path: 'recuperar-contrasena',
    title: 'Recuperar contraseña · Bipsy Business',
    loadComponent: () => import('./panel/auth/recover.component').then((m) => m.RecoverComponent),
  },
  {
    path: 'panel',
    loadChildren: () => import('./panel/panel.routes').then((m) => m.panelRoutes),
  },
  // The one page that is NOT lazy: it is where a lazy chunk that failed to
  // load ends up (`shared/app-error-handler.ts`), so it cannot be one itself.
  // `?tipo=conexion|version` picks what it says.
  {
    path: 'error',
    title: errorTitle,
    component: ErrorComponent,
  },
  // Anything else does not exist, and says so. It used to redirect to the home
  // page, which hides a broken link from the person who followed it.
  {
    path: '**',
    title: NOT_FOUND_TITLE,
    loadComponent: () => import('./pages/not-found/not-found.component').then((m) => m.NotFoundComponent),
  },
];

/**
 * Two doors. `/admin` is the team's way in during maintenance, so it is the
 * only route outside the gate; everything else hangs from one parent without a
 * component whose guard holds navigation while the site is closed (see
 * `maintenanceGate`). The parent changes no URL.
 */
export const routes: Routes = [
  {
    path: 'admin',
    // «Acceso del equipo» in maintenance; the rest of the time, the same title
    // and the same page as any unknown URL.
    title: adminTitle,
    loadComponent: () => import('./maintenance/admin.component').then((m) => m.AdminComponent),
  },
  {
    path: '',
    canActivateChild: [maintenanceGate],
    children: siteRoutes,
  },
];
