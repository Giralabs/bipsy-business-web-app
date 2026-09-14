/**
 * Blog articles. Placeholder content until there is a CMS, but not filler:
 * each article is useful on its own and everything it says about the app is
 * true today.
 */

export interface BlogSection {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
}

export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  category: 'Agenda' | 'Equipo' | 'Clientes' | 'Escaparate' | 'Gestión';
  icon: string;
  readMinutes: number;
  /** ISO date, for sorting and for <time datetime>. */
  date: string;
  dateLabel: string;
  sections: BlogSection[];
  /** Related feature, linked at the end of the article. */
  featureSlug: string;
}

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: 'como-reducir-los-plantones',
    title: 'Cómo reducir los plantones sin perder clientes',
    excerpt: 'Una política de cancelación clara, tarjeta al reservar y recordatorios: las tres piezas que evitan la silla vacía.',
    category: 'Gestión',
    icon: 'person_off',
    readMinutes: 5,
    date: '2026-09-08',
    dateLabel: '8 de septiembre de 2026',
    featureSlug: 'proteccion-contra-plantones',
    sections: [
      {
        heading: 'Un plantón cuesta más que la cita',
        paragraphs: [
          'Cuando alguien no se presenta no solo pierdes lo que iba a pagar. Pierdes el hueco que podrías haber dado a otra persona, el tiempo que reservaste y, muchas veces, el ritmo del resto del día.',
          'La mayoría de plantones no son mala fe: son olvidos. Por eso lo primero no es castigar, sino recordar y dejar las normas claras antes de que el cliente reserve.',
        ],
      },
      {
        heading: 'Primero, que no se olvide',
        paragraphs: [
          'Bipsy manda al cliente un recordatorio el día anterior a su cita. Además, el cliente puede cambiar la hora o cancelar desde la app en dos toques, así que es más fácil avisar que no presentarse.',
        ],
      },
      {
        heading: 'Después, una política que se entienda',
        paragraphs: ['Una buena política de cancelación tiene tres datos y ninguno más:'],
        bullets: [
          'Hasta cuándo se puede cancelar gratis: una ventana de entre 3 y 24 horas antes de la cita.',
          'Cuánto cuesta cancelar tarde o no venir: un porcentaje del servicio, como mucho el 50 % y nunca más de 100 €.',
          'Qué se necesita para reservar: si pides tarjeta, el cliente lo sabe antes de confirmar.',
        ],
      },
      {
        heading: 'Y si aun así no viene',
        paragraphs: [
          'Márcalo como «No se presentó» desde la agenda, hasta 48 horas después. Si tu política lleva tarifa, se cobra a la tarjeta guardada y el cliente recibe el aviso con el importe exacto.',
          'Consejo: empieza con una tarifa moderada. Su objetivo es que la gente avise, no ganar dinero con los despistes.',
        ],
      },
    ],
  },
  {
    slug: 'lista-de-espera-huecos-cancelados',
    title: 'Lista de espera: que una cancelación no sea un hueco vacío',
    excerpt: 'Cómo configurar la lista de espera para que los huecos que se liberan se llenen solos.',
    category: 'Agenda',
    icon: 'hourglass_top',
    readMinutes: 4,
    date: '2026-09-01',
    dateLabel: '1 de septiembre de 2026',
    featureSlug: 'lista-de-espera',
    sections: [
      {
        heading: 'Los huecos se liberan cuando ya nadie los busca',
        paragraphs: [
          'Una cancelación a las nueve de la mañana para las cinco de la tarde es un hueco que alguien quería la semana pasada y no encontró. La lista de espera guarda a esa persona para que no se pierda.',
        ],
      },
      {
        heading: 'En orden o a todos',
        paragraphs: ['Tienes dos formas de avisar, y cada una tiene su momento:'],
        bullets: [
          'En orden: se avisa por turnos, respetando quién se apuntó antes. Es lo más justo cuando hay margen.',
          'A todos: se avisa a la vez y se lo queda el primero que acepta. Es lo más rápido.',
        ],
      },
      {
        heading: 'El plazo para responder',
        paragraphs: [
          'Cada cliente tiene un tiempo para aceptar el hueco antes de que pase al siguiente: de 6 a 72 horas, 24 por defecto. Cuando la cita es para dentro de menos de 24 horas, Bipsy avisa a todos a la vez, porque no hay tiempo para turnos.',
        ],
      },
      {
        heading: 'Los días flojos también cuentan',
        paragraphs: [
          'Desde la agenda puedes ofrecer un hueco concreto —servicio, profesional y hora— a quien está esperando, aunque nadie haya cancelado. Es la forma más sencilla de llenar un martes a media tarde.',
        ],
      },
    ],
  },
  {
    slug: 'anadir-a-tu-equipo-gratis',
    title: 'Cómo añadir a tu equipo a Bipsy Business, gratis y en dos minutos',
    excerpt: 'Tus trabajadores no cuestan nada: se descargan la app, escriben tu código de invitación y ya están dentro.',
    category: 'Equipo',
    icon: 'group_add',
    readMinutes: 3,
    date: '2026-08-26',
    dateLabel: '26 de agosto de 2026',
    featureSlug: 'gestion-de-equipo',
    sections: [
      {
        heading: 'Un precio por negocio, no por persona',
        paragraphs: [
          'En Bipsy Business la suscripción la paga el negocio. Da igual que trabajes con una persona o con diez: añadir a alguien a tu equipo no cambia lo que pagas.',
        ],
      },
      {
        heading: 'Paso a paso',
        paragraphs: [],
        bullets: [
          'Entra en Perfil › Equipo y pulsa Invitar. Se genera un código de 6 dígitos.',
          'Pásaselo a tu trabajador. El código caduca en 12 horas y puedes atarlo a su correo.',
          'Tu trabajador se descarga Bipsy Business, elige «Soy trabajador» y escribe el código.',
          'Ya está en tu negocio. Asígnale sus servicios, su horario y sus permisos.',
        ],
      },
      {
        heading: 'Qué ve cada uno',
        paragraphs: [
          'Cada trabajador ve su propia agenda y gestiona sus citas desde su móvil. Tú decides si puede aceptar reservas automáticamente, usar el chat, gestionar la lista de espera o cobrar sus citas. Nunca ve los números del negocio.',
        ],
      },
    ],
  },
  {
    slug: 'registro-de-jornada',
    title: 'Registro de jornada: qué pide la ley y cómo llevarlo desde el móvil',
    excerpt: 'Si tienes trabajadores, tienes que registrar su jornada cada día. Así puedes hacerlo sin papeles.',
    category: 'Equipo',
    icon: 'timer',
    readMinutes: 4,
    date: '2026-08-18',
    dateLabel: '18 de agosto de 2026',
    featureSlug: 'fichaje',
    sections: [
      {
        heading: 'Qué dice la norma',
        paragraphs: [
          'Desde 2019, el Estatuto de los Trabajadores obliga a las empresas a registrar cada día la hora de inicio y de fin de la jornada de cada persona trabajadora, y a conservar esos registros durante cuatro años a disposición de la plantilla, sus representantes y la Inspección de Trabajo.',
          'Este artículo es informativo y no sustituye el consejo de tu asesoría laboral, que es quien conoce tu convenio y tu caso.',
        ],
      },
      {
        heading: 'Cómo se ficha con Bipsy Business',
        paragraphs: [
          'Activa el fichaje en los ajustes del negocio. Tus trabajadores tendrán una pestaña «Fichar» para marcar la entrada y la salida con un toque, y recibirán un recordatorio 10 minutos antes de empezar o terminar su turno.',
        ],
      },
      {
        heading: 'Lo que ves tú',
        paragraphs: ['Desde el registro de fichajes tienes:'],
        bullets: [
          'Quién está trabajando ahora mismo.',
          'El historial de cada día.',
          'El resumen del mes de cada persona.',
        ],
      },
    ],
  },
  {
    slug: 'como-conseguir-y-responder-resenas',
    title: 'Cómo conseguir más reseñas y responderlas bien',
    excerpt: 'Las reseñas deciden a quién reservan tus futuros clientes. Cómo pedirlas sin agobiar y qué contestar.',
    category: 'Clientes',
    icon: 'reviews',
    readMinutes: 4,
    date: '2026-08-10',
    dateLabel: '10 de agosto de 2026',
    featureSlug: 'resenas',
    sections: [
      {
        heading: 'En Bipsy, cada reseña es de alguien que ha venido',
        paragraphs: [
          'Solo puede opinar un cliente con una cita confirmada y ya terminada, y una sola vez por negocio. Eso hace que tus reseñas valgan más: quien las lee sabe que son reales.',
        ],
      },
      {
        heading: 'Pedirlas sin agobiar',
        paragraphs: [],
        bullets: [
          'Pídelas en el mejor momento: al terminar, cuando el cliente está contento con el resultado.',
          'Recuérdale que puede hacerlo desde Mis citas en la app de Bipsy.',
          'No ofrezcas nada a cambio: una reseña comprada se nota y resta confianza.',
        ],
      },
      {
        heading: 'Responder, también a las malas',
        paragraphs: [
          'Tus respuestas son públicas y las lee quien está decidiendo si reservar contigo. Da las gracias a las buenas con algo concreto y, en las malas, reconoce lo que haya que reconocer, explica sin discutir y ofrece hablarlo en privado por el chat.',
        ],
      },
    ],
  },
  {
    slug: 'ficha-que-convierte',
    title: '7 detalles de tu ficha que hacen que te reserven a ti',
    excerpt: 'Foto, servicios con precio, portfolio, normas… Lo que mira un cliente antes de elegir entre dos negocios.',
    category: 'Escaparate',
    icon: 'storefront',
    readMinutes: 5,
    date: '2026-08-03',
    dateLabel: '3 de agosto de 2026',
    featureSlug: 'ficha-en-bipsy',
    sections: [
      {
        heading: 'Tu ficha es tu escaparate',
        paragraphs: [
          'En la app de Bipsy, un cliente compara negocios en segundos. Estos son los detalles que marcan la diferencia, y todos están en la lista «Completar mi perfil» de la app.',
        ],
      },
      {
        heading: 'La lista',
        paragraphs: [],
        bullets: [
          'Una foto de perfil reconocible: tu logo o tu local.',
          'Una portada que enseñe el ambiente.',
          'Una descripción corta: qué haces, para quién y qué te diferencia.',
          'Servicios con precio y duración, sin letra pequeña.',
          'Un portfolio con fotos etiquetadas por servicio.',
          'Tus normas publicadas: cita previa, formas de pago, accesibilidad.',
          'Tu horario al día, con los días de cierre.',
        ],
      },
      {
        heading: 'Antes de publicarla, mírala como un cliente',
        paragraphs: [
          'La vista previa de la app enseña tu ficha exactamente como la ve un cliente. Y si quieres destacar todavía más, con Quality añades tu color, portada animada y efectos que llaman la atención en la lista.',
        ],
      },
    ],
  },
];

export function postBySlug(slug: string | null | undefined): BlogPost | undefined {
  return BLOG_POSTS.find((p) => p.slug === slug);
}
