import { LegalDocument, LEGAL_COMPANY } from './legal.models';
import { TRIAL_DAYS } from '../site.data';

/**
 * The two documents that only concern businesses.
 *
 * ⚠️ BOTH ARE DRAFTS (`version` contains "borrador", which makes the legal page
 * show the draft notice). They describe what the code does today —store
 * billing, one trial per business, nothing deleted when the plan ends, the
 * processors already named in the privacy policy—, but a lawyer has to review
 * them before they are published, and the trial length must match the backend
 * and the store offers first (docs/LEGAL-PENDIENTE.md §4).
 *
 * The rest of the documents are a copy of bipsy-web-app's `legal.content.ts`:
 * the provider and the service are the same, so the texts must not diverge.
 */

const SUBSCRIPTION: LegalDocument = {
  slug: 'condiciones-suscripcion',
  title: 'Condiciones de suscripción',
  subtitle: 'Los planes de pago de Bipsy Business: prueba, renovación, cambios y baja',
  version: '0.1 · borrador',
  updatedAt: '13 de septiembre de 2026',
  sections: [
    {
      id: 'ambito',
      title: '1. A quién se aplican',
      paragraphs: [
        `Estas condiciones regulan la suscripción a los planes de pago de Bipsy Business que presta ${LEGAL_COMPANY.legalName} (${LEGAL_COMPANY.name}), NIF ${LEGAL_COMPANY.taxId}. Se dirigen a quien da de alta un negocio en Bipsy y contrata un plan para gestionarlo, que actúa como profesional y no como consumidor.`,
        'Completan los Términos y condiciones generales de Bipsy, que siguen siendo aplicables. Si algo de lo que se dice aquí contradice a los Términos, en lo relativo a la suscripción mandan estas condiciones.',
      ],
    },
    {
      id: 'planes',
      title: '2. Planes y precios',
      paragraphs: [
        'Hoy se ofrecen dos planes de pago mensual:',
      ],
      bullets: [
        'Bipsy Business, 18,99 € al mes: agenda y reservas, servicios, equipo, clientes, mensajes, reseñas, fichaje, finanzas, lista de espera y un portfolio de hasta 10 fotos.',
        'Quality, 27,99 € al mes: todo lo anterior y además personalización de la ficha, portada y foto animadas, efectos exclusivos, portfolio sin límite, solicitudes directas a Bipsy y prioridad dentro de su franja de distancia en la fila de Destacados.',
      ],
      closingParagraphs: [
        'El precio es por negocio. Los trabajadores que el negocio añade con su código de invitación usan la aplicación sin coste adicional.',
        'El importe final, con los impuestos que correspondan a tu país, es el que muestra Google Play o App Store antes de confirmar la compra, y es el que se cobra.',
      ],
    },
    {
      id: 'prueba',
      title: '3. Periodo de prueba',
      paragraphs: [
        `Cada negocio puede disfrutar de un único periodo de prueba gratuito de ${TRIAL_DAYS} días, sea cual sea el plan con el que empiece. Durante la prueba tienes acceso a todas las funciones del plan elegido.`,
        'La tienda puede pedirte un método de pago al empezar la prueba. Si no cancelas antes de que termine, la suscripción pasa a ser de pago y se cobra el primer mes.',
      ],
    },
    {
      id: 'pago',
      title: '4. Pago y renovación automática',
      paragraphs: [
        'La suscripción se contrata y se paga a través de Google Play (Android) o App Store (iPhone), con la cuenta de la tienda del dispositivo. La tienda procesa el pago y aplica sus propias condiciones. Bipsy no recibe ni guarda los datos de la tarjeta con la que pagas la suscripción.',
        'La suscripción se renueva automáticamente cada mes por el mismo precio, salvo que la canceles antes del final del periodo en curso. Cada tienda fija el plazo mínimo para que la cancelación evite la siguiente renovación; en App Store es de al menos 24 horas antes.',
      ],
    },
    {
      id: 'cambios-plan',
      title: '5. Cambiar de plan',
      paragraphs: [
        'Puedes cambiar de Bipsy Business a Quality, o al revés, desde la sección Mi plan de la aplicación. El cambio se tramita en la tienda, que es quien calcula y muestra la diferencia de precio que corresponda antes de confirmarlo.',
      ],
    },
    {
      id: 'cancelacion',
      title: '6. Cancelación y reembolsos',
      paragraphs: [
        'Ninguna tienda permite que el vendedor cancele una suscripción en nombre del cliente. Para darte de baja, entra en las suscripciones de tu cuenta de Google Play o App Store; la aplicación te lleva hasta allí desde Mi plan.',
        'Al cancelar mantienes el acceso hasta el final del periodo ya pagado. No hay permanencia ni penalización por cancelar.',
        'Los reembolsos de cobros realizados por la tienda se rigen por la política de la tienda correspondiente y se solicitan a ella. Si crees que se te ha cobrado por error, escríbenos a ' +
          `${LEGAL_COMPANY.email} y te ayudaremos a tramitarlo.`,
      ],
    },
    {
      id: 'fin',
      title: '7. Qué pasa cuando termina la suscripción',
      paragraphs: [
        'Si la suscripción termina y no contratas otro plan, la aplicación del negocio queda bloqueada hasta que elijas uno. Mientras tanto no podrás gestionar la agenda y tus trabajadores verán que el negocio no tiene suscripción activa.',
        'Terminar la suscripción no borra tus datos. Si pierdes el plan Quality, la personalización de tu ficha se conserva y deja de mostrarse a los clientes hasta que vuelvas a contratarlo.',
        'Si quieres que se eliminen los datos de tu negocio, puedes pedir la baja de la cuenta en los términos de la Política de privacidad.',
      ],
    },
    {
      id: 'cambios-precio',
      title: '8. Cambios en los planes y en los precios',
      paragraphs: [
        'Podemos modificar los precios o el contenido de los planes. Te avisaremos con al menos treinta días de antelación antes de que un cambio de precio te afecte, y la tienda te pedirá tu conformidad cuando sus normas lo exijan. Si no estás de acuerdo, puedes cancelar antes de la siguiente renovación.',
        'Las funciones pueden mejorar o cambiar con las actualizaciones de la aplicación. No retiraremos de un plan una función esencial durante un periodo ya pagado.',
      ],
    },
    {
      id: 'ley',
      title: '9. Ley aplicable',
      paragraphs: [
        'Estas condiciones se rigen por la ley española. Para cualquier controversia, las partes se someten a los juzgados y tribunales que correspondan conforme a la normativa aplicable.',
      ],
    },
  ],
};

