import { LegalDocument, LEGAL_COMPANY } from './legal.models';
import { TRIAL_MONTHS, WELCOME_DAYS } from '../site.data';
import { BUSINESS_PHOTOS, PLANS, QUALITY_PHOTOS } from '../plans.data';

const priceOf = (code: 'BIPSY' | 'QUALITY') => PLANS.find((plan) => plan.code === code)?.price ?? '';

/**
 * The two documents that only concern businesses: the subscription terms and
 * the data processing agreement (art. 28 GDPR).
 *
 * Final versions since 7/11/2026 (1.0). Reviewed against what the code does:
 * `Business.WELCOME_TRIAL_DAYS`, `plan.trial_months`, `Subscription.PAST_DUE_GRACE_DAYS`,
 * the two billing paths (Stripe from the web panel, App Store / Google Play from
 * the phone) and the two-step business deletion (`BusinessAccountDeletionService`).
 * If any of those changes, the text changes in the same commit or it becomes false.
 *
 * Both are accepted at sign-up together with the Terms (`TERMS_VERSION`).
 */

/** Days the backend keeps access after a failed renewal (`Subscription.PAST_DUE_GRACE_DAYS`). */
const PAST_DUE_GRACE_DAYS = 3;
/** Days a business has to change its mind after asking to delete its account (`BusinessAccountDeletionService.GRACE`). */
const DELETION_GRACE_DAYS = 14;

