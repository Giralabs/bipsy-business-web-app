/**
 * The kinds of business the site speaks to, one page each.
 *
 * The list is the category catalogue of the backend (`category` table, active
 * rows, in display order, V121) and the icons are the app's
 * `GipsiCategoryIcons`, so a barber sees the same face here as in the app.
 * Deactivated categories (MEDICAL, BARBERSHOP, PILATES, COACHING, TUTORING)
 * are not here, and neither is OTHER, which is not a trade.
 */

export interface SampleService {
  name: string;
  minutes: number;
  price: string;
}

export interface BusinessType {
  slug: string;
  /** Backend category code. */
  code: string;
  icon: string;
  name: string;
  /** "tu barbería", used inside sentences. */
  yours: string;
  headline: string;
  intro: string;
  /** Problems of the trade that the app solves, in the owner's words. */
  pains: { title: string; text: string }[];
  /** Feature slugs worth highlighting for this trade (see features.data.ts). */
  highlights: string[];
  /** Demo services for the mock agenda of the page. */
  services: SampleService[];
  /** Mr. Bip illustration of the page. */
  bip: { code: string; pose: string };
}

export const BUSINESS_TYPES: BusinessType[] = [
  {
    slug: 'barberias',
    code: 'BARBER',
    icon: 'face',
    name: 'Barberías',
    yours: 'tu barbería',
    headline: 'Tu barbería, con cada silla ocupada',
    intro: 'Citas cortas, clientes fijos cada dos semanas y el plantón que te deja la silla vacía. Bipsy Business está pensado para ese ritmo.',
    pains: [
      { title: 'Plantones', text: 'Pide tarjeta al reservar y cobra una tarifa si no se presentan. Se acabó perder la tarde por un «se me olvidó».' },
      { title: 'Clientes de siempre', text: 'Desde Bipsy repiten cita en un toque con «Volver a reservar», sin escribirte por WhatsApp.' },
      { title: 'Varios barberos', text: 'Cada uno con su agenda en su móvil y tú con la vista de todos. Añadirlos no te cuesta nada.' },
    ],
    highlights: ['proteccion-contra-plantones', 'agenda-y-reservas-online', 'gestion-de-equipo', 'finanzas'],
    services: [
      { name: 'Corte clásico', minutes: 30, price: '15 €' },
      { name: 'Corte + barba', minutes: 45, price: '22 €' },
      { name: 'Arreglo de barba', minutes: 20, price: '10 €' },
      { name: 'Afeitado a navaja', minutes: 30, price: '16 €' },
    ],
    bip: { code: 'MB-21', pose: 'Con peine y navaja, pose de barbero clásico' },
  },
  {
    slug: 'peluquerias',
    code: 'HAIRDRESSER',
    icon: 'content_cut',
    name: 'Peluquerías',
    yours: 'tu peluquería',
    headline: 'Tu peluquería, con la agenda llena y sin el teléfono sonando',
    intro: 'Cortes, color y tratamientos de distinta duración, varias personas trabajando a la vez y clientas que quieren a su estilista de siempre. Bipsy Business lo encaja todo.',
    pains: [
      { title: 'Servicios que duran distinto', text: 'Un corte son 30 minutos y unas mechas, dos horas. Cada servicio lleva su duración y la agenda solo ofrece huecos donde caben.' },
      { title: 'Cada clienta, con su estilista', text: 'Asigna servicios por persona y deja que reserven con quien prefieran o con cualquiera disponible.' },
      { title: 'Huecos que deja una cancelación', text: 'La lista de espera ofrece el hueco a quien estaba esperando antes de que se quede vacío.' },
    ],
    highlights: ['agenda-y-reservas-online', 'gestion-de-equipo', 'lista-de-espera', 'ficha-en-bipsy'],
    services: [
      { name: 'Corte y peinado', minutes: 45, price: '22 €' },
      { name: 'Mechas balayage', minutes: 150, price: '85 €' },
      { name: 'Color raíz', minutes: 75, price: '38 €' },
      { name: 'Tratamiento de keratina', minutes: 120, price: '70 €' },
    ],
    bip: { code: 'MB-20', pose: 'Con tijeras y un secador, guiñando un ojo' },
  },
  {
    slug: 'unas',
    code: 'NAILS',
    icon: 'brush',
    name: 'Uñas',
    yours: 'tu salón de uñas',
    headline: 'Tu salón de uñas, con el portfolio que vende solo',
    intro: 'Tus clientas eligen por las fotos. Enseña tus trabajos, organiza rellenos y retiradas y no pierdas ni una cita.',
    pains: [
      { title: 'Se elige por la foto', text: 'Sube tus diseños al portfolio con su servicio y deja que tus trabajos convenzan.' },
      { title: 'Rellenos cada pocas semanas', text: 'Tus clientas repiten desde la app sin escribirte cada vez.' },
      { title: 'Referencias de diseño', text: 'Te mandan la foto del diseño por el chat de la cita, sin mezclarlo con tu WhatsApp personal.' },
    ],
    highlights: ['ficha-en-bipsy', 'chat-con-clientes', 'agenda-y-reservas-online', 'plan-quality'],
    services: [
      { name: 'Manicura semipermanente', minutes: 45, price: '20 €' },
      { name: 'Uñas de gel', minutes: 90, price: '35 €' },
      { name: 'Relleno de gel', minutes: 60, price: '25 €' },
      { name: 'Pedicura completa', minutes: 60, price: '28 €' },
    ],
    bip: { code: 'MB-23', pose: 'Enseñando las manos con las uñas pintadas' },
  },
  {
    slug: 'centros-de-estetica',
    code: 'ESTHETIC',
    icon: 'auto_awesome',
    name: 'Centros de estética',
    yours: 'tu centro de estética',
    headline: 'Tu centro de estética, organizado de cabina a caja',
    intro: 'Tratamientos largos, bonos, productos en el mostrador y clientas con alergias que no puedes olvidar. Todo en la ficha y en la caja.',
    pains: [
      { title: 'Notas que importan', text: 'Alergias, tipo de piel o preferencias en las notas privadas de cada clienta.' },
      { title: 'Productos a la venta', text: 'Cremas y productos con su stock y aviso de mínimo, cobrados en la misma venta que el tratamiento.' },
      { title: 'Normas claras', text: 'Llegar 10 minutos antes, avisar de embarazo o alergias: publícalas en tu ficha antes de que reserven.' },
    ],
    highlights: ['agenda-de-clientes', 'finanzas', 'ficha-en-bipsy', 'proteccion-contra-plantones'],
    services: [
      { name: 'Limpieza facial', minutes: 60, price: '45 €' },
      { name: 'Higiene y peeling', minutes: 75, price: '55 €' },
      { name: 'Masaje drenante', minutes: 50, price: '40 €' },
      { name: 'Tratamiento reafirmante', minutes: 60, price: '60 €' },
    ],
    bip: { code: 'MB-22', pose: 'Con mascarilla facial y rodajas de pepino, relajado' },
  },
  {
    slug: 'cejas-y-pestanas',
    code: 'EYEBROWS',
    icon: 'visibility',
    name: 'Cejas y pestañas',
    yours: 'tu estudio de cejas y pestañas',
    headline: 'Cejas y pestañas, con clientas que vuelven a su hora',
    intro: 'Laminados, extensiones y rellenos que se repiten cada pocas semanas. Que reserven solas y lleguen con las normas leídas.',
    pains: [
      { title: 'Rellenos periódicos', text: '«Volver a reservar» en la app hace que repetir sea cosa de un toque.' },
      { title: 'Normas antes de venir', text: 'Sin rímel, sin lentillas: publícalo en tu ficha para que nadie llegue sin saberlo.' },
      { title: 'Huecos cortos', text: 'Intervalos de 5 minutos para encajar servicios breves sin tiempos muertos.' },
    ],
    highlights: ['agenda-y-reservas-online', 'ficha-en-bipsy', 'lista-de-espera', 'resenas'],
    services: [
      { name: 'Laminado de cejas', minutes: 45, price: '30 €' },
      { name: 'Lifting de pestañas', minutes: 60, price: '40 €' },
      { name: 'Extensiones pelo a pelo', minutes: 120, price: '75 €' },
      { name: 'Diseño de cejas', minutes: 20, price: '12 €' },
    ],
    bip: { code: 'MB-26', pose: 'Guiñando un ojo con pestañas largas' },
  },
  {
    slug: 'estudios-de-tatuaje',
    code: 'TATTOO',
    icon: 'draw',
    name: 'Tatuaje y piercing',
    yours: 'tu estudio de tatuaje',
    headline: 'Tu estudio de tatuaje, con señal y sin plantones',
    intro: 'Sesiones largas que no puedes perder, diseños que se hablan antes y artistas con agenda propia.',
    pains: [
      { title: 'Una sesión perdida es medio día', text: 'Tarjeta al reservar y tarifa por no presentarse para las sesiones largas.' },
      { title: 'El diseño se habla antes', text: 'Referencias y bocetos por el chat de la cita.' },
      { title: 'Artistas con su agenda', text: 'Cada tatuador con sus servicios y su horario, gratis para el estudio.' },
    ],
    highlights: ['proteccion-contra-plantones', 'chat-con-clientes', 'gestion-de-equipo', 'ficha-en-bipsy'],
    services: [
      { name: 'Tatuaje pequeño', minutes: 60, price: '70 €' },
      { name: 'Sesión de 3 horas', minutes: 180, price: '240 €' },
      { name: 'Consulta de diseño', minutes: 30, price: 'Gratis' },
      { name: 'Retoque', minutes: 45, price: '40 €' },
    ],
    bip: { code: 'MB-25', pose: 'Con máquina de tatuar y un tatuaje del loto de Bipsy en el brazo' },
  },
  {
    slug: 'maquillaje',
    code: 'MAKEUP',
    icon: 'palette',
    name: 'Maquillaje',
    yours: 'tu estudio de maquillaje',
    headline: 'Maquillaje para eventos, sin cuadrar citas a mano',
    intro: 'Bodas, pruebas y servicios a domicilio. Organiza tus días grandes y enseña tu trabajo a quien busca maquilladora.',
    pains: [
      { title: 'Trabajas a domicilio', text: 'Date de alta como negocio a domicilio: tus clientas ven que vas tú.' },
      { title: 'Días con mucha antelación', text: 'Abre la agenda hasta 365 días vista para bodas y eventos.' },
      { title: 'Tu trabajo, a la vista', text: 'Un portfolio con tus mejores looks en tu ficha.' },
    ],
    highlights: ['ficha-en-bipsy', 'agenda-y-reservas-online', 'proteccion-contra-plantones', 'chat-con-clientes'],
    services: [
      { name: 'Maquillaje de novia', minutes: 90, price: '120 €' },
      { name: 'Prueba de maquillaje', minutes: 60, price: '50 €' },
      { name: 'Maquillaje de evento', minutes: 60, price: '45 €' },
      { name: 'Clase de automaquillaje', minutes: 90, price: '60 €' },
    ],
    bip: { code: 'MB-24', pose: 'Con una brocha de maquillaje en la mano' },
  },
  {
    slug: 'depilacion-laser',
    code: 'LASER',
    icon: 'bolt',
    name: 'Depilación',
    yours: 'tu centro de depilación láser',
    headline: 'Depilación láser: sesiones en serie, agenda sin huecos',
    intro: 'Tratamientos de varias sesiones y cabinas que tienen que rendir. Bipsy Business ordena el calendario y la caja.',
    pains: [
      { title: 'Sesiones en serie', text: 'La ficha de cada clienta guarda su historial de citas y tus notas del tratamiento.' },
      { title: 'Cabinas que rinden', text: 'La lista de espera llena las cancelaciones de última hora.' },
      { title: 'Cuentas claras', text: 'Cobros, gastos e informe de IVA desde Finanzas.' },
    ],
    highlights: ['agenda-de-clientes', 'lista-de-espera', 'finanzas', 'agenda-y-reservas-online'],
    services: [
      { name: 'Axilas', minutes: 15, price: '25 €' },
      { name: 'Piernas completas', minutes: 45, price: '90 €' },
      { name: 'Ingles', minutes: 20, price: '35 €' },
      { name: 'Valoración inicial', minutes: 20, price: 'Gratis' },
    ],
    bip: { code: 'MB-27', pose: 'Con gafas protectoras, pose de «¡zas!»' },
  },
  {
    slug: 'masajes',
    code: 'MASSAGE',
    icon: 'massage',
    name: 'Masajes',
    yours: 'tu centro de masajes',
    headline: 'Tu centro de masajes, en calma también por dentro',
    intro: 'Que la gestión no rompa el ambiente: reservas online, recordatorios y cobros sin interrumpir una sesión.',
    pains: [
      { title: 'No coges el teléfono en sesión', text: 'Tus clientes reservan solos mientras tú trabajas.' },
      { title: 'Recordatorios', text: 'Aviso al cliente el día anterior para que no se le olvide.' },
      { title: 'Varias salas y profesionales', text: 'Cada profesional con su agenda y sus servicios.' },
    ],
    highlights: ['agenda-y-reservas-online', 'proteccion-contra-plantones', 'gestion-de-equipo', 'resenas'],
    services: [
      { name: 'Masaje relajante', minutes: 60, price: '45 €' },
      { name: 'Masaje descontracturante', minutes: 50, price: '50 €' },
      { name: 'Piedras calientes', minutes: 75, price: '60 €' },
      { name: 'Reflexología podal', minutes: 45, price: '35 €' },
    ],
    bip: { code: 'MB-28', pose: 'Tumbado en una camilla con una toalla enrollada en la cabeza' },
  },
  {
    slug: 'entrenamiento-personal',
    code: 'PERSONAL_TRAINER',
    icon: 'exercise',
    name: 'Entreno personal',
    yours: 'tu negocio de entrenamiento',
    headline: 'Entrenamiento personal: tú entrenas, la agenda se gestiona sola',
    intro: 'Sesiones individuales, en el gimnasio o a domicilio, con clientes que reservan y cambian de hora sin llamarte.',
    pains: [
      { title: 'En el centro o a domicilio', text: 'Date de alta con local o como servicio a domicilio.' },
      { title: 'Cambios de hora', text: 'El cliente cambia día u hora desde la app, dentro de tus reglas.' },
      { title: 'Cobros', text: 'Registra cada sesión cobrada y mira tus ingresos del mes.' },
    ],
    highlights: ['agenda-y-reservas-online', 'finanzas', 'proteccion-contra-plantones', 'chat-con-clientes'],
    services: [
      { name: 'Sesión individual', minutes: 60, price: '35 €' },
      { name: 'Sesión en pareja', minutes: 60, price: '50 €' },
      { name: 'Valoración física', minutes: 45, price: '30 €' },
      { name: 'Entreno a domicilio', minutes: 60, price: '45 €' },
    ],
    bip: { code: 'MB-31', pose: 'Levantando una pesa con una mano, con traje y cinta en la frente' },
  },
  {
    slug: 'fisioterapia',
    code: 'PHYSIO',
    icon: 'physical_therapy',
    name: 'Fisioterapia',
    yours: 'tu clínica de fisioterapia',
    headline: 'Tu consulta de fisioterapia, con la agenda bajo control',
    intro: 'Tratamientos de varias sesiones, pacientes que necesitan su hora de siempre y un equipo con horarios distintos.',
    pains: [
      { title: 'Seguimiento', text: 'Historial de citas y notas privadas en la ficha de cada paciente.' },
      { title: 'Horarios del equipo', text: 'Ausencias y vacaciones aprobadas con las citas afectadas resueltas.' },
      { title: 'Registro de jornada', text: 'Fichaje desde el móvil para todo el equipo.' },
    ],
    highlights: ['agenda-de-clientes', 'ausencias-y-vacaciones', 'fichaje', 'agenda-y-reservas-online'],
    services: [
      { name: 'Sesión de fisioterapia', minutes: 45, price: '40 €' },
      { name: 'Punción seca', minutes: 30, price: '35 €' },
      { name: 'Valoración inicial', minutes: 60, price: '45 €' },
      { name: 'Drenaje linfático', minutes: 50, price: '45 €' },
    ],
    bip: { code: 'MB-30', pose: 'Con una venda en el brazo y el pulgar arriba' },
  },
  {
    slug: 'podologia',
    code: 'PODIATRY',
    icon: 'footprint',
    name: 'Podología',
    yours: 'tu clínica de podología',
    headline: 'Tu clínica de podología, con cada revisión en su sitio',
    intro: 'Quiropodias que se repiten cada pocas semanas, estudios de la pisada que llevan su tiempo y pacientes que prefieren reservar sin llamar.',
    pains: [
      { title: 'Revisiones que vuelven', text: 'El paciente repite su quiropodia desde la app en un toque, con su podólogo de siempre.' },
      { title: 'Pruebas largas', text: 'El estudio de la pisada lleva su duración y la agenda solo ofrece huecos donde cabe.' },
      { title: 'Historial del paciente', text: 'Plantillas, tratamientos y observaciones en las notas privadas de su ficha.' },
    ],
    highlights: ['agenda-y-reservas-online', 'agenda-de-clientes', 'proteccion-contra-plantones', 'resenas'],
    services: [
      { name: 'Quiropodia', minutes: 30, price: '30 €' },
      { name: 'Estudio de la pisada', minutes: 60, price: '60 €' },
      { name: 'Plantillas a medida', minutes: 45, price: '120 €' },
      { name: 'Tratamiento de uña encarnada', minutes: 30, price: '40 €' },
    ],
    // Sin ilustración propia todavía: el genérico, que sí existe. Con un código
    // nuevo sin su .webp el panel enseñaría una imagen rota.
    bip: { code: 'MB-00', pose: 'Mr. Bip, la mascota de Bipsy Business' },
  },
  {
    slug: 'dentistas',
    code: 'DENTAL',
    icon: 'dentistry',
    name: 'Dentistas',
    yours: 'tu clínica dental',
    headline: 'Tu clínica dental, sin huecos en el sillón',
    intro: 'Revisiones, limpiezas y tratamientos de varias visitas, con varios profesionales y pacientes que olvidan su cita si nadie se la recuerda.',
    pains: [
      { title: 'Citas que se olvidan', text: 'Cada paciente recibe el aviso de su cita y la confirma o la cambia desde la app.' },
      { title: 'Varios profesionales', text: 'Cada odontólogo e higienista con sus tratamientos y su horario.' },
      { title: 'Huecos que deja una cancelación', text: 'La lista de espera ofrece el hueco a quien quería venir antes.' },
    ],
    highlights: ['agenda-y-reservas-online', 'gestion-de-equipo', 'lista-de-espera', 'proteccion-contra-plantones'],
    services: [
      { name: 'Revisión', minutes: 30, price: '30 €' },
      { name: 'Limpieza dental', minutes: 45, price: '50 €' },
      { name: 'Blanqueamiento', minutes: 60, price: '250 €' },
      { name: 'Revisión de ortodoncia', minutes: 20, price: '40 €' },
    ],
    // Sin ilustración propia todavía: ver la nota de Podología.
    bip: { code: 'MB-00', pose: 'Mr. Bip, la mascota de Bipsy Business' },
  },
  {
    slug: 'nutricion',
    code: 'NUTRITION',
    icon: 'grocery',
    name: 'Nutrición',
    yours: 'tu consulta de nutrición',
    headline: 'Tu consulta de nutrición, con revisiones que no se olvidan',
    intro: 'Primeras visitas, revisiones periódicas y pacientes que agradecen reservar a cualquier hora.',
    pains: [
      { title: 'Revisiones periódicas', text: 'El paciente vuelve a reservar desde la app en un toque.' },
      { title: 'Consulta tranquila', text: 'Nada de coger el teléfono durante una consulta.' },
      { title: 'Notas del paciente', text: 'Intolerancias y objetivos en las notas privadas.' },
    ],
    highlights: ['agenda-y-reservas-online', 'agenda-de-clientes', 'chat-con-clientes', 'resenas'],
    services: [
      { name: 'Primera consulta', minutes: 60, price: '50 €' },
      { name: 'Revisión', minutes: 30, price: '30 €' },
      { name: 'Plan deportivo', minutes: 45, price: '45 €' },
      { name: 'Consulta online', minutes: 30, price: '30 €' },
    ],
    bip: { code: 'MB-32', pose: 'Mordiendo una manzana verde' },
  },
  {
    slug: 'psicologia',
    code: 'PSYCHOLOGY',
    icon: 'psychology',
    name: 'Psicología',
    yours: 'tu consulta de psicología',
    headline: 'Tu consulta de psicología, con la agenda tranquila',
    intro: 'Sesiones semanales que se repiten, pacientes que valoran la discreción y una consulta en la que no cabe coger el teléfono.',
    pains: [
      { title: 'Sesiones que se repiten', text: 'El paciente reserva su hora de siempre desde la app, sin mensajes de ida y vuelta.' },
      { title: 'Consulta sin interrupciones', text: 'Nada de coger el teléfono en mitad de una sesión: las citas entran solas.' },
      { title: 'Sesiones que se pierden', text: 'Una política de cancelación clara para la hora que se queda vacía.' },
    ],
    highlights: ['agenda-y-reservas-online', 'agenda-de-clientes', 'proteccion-contra-plantones', 'chat-con-clientes'],
    services: [
      { name: 'Primera consulta', minutes: 60, price: '60 €' },
      { name: 'Sesión individual', minutes: 50, price: '55 €' },
      { name: 'Terapia de pareja', minutes: 90, price: '80 €' },
      { name: 'Sesión online', minutes: 50, price: '50 €' },
    ],
    bip: { code: 'MB-33', pose: 'Sentado en un sillón con libreta, escuchando' },
  },
  {
    slug: 'fotografia',
    code: 'PHOTOGRAPHY',
    icon: 'photo_camera',
    name: 'Fotografía',
    yours: 'tu estudio de fotografía',
    headline: 'Tu estudio de fotografía, con sesiones reservadas y portfolio a la vista',
    intro: 'Sesiones de estudio y exteriores, con un portfolio que vende y reservas que no dependen de responder mensajes.',
    pains: [
      { title: 'El portfolio lo es todo', text: 'Tus mejores fotos en tu ficha, sin límite con Quality.' },
      { title: 'Sesiones largas', text: 'Tarjeta al reservar para no perder una tarde de estudio.' },
      { title: 'Detalles de la sesión', text: 'Ideas y referencias por el chat de la cita.' },
    ],
    highlights: ['ficha-en-bipsy', 'plan-quality', 'proteccion-contra-plantones', 'chat-con-clientes'],
    services: [
      { name: 'Sesión de retrato', minutes: 60, price: '80 €' },
      { name: 'Book profesional', minutes: 120, price: '150 €' },
      { name: 'Fotos de producto', minutes: 90, price: '110 €' },
      { name: 'Fotos de carné', minutes: 15, price: '12 €' },
    ],
    bip: { code: 'MB-34', pose: 'Haciendo una foto con una cámara réflex' },
  },
  {
    slug: 'peluqueria-canina',
    code: 'PET_GROOMING',
    icon: 'pet_supplies',
    name: 'Peluquería canina',
    yours: 'tu peluquería canina',
    headline: 'Tu peluquería canina, con cada baño en su hora',
    intro: 'Baños y cortes que duran según la raza, clientes que vuelven cada mes y mañanas en las que no da tiempo a contestar el teléfono.',
    pains: [
      { title: 'Cada raza, su tiempo', text: 'Un baño de un chihuahua no dura lo que el de un pastor alemán: cada servicio lleva su duración.' },
      { title: 'Clientes que vuelven', text: 'El dueño repite el arreglo de su perro desde la app, con quien siempre lo atiende.' },
      { title: 'Lo que hay que saber', text: 'Alergias, carácter y cómo le gusta el corte, en las notas privadas de la ficha.' },
    ],
    highlights: ['agenda-y-reservas-online', 'agenda-de-clientes', 'lista-de-espera', 'ficha-en-bipsy'],
    services: [
      { name: 'Baño perro pequeño', minutes: 45, price: '25 €' },
      { name: 'Baño y corte perro mediano', minutes: 90, price: '40 €' },
      { name: 'Arreglo perro grande', minutes: 120, price: '55 €' },
      { name: 'Corte de uñas', minutes: 15, price: '8 €' },
    ],
    // Sin ilustración propia todavía: ver la nota de Podología.
    bip: { code: 'MB-00', pose: 'Mr. Bip, la mascota de Bipsy Business' },
  },
];

export function businessTypeBySlug(slug: string | null | undefined): BusinessType | undefined {
  return BUSINESS_TYPES.find((t) => t.slug === slug);
}

/** The five trades shown first in menus, like the categories row of the app. */
export const FEATURED_TYPE_SLUGS = ['peluquerias', 'barberias', 'centros-de-estetica', 'unas', 'cejas-y-pestanas', 'masajes'];
