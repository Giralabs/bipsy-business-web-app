import { Routes } from '@angular/router';
import { panelChildGuard, panelGuard } from './core/auth/auth.guard';
import { PanelShellComponent } from './shell/panel-shell.component';

/**
 * Everything behind the login. One shell, one guard, and a lazy component per
 * section so opening the panel does not download the settings screens.
 *
 * The paths are Spanish because they are what the owner sees in the address
 * bar; the mapping to the app's routes is in `docs/PANEL-SYNC.md`.
 */
export const panelRoutes: Routes = [
  {
    path: '',
    component: PanelShellComponent,
    canActivate: [panelGuard],
    canActivateChild: [panelChildGuard],
    children: [
      {
        path: '',
        title: 'Tu panel · Bipsy Business',
        // El inicio del dueño o el del trabajador, según quién entre.
        loadComponent: () => import('./inicio/home-switch.component').then((m) => m.HomeSwitchComponent),
      },
      // ----- Lo del trabajador ------------------------------------------------
      {
        path: 'fichar',
        title: 'Fichar · Bipsy Business',
        loadComponent: () => import('./trabajador/fichar.component').then((m) => m.FicharComponent),
      },
      {
        path: 'mi-horario',
        title: 'Mi horario · Bipsy Business',
        loadComponent: () => import('./trabajador/mi-horario.component').then((m) => m.MiHorarioComponent),
      },
      {
        path: 'mis-ausencias',
        title: 'Mis ausencias · Bipsy Business',
        loadComponent: () =>
          import('./trabajador/mis-ausencias.component').then((m) => m.MisAusenciasComponent),
      },
      {
        path: 'mi-perfil',
        title: 'Mi perfil · Bipsy Business',
        loadComponent: () => import('./trabajador/mi-perfil.component').then((m) => m.MiPerfilComponent),
      },
      // ----- Lo del negocio ---------------------------------------------------
      {
        path: 'agenda',
        title: 'Agenda · Bipsy Business',
        loadComponent: () => import('./agenda/agenda.component').then((m) => m.AgendaComponent),
      },
      {
        path: 'servicios',
        title: 'Servicios · Bipsy Business',
        loadComponent: () => import('./servicios/servicios.component').then((m) => m.ServiciosComponent),
      },
      {
        path: 'clientes',
        title: 'Clientes · Bipsy Business',
        loadComponent: () => import('./clientes/clientes.component').then((m) => m.ClientesComponent),
      },
      {
        path: 'clientes/importar',
        title: 'Importar clientes · Bipsy Business',
        loadComponent: () => import('./clientes/importar.component').then((m) => m.ImportarComponent),
      },
      {
        path: 'clientes/vetados',
        title: 'Clientes vetados · Bipsy Business',
        loadComponent: () => import('./clientes/vetados.component').then((m) => m.VetadosComponent),
      },
      {
        path: 'clientes/:id',
        loadComponent: () =>
          import('./clientes/cliente-detalle.component').then((m) => m.ClienteDetalleComponent),
      },
      {
        path: 'equipo',
        title: 'Equipo · Bipsy Business',
        loadComponent: () => import('./equipo/equipo.component').then((m) => m.EquipoComponent),
      },
      {
        path: 'equipo/fichajes',
        title: 'Fichajes · Bipsy Business',
        loadComponent: () => import('./equipo/fichajes.component').then((m) => m.FichajesComponent),
      },
      {
        path: 'equipo/ausencias',
        title: 'Ausencias · Bipsy Business',
        loadComponent: () => import('./equipo/ausencias.component').then((m) => m.AusenciasComponent),
      },
      {
        path: 'equipo/:id/horario',
        title: 'Horario del trabajador · Bipsy Business',
        loadComponent: () =>
          import('./equipo/horario-trabajador.component').then((m) => m.HorarioTrabajadorComponent),
      },
      {
        path: 'mensajes',
        title: 'Mensajes · Bipsy Business',
        loadComponent: () => import('./mensajes/mensajes.component').then((m) => m.MensajesComponent),
      },
      {
        path: 'negocio',
        title: 'Tu ficha · Bipsy Business',
        loadComponent: () => import('./negocio/negocio.component').then((m) => m.NegocioComponent),
      },
      {
        path: 'negocio/horario',
        title: 'Horario · Bipsy Business',
        loadComponent: () => import('./negocio/horario.component').then((m) => m.HorarioComponent),
      },
      {
        path: 'negocio/portfolio',
        title: 'Portfolio · Bipsy Business',
        loadComponent: () => import('./negocio/portfolio.component').then((m) => m.PortfolioComponent),
      },
      {
        path: 'negocio/normas',
        title: 'Normas · Bipsy Business',
        loadComponent: () => import('./negocio/normas.component').then((m) => m.NormasComponent),
      },
      {
        path: 'negocio/codigo',
        title: 'Código de invitación · Bipsy Business',
        loadComponent: () => import('./negocio/codigo.component').then((m) => m.CodigoComponent),
      },
      {
        path: 'negocio/vista-previa',
        title: 'Vista previa · Bipsy Business',
        loadComponent: () => import('./negocio/vista-previa.component').then((m) => m.VistaPreviaComponent),
      },
      {
        path: 'resenas',
        title: 'Reseñas · Bipsy Business',
        loadComponent: () => import('./resenas/resenas.component').then((m) => m.ResenasComponent),
      },
      {
        path: 'ajustes',
        title: 'Ajustes · Bipsy Business',
        loadComponent: () => import('./ajustes/ajustes.component').then((m) => m.AjustesComponent),
      },
      {
        path: 'ajustes/reservas',
        title: 'Reservas · Bipsy Business',
        loadComponent: () => import('./ajustes/reservas.component').then((m) => m.ReservasComponent),
      },
      {
        path: 'ajustes/funcionalidades',
        title: 'Funcionalidades · Bipsy Business',
        loadComponent: () =>
          import('./ajustes/funcionalidades.component').then((m) => m.FuncionalidadesComponent),
      },
      {
        path: 'ajustes/cancelaciones',
        title: 'Cancelaciones · Bipsy Business',
        loadComponent: () => import('./ajustes/cancelaciones.component').then((m) => m.CancelacionesComponent),
      },
      {
        path: 'ajustes/cobros',
        title: 'Cobros · Bipsy Business',
        loadComponent: () => import('./ajustes/cobros.component').then((m) => m.CobrosComponent),
      },
      {
        path: 'ajustes/cierres',
        title: 'Días de cierre · Bipsy Business',
        loadComponent: () => import('./ajustes/cierres.component').then((m) => m.CierresComponent),
      },
      // «Mis ausencias» of the owner is gone, as in the app: closing days took
      // its place, and the owner's own days off live in Equipo › Ausencias.
      { path: 'ajustes/tiempo-libre', redirectTo: 'ajustes/cierres' },
      {
        path: 'ajustes/suscripcion',
        title: 'Mi plan · Bipsy Business',
        loadComponent: () => import('./ajustes/suscripcion.component').then((m) => m.SuscripcionComponent),
      },
      {
        path: 'ajustes/notificaciones',
        title: 'Notificaciones · Bipsy Business',
        loadComponent: () =>
          import('./ajustes/notificaciones.component').then((m) => m.NotificacionesComponent),
      },
      {
        path: 'ajustes/cuenta',
        title: 'Tu cuenta · Bipsy Business',
        loadComponent: () => import('./ajustes/cuenta.component').then((m) => m.CuentaComponent),
      },
      {
        path: 'plan',
        title: 'Elige tu plan · Bipsy Business',
        loadComponent: () => import('./ajustes/plan-wall.component').then((m) => m.PlanWallComponent),
      },
      {
        path: 'soporte',
        title: 'Soporte · Bipsy Business',
        loadComponent: () => import('./soporte/soporte.component').then((m) => m.SoporteComponent),
      },
      {
        path: 'verificar-email',
        title: 'Verifica tu correo · Bipsy Business',
        loadComponent: () => import('./soporte/verificar-email.component').then((m) => m.VerificarEmailComponent),
      },
      // An unknown address says so, inside the shell. (A worker never gets
      // here: `panelGuard` returns them to /panel first.)
      {
        path: '**',
        title: 'Página no encontrada · Bipsy Business',
        loadComponent: () =>
          import('./shell/panel-not-found.component').then((m) => m.PanelNotFoundComponent),
      },
    ],
  },
];
