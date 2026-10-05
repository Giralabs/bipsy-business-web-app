/**
 * La navegación del panel, en un solo sitio.
 *
 * Las secciones viven en la barra lateral: un icono y una palabra, nada más.
 * Los destinos de segundo nivel (fichajes, horario, cobros…) no ocupan sitio
 * en la barra; se llega a ellos desde su sección o desde el buscador (⌘K),
 * que los conoce todos.
 */
export type NavId =
  | 'inicio'
  | 'agenda'
  | 'mensajes'
  | 'clientes'
  | 'servicios'
  | 'equipo'
  | 'negocio'
  | 'resenas'
  | 'ajustes'
  | 'fichar'
  | 'ausencias-mias'
  | 'horario-mio'
  | 'soporte';

export interface Section {
  id: NavId;
  label: string;
  /** Lo que se hace ahí, en una línea. Lo usa el buscador. */
  blurb: string;
  icon: string;
  route: string;
  /** La barra lateral separa los grupos con aire, sin títulos. */
  group: 1 | 2 | 3;
}

/** Lo que ve el dueño del negocio. */
export const BUSINESS_SECTIONS: Section[] = [
  { id: 'inicio', label: 'Inicio', blurb: 'Tu día de un vistazo', icon: 'space_dashboard', route: '/panel', group: 1 },
  { id: 'agenda', label: 'Agenda', blurb: 'Tus citas, día a día', icon: 'calendar_month', route: '/panel/agenda', group: 1 },
  { id: 'mensajes', label: 'Mensajes', blurb: 'Lo que te escriben', icon: 'forum', route: '/panel/mensajes', group: 1 },
  { id: 'clientes', label: 'Clientes', blurb: 'Su historial y sus notas', icon: 'group', route: '/panel/clientes', group: 2 },
  { id: 'servicios', label: 'Servicios', blurb: 'Lo que ofreces y a qué precio', icon: 'content_cut', route: '/panel/servicios', group: 2 },
  { id: 'equipo', label: 'Equipo', blurb: 'Horarios, fichajes y ausencias', icon: 'badge', route: '/panel/equipo', group: 2 },
  { id: 'negocio', label: 'Tu ficha', blurb: 'Cómo te ven tus clientes', icon: 'storefront', route: '/panel/negocio', group: 3 },
  { id: 'resenas', label: 'Reseñas', blurb: 'Lo que dicen de ti', icon: 'star', route: '/panel/resenas', group: 3 },
];

/**
 * Lo que ve un trabajador: su día, su agenda, su fichaje y sus ausencias.
 * Nada de la ficha, los servicios, el equipo ni el dinero del negocio, igual
 * que en la app.
 */
export const WORKER_SECTIONS: Section[] = [
  { id: 'inicio', label: 'Inicio', blurb: 'Tu día de un vistazo', icon: 'space_dashboard', route: '/panel', group: 1 },
  { id: 'agenda', label: 'Mi agenda', blurb: 'Tus citas, día a día', icon: 'calendar_month', route: '/panel/agenda', group: 1 },
  { id: 'mensajes', label: 'Mensajes', blurb: 'Lo que te escriben', icon: 'forum', route: '/panel/mensajes', group: 1 },
  { id: 'fichar', label: 'Fichar', blurb: 'Entrada, salida y tu registro', icon: 'timer', route: '/panel/fichar', group: 2 },
  { id: 'horario-mio', label: 'Mi horario', blurb: 'Los días y las horas que trabajas', icon: 'schedule', route: '/panel/mi-horario', group: 2 },
  { id: 'ausencias-mias', label: 'Ausencias', blurb: 'Vacaciones y días libres', icon: 'beach_access', route: '/panel/mis-ausencias', group: 2 },
  { id: 'resenas', label: 'Reseñas', blurb: 'Lo que dicen del negocio', icon: 'star', route: '/panel/resenas', group: 3 },
];

/** Un destino que el buscador sabe abrir aunque no esté en la barra. */
export interface Destination {
  label: string;
  hint: string;
  icon: string;
  route: string;
  /** Palabras que también lo encuentran. */
  keywords?: string;
}

