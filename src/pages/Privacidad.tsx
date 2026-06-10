import LegalPage, { LegalSection } from '@/src/pages/LegalPage';

const sections: LegalSection[] = [
  {
    heading: 'Responsable de los datos',
    body: [
      'El responsable del tratamiento de los datos personales recolectados a través de ENTRÁ es SOMOS DER. Esta política explica qué datos recopilamos, con qué fin y cuáles son tus derechos.',
    ],
  },
  {
    heading: 'Qué datos recopilamos',
    body: [
      'Datos que nos brindás al comprar o reservar: nombre, correo electrónico, teléfono y, según el evento, DNI. Si te registrás como organizador, también datos de tu cuenta.',
      'Datos de la transacción: entradas adquiridas, evento, fecha y estado del pago. El procesamiento del pago lo realiza el proveedor (por ejemplo, Mercado Pago); no almacenamos datos completos de tarjetas.',
      'Datos técnicos mínimos necesarios para el funcionamiento del sitio.',
    ],
  },
  {
    heading: 'Para qué los usamos',
    body: [
      'Para emitir y enviarte tus entradas con su código QR, gestionar el acceso al evento, brindarte soporte y cumplir con obligaciones legales.',
      'Para comunicarte información relevante sobre tu compra o el evento. No vendemos tus datos a terceros.',
    ],
  },
  {
    heading: 'Con quién los compartimos',
    body: [
      'Con el organizador del evento al que asistís, a fin de gestionar el acceso y el control de asistentes.',
      'Con proveedores que nos permiten operar (procesador de pagos y servicio de envío de correos), únicamente en la medida necesaria para prestar el servicio.',
      'Con autoridades, cuando exista una obligación legal de hacerlo.',
    ],
  },
  {
    heading: 'Base legal y marco normativo',
    body: [
      'El tratamiento de tus datos se realiza conforme a la Ley 25.326 de Protección de los Datos Personales de la República Argentina y su normativa complementaria.',
    ],
  },
  {
    heading: 'Tus derechos',
    body: [
      'Podés solicitar el acceso, la rectificación, la actualización o la supresión de tus datos personales escribiéndonos a contacto@somosder.com.ar.',
      'La Agencia de Acceso a la Información Pública (AAIP), órgano de control de la Ley 25.326, tiene la atribución de atender denuncias y reclamos relacionados con el incumplimiento de las normas sobre protección de datos personales.',
    ],
  },
  {
    heading: 'Conservación',
    body: [
      'Conservamos tus datos durante el tiempo necesario para cumplir con las finalidades descritas y con las obligaciones legales y contables aplicables.',
    ],
  },
  {
    heading: 'Seguridad',
    body: [
      'Aplicamos medidas técnicas y organizativas razonables para proteger tus datos. Las entradas utilizan códigos QR únicos y la transferencia oficial invalida el código anterior para prevenir fraudes.',
    ],
  },
  {
    heading: 'Cookies',
    body: [
      'Utilizamos únicamente el almacenamiento necesario para el funcionamiento del sitio (por ejemplo, mantener tu sesión). No usamos cookies con fines publicitarios de terceros.',
    ],
  },
  {
    heading: 'Cambios en esta política',
    body: [
      'Podemos actualizar esta Política de Privacidad. La versión vigente será siempre la publicada en esta página, con su fecha de última actualización.',
      'Para cualquier consulta sobre tus datos: contacto@somosder.com.ar',
    ],
  },
];

export default function Privacidad() {
  return (
    <LegalPage
      kicker="LEGAL · ENTRÁ"
      title="Política de"
      highlight="privacidad."
      intro="Cómo cuidamos tus datos personales: qué recopilamos, para qué, con quién lo compartimos y qué derechos tenés."
      updated="Junio 2026"
      sections={sections}
    />
  );
}
