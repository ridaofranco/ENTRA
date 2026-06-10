import LegalPage, { LegalSection } from '@/src/pages/LegalPage';

const sections: LegalSection[] = [
  {
    heading: 'Aceptación de los términos',
    body: [
      'ENTRÁ es una plataforma de venta y gestión de entradas para eventos operada por SOMOS DER. Al acceder o utilizar el sitio, el comprador o el organizador acepta estos Términos y Condiciones en su totalidad.',
      'Si no estás de acuerdo con alguna parte de estos términos, te pedimos que no utilices la plataforma.',
    ],
  },
  {
    heading: 'Qué es ENTRÁ',
    body: [
      'ENTRÁ actúa como intermediaria tecnológica entre los organizadores de eventos y el público que compra o reserva entradas. La organización, realización y contenido de cada evento es responsabilidad exclusiva del organizador correspondiente.',
      'ENTRÁ provee las herramientas para emitir entradas con código QR único, gestionar el acceso y, cuando corresponde, procesar el pago.',
    ],
  },
  {
    heading: 'Compra y reserva de entradas',
    body: [
      'Las entradas pueden adquirirse de forma paga o reservarse sin cargo en eventos gratuitos. Podés comprar como invitado, sin necesidad de crear una cuenta.',
      'Cada entrada incluye un código QR único e intransferible (salvo mediante la transferencia oficial dentro de la plataforma). El QR es el único comprobante válido de acceso al evento.',
      'Es responsabilidad del comprador ingresar correctamente su correo electrónico y datos. ENTRÁ no se responsabiliza por entradas no recibidas a causa de datos mal ingresados.',
    ],
  },
  {
    heading: 'Precios, cargos y medios de pago',
    body: [
      'El precio final de cada entrada se muestra de forma clara antes de confirmar la compra, sin cargos ocultos. Cuando corresponda un cargo de servicio, este se exhibe a la vista del comprador.',
      'Los pagos se procesan a través de los medios habilitados (por ejemplo, Mercado Pago). ENTRÁ no almacena datos de tarjetas; el procesamiento del pago lo realiza el proveedor correspondiente bajo sus propias condiciones.',
    ],
  },
  {
    heading: 'Cambios, devoluciones y cancelaciones',
    body: [
      'Las políticas de devolución pueden variar según el evento y el organizador. En caso de cancelación o reprogramación de un evento, el organizador es el responsable de definir y comunicar la política de reintegro aplicable.',
      'De acuerdo con la Ley 24.240 de Defensa del Consumidor, te corresponden los derechos allí previstos. Para gestionar un reclamo o devolución, contactanos y te acompañamos en el proceso con el organizador.',
    ],
  },
  {
    heading: 'Transferencia de entradas y reventa',
    body: [
      'La plataforma permite transferir una entrada de forma oficial: al hacerlo, el código anterior se invalida y se genera un QR nuevo para el destinatario. Esto evita la duplicación y el fraude.',
      'Está prohibida la reventa de entradas por fuera de la plataforma, así como la duplicación, falsificación o comercialización no autorizada de los códigos QR.',
    ],
  },
  {
    heading: 'Obligaciones del organizador',
    body: [
      'El organizador garantiza que cuenta con las habilitaciones, permisos y derechos necesarios para realizar el evento, y que la información publicada (fecha, lugar, condiciones) es veraz y está actualizada.',
      'El organizador es responsable frente al público por la efectiva realización del evento y por el cumplimiento de la normativa aplicable.',
    ],
  },
  {
    heading: 'Conducta del usuario',
    body: [
      'El usuario se compromete a utilizar la plataforma de buena fe y a no realizar acciones que afecten su seguridad o funcionamiento, incluyendo intentos de fraude, manipulación de códigos o accesos no autorizados.',
    ],
  },
  {
    heading: 'Propiedad intelectual',
    body: [
      'La marca ENTRÁ, su logotipo, diseño y software son propiedad de SOMOS DER y se encuentran protegidos. No está permitido su uso sin autorización expresa.',
    ],
  },
  {
    heading: 'Limitación de responsabilidad',
    body: [
      'ENTRÁ provee la tecnología para la emisión y gestión de entradas, pero no organiza los eventos. No será responsable por la suspensión, cancelación o cambios en un evento, ni por daños derivados del mismo, sin perjuicio de los derechos que la ley reconoce al consumidor.',
    ],
  },
  {
    heading: 'Modificaciones',
    body: [
      'ENTRÁ puede actualizar estos Términos y Condiciones en cualquier momento. La versión vigente será siempre la publicada en esta página, con su fecha de última actualización.',
    ],
  },
  {
    heading: 'Ley aplicable y jurisdicción',
    body: [
      'Estos términos se rigen por las leyes de la República Argentina. Ante cualquier controversia, las partes se someten a los tribunales ordinarios competentes de la Ciudad Autónoma de Buenos Aires, sin perjuicio de la jurisdicción que pudiera corresponder al consumidor.',
      'Para consultas: contacto@somosder.com.ar',
    ],
  },
];

export default function Terminos() {
  return (
    <LegalPage
      kicker="LEGAL · ENTRÁ"
      title="Términos y"
      highlight="condiciones."
      intro="Las reglas claras de cómo funciona ENTRÁ, tanto para quienes compran entradas como para quienes organizan eventos."
      updated="Junio 2026"
      sections={sections}
    />
  );
}