export const BUSINESS_DESTINATIONS: Destination[] = [
  { label: 'Pendientes de confirmar', hint: 'Agenda', icon: 'notifications_active', route: '/panel/agenda?vista=pendientes', keywords: 'confirmar citas reservas' },
  { label: 'Lista de espera', hint: 'Agenda', icon: 'hourglass_top', route: '/panel/agenda?vista=espera', keywords: 'espera huecos' },
  { label: 'Importar clientes', hint: 'Clientes', icon: 'upload', route: '/panel/clientes/importar', keywords: 'contactos agenda vcf csv archivo' },
  { label: 'Clientes vetados', hint: 'Clientes', icon: 'block', route: '/panel/clientes/vetados', keywords: 'bloqueados veto' },
  { label: 'Fichajes', hint: 'Equipo', icon: 'timer', route: '/panel/equipo/fichajes', keywords: 'entrada salida registro horas' },
  { label: 'Ausencias del equipo', hint: 'Equipo', icon: 'beach_access', route: '/panel/equipo/ausencias', keywords: 'vacaciones bajas días libres mis ausencias yo' },
  { label: 'Horario del negocio', hint: 'Tu ficha', icon: 'schedule', route: '/panel/negocio/horario', keywords: 'apertura horas' },
  { label: 'Portfolio', hint: 'Tu ficha', icon: 'photo_library', route: '/panel/negocio/portfolio', keywords: 'fotos trabajos galería' },
  { label: 'Normas y políticas', hint: 'Tu ficha', icon: 'gavel', route: '/panel/negocio/normas', keywords: 'cancelación reglas' },
  { label: 'Código de invitación', hint: 'Tu ficha', icon: 'card_giftcard', route: '/panel/negocio/codigo', keywords: 'referido regalo' },
  { label: 'Ver como cliente', hint: 'Tu ficha', icon: 'visibility', route: '/panel/negocio/vista-previa', keywords: 'vista previa ficha pública cliente' },
  { label: 'Ajustes de reservas', hint: 'Ajustes', icon: 'event_available', route: '/panel/ajustes/reservas', keywords: 'antelación límite huecos' },
  { label: 'Funcionalidades', hint: 'Ajustes', icon: 'toggle_on', route: '/panel/ajustes/funcionalidades', keywords: 'chat espera fichaje activar' },
  { label: 'Cancelaciones', hint: 'Ajustes', icon: 'event_busy', route: '/panel/ajustes/cancelaciones', keywords: 'penalización tarifa plantón tarjeta plazo' },
  { label: 'Cobros', hint: 'Ajustes', icon: 'payments', route: '/panel/ajustes/cobros', keywords: 'dinero pagos stripe iban' },
  { label: 'Mi plan', hint: 'Ajustes', icon: 'workspace_premium', route: '/panel/ajustes/suscripcion', keywords: 'suscripción precio factura' },
  { label: 'Días de cierre', hint: 'Ajustes', icon: 'event_busy', route: '/panel/ajustes/cierres', keywords: 'festivos vacaciones cerrado cierre no abrimos local días libres' },
  { label: 'Notificaciones', hint: 'Ajustes', icon: 'notifications', route: '/panel/ajustes/notificaciones', keywords: 'avisos' },
  { label: 'Tu cuenta', hint: 'Ajustes', icon: 'lock', route: '/panel/ajustes/cuenta', keywords: 'contraseña sesiones seguridad' },
  { label: 'Ajustes', hint: 'Todo lo demás', icon: 'tune', route: '/panel/ajustes', keywords: 'configuración' },
  { label: 'Soporte', hint: 'Escríbenos', icon: 'support_agent', route: '/panel/soporte', keywords: 'ayuda ticket problema' },
];

export const WORKER_DESTINATIONS: Destination[] = [
  { label: 'Pendientes de confirmar', hint: 'Mi agenda', icon: 'notifications_active', route: '/panel/agenda?vista=pendientes', keywords: 'confirmar citas reservas' },
  // Only works with the owner's `waitlistManageEnabled`; without it the agenda opens on its week.
  { label: 'Lista de espera', hint: 'Mi agenda', icon: 'hourglass_top', route: '/panel/agenda?vista=espera', keywords: 'espera huecos' },
  { label: 'Mi perfil', hint: 'Nombre, foto y disponibilidad', icon: 'account_circle', route: '/panel/mi-perfil', keywords: 'datos teléfono foto disponible aceptar automáticamente código' },
  { label: 'Tu cuenta', hint: 'Contraseña y sesiones', icon: 'lock', route: '/panel/ajustes/cuenta', keywords: 'contraseña seguridad' },
  { label: 'Notificaciones', hint: 'Avisos en este ordenador', icon: 'notifications', route: '/panel/ajustes/notificaciones', keywords: 'avisos escritorio' },
  { label: 'Soporte', hint: 'Escríbenos', icon: 'support_agent', route: '/panel/soporte', keywords: 'ayuda ticket problema' },
];

/** Qué sección es una ruta, para marcarla en la barra. */
export function sectionOf(url: string, sections: Section[]): Section | null {
  const path = url.split(/[?#]/)[0];
  if (path === '/panel' || path === '/panel/') return sections.find((s) => s.id === 'inicio') ?? null;
  return (
    sections
      .filter((section) => section.route !== '/panel' && path.startsWith(section.route))
      .sort((a, b) => b.route.length - a.route.length)[0] ?? null
  );
}