const SUBSCRIPTION: LegalDocument = {
  slug: 'condiciones-suscripcion',
  title: 'Condiciones de suscripción',
  subtitle: 'Los planes de pago de Bipsy Business: prueba, renovación, cambios y baja',
  version: '1.0',
  updatedAt: '7 de noviembre de 2026',
  sections: [
    {
      id: 'ambito',
      title: '1. A quién se aplican',
      paragraphs: [
        `Estas condiciones regulan la suscripción a los planes de pago de Bipsy Business que presta ${LEGAL_COMPANY.legalName} (${LEGAL_COMPANY.name}), NIF ${LEGAL_COMPANY.taxId}, con domicilio en ${LEGAL_COMPANY.address}. Se dirigen a quien da de alta un negocio en Bipsy y contrata un plan para gestionarlo, que actúa como empresario o profesional y no como consumidor.`,
        'Completan los Términos y condiciones generales de Bipsy y el Encargo del tratamiento, que se aceptan a la vez al darse de alta. Si algo de lo que se dice aquí contradice a los Términos, en lo relativo a la suscripción mandan estas condiciones.',
        'Puedes consultar, descargar e imprimir estas condiciones en cualquier momento en esta página. El contrato se celebra en español.',
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
        `Quality, ${priceOf('QUALITY')} € al mes: todo lo anterior y además portada animada, prioridad dentro de su franja de distancia en los resultados y en la fila de Destacados, y un portfolio de hasta ${QUALITY_PHOTOS} fotos. Cómo afecta esa prioridad al orden de los resultados se explica en el apartado 5 de los Términos y condiciones.`,
      ],
      closingParagraphs: [
        'El precio es por negocio. Los trabajadores que el negocio añade con su código de invitación usan la aplicación sin coste adicional.',
        'Antes de confirmar la contratación se muestra el importe final con los impuestos aplicables —en el panel web si pagas con Stripe, o en Google Play o App Store si contratas desde el móvil—, y es el que se cobra.',
        'Bipsy no cobra comisiones por las reservas ni por los cobros que el negocio hace a sus clientes. De cada uno de esos cobros solo se retiene la comisión que Stripe factura por procesarlo, como se explica en los Términos y condiciones.',
      ],
    },
    {
      id: 'prueba',
      title: '3. Días de prueba y primer mes gratis',
      paragraphs: [
        `Al terminar el alta, cada negocio tiene ${WELCOME_DAYS} días para probar Bipsy Business y elegir plan, sin dar ningún método de pago. Pasados esos días, la aplicación del negocio queda bloqueada hasta que elija uno; sus datos se conservan.`,
        `El primer plan que contrata cada negocio incluye ${TRIAL_MONTHS === 1 ? 'el primer mes' : `los primeros ${TRIAL_MONTHS} meses`} gratis, contado como mes natural desde el día de la contratación. Al contratarlo se pide un método de pago, pero no se cobra nada hasta que termina ese periodo. Si no cancelas antes de que termine, se cobra el primer mes y después cada mes por adelantado. Antes de contratar se te muestra la fecha del primer cobro.`,
        'El periodo gratuito se concede una sola vez por negocio: no lo hay si el negocio ya tuvo antes un plan de pago o un plan regalado por Bipsy.',
        'Bipsy puede ofrecer, por tiempo limitado, un precio rebajado durante los primeros meses de pago del primer plan. Cuando la hay, la oferta se muestra antes de contratar, con su duración y el precio que se cobra después, y solo se aplica a lo que se contrata desde el panel web.',
        'Si Bipsy te regala un plan, al terminar el regalo no hay mes gratis. Durante el regalo puedes dejar guardado un método de pago desde el panel web para seguir con ese plan sin cortes: no se cobra nada hasta el día en que termina el regalo.',
      ],
    },
    {
      id: 'pago',
      title: '4. Pago y renovación automática',
      paragraphs: [
        'La suscripción se puede contratar y pagar de dos maneras:',
      ],
      bullets: [
        'Desde el panel web de Bipsy Business, con tarjeta, adeudo en cuenta bancaria (SEPA), Apple Pay o Google Pay. El pago lo procesa Stripe Payments Europe, Ltd.',
        'Desde la aplicación móvil, a través de Google Play (Android) o App Store (iPhone), con la cuenta de la tienda del dispositivo. En ese caso es la tienda quien cobra y aplica sus propias condiciones de compra.',
      ],
      closingParagraphs: [
        'En ninguno de los dos casos Bipsy recibe ni guarda los datos completos de la tarjeta o de la cuenta con la que pagas.',
        'La suscripción es por tiempo indefinido y se renueva automáticamente cada mes por el precio del plan (o el de la oferta, mientras dure), salvo que la canceles antes del final del periodo en curso. Si pagas desde el panel web, basta con cancelarla antes de esa fecha; si la contrataste en una tienda, cada tienda fija el plazo mínimo para que la cancelación evite la siguiente renovación (en App Store, al menos 24 horas antes).',
        `Si un cobro de renovación no se puede hacer, mantienes el acceso durante ${PAST_DUE_GRACE_DAYS} días mientras se reintenta; en ese tiempo puedes actualizar el método de pago desde Mi plan. Si sigue sin poder cobrarse, la suscripción termina con los efectos del apartado 7.`,
        'Las facturas de lo que pagas desde el panel web están disponibles en el portal de pagos al que se llega desde Mi plan. Si necesitas que consten unos datos fiscales concretos, escríbenos antes del cobro. Las compras hechas en una tienda las factura la propia tienda.',
      ],
    },
    {
      id: 'cambios-plan',
      title: '5. Cambiar de plan',
      paragraphs: [
        'Puedes cambiar de Bipsy Business a Quality, o al revés, desde Mi plan. Si pagas desde el panel web, el cambio se hace allí y la diferencia se prorratea por los días que queden del periodo en curso; si contrataste en el móvil, el cambio se tramita en la tienda, que es quien calcula y muestra la diferencia de precio antes de confirmarlo.',
      ],
    },
    {
      id: 'cancelacion',
      title: '6. Cancelación y reembolsos',
      paragraphs: [
        'Puedes cancelar la suscripción en cualquier momento, sin permanencia ni penalización. Si pagas desde el panel web, hazlo desde Mi plan en el panel web. Si contrataste en el móvil, ten en cuenta que ninguna tienda permite que el vendedor cancele una suscripción en nombre del cliente: entra en las suscripciones de tu cuenta de Google Play o App Store; la aplicación te lleva hasta allí desde Mi plan.',
        'Al cancelar mantienes el acceso hasta el final del periodo ya pagado. Los periodos ya iniciados no se reembolsan, salvo error en el cobro o lo que disponga la ley.',
        `Los reembolsos de cobros hechos por una tienda se rigen por la política de esa tienda y se solicitan a ella; los de cobros desde el panel web se solicitan a Bipsy en ${LEGAL_COMPANY.email}. Si crees que se te ha cobrado por error, escríbenos y te ayudaremos a tramitarlo.`,
        'Como el plan se contrata para una actividad profesional, no se aplica el derecho de desistimiento de los consumidores. Aun así, durante el periodo gratuito puedes cancelar sin que se te cobre nada.',
      ],
    },
    {
      id: 'fin',
      title: '7. Qué pasa cuando termina la suscripción',
      paragraphs: [
        'Si la suscripción termina y no contratas otro plan, la aplicación del negocio queda bloqueada hasta que elijas uno. Mientras tanto no podrás gestionar la agenda y tus trabajadores verán que el negocio no tiene suscripción activa.',
        `Terminar la suscripción no borra tus datos. Si pasas de Quality a Bipsy Business, las fotos de tu portfolio que superen las ${BUSINESS_PHOTOS} del plan se conservan sin mostrarse a los clientes, y vuelven a verse si contratas Quality de nuevo.`,
      ],
    },
    {
      id: 'baja',
      title: '8. Si das de baja el negocio',
      paragraphs: [
        `Puedes pedir la baja del negocio desde Bipsy Business. Desde ese momento deja de aparecer en Bipsy y de aceptar reservas, y se cancelan sus citas futuras con la devolución íntegra a los clientes. Tienes ${DELETION_GRACE_DAYS} días para arrepentirte volviendo a entrar; pasado ese plazo, la cuenta se elimina en los términos de la Política de privacidad y del Encargo del tratamiento.`,
        'Pedir la baja no cancela por sí sola una suscripción contratada en una tienda: cancélala también en Google Play o App Store, como se explica en el apartado 6. Si pagas desde el panel web, al pedir la baja dejamos de renovarla.',
      ],
    },
    {
      id: 'cambios-precio',
      title: '9. Cambios en los planes y en los precios',
      paragraphs: [
        'Podemos modificar los precios o el contenido de los planes. Te avisaremos con al menos treinta días de antelación antes de que un cambio de precio te afecte, y la tienda te pedirá tu conformidad cuando sus normas lo exijan. Si no estás de acuerdo, puedes cancelar antes de la siguiente renovación sin coste.',
        'Las funciones pueden mejorar o cambiar con las actualizaciones de la aplicación. No retiraremos de un plan una función esencial durante un periodo ya pagado.',
      ],
    },
    {
      id: 'responsabilidad',
      title: '10. Disponibilidad y responsabilidad',
      paragraphs: [
        'Trabajamos para que Bipsy Business esté disponible de forma continua, pero puede haber interrupciones por mantenimiento o por fallos de los proveedores, y no garantizamos que funcione sin interrupciones ni errores.',
        'Salvo dolo o culpa grave, la responsabilidad de Bipsy frente al negocio por el servicio de suscripción se limita a las cuotas pagadas en los doce meses anteriores al hecho que la origine, y no alcanza al lucro cesante ni a los daños indirectos.',
      ],
    },
    {
      id: 'reclamaciones',
      title: '11. Reclamaciones',
      paragraphs: [
        `Para cualquier reclamación sobre tu suscripción escríbenos a ${LEGAL_COMPANY.email} con el asunto «Reclamación». Es gratuito y te responderemos por escrito y de forma motivada, como se explica en el apartado 10 de los Términos y condiciones.`,
      ],
    },
    {
      id: 'ley',
      title: '12. Ley aplicable y jurisdicción',
      paragraphs: [
        'Estas condiciones se rigen por la ley española. Como se contratan en el ejercicio de una actividad profesional, para cualquier controversia serán competentes los juzgados y tribunales del domicilio del titular, salvo que una norma imperativa disponga otra cosa.',
      ],
    },
  ],
};

