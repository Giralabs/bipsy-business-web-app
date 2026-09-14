/**
 * Everything Bipsy Business does, as the website tells it.
 *
 * Written from the code, not from a wish list: every number here exists in the
 * backend or in the business app (limits, defaults, plan gates). If a limit
 * changes there, it changes here — a marketing page promising 72 h when the
 * app allows 48 is worse than no page.
 *
 * Grouped by what the owner wants to get done, not by app module, which is
 * how a business thinks when it lands on the site.
 */

export type FeatureGroupId = 'agenda' | 'clientes' | 'cobros' | 'equipo' | 'escaparate';

/** Which mock screen of the app illustrates the feature (see AppScreenComponent). */
export type ScreenId =
  | 'agenda'
  | 'clientes'
  | 'finanzas'
  | 'equipo'
  | 'ficha'
  | 'espera'
  | 'chat'
  | 'reserva'
  | 'quality';

export interface FeatureGroup {
  id: FeatureGroupId;
  label: string;
  icon: string;
  blurb: string;
  /** Mr. Bip illustration shared by the pages of the group. */
  bip: { code: string; pose: string; screen: string };
}

export interface FeaturePoint {
  icon: string;
  title: string;
  text: string;
}

export interface Feature {
  slug: string;
  group: FeatureGroupId;
  icon: string;
  name: string;
  /** One line, for menus and cards. */
  summary: string;
  headline: string;
  intro: string;
  points: FeaturePoint[];
  /** Short hard facts shown as chips. */
  facts: string[];
  screen: ScreenId;
  /** Only in the Quality plan. */
  quality?: boolean;
}

export const FEATURE_GROUPS: FeatureGroup[] = [
  {
    id: 'agenda',
    label: 'Agenda y reservas',
    icon: 'calendar_month',
    blurb: 'Reservas online a cualquier hora y una agenda que se ordena sola.',
    bip: { code: 'MB-10', pose: 'Enseña el móvil con la agenda del día llena', screen: 'Agenda › Hoy' },
  },
  {
    id: 'clientes',
    label: 'Clientes',
    icon: 'contacts',
    blurb: 'Tu cartera de clientes, sus citas y la conversación, en el mismo sitio.',
    bip: { code: 'MB-11', pose: 'Saluda mientras enseña la ficha de un cliente', screen: 'Clientes › Ficha' },
  },
  {
    id: 'cobros',
    label: 'Cobros y finanzas',
    icon: 'payments',
    blurb: 'Caja, gastos, comisiones y protección frente a los plantones.',
    bip: { code: 'MB-12', pose: 'Sonríe con el móvil en el panel de Finanzas', screen: 'Finanzas › Panel' },
  },
  {
    id: 'equipo',
    label: 'Equipo',
    icon: 'groups',
    blurb: 'Horarios, permisos, ausencias y fichaje de todo el equipo.',
    bip: { code: 'MB-13', pose: 'Mira un reloj de pulsera, con el móvil en la otra mano', screen: 'Registro de fichajes' },
  },
  {
    id: 'escaparate',
    label: 'Escaparate y marca',
    icon: 'auto_awesome',
    blurb: 'Tu ficha en Bipsy, tu portfolio y un aspecto que no pasa desapercibido.',
    bip: { code: 'MB-14', pose: 'Presenta orgulloso el móvil con su ficha pública', screen: 'Ficha pública del negocio' },
  },
];

