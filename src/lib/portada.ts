// Contenido de la portada para quien organiza: qué es ENTRÁ, cómo se cobra, pasos, tipos de
// evento, ciudades y preguntas frecuentes (16/11/2026).
// Lo usan dos lados, con el MISMO texto:
//  - src/components/PortadaOrganizadores.tsx, que lo muestra en la home y en /productores;
//  - vite.config.ts (plugin htmlPorRuta), que lo escribe como HTML dentro de <div id="root"> en
//    dist/index.html y dist/_rutas/productores.html, para que un buscador o una IA que no corre
//    JavaScript lea lo mismo que ve una persona. React lo reemplaza al arrancar.
// Todo lo que dice acá ya está publicado en /vender-entradas/como-funciona, en
// /vender-entradas/comparar-ticketeras y en public/llms.txt. Si cambia una condición (comisión,
// revisión, qué incluye), se cambia en esos lugares y acá.
// Liquidación (decisión de Franco, 16/11): el plazo depende del medio de cobro; en Argentina es
// Mercado Pago y la plata se libera en los plazos de Mercado Pago según la cuenta del organizador.
// NUNCA poner días ni porcentajes de Mercado Pago. No sumar otros medios de pago mientras no existan.
// Este archivo no puede importar nada: lo carga Node en el build.

export interface Enlace {
  href: string;
  texto: string;
}

