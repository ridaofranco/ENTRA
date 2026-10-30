// Título, descripción y canonical de cada ruta de la app.
// Lo usan dos lados:
//  - src/components/RouteMeta.tsx, que los aplica en el navegador al cambiar de ruta;
//  - vite.config.ts (plugin htmlPorRuta), que en el build escribe dist/_rutas/<archivo>.html
//    con estos datos ya puestos en el <head> y en el <noscript>, para que Google y las IA
//    (que no corren JavaScript) no vean la misma página para /productores, /ayuda, etc.
//    vercel.json reescribe cada ruta pública a su archivo.
// Este archivo no puede importar nada: lo carga Node en el build.

export const SITIO = 'https://www.entratickets.com';

export interface MetaRuta {
  title: string;
  description: string;
  // Ruta canónica; si falta, se usa la ruta actual sin query.
  canonical?: string;
  // Pantallas privadas o de un solo uso: no se indexan.
  noindex?: boolean;
  // Solo rutas públicas: archivo que genera el build y párrafo propio del <noscript>.
  archivo?: string;
  h1?: string;
  resumen?: string;
}

const HOME: MetaRuta = {
  title: 'ENTRÁ: ticketera online para vender entradas',
  description: 'Acceso a experiencias en vivo. Comprá y vendé entradas, gestioná tus eventos y controlá el acceso desde el celular.',
  canonical: '/',
};

const EVENTOS: MetaRuta = {
  title: 'Eventos con entradas a la venta | ENTRÁ',
  description: 'Fiestas, recitales, obras y eventos con entradas a la venta en ENTRÁ. Comprás online, ves el precio final antes de pagar y entrás con el QR desde el celular.',
  canonical: '/eventos',
  archivo: 'eventos',
  h1: 'Eventos con entradas a la venta en ENTRÁ',
  resumen: 'La cartelera de ENTRÁ reúne los eventos publicados por sus organizadores: fiestas, recitales, obras, talleres y festivales. Cada compra muestra el precio final con los costos de servicio antes de pagar, y cada entrada tiene un QR único que se valida en la puerta desde el celular.',
};

export const RUTAS: Record<string, MetaRuta> = {
  '/': HOME,
  '/eventos': EVENTOS,
  '/comprar': EVENTOS,
  '/productores': {
    title: 'Vender entradas online: cobrás el 100% | ENTRÁ',
    description: 'Creá tu evento gratis, vendé entradas online y validalas en la puerta con QR desde el celular. Cobrás el 100% del precio; el costo de servicio lo paga quien compra.',
    archivo: 'productores',
    h1: 'Vender entradas con ENTRÁ: el organizador cobra el 100%',
    resumen: 'Ponés tu entrada al precio que querés y recibís ese precio completo: los costos de servicio y procesamiento los paga quien compra, con el desglose a la vista en el checkout. Crear la cuenta y publicar el evento no tiene costo, y el día del evento las entradas se validan en la puerta desde el celular con un QR único por entrada.',
  },
  '/ayuda': {
    title: 'Ayuda y preguntas frecuentes | ENTRÁ',
    description: 'Cómo entrar a tu evento, qué hacer si no te llegó la entrada, cómo transferirla, qué se cobra y qué pasa si el evento se cancela o se reprograma.',
    archivo: 'ayuda',
    h1: 'Ayuda de ENTRÁ',
    resumen: 'Respuestas a las preguntas más comunes: cómo entro a mi evento, no me llegó la entrada, compré como invitado y dónde veo mi entrada, cómo transferir una entrada a otra persona, cómo pago y qué me cobran, qué pasa si el evento se cancela o se reprograma, y cómo publica un evento quien organiza.',
  },
  '/contacto': {
    title: 'Contacto | ENTRÁ',
    description: 'Escribile al equipo de ENTRÁ para vender entradas de tu evento o resolver una consulta sobre una compra.',
    archivo: 'contacto',
    h1: 'Contacto de ENTRÁ',
    resumen: 'Para vender entradas de tu evento o resolver una consulta sobre una compra, escribinos a contacto@somosder.com.ar. ENTRÁ es la ticketera de SOMOS DER, Aráoz 1146, Palermo, Ciudad de Buenos Aires.',
  },
  '/terminos': {
    title: 'Términos y condiciones | ENTRÁ',
    description: 'Términos y condiciones de uso de ENTRÁ, la ticketera online de SOMOS DER.',
    archivo: 'terminos',
    h1: 'Términos y condiciones de ENTRÁ',
    resumen: 'Condiciones de uso de ENTRÁ para quien compra entradas y para quien organiza y publica eventos.',
  },
  '/privacidad': {
    title: 'Política de privacidad | ENTRÁ',
    description: 'Cómo ENTRÁ, la ticketera online de SOMOS DER, trata los datos de quien compra entradas y de quien organiza eventos.',
    archivo: 'privacidad',
    h1: 'Política de privacidad de ENTRÁ',
    resumen: 'Qué datos guarda ENTRÁ cuando comprás una entrada o publicás un evento, para qué se usan y cómo pedir que se modifiquen o se borren.',
  },
  '/demo': {
    title: 'Probá ENTRÁ con un evento de demo | ENTRÁ',
    description: 'Mirá cómo compra la gente y cómo se valida la entrada en la puerta con dos eventos de demo, uno gratis y uno pago.',
  },
  '/checkout': { title: 'Pagar entradas | ENTRÁ', description: HOME.description, noindex: true },
  '/auth/login': { title: 'Ingresar | ENTRÁ', description: HOME.description, noindex: true },
  '/entrar': { title: 'Ingresar | ENTRÁ', description: HOME.description, noindex: true },
  '/perfil': { title: 'Mis entradas | ENTRÁ', description: HOME.description, noindex: true },
  '/dashboard': { title: 'Panel del organizador | ENTRÁ', description: HOME.description, noindex: true },
  '/crear-evento': { title: 'Crear evento | ENTRÁ', description: HOME.description, noindex: true },
  '/control-acceso': { title: 'Control de acceso | ENTRÁ', description: HOME.description, noindex: true },
  '/admin/dashboard': { title: 'Administración | ENTRÁ', description: HOME.description, noindex: true },
};

// Rutas con parámetro: se resuelven por prefijo.
const PREFIJOS: [string, MetaRuta][] = [
  ['/dashboard/evento/', { title: 'Panel del evento | ENTRÁ', description: HOME.description, noindex: true }],
  ['/claim/', { title: 'Recibir una entrada | ENTRÁ', description: HOME.description, noindex: true }],
  ['/admin/', { title: 'Administración | ENTRÁ', description: HOME.description, noindex: true }],
];

const NO_ENCONTRADA: MetaRuta = { title: 'Página no encontrada | ENTRÁ', description: HOME.description, noindex: true };

// /evento/:id: canonical a la propia URL del evento (para los bots, el título y la vista previa
// los arma api/evento-preview con los datos del evento).
const EVENTO: MetaRuta = { title: HOME.title, description: HOME.description };

export function metaDeRuta(pathname: string): MetaRuta {
  const p = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  if (p.startsWith('/evento/')) return EVENTO;
  if (RUTAS[p]) return RUTAS[p];
  for (const [prefijo, meta] of PREFIJOS) if (p.startsWith(prefijo)) return meta;
  return NO_ENCONTRADA;
}