export const FEATURES: Feature[] = [
  // ----- AGENDA -----------------------------------------------------------
  {
    slug: 'agenda-y-reservas-online',
    group: 'agenda',
    icon: 'calendar_month',
    name: 'Agenda y reservas online',
    summary: 'Tus clientes reservan 24/7 y tú lo ves todo en una agenda clara.',
    headline: 'La agenda que se llena mientras tú trabajas',
    intro:
      'Tus clientes reservan desde la app de Bipsy a cualquier hora, sin llamadas ni mensajes. Tú ves el día de un vistazo: lo que toca hoy, lo que queda por confirmar y cualquier otro día con un toque.',
    points: [
      { icon: 'today', title: 'Hoy, Pendientes y Agenda', text: 'Tres vistas para las tres preguntas del día: qué toca ahora, qué tengo que confirmar y cómo va la semana.' },
      { icon: 'palette', title: 'Un color por estado', text: 'Pendiente, confirmada, por cobrar, cobrada, cancelada o no vino: cada cita dice en qué punto está sin abrirla.' },
      { icon: 'bolt', title: 'Acepta solo o confirma a mano', text: 'Activa la aceptación automática o revisa cada reserva. Las que nadie confirma se cancelan solas a los 2 días (lo puedes cambiar).' },
      { icon: 'tune', title: 'Tus reglas de reserva', text: 'Intervalo entre citas de 5 a 240 minutos, antelación mínima y máxima, y un tope de citas activas por cliente.' },
      { icon: 'schedule', title: 'Horario con varios tramos', text: 'Mañana y tarde, días cerrados y servicios que solo se reservan a ciertas horas.' },
      { icon: 'notifications_active', title: 'Avisos al momento', text: 'Notificación cuando entra, se cancela o se mueve una cita, y recordatorio al cliente el día anterior.' },
    ],
    facts: ['Reservas 24/7', 'Intervalos de 5 a 240 min', 'Hasta 365 días de antelación', 'Recordatorio el día antes'],
    screen: 'agenda',
  },
  {
    slug: 'lista-de-espera',
    group: 'agenda',
    icon: 'hourglass_top',
    name: 'Lista de espera',
    summary: 'Cuando alguien cancela, el hueco se ofrece solo a quien espera.',
    headline: 'Un hueco cancelado ya no es un hueco vacío',
    intro:
      'Tus clientes se apuntan a la lista cuando no encuentran hora. Si se libera una cita, Bipsy avisa a quien está esperando y el primero que la quiere, se la queda.',
    points: [
      { icon: 'format_list_numbered', title: 'En orden o a todos', text: 'Avisa por turno, respetando quién llegó antes, o a todos a la vez para llenar el hueco cuanto antes.' },
      { icon: 'timer', title: 'Plazo para responder', text: 'Tú decides cuánto tiempo tiene cada cliente para aceptar: de 6 a 72 horas. Si la cita es para dentro de menos de 24 h, se avisa a todos.' },
      { icon: 'event_available', title: 'Ofrece huecos a mano', text: '¿Un día flojo? Elige servicio, profesional y hora y ofrécelo a la lista desde la agenda.' },
      { icon: 'swap_vert', title: 'Tú mandas en la lista', text: 'Reordena, quita a alguien y decide qué miembros del equipo pueden gestionarla.' },
    ],
    facts: ['Incluida en todos los planes', 'Plazo de 6 a 72 h', 'Aviso por turno o a todos'],
    screen: 'espera',
  },
  {
    slug: 'proteccion-contra-plantones',
    group: 'agenda',
    icon: 'shield_person',
    name: 'Protección contra plantones',
    summary: 'Pide tarjeta al reservar y cobra la tarifa si no vienen.',
    headline: 'Que un plantón no te cueste el día',
    intro:
      'Pide tarjeta al reservar y define una tarifa para las cancelaciones de última hora y los no presentados. El cliente la ve y la acepta antes de confirmar, así que no hay sorpresas para nadie.',
    points: [
      { icon: 'credit_card', title: 'Tarjeta al reservar', text: 'Activa «Pedir tarjeta al reservar» y la reserva solo se completa con una tarjeta guardada.' },
      { icon: 'percent', title: 'Tu tarifa, tu ventana', text: 'Un porcentaje del servicio (hasta el 50 %, con un tope de 100 €) para cancelaciones o cambios dentro de la ventana que elijas, de 3 a 24 horas.' },
      { icon: 'person_off', title: '«No se presentó» en un toque', text: 'Márcalo desde la agenda hasta 48 horas después de la cita. Si hay tarifa, se cobra y el cliente recibe el aviso con el importe.' },
      { icon: 'verified', title: 'Todo queda registrado', text: 'Se guarda qué política aceptó cada cliente y cuándo, por si alguna vez hay que demostrarlo.' },
    ],
    facts: ['Hasta el 50 % del servicio', 'Tope de 100 €', 'Ventana de 3 a 24 h', 'Bipsy no se queda comisión'],
    screen: 'reserva',
  },

  // ----- CLIENTES ---------------------------------------------------------
  {
    slug: 'agenda-de-clientes',
    group: 'clientes',
    icon: 'contacts',
    name: 'Agenda de clientes',
    summary: 'Importa tus contactos y ten la ficha completa de cada cliente.',
    headline: 'Conoce a cada cliente antes de que se siente',
    intro:
      'Todos tus clientes en una lista ordenada, con su historial de citas, reseñas, cobros y tus notas privadas. Los de siempre entran de golpe desde los contactos del móvil.',
    points: [
      { icon: 'import_contacts', title: 'Importa de tus contactos', text: 'Elige a quién traer desde la agenda del teléfono. Nada sale del móvil hasta que pulsas Importar.' },
      { icon: 'badge', title: 'Ficha completa', text: 'Citas, reseñas, pagos y notas privadas como alergias o preferencias, siempre a mano.' },
      { icon: 'call', title: 'WhatsApp, SMS, llamada o email', text: 'Contacta desde la ficha con el canal que prefiera cada cliente.' },
      { icon: 'send', title: 'Invítales a Bipsy', text: 'Manda la invitación con un mensaje ya escrito y tu código de negocio.' },
      { icon: 'block', title: 'Vetar cuando hace falta', text: 'Bloquea a quien no respeta tus normas: se cancelan sus reservas activas y no puede volver a reservar.' },
    ],
    facts: ['Búsqueda por nombre, teléfono o email', 'Notas privadas', 'Importación desde el móvil'],
    screen: 'clientes',
  },
  {
    slug: 'chat-con-clientes',
    group: 'clientes',
    icon: 'forum',
    name: 'Mensajes con clientes',
    summary: 'Un chat con cada cliente, con fotos y avisos de sus citas.',
    headline: 'Habla con tus clientes sin darles tu número',
    intro:
      'Cada cliente con cita tiene una conversación contigo dentro de Bipsy. Fotos de referencia, dudas de última hora y los avisos de sus reservas, todo en el mismo hilo.',
    points: [
      { icon: 'photo_library', title: 'Fotos y documentos', text: 'El cliente te enseña el corte que quiere y tú le mandas lo que necesite.' },
      { icon: 'event_note', title: 'Avisos de la cita en el hilo', text: 'Cuando una cita se reserva, se cancela o se mueve, queda anotado en la conversación.' },
      { icon: 'bolt', title: 'En tiempo real', text: 'Los mensajes llegan al momento y con notificación.' },
      { icon: 'do_not_disturb_on', title: 'Tú pones el límite', text: 'Desactiva los mensajes cuando quieras y decide qué trabajadores pueden usar el chat.' },
    ],
    facts: ['Gratis en todos los planes', 'Fotos y documentos', 'Permisos por trabajador'],
    screen: 'chat',
  },
  {
    slug: 'resenas',
    group: 'clientes',
    icon: 'star',
    name: 'Reseñas verificadas',
    summary: 'Solo opinan clientes que han venido. Y tú puedes responder.',
    headline: 'Reseñas de clientes que han venido de verdad',
    intro:
      'En Bipsy solo puede opinar quien tiene una cita confirmada y ya terminada. Nada de reseñas de desconocidos: cada estrella la ha ganado tu trabajo.',
    points: [
      { icon: 'verified_user', title: 'Solo clientes reales', text: 'Una reseña por cliente y negocio, siempre ligada a una cita que ha ocurrido.' },
      { icon: 'reply', title: 'Responde en público', text: 'Da las gracias o aclara lo que haga falta. Tu respuesta se ve en tu ficha.' },
      { icon: 'trending_up', title: 'Suben tu posición', text: 'Una buena nota ayuda a aparecer en Destacados dentro de la app de Bipsy.' },
    ],
    facts: ['Ligadas a una cita real', 'Respuesta pública', 'Aviso de cada reseña nueva'],
    screen: 'ficha',
  },

  // ----- COBROS -----------------------------------------------------------
  {
    slug: 'finanzas',
    group: 'cobros',
    icon: 'account_balance_wallet',
    name: 'Finanzas',
    summary: 'Cobros, caja del día, gastos, propinas, comisiones e IVA.',
    headline: 'Las cuentas de tu negocio, sin hojas de cálculo',
    intro:
      'Registra cada cobro al terminar la cita, abre y cierra la caja, apunta los gastos con la foto del ticket y mira cuánto has ganado este mes. Incluido en todos los planes.',
    points: [
      { icon: 'point_of_sale', title: 'Cobra al terminar la cita', text: 'Efectivo, tarjeta, Bizum o transferencia, incluso mezclados en un mismo cobro, con descuentos y propinas.' },
      { icon: 'savings', title: 'Caja del día', text: 'Abre con el cambio, apunta entradas y salidas y ciérrala sabiendo si sobra o falta.' },
      { icon: 'receipt_long', title: 'Gastos con ticket', text: 'Haz una foto al ticket y el gasto queda apuntado en su categoría.' },
      { icon: 'groups', title: 'Comisiones y propinas', text: 'Calcula la comisión de cada trabajador sobre bruto o neto y reparte las propinas.' },
      { icon: 'inventory_2', title: 'Productos y stock', text: 'Lo que vendes en el mostrador, con coste, margen y aviso de stock mínimo.' },
      { icon: 'description', title: 'Informe de IVA y exportación', text: 'El resumen para tu gestoría y la exportación a hoja de cálculo.' },
    ],
    facts: ['Incluido en todos los planes', 'Exporta hasta 5.000 filas', 'Registro interno: no emite facturas'],
    screen: 'finanzas',
  },
  {
    slug: 'cobros-con-tarjeta',
    group: 'cobros',
    icon: 'credit_score',
    name: 'Cobros con tarjeta',
    summary: 'Recibe en tu banco las tarifas por cancelación y no presentados.',
    headline: 'El dinero de los plantones, en tu cuenta',
    intro:
      'Conecta tu cuenta bancaria una vez y las tarifas de cancelación tardía, cambios de última hora y no presentados se cobran a la tarjeta del cliente y llegan a tu banco.',
    points: [
      { icon: 'account_balance', title: 'Alta en minutos', text: 'Titular, domicilio e IBAN. Los pagos los procesa Stripe, uno de los mayores procesadores de pago del mundo.' },
      { icon: 'price_check', title: 'Sin comisión de Bipsy', text: 'Bipsy no se queda nada. Solo se descuenta la tarifa del procesador de pagos.' },
      { icon: 'history', title: 'Saldo y movimientos', text: 'Mira lo que está de camino, lo que está listo para ingresar y cada cobro con su detalle.' },
      { icon: 'undo', title: 'Devoluciones', text: 'Si algo no fue culpa del cliente, devuélvele el cobro desde la app.' },
    ],
    facts: ['0 % de comisión de Bipsy', 'Pagos con Stripe', 'Devoluciones desde la app'],
    screen: 'finanzas',
  },

  // ----- EQUIPO -----------------------------------------------------------
  {
    slug: 'gestion-de-equipo',
    group: 'equipo',
    icon: 'groups',
    name: 'Gestión de equipo',
    summary: 'Añade a tu equipo gratis con un código de invitación.',
    headline: 'Todo tu equipo dentro, sin pagar por cada persona',
    intro:
      'Tus trabajadores usan Bipsy Business gratis: les pasas un código de invitación, se descargan la app y entran en tu negocio. Cada uno ve y gestiona sus citas desde su móvil, y tú decides qué servicios presta y qué permisos tiene.',
    points: [
      { icon: 'volunteer_activism', title: 'Gratis para tu equipo', text: 'La suscripción la paga el negocio, no cada trabajador. Añadir a alguien más no cambia tu cuota.' },
      { icon: 'pin', title: 'Invitación con código', text: 'Un código de 6 dígitos que caduca en 12 horas. Tu trabajador lo escribe al registrarse y ya está dentro.' },
      { icon: 'content_cut', title: 'Servicios por persona', text: 'Asigna quién hace cada servicio para que el cliente elija bien, o reserve con «cualquiera disponible».' },
      { icon: 'admin_panel_settings', title: 'Permisos a medida', text: 'Aceptar citas solo, horas extra, usar el chat, gestionar la lista de espera o cobrar sus citas.' },
      { icon: 'visibility_off', title: 'Cada uno ve lo suyo', text: 'Un trabajador puede cobrar sus citas sin ver los números del negocio.' },
    ],
    facts: ['0 € por trabajador', 'Código de invitación de 6 dígitos', 'Permisos por trabajador'],
    screen: 'equipo',
  },
  {
    slug: 'fichaje',
    group: 'equipo',
    icon: 'timer',
    name: 'Fichaje',
    summary: 'Registro de jornada desde el móvil, con recordatorios.',
    headline: 'El registro de jornada, resuelto desde el móvil',
    intro:
      'Tu equipo ficha la entrada y la salida desde su pestaña «Fichar». Tú ves quién está trabajando ahora mismo y el resumen del mes de cada persona.',
    points: [
      { icon: 'login', title: 'Entrada y salida', text: 'Un toque para fichar, y un aviso al negocio cuando alguien empieza o termina.' },
      { icon: 'alarm', title: 'Recordatorios', text: 'Aviso al trabajador 10 minutos antes de empezar o terminar su turno.' },
      { icon: 'calendar_view_month', title: 'Resumen del mes', text: 'Historial por día y resumen mensual de cada persona del equipo.' },
      { icon: 'home', title: 'Personal de hoy en la agenda', text: 'Desde el inicio ves cuántas personas han fichado sin salir de las citas.' },
    ],
    facts: ['Incluido en todos los planes', 'Recordatorio 10 min antes', 'Resumen mensual'],
    screen: 'equipo',
  },
  {
    slug: 'ausencias-y-vacaciones',
    group: 'equipo',
    icon: 'beach_access',
    name: 'Ausencias y vacaciones',
    summary: 'Solicitudes, aprobaciones y las citas afectadas resueltas.',
    headline: 'Vacaciones aprobadas sin descuadrar la agenda',
    intro:
      'Tu equipo pide vacaciones, asuntos propios o bajas desde la app. Al aprobarlas, Bipsy te enseña las citas que chocan para que las reasignes o las canceles una a una.',
    points: [
      { icon: 'send', title: 'Solicitudes desde el móvil', text: 'Vacaciones, asuntos personales, baja médica u otro, con su motivo.' },
      { icon: 'rule', title: 'Aprueba o rechaza', text: 'Con un toque, y el trabajador recibe la respuesta al momento.' },
      { icon: 'call_split', title: 'Resuelve los conflictos', text: 'Las citas afectadas aparecen juntas: reasígnalas a otra persona o cancélalas.' },
      { icon: 'event_busy', title: 'Ausencias directas', text: 'Bloquea días a cualquier persona del equipo sin esperar a que lo pida.' },
    ],
    facts: ['4 tipos de ausencia', 'Conflictos resueltos antes de aprobar', 'Avisos push'],
    screen: 'equipo',
  },

  // ----- ESCAPARATE -------------------------------------------------------
  {
    slug: 'ficha-en-bipsy',
    group: 'escaparate',
    icon: 'storefront',
    name: 'Tu ficha en Bipsy',
    summary: 'Aparece en la app de Bipsy, donde tus clientes buscan cita.',
    headline: 'Tu negocio, a la vista de quien busca cita cerca',
    intro:
      'Al darte de alta, tu negocio aparece en Bipsy, la app donde tus clientes buscan, comparan y reservan. Con tus servicios, fotos, reseñas, horario y normas.',
    points: [
      { icon: 'travel_explore', title: 'Te encuentran por zona', text: 'Los clientes buscan por nombre, servicio o categoría, en lista o en el mapa.' },
      { icon: 'photo_camera', title: 'Portfolio de tus trabajos', text: 'Hasta 10 fotos con su servicio, o sin límite con Quality. También desde Instagram.' },
      { icon: 'gavel', title: 'Normas claras', text: '38 normas listas para marcar —cita previa, formas de pago, accesibilidad— o escribe las tuyas.' },
      { icon: 'preview', title: 'Mira cómo te ven', text: 'La vista previa enseña tu ficha exactamente como la ve un cliente.' },
      { icon: 'new_releases', title: 'Insignia de Nuevo', text: 'Los primeros 60 días tu negocio lleva la insignia «Nuevo» en la app.' },
    ],
    facts: ['38 normas predefinidas', 'Mapa y búsqueda por zona', 'Vista previa en directo'],
    screen: 'ficha',
  },
  {
    slug: 'plan-quality',
    group: 'escaparate',
    icon: 'auto_awesome',
    name: 'Personalización Quality',
    summary: 'Tus colores, portada animada y efectos que solo tiene Quality.',
    headline: 'Destaca en la lista antes de que lean tu nombre',
    intro:
      'Con Quality tu ficha lleva tu color de marca, una portada y una foto animadas y efectos exclusivos. Además, en Destacados apareces por delante de los negocios de tu misma zona.',
    points: [
      { icon: 'format_color_fill', title: 'Tu color de marca', text: 'Botones, acentos y detalles de tu ficha con tu color.' },
      { icon: 'animated_images', title: 'Portada y foto animadas', text: 'Un GIF o WebP en lugar de una imagen fija: tu negocio se mueve en la lista.' },
      { icon: 'blur_on', title: 'Efectos exclusivos', text: '5 marcos de foto, 9 efectos de portada, 7 para la tarjeta en búsquedas y 6 para tu nombre.' },
      { icon: 'reorder', title: 'Tu ficha a tu manera', text: 'Ordena galería, servicios y reseñas: primero lo que más vende.' },
      { icon: 'collections', title: 'Portfolio sin límite', text: 'Todas las fotos que quieras enseñar.' },
      { icon: 'support_agent', title: 'Solicitudes a Bipsy', text: 'Pide mejoras y cambios en la app. Las leemos una a una y te contestamos.' },
    ],
    facts: ['Prioridad en Destacados', '27 efectos', 'Vista previa antes de contratar'],
    screen: 'quality',
    quality: true,
  },
];

export function featuresOf(group: FeatureGroupId): Feature[] {
  return FEATURES.filter((f) => f.group === group);
}

export function featureBySlug(slug: string | null | undefined): Feature | undefined {
  return FEATURES.find((f) => f.slug === slug);
}

export function groupOf(id: FeatureGroupId): FeatureGroup {
  // Every feature references an existing group; the fallback only protects
  // against a typo in the data turning into a crash.
  return FEATURE_GROUPS.find((g) => g.id === id) ?? FEATURE_GROUPS[0];
}