export const PORTADA = {
  kicker: 'Para quien organiza',
  titulo: 'Ticketera online para vender entradas de tu evento',
  intro:
    'ENTRÁ es la ticketera de SOMOS DER, productora de eventos de Buenos Aires. Sirve para vender entradas online a fiestas, recitales, obras, festivales y eventos con cupo en todo el país, y para validarlas en la puerta desde el celular con un QR único por entrada.',
  enlaceVender: { href: '/vender-entradas', texto: 'Vender entradas online según tu evento' },

  cobroTitulo: 'Cómo se cobra',
  cobro: [
    'Crear la cuenta y cargar el evento no tiene costo.',
    'Vos ponés el precio de cada entrada y cobrás el 100% de ese precio.',
    'Quien compra paga el cargo de servicio, del 8% + IVA sobre el precio de la entrada, y el procesamiento del pago. Lo ve desglosado en el checkout antes de pagar.',
    'El pago lo procesa Mercado Pago. Conectás tu cuenta desde el panel y cada venta entra directo a tu Mercado Pago.',
    'Cuándo tenés la plata disponible depende del medio de cobro. En Argentina es Mercado Pago, y se libera en los plazos de Mercado Pago según tu cuenta.',
    'En los eventos gratuitos la reserva no tiene ningún cargo.',
  ],

  pasosTitulo: 'Cómo se empieza',
  pasos: [
    'Creás tu cuenta y activás el panel de productor.',
    'Cargás el evento: fecha, lugar, flyer y cada tipo de entrada con su precio y su cupo.',
    'Lo revisamos antes de publicarlo, normalmente el mismo día, y te avisamos por mail.',
    'Compartís el link. Tu público compra sin crearse una cuenta y recibe la entrada por mail con su QR.',
    'El día del evento escaneás cada QR con la cámara del celular. Cada código vale una sola vez.',
  ],
  enlacePasos: { href: '/vender-entradas/como-funciona', texto: 'Cómo vender entradas con ENTRÁ, paso a paso' },

  incluyeTitulo: 'Qué incluye, sin costo extra',
  incluye: [
    'Publicación ilimitada de eventos',
    'Tipos de entrada con precio y cupo, y preventa',
    'Códigos de descuento y cortesías con QR',
    'Panel de ventas en tiempo real',
    'Exportación de la base de compradores',
    'Transferencia oficial de entradas',
    'Control de acceso desde el celular',
    'Soporte por WhatsApp',
  ],

  tiposTitulo: 'Vender entradas según tu evento',
  tipos: [
    { href: '/vender-entradas/fiestas', texto: 'Fiestas' },
    { href: '/vender-entradas/recitales-y-shows', texto: 'Recitales y shows' },
    { href: '/vender-entradas/festivales', texto: 'Festivales' },
    { href: '/vender-entradas/teatro', texto: 'Teatro' },
    { href: '/vender-entradas/stand-up-y-comedia', texto: 'Stand-up y comedia' },
    { href: '/vender-entradas/talleres-y-charlas', texto: 'Talleres y charlas' },
    { href: '/vender-entradas/eventos-infantiles', texto: 'Eventos infantiles' },
    { href: '/vender-entradas/congresos-y-jornadas', texto: 'Congresos y jornadas' },
    { href: '/vender-entradas/penas-milongas-y-baile', texto: 'Peñas, milongas y bailes' },
    { href: '/vender-entradas/ferias-y-gastronomia', texto: 'Ferias y gastronomía' },
    { href: '/vender-entradas/salidas-y-visitas-con-cupo', texto: 'Salidas y visitas con cupo' },
    { href: '/vender-entradas/eventos-deportivos', texto: 'Eventos deportivos' },
    { href: '/vender-entradas/eventos-solidarios', texto: 'Eventos solidarios' },
    { href: '/vender-entradas/cultura-y-arte', texto: 'Cultura y arte' },
    { href: '/vender-entradas/after-office-y-eventos-de-empresa', texto: 'After office y eventos de empresa' },
    { href: '/vender-entradas/eventos-gratuitos-con-reserva', texto: 'Eventos gratuitos con reserva' },
  ] as Enlace[],

  ciudadesTitulo: 'Vender entradas en tu ciudad',
  ciudadesIntro: 'La venta es online y funciona en todo el país. Hay una guía por ciudad:',
  ciudades: [
    { href: '/vender-entradas/buenos-aires', texto: 'Buenos Aires' },
    { href: '/vender-entradas/cordoba', texto: 'Córdoba' },
    { href: '/vender-entradas/rosario', texto: 'Rosario' },
    { href: '/vender-entradas/mendoza', texto: 'Mendoza' },
    { href: '/vender-entradas/la-plata', texto: 'La Plata' },
    { href: '/vender-entradas/mar-del-plata', texto: 'Mar del Plata' },
    { href: '/vender-entradas/tucuman', texto: 'Tucumán' },
    { href: '/vender-entradas/salta', texto: 'Salta' },
    { href: '/vender-entradas/santa-fe', texto: 'Santa Fe' },
    { href: '/vender-entradas/neuquen', texto: 'Neuquén' },
    { href: '/vender-entradas/bahia-blanca', texto: 'Bahía Blanca' },
    { href: '/vender-entradas/posadas', texto: 'Posadas' },
    { href: '/vender-entradas/bariloche', texto: 'Bariloche' },
    { href: '/vender-entradas/jujuy', texto: 'Jujuy' },
    { href: '/vender-entradas/san-juan', texto: 'San Juan' },
    { href: '/vender-entradas/parana', texto: 'Paraná' },
    { href: '/vender-entradas/corrientes', texto: 'Corrientes' },
    { href: '/vender-entradas/resistencia', texto: 'Resistencia' },
    { href: '/vender-entradas/villa-carlos-paz', texto: 'Villa Carlos Paz' },
    { href: '/vender-entradas/rio-cuarto', texto: 'Río Cuarto' },
    { href: '/vender-entradas/santiago-del-estero', texto: 'Santiago del Estero' },
    { href: '/vender-entradas/san-luis', texto: 'San Luis' },
    { href: '/vender-entradas/villa-gesell', texto: 'Villa Gesell' },
    { href: '/vender-entradas/tandil', texto: 'Tandil' },
    { href: '/vender-entradas/gualeguaychu', texto: 'Gualeguaychú' },
    { href: '/vender-entradas/cosquin', texto: 'Cosquín' },
    { href: '/vender-entradas/villa-maria', texto: 'Villa María' },
    { href: '/vender-entradas/puerto-madryn', texto: 'Puerto Madryn' },
    { href: '/vender-entradas/comodoro-rivadavia', texto: 'Comodoro Rivadavia' },
    { href: '/vender-entradas/ushuaia', texto: 'Ushuaia' },
    { href: '/vender-entradas/pinamar', texto: 'Pinamar' },
    { href: '/vender-entradas/necochea', texto: 'Necochea' },
    { href: '/vender-entradas/san-rafael', texto: 'San Rafael' },
    { href: '/vender-entradas/concordia', texto: 'Concordia' },
    { href: '/vender-entradas/trelew', texto: 'Trelew' },
    { href: '/vender-entradas/rio-gallegos', texto: 'Río Gallegos' },
  ] as Enlace[],

  guiasTitulo: 'Antes de elegir ticketera',
  guias: [
    { href: '/vender-entradas/comparar-ticketeras', texto: 'Ticketeras en Argentina: cómo comparar comisiones y condiciones' },
    { href: '/vender-entradas/transferencia-y-lista-o-ticketera', texto: 'Vender por transferencia y lista o con una ticketera: qué cambia' },
    { href: '/blog/como-elegir-ticketera-comisiones', texto: 'Cómo elegir una ticketera y qué mirar de las comisiones' },
    { href: '/blog/control-de-acceso-dia-del-evento', texto: 'Cómo funciona el control de acceso el día del evento' },
    { href: '/blog', texto: 'Blog de ENTRÁ: todas las notas' },
  ] as Enlace[],

  preguntasTitulo: 'Preguntas frecuentes',
  preguntas: [
    {
      q: '¿Cuánto cuesta vender entradas online con ENTRÁ?',
      a: 'Crear la cuenta y cargar el evento no tiene costo, y cobrás el 100% del precio que le ponés a cada entrada. El cargo de servicio, del 8% + IVA sobre el precio de la entrada, y el procesamiento del pago los paga quien compra, con el desglose a la vista en el checkout antes de pagar.',
    },
    {
      q: '¿Cuándo cobro la plata de las entradas?',
      a: 'El plazo depende del medio de cobro. En Argentina se cobra con Mercado Pago: conectás tu cuenta desde el panel, cada venta entra directo a tu Mercado Pago y la plata queda disponible en los plazos de Mercado Pago, según tu cuenta y el medio con que pagó cada persona. Ese plazo no lo fija ENTRÁ: miralo en tu cuenta de Mercado Pago antes de comprometer pagos a proveedores.',
    },
    {
      q: '¿Cuánto tarda en publicarse mi evento?',
      a: 'Cada evento pasa por una revisión antes de publicarse, normalmente el mismo día. Te avisamos por mail apenas queda a la venta.',
    },
    {
      q: '¿Mis compradores tienen que crearse una cuenta?',
      a: 'No. Se compra sin crear una cuenta y la entrada llega por mail con su QR. El pago lo procesa Mercado Pago.',
    },
    {
      q: '¿Necesito comprar lectores para controlar la puerta?',
      a: 'No. El QR se escanea con la cámara del celular y cada código vale una sola vez. Si alguien llega sin el QR, se lo busca por apellido, DNI o mail, y si se cae la señal el escáner sigue validando y avisa que está trabajando sin conexión.',
    },
    {
      q: '¿Sirve para eventos gratuitos?',
      a: 'Sí. Marcás el evento como gratuito y la gente reserva su lugar sin pagar, pero igual saca su QR. La reserva no tiene ningún cargo.',
    },
    {
      q: '¿Funciona fuera de Buenos Aires?',
      a: 'Sí. La venta es online y ENTRÁ funciona en todo el país: tu público compra desde el celular en cualquier ciudad y recibe la entrada por mail.',
    },
    {
      q: '¿Puedo usar ENTRÁ para acreditar un congreso o conseguir personal?',
      a: 'ENTRÁ es para vender entradas y controlarlas en la puerta. La acreditación de congresos y eventos corporativos con credenciales se hace con PASE, y el personal para el evento se consigue en LABURO, las dos de SOMOS DER.',
    },
  ],

  cta: { href: '/productores', texto: 'Para productores' },
};

