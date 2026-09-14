import { TRIAL_DAYS, SUPPORT_RESPONSE_TIME } from './site.data';

/**
 * Frequently asked questions. Every answer describes what the app does today.
 *
 * ⚠️ The FAQ inside the business app (info_sheets.dart) is partly out of date
 * —it still says workers are invited by email—, so these answers were written
 * from the code, not copied from there.
 */

export interface FaqItem {
  q: string;
  a: string;
}

export interface FaqGroup {
  id: string;
  label: string;
  icon: string;
  items: FaqItem[];
}

export const HOME_FAQ: FaqItem[] = [
  {
    q: '¿Qué es Bipsy Business?',
    a: 'Es la app para gestionar un negocio que trabaja con cita: agenda, reservas online, clientes, equipo, fichaje y finanzas. Tus clientes reservan desde Bipsy, la app gratuita para ellos, y tú lo recibes todo en Bipsy Business.',
  },
  {
    q: '¿Cuánto cuesta?',
    a: `Bipsy Business cuesta 18,99 € al mes y Quality, 27,99 € al mes. Los primeros ${TRIAL_DAYS} días son gratis y no hay permanencia.`,
  },
  {
    q: '¿Tengo que pagar por cada trabajador?',
    a: 'No. La suscripción es del negocio. Tus trabajadores se descargan Bipsy Business gratis, escriben el código de invitación que les das y entran en tu negocio con su propia agenda.',
  },
  {
    q: '¿Bipsy se queda una comisión de mis reservas?',
    a: 'No. Pagas tu plan y ya está. Si activas los cobros con tarjeta para las tarifas de cancelación, Bipsy tampoco se queda nada: solo se descuenta la tarifa del procesador de pagos.',
  },
  {
    q: '¿Mis clientes tienen que descargarse algo?',
    a: 'Pueden reservar desde la app de Bipsy, que es gratuita en Android e iPhone, o desde la web de Bipsy. Los clientes que ya tienes los puedes importar desde los contactos de tu móvil e invitarles con un mensaje ya escrito.',
  },
  {
    q: '¿Sirve si trabajo solo o a domicilio?',
    a: 'Sí. Al darte de alta eliges si trabajas en un local o a domicilio, y si eres autónomo sin equipo la app se adapta: no verás pantallas de trabajadores que no necesitas.',
  },
];

