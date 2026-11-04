import { LegalDocument, LEGAL_COMPANY } from './legal.models';
import { TRIAL_MONTHS, WELCOME_DAYS } from '../site.data';
import { BUSINESS_PHOTOS, PLANS, QUALITY_PHOTOS } from '../plans.data';

const priceOf = (code: 'BIPSY' | 'QUALITY') => PLANS.find((plan) => plan.code === code)?.price ?? '';

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
  version: '0.2 · borrador',
  updatedAt: '4 de noviembre de 2026',
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
        `Bipsy Business, ${priceOf('BIPSY')} € al mes: agenda y reservas, servicios, equipo, clientes, mensajes, reseñas, fichaje, finanzas, lista de espera y un portfolio de hasta ${BUSINESS_PHOTOS} fotos.`,
        `Quality, ${priceOf('QUALITY')} € al mes: todo lo anterior y además portada animada, prioridad dentro de su franja de distancia en la fila de Destacados y un portfolio de hasta ${QUALITY_PHOTOS} fotos.`,
      ],
      closingParagraphs: [
        'El precio es por negocio. Los trabajadores que el negocio añade con su código de invitación usan la aplicación sin coste adicional.',
        'El importe final, con los impuestos que correspondan a tu país, es el que se muestra antes de confirmar la contratación —en el panel web si pagas con Stripe, o en Google Play o App Store si contratas desde el móvil— y es el que se cobra.',
      ],
    },
    {
      id: 'prueba',
      title: '3. Días de prueba y primer mes gratis',
      paragraphs: [
        `Al terminar el alta, cada negocio tiene ${WELCOME_DAYS} días de prueba para elegir plan, sin necesidad de dar ningún método de pago. Pasados esos días, la aplicación del negocio queda bloqueada hasta que elija uno.`,
        `El primer plan que contrata cada negocio incluye ${TRIAL_MONTHS === 1 ? 'el primer mes' : `los primeros ${TRIAL_MONTHS} meses`} gratis, contado como mes natural desde el día de la contratación. Al contratarlo se pide un método de pago, pero no se cobra nada hasta que termina ese periodo; si no cancelas antes, se cobra el primer mes y después cada mes por adelantado. No hay periodo gratuito si el negocio ya tuvo antes un plan de pago o un plan regalado por Bipsy.`,
        'Bipsy puede ofrecer, por tiempo limitado, un precio rebajado durante los primeros meses de pago del primer plan. Cuando la hay, la oferta se muestra antes de contratar, con su duración y el precio que se cobra después, y solo se aplica a lo que se contrata desde el panel web.',
        'Si Bipsy te regala un plan, al terminar el regalo no hay mes gratis. Durante el regalo puedes dejar guardado un método de pago desde el panel web para seguir con ese plan sin cortes: no se cobra nada hasta el día en que termina el regalo.',
      ],
    },
    {
      id: 'pago',
      title: '4. Pago y renovación automática',
      paragraphs: [
        'La suscripción se puede contratar y pagar de dos maneras: desde el panel web de Bipsy Business, con tarjeta, adeudo en cuenta bancaria (SEPA), Apple Pay o Google Pay, en cuyo caso el pago lo procesa Stripe Payments Europe, Ltd.; o desde la aplicación móvil, a través de Google Play (Android) o App Store (iPhone) con la cuenta de la tienda del dispositivo, en cuyo caso la tienda procesa el pago y aplica sus propias condiciones. En ninguno de los dos casos Bipsy recibe ni guarda los datos completos de la tarjeta o de la cuenta con la que pagas la suscripción.',
        'La suscripción se renueva automáticamente cada mes por el precio del plan (o el de la oferta, mientras dure), salvo que la canceles antes del final del periodo en curso. Si pagas desde el panel web, basta con cancelarla antes de esa fecha; si la contrataste en una tienda, cada tienda fija el plazo mínimo para que la cancelación evite la siguiente renovación (en App Store es de al menos 24 horas antes).',
      ],
    },
    {
      id: 'cambios-plan',
      title: '5. Cambiar de plan',
      paragraphs: [
        'Puedes cambiar de Bipsy Business a Quality, o al revés, desde la sección Mi plan. Si pagas desde el panel web, el cambio se hace en el panel web y la diferencia se prorratea por los días que queden del periodo en curso; si contrataste en el móvil, el cambio se tramita en la tienda, que es quien calcula y muestra la diferencia de precio antes de confirmarlo.',
      ],
    },
    {
      id: 'cancelacion',
      title: '6. Cancelación y reembolsos',
      paragraphs: [
        'Si pagas desde el panel web, puedes darte de baja en cualquier momento desde Mi plan en el panel web. Si contrataste en el móvil, ten en cuenta que ninguna tienda permite que el vendedor cancele una suscripción en nombre del cliente: entra en las suscripciones de tu cuenta de Google Play o App Store; la aplicación te lleva hasta allí desde Mi plan.',
        'Al cancelar mantienes el acceso hasta el final del periodo ya pagado. No hay permanencia ni penalización por cancelar.',
        'Los reembolsos de cobros realizados por una tienda se rigen por la política de esa tienda y se solicitan a ella; los de cobros desde el panel web se solicitan a Bipsy. Si crees que se te ha cobrado por error, escríbenos a ' +
          `${LEGAL_COMPANY.email} y te ayudaremos a tramitarlo.`,
      ],
    },
    {
      id: 'fin',
      title: '7. Qué pasa cuando termina la suscripción',
      paragraphs: [
        'Si la suscripción termina y no contratas otro plan, la aplicación del negocio queda bloqueada hasta que elijas uno. Mientras tanto no podrás gestionar la agenda y tus trabajadores verán que el negocio no tiene suscripción activa.',
        `Terminar la suscripción no borra tus datos. Si pasas de Quality a Bipsy Business, las fotos de tu portfolio que superen las ${BUSINESS_PHOTOS} del plan se conservan sin mostrarse a los clientes, y vuelven a verse si contratas Quality de nuevo.`,
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