// ---------------------------------------------------------------------------
// HTML para el build (sin React). Mismo contenido que PortadaOrganizadores.tsx.
// ---------------------------------------------------------------------------

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const a = (e: Enlace) => `<a href="${e.href}">${esc(e.texto)}</a>`;
const ul = (items: string[]) => `<ul>\n${items.map((i) => `          <li>${i}</li>`).join('\n')}\n        </ul>`;
const ol = (items: string[]) => `<ol>\n${items.map((i) => `          <li>${i}</li>`).join('\n')}\n        </ol>`;
const lista = (enlaces: Enlace[]) => enlaces.map(a).join(', ');

/** Bloques comunes a la home y a /productores (las preguntas van solo en la home). */
function bloquesOrganizadores(conPreguntas: boolean): string {
  const p = PORTADA;
  const preguntas = conPreguntas
    ? `
        <h3>${esc(p.preguntasTitulo)}</h3>
${p.preguntas.map((f) => `        <h4>${esc(f.q)}</h4>\n        <p>${esc(f.a)}</p>`).join('\n')}`
    : '';
  return `
        <h3>${esc(p.cobroTitulo)}</h3>
        ${ul(p.cobro.map(esc))}
        <h3>${esc(p.pasosTitulo)}</h3>
        ${ol(p.pasos.map(esc))}
        <p>${a(p.enlacePasos)}</p>
        <h3>${esc(p.incluyeTitulo)}</h3>
        ${ul(p.incluye.map(esc))}
        <h3>${esc(p.tiposTitulo)}</h3>
        <p>${lista(p.tipos)}.</p>
        <h3>${esc(p.ciudadesTitulo)}</h3>
        <p>${esc(p.ciudadesIntro)} ${lista(p.ciudades)}.</p>
        <h3>${esc(p.guiasTitulo)}</h3>
        ${ul(p.guias.map(a))}${preguntas}`;
}