export const HELP_FAQ: FaqGroup[] = [
  {
    id: 'empezar',
    label: 'Empezar',
    icon: 'rocket_launch',
    items: [
      {
        q: '¿Cómo me doy de alta?',
        a: 'Descarga Bipsy Business y elige «Soy negocio». El alta son cinco pasos: tu cuenta (con correo o con Google), los datos y la categoría del negocio, la verificación del correo, tu ubicación y la configuración de equipo, horario, servicios y cancelaciones.',
      },
      {
        q: '¿Qué pasa cuando termino el alta?',
        a: 'Un tutorial te enseña la app de verdad, pantalla por pantalla, y después una lista te guía para completar tu perfil: foto, portada, portfolio, descripción, servicios, horario, equipo y código de invitación.',
      },
      {
        q: '¿Puedo tener mi negocio en varias categorías?',
        a: 'Sí, hasta cinco: una principal y cuatro adicionales. Así apareces cuando tus clientes buscan cualquiera de ellas.',
      },
      {
        q: '¿Qué es el código de invitación del negocio?',
        a: 'Un código que eliges una vez (de 4 a 20 caracteres) y que tus clientes pueden escribir al registrarse en Bipsy. No confundir con el código para trabajadores, que es de 6 dígitos y caduca.',
      },
    ],
  },
  {
    id: 'agenda',
    label: 'Agenda y reservas',
    icon: 'calendar_month',
    items: [
      {
        q: '¿Tengo que confirmar cada reserva?',
        a: 'Solo si quieres. Puedes aceptar las reservas automáticamente, para todo el negocio o por trabajador. Las que se quedan pendientes se cancelan solas a los 2 días, y ese plazo lo puedes cambiar.',
      },
      {
        q: '¿Puedo limitar con cuánta antelación reservan?',
        a: 'Sí. Tienes antelación mínima (por defecto 60 minutos), días máximos hacia delante (por defecto 60, hasta 365), intervalo entre citas (de 5 a 240 minutos) y un tope de citas activas por cliente.',
      },
      {
        q: '¿Cómo funciona la lista de espera?',
        a: 'Actívala en tus ajustes. Cuando se libera un hueco, Bipsy avisa a quien espera, por orden o a todos a la vez, y cada cliente tiene un plazo de 6 a 72 horas para aceptarlo. También puedes ofrecer un hueco a mano desde la agenda.',
      },
      {
        q: '¿Qué hago si un cliente no se presenta?',
        a: 'En la agenda, abre la cita y pulsa «No se presentó» (hasta 48 horas después). Si tienes política de cancelación con tarjeta, se cobra la tarifa y el cliente recibe el aviso con el importe.',
      },
    ],
  },
  {
    id: 'equipo',
    label: 'Equipo',
    icon: 'groups',
    items: [
      {
        q: '¿Cuánto cuesta añadir a un trabajador?',
        a: 'Nada. Tus trabajadores usan la app gratis dentro de tu suscripción, tengas el plan que tengas.',
      },
      {
        q: '¿Cómo invito a alguien a mi equipo?',
        a: 'Desde Perfil › Equipo › Invitar se genera un código de 6 dígitos que caduca en 12 horas. Tu trabajador se descarga Bipsy Business, elige «Soy trabajador», escribe el código y entra en tu negocio. Puedes atar el código a su correo y revocarlo cuando quieras.',
      },
      {
        q: '¿Qué puede ver un trabajador?',
        a: 'Su agenda, sus citas y, si le das permiso, el chat, la lista de espera y el cobro de sus propias citas. Nunca ve los números del negocio.',
      },
      {
        q: '¿Cómo funcionan las vacaciones?',
        a: 'El trabajador las pide desde la app y tú las apruebas o rechazas. Si la ausencia choca con citas, Bipsy te las enseña para reasignarlas a otra persona o cancelarlas antes de aprobar.',
      },
    ],
  },
  {
    id: 'plan',
    label: 'Planes y pagos',
    icon: 'credit_card',
    items: [
      {
        q: '¿Cómo se paga la suscripción?',
        a: 'A través de Google Play o App Store, con la cuenta de tu móvil. La tienda te enseña el precio final con impuestos antes de confirmar.',
      },
      {
        q: '¿Cómo cancelo?',
        a: 'Desde la sección de suscripciones de Google Play o App Store; en la app, Mi plan te lleva directo. Mantienes el acceso hasta el final del periodo pagado.',
      },
      {
        q: '¿Qué pasa si dejo de pagar?',
        a: 'No se borra nada. La app te pide elegir un plan para seguir usándola, y tus trabajadores ven que el negocio no tiene suscripción activa. Si pierdes Quality, tu personalización se queda guardada y vuelve al contratarlo.',
      },
      {
        q: '¿Bipsy emite facturas a mis clientes?',
        a: 'No. Finanzas es un registro interno de cobros, gastos, caja y comisiones con informe de IVA, pero no emite facturas ni las envía a Hacienda.',
      },
    ],
  },
  {
    id: 'soporte',
    label: 'Soporte',
    icon: 'support_agent',
    items: [
      {
        q: '¿Cómo contacto con soporte?',
        a: `Desde la app, en Perfil › Soporte, abre un ticket con hasta 4 adjuntos. Respondemos en ${SUPPORT_RESPONSE_TIME}. También puedes escribir a soporte@bipsy.es.`,
      },
      {
        q: '¿Puedo pedir una función nueva?',
        a: 'Con el plan Quality tienes «Solicitudes a Bipsy»: pides mejoras y cambios en la app, las leemos una a una y te contestamos.',
      },
    ],
  },
];