const PROCESSING: LegalDocument = {
  slug: 'encargo-tratamiento',
  title: 'Encargo del tratamiento',
  subtitle: 'Cómo tratamos los datos de tus clientes y de tu equipo cuando los gestionas en Bipsy Business',
  version: '1.0',
  updatedAt: '7 de noviembre de 2026',
  sections: [
    {
      id: 'partes',
      title: '1. Partes y objeto',
      paragraphs: [
        'Cuando un negocio usa Bipsy Business para gestionar su agenda de clientes, su equipo y sus cuentas, el negocio decide para qué y cómo se usan esos datos: es el responsable del tratamiento. ' +
          `${LEGAL_COMPANY.legalName} (${LEGAL_COMPANY.name}), NIF ${LEGAL_COMPANY.taxId}, los trata por cuenta del negocio para prestarle el servicio y actúa como encargado del tratamiento, conforme al artículo 28 del Reglamento (UE) 2016/679 (RGPD) y al artículo 33 de la Ley Orgánica 3/2018 (LOPDGDD).`,
        'Este acuerdo forma parte del contrato que el negocio acepta al darse de alta, junto con los Términos y condiciones y las Condiciones de suscripción, y vincula a ambas partes desde ese momento. No se aplica a los datos de la cuenta que cada cliente tiene en la app Bipsy ni a los de las cuentas de Bipsy Business: de esos Bipsy es responsable por su cuenta, como explica la Política de privacidad.',
      ],
    },
    {
      id: 'tratamiento',
      title: '2. Naturaleza, finalidad y duración',
      paragraphs: [
        'Naturaleza: alojamiento, registro, organización, consulta, comunicación a los propios interesados (avisos de cita, mensajes del chat) y supresión de los datos, con medios automatizados.',
        'Finalidad: única y exclusivamente prestar al negocio el servicio de Bipsy Business —agenda y reservas, gestión de clientes y equipo, mensajes, fichaje, finanzas y cobros— tal y como está descrito en la aplicación.',
        'Duración: la del contrato, es decir, mientras el negocio tenga su cuenta en Bipsy, más el tiempo necesario para su fin conforme al apartado 8.',
      ],
    },
    {
      id: 'datos',
      title: '3. Qué datos y de quién',
      paragraphs: ['El encargo cubre los datos que el negocio introduce o genera en Bipsy Business sobre estas personas:'],
      bullets: [
        'Sus clientes: nombre, teléfono, correo, historial de citas, cobros registrados, valoraciones recibidas, mensajes y las notas privadas que el negocio escriba.',
        'Su equipo: nombre, correo, foto, horarios, ausencias con su motivo y registros de fichaje (jornada).',
        'Los contactos que el negocio importa desde su teléfono. Solo salen del dispositivo los que el negocio marca para importar.',
      ],
      closingParagraphs: [
        'Bipsy Business no está pensada para tratar categorías especiales de datos. Si el negocio anota en sus notas privadas datos de salud, como una alergia, es responsable de contar con una base legal para ello y de limitarlos a lo imprescindible para prestar su servicio.',
      ],
    },
    {
      id: 'obligaciones-bipsy',
      title: '4. Qué nos comprometemos a hacer',
      paragraphs: [],
      bullets: [
        'Tratar los datos solo para la finalidad del apartado 2 y siguiendo las instrucciones documentadas del negocio, que son las que da al configurar y usar la aplicación y las que nos haga llegar por escrito. Si una instrucción nos pareciera contraria a la normativa de protección de datos, se lo diremos inmediatamente.',
        'No usar los datos para fines propios, no cederlos a terceros salvo a los subencargados del apartado 5 o por obligación legal, y no transferirlos fuera del Espacio Económico Europeo salvo en los términos del apartado 6.',
        'Garantizar que quien acceda a los datos esté obligado a guardar confidencialidad, también después de terminar su relación con Bipsy.',
        'Aplicar las medidas de seguridad apropiadas al riesgo (artículo 32 RGPD) descritas en la página de Seguridad: contraseñas cifradas en un solo sentido, comunicaciones cifradas, almacenamiento privado para los archivos adjuntos, sesiones que caducan y acceso restringido a los datos de producción.',
        'Ayudar al negocio, en la medida de lo posible, a atender las solicitudes de acceso, rectificación, supresión, oposición, limitación y portabilidad de sus clientes y trabajadores. Si una de esas personas se dirige a nosotros, se lo trasladaremos al negocio sin demora.',
        'Notificar al negocio, sin dilación indebida y en todo caso en un máximo de 48 horas desde que tengamos constancia, cualquier violación de seguridad que afecte a sus datos, con la información necesaria para que pueda cumplir sus propias obligaciones de notificación.',
        'Ayudar al negocio, con la información de que dispongamos, cuando deba hacer una evaluación de impacto o una consulta previa a la autoridad de control.',
        'Llevar el registro de actividades de tratamiento que hacemos por cuenta de los negocios.',
        'Poner a disposición del negocio la información necesaria para demostrar el cumplimiento de este acuerdo y permitir las auditorías que razonablemente solicite, con un preaviso de treinta días, en horario laborable y sin acceso a datos de otros negocios. El coste de la auditoría corre a cargo de quien la solicite.',
      ],
    },
    {
      id: 'subencargados',
      title: '5. Subencargados',
      paragraphs: [
        'El negocio nos autoriza de forma general a apoyarnos en estos proveedores, con los que tenemos firmados contratos que les imponen las mismas obligaciones de protección de datos que este acuerdo:',
      ],
      bullets: [
        'IONOS — servidor y base de datos, en la Unión Europea.',
        'Cloudflare (R2) — almacenamiento de imágenes y archivos.',
        'Resend — envío de los correos de aviso a clientes y trabajadores.',
        'Google (Firebase y Google Maps Platform) — notificaciones push y direcciones.',
        'Stripe — procesamiento de los cobros a clientes, cuando el negocio los activa.',
        'Vercel — alojamiento del panel web.',
      ],
      closingParagraphs: [
        'Si añadimos o sustituimos un subencargado, lo anunciaremos actualizando esta lista con al menos quince días de antelación. Si el negocio no está de acuerdo, puede oponerse escribiéndonos y, si no encontramos una alternativa, darse de baja sin penalización.',
        'Los cobros que el negocio hace a sus clientes se procesan en la cuenta de Stripe del propio negocio, que se rige por el acuerdo que el negocio firma directamente con Stripe.',
      ],
    },
    {
      id: 'transferencias',
      title: '6. Transferencias internacionales',
      paragraphs: [
        'El servidor y la base de datos están en la Unión Europea. Algunos subencargados (Cloudflare, Resend, Google, Stripe y Vercel) son estadounidenses y pueden tratar datos fuera del Espacio Económico Europeo. En todos los casos la transferencia se ampara en el Marco de Privacidad de Datos UE-EE. UU. o, en su defecto, en las cláusulas contractuales tipo aprobadas por la Comisión Europea, con las garantías adicionales que correspondan.',
      ],
    },
    {
      id: 'obligaciones-negocio',
      title: '7. Qué corresponde al negocio',
      paragraphs: [],
      bullets: [
        'Tener una base legal para tratar los datos de sus clientes y trabajadores e informarles de ello, incluido que usa Bipsy Business para gestionarlos.',
        'Importar e invitar solo a personas con las que tenga una relación que lo justifique.',
        'Usar las funciones de mensajes, invitación, fichaje y veto de acuerdo con la ley —en particular, la normativa laboral en el registro de jornada— y con los Términos y condiciones.',
        'Mantener seguras sus credenciales y las de su equipo, y retirar el acceso a quien deje de trabajar en el negocio.',
        'Supervisar el tratamiento y darnos las instrucciones que necesite por escrito.',
      ],
    },
    {
      id: 'fin-encargo',
      title: '8. Fin del encargo',
      paragraphs: [
        `Antes de darse de baja, el negocio puede exportar sus registros de Finanzas a una hoja de cálculo y pedirnos en ${LEGAL_COMPANY.privacyEmail} una copia del resto de los datos tratados por su cuenta en un formato estructurado y de uso común. Esa es la forma de devolución de los datos.`,
        `Cuando el negocio pide la baja tiene ${DELETION_GRACE_DAYS} días para anularla. Pasado ese plazo suprimimos o anonimizamos de forma irreversible los datos tratados por su cuenta, salvo los que una ley nos obligue a conservar, que quedarán bloqueados durante el plazo que esta fije y después se suprimirán.`,
      ],
    },
    {
      id: 'responsabilidad-encargo',
      title: '9. Responsabilidad',
      paragraphs: [
        'Cada parte responde del cumplimiento de sus propias obligaciones conforme al artículo 82 del RGPD. Si Bipsy tratara los datos para otra finalidad o incumpliera este acuerdo, sería considerada responsable de ese tratamiento.',
      ],
    },
  ],
};

export const BUSINESS_LEGAL_DOCUMENTS: Record<string, LegalDocument> = {
  'condiciones-suscripcion': SUBSCRIPTION,
  'encargo-tratamiento': PROCESSING,
};