/** La familia de productos de SOMOS DER (16/11: «mis productos entre sí deberían hablarse»).
 *  El texto del enlace es la búsqueda que pelea cada producto. Lo usan el pie de la portada
 *  sin JavaScript (PIE) y el pie de la app (src/components/layout/Footer.tsx). Las páginas
 *  HTML de public/ llevan lo mismo con scripts/pie-familia.py. */
export const FAMILIA: Enlace[] = [
  { href: 'https://www.somosder.ar', texto: 'Productora de eventos: SOMOS DER' },
  { href: 'https://pase.somosder.ar', texto: 'Acreditación y control de acceso para eventos: PASE' },
  { href: 'https://laburo.somosder.ar', texto: 'Personal para eventos: LABURO' },
  { href: 'https://hito.agency', texto: 'Consultoría y web para emprendedores de eventos: HITO' },
];
export const FAMILIA_EN: Enlace[] = [
  { href: 'https://somosder.com/', texto: 'Event production company in Argentina: SOMOS DER' },
  { href: 'https://pase.somosder.ar/en/', texto: 'Event accreditation and access control: PASE' },
  { href: 'https://laburo.somosder.ar', texto: 'Event staff in Argentina: LABURO' },
  { href: 'https://hito.agency/en/', texto: 'Consulting and websites for event entrepreneurs: HITO' },
];

const PIE = `
        <p>De la misma casa: ${FAMILIA.map(a).join(' · ')}. <a href="/llms.txt">Resumen para asistentes de IA</a>.</p>`;

/** Portada: lo que queda dentro de <div id="root"> en dist/index.html. */
export function htmlPortada(h1: string): string {
  const p = PORTADA;
  return `
      <div class="pre">
        <h1>${esc(h1)}</h1>
        <p>${esc(p.intro)}</p>
        <p><a href="/eventos">Eventos con entradas a la venta</a> · ${a(p.enlaceVender)} · ${a(p.cta)} · <a href="/ayuda">Ayuda</a> · <a href="/contacto">Contacto</a></p>
        <h2>${esc(p.titulo)}</h2>${bloquesOrganizadores(true)}${PIE}
      </div>
    `;
}

/** /productores: su h1 y su resumen (src/lib/routeMeta.ts) más los mismos bloques. */
export function htmlProductores(h1: string, resumen: string): string {
  const p = PORTADA;
  return `
      <div class="pre">
        <h1>${esc(h1)}</h1>
        <p>${esc(resumen)}</p>
        <p><a href="/crear-evento">Crear mi evento</a> · ${a(p.enlaceVender)} · <a href="/">ENTRÁ, la ticketera de SOMOS DER</a> · <a href="/contacto">Contacto</a></p>${bloquesOrganizadores(false)}${PIE}
      </div>
    `;
}

/** Cualquier otra ruta pública: h1, resumen y los enlaces de siempre. */
export function htmlRuta(h1: string, resumen: string): string {
  const p = PORTADA;
  return `
      <div class="pre">
        <h1>${esc(h1)}</h1>
        <p>${esc(resumen)}</p>
        <p><a href="/">ENTRÁ, la ticketera de SOMOS DER</a> · <a href="/eventos">Eventos con entradas a la venta</a> · ${a(p.enlaceVender)} · ${a(p.enlacePasos)} · ${a(p.cta)} · <a href="/blog">Blog de ENTRÁ</a> · <a href="/ayuda">Ayuda</a> · <a href="/contacto">Contacto</a></p>
      </div>
    `;
}

/** Datos estructurados de las preguntas frecuentes (solo la home). */
export function jsonLdPreguntas(): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': 'https://www.entratickets.com/#faq',
    inLanguage: 'es-AR',
    mainEntity: PORTADA.preguntas.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  });
}