const PROCESSING: LegalDocument = {
  slug: 'encargo-tratamiento',
  title: 'Encargo del tratamiento',
  subtitle: 'Cómo tratamos los datos de tus clientes y de tu equipo cuando los gestionas en Bipsy Business',
  version: '0.1 · borrador',
  updatedAt: '13 de septiembre de 2026',
  sections: [
    {
      id: 'partes',
      title: '1. Partes y objeto',
      paragraphs: [
        'Cuando un negocio usa Bipsy Business para gestionar su agenda de clientes, su equipo y sus cuentas, el negocio decide para qué y cómo se usan esos datos: es el responsable del tratamiento. ' +
          `${LEGAL_COMPANY.legalName} (${LEGAL_COMPANY.name}) los trata por cuenta del negocio para prestarle el servicio y actúa como encargado del tratamiento, conforme al artículo 28 del Reglamento General de Protección de Datos.`,
        'Este acuerdo forma parte de las condiciones que el negocio acepta al darse de alta. No se aplica a los datos de la cuenta que cada cliente tiene en la app de Bipsy: de esos Bipsy es responsable por su cuenta, como explica la Política de privacidad.',
      ],
    },
    {
      id: 'datos',
      title: '2. Qué datos y de quién',
      paragraphs: ['El encargo cubre los datos que el negocio introduce o genera en Bipsy Business:'],
      bullets: [
        'De sus clientes: nombre, teléfono, correo, historial de citas, cobros registrados y las notas privadas que el negocio escriba.',
        'De su equipo: nombre, correo, horarios, ausencias con su motivo y registros de fichaje.',
        'Los contactos que el negocio importa desde su teléfono. Solo salen del dispositivo los que el negocio marca para importar.',
      ],
      closingParagraphs: [
        'Las notas privadas pueden contener datos de salud, como una alergia. Si el negocio los anota, es responsable de contar con una base legal para ello y de limitarlos a lo imprescindible para prestar su servicio.',
      ],
    },
    {
      id: 'obligaciones-bipsy',
      title: '3. Qué nos comprometemos a hacer',
      paragraphs: [],
      bullets: [
        'Tratar los datos solo para prestar el servicio y siguiendo las instrucciones del negocio, que son las que da al usar la aplicación.',
        'Mantener la confidencialidad y que quien acceda a ellos esté obligado a guardarla.',
        'Aplicar las medidas de seguridad descritas en la página de Seguridad.',
        'Ayudar al negocio a atender las solicitudes de acceso, rectificación, supresión y demás derechos de sus clientes y trabajadores.',
        'Avisar al negocio sin dilación indebida si sufrimos una brecha de seguridad que afecte a sus datos, con la información necesaria para que pueda cumplir sus propias obligaciones.',
        'Poner a disposición del negocio la información necesaria para demostrar el cumplimiento de este acuerdo.',
      ],
    },
    {
      id: 'subencargados',
      title: '4. Subencargados',
      paragraphs: [
        'Para prestar el servicio nos apoyamos en los proveedores que se nombran uno a uno en la Política de privacidad: alojamiento del servidor y la base de datos, almacenamiento de imágenes, envío de correo, notificaciones, mapas y procesamiento de pagos.',
        'El negocio autoriza de forma general su uso. Si añadimos o sustituimos un proveedor que trate estos datos, lo anunciaremos actualizando la Política de privacidad con antelación, y el negocio podrá oponerse dándose de baja.',
        'Cuando un proveedor trata datos fuera del Espacio Económico Europeo, la transferencia se ampara en las garantías que explica la Política de privacidad.',
      ],
    },
    {
      id: 'obligaciones-negocio',
      title: '5. Qué corresponde al negocio',
      paragraphs: [],
      bullets: [
        'Tener una base legal para tratar los datos de sus clientes y trabajadores e informarles de ello.',
        'Importar e invitar solo a personas con las que tenga una relación que lo justifique.',
        'Usar las funciones de mensajes, invitación y veto de acuerdo con la ley y con los Términos y condiciones.',
        'Mantener seguras sus credenciales y las de su equipo, y retirar el acceso a quien deje de trabajar en el negocio.',
      ],
    },
    {
      id: 'fin-encargo',
      title: '6. Duración y fin del encargo',
      paragraphs: [
        'El encargo dura mientras el negocio tenga su cuenta en Bipsy. Antes de darse de baja, el negocio puede exportar sus registros de Finanzas a una hoja de cálculo.',
        'Cuando se da de baja la cuenta, suprimiremos los datos tratados por cuenta del negocio, salvo los que una ley nos obligue a conservar, que quedarán bloqueados durante el plazo que esta fije.',
      ],
    },
  ],
};

export const BUSINESS_LEGAL_DOCUMENTS: Record<string, LegalDocument> = {
  'condiciones-suscripcion': SUBSCRIPTION,
  'encargo-tratamiento': PROCESSING,
};
