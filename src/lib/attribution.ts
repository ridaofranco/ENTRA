// ============================================================================
// ATRIBUCIÓN — de dónde vino el que compró
// ============================================================================
// Hasta acá ENTRÁ no guardaba NADA del origen de una venta. El productor que
// publicaba el evento en Instagram, en WhatsApp y en una story de un amigo veía
// un solo número de ventas y no tenía manera de saber cuál de los tres se lo
// trajo. El único método que funcionaba era crear un código de descuento por
// canal (cada código lleva su usedCount), y eso obliga a regalar plata para
// poder medir.
//
// Cómo funciona:
//   1) capturarOrigen() corre UNA vez al abrir la app (main.tsx). Lee los
//      parámetros utm_* de la URL y, si no hay, deduce la red desde el referrer.
//   2) el resultado queda en sessionStorage, así sobrevive al camino
//      landing → evento → checkout → MercadoPago → vuelta.
//   3) el checkout lo manda a /api/create-payment, que lo escribe en la orden.
//
// Criterio: se guarda el ÚLTIMO origen identificable de la sesión. Si el
// visitante entra por Instagram, se va, y vuelve escribiendo la dirección a
// mano, la venta sigue siendo de Instagram: una visita directa NO pisa un
// origen conocido. Pero si vuelve por otra campaña, esa campaña sí manda,
// porque es la que efectivamente lo trajo a comprar.
//
// Nada de esto identifica a una persona: son cinco textos sobre de qué link
// vino el clic. No se usa ninguna cookie ni se comparte con terceros.

const CLAVE = 'entra_origen';

export type Origen = {
  source: string;              // instagram, google, whatsapp, direct...
  medium?: string;             // social, cpc, email, referral...
  campaign?: string;           // el nombre que le puso el productor
  content?: string;            // para diferenciar dos piezas de la misma campaña
  term?: string;               // palabra clave, si vino de buscador pago
  referrer?: string;           // el dominio crudo, por si la deducción se queda corta
  landing?: string;            // en qué página del sitio cayó
  at?: string;                 // cuándo (ISO)
};

/**
 * Redes y buscadores por dominio del referrer. La lista cubre los subdominios
 * reales con los que llegan los clics: Instagram manda `l.instagram.com` en el
 * link de la bio, Facebook manda `m.facebook.com` desde la app, y Twitter/X
 * acorta todo a `t.co`. Sin esto, el 90% del tráfico de redes se vería como
 * "referral" genérico, que para el productor no dice nada.
 */
const REDES: Array<{ test: RegExp; source: string; medium: string }> = [
  { test: /(^|\.)instagram\.com$/i,           source: 'instagram', medium: 'social' },
  { test: /(^|\.)facebook\.com$|^fb\.me$/i,   source: 'facebook',  medium: 'social' },
  { test: /(^|\.)tiktok\.com$/i,              source: 'tiktok',    medium: 'social' },
  { test: /(^|\.)(twitter|x)\.com$|^t\.co$/i, source: 'twitter',   medium: 'social' },
  { test: /whatsapp\.com$|^wa\.me$/i,         source: 'whatsapp',  medium: 'social' },
  { test: /(^|\.)youtube\.com$|^youtu\.be$/i, source: 'youtube',   medium: 'social' },
  { test: /(^|\.)linkedin\.com$|^lnkd\.in$/i, source: 'linkedin',  medium: 'social' },
  { test: /(^|\.)t\.me$|telegram/i,           source: 'telegram',  medium: 'social' },
  { test: /(^|\.)google\./i,                  source: 'google',    medium: 'organic' },
  { test: /(^|\.)bing\.com$/i,                source: 'bing',      medium: 'organic' },
  { test: /(^|\.)(duckduckgo|ecosia|yahoo)\./i, source: 'buscador', medium: 'organic' },
];

/** Recorta y limpia: nunca guardamos más de 120 caracteres de un parámetro ajeno. */
function limpiar(v: string | null | undefined): string | undefined {
  if (!v) return undefined;
  const s = String(v).trim().slice(0, 120);
  return s || undefined;
}

/**
 * Dominios que NUNCA son un origen. Cuando el comprador vuelve de pagar, el
 * navegador manda `mercadopago.com` como referrer: sin esta lista, la última
 * pantalla del checkout reescribiría el origen y TODAS las ventas pagas
 * figurarían como venidas de MercadoPago, justo las que más importa atribuir.
 */
const NO_SON_ORIGEN = /mercadopago|mercadolibre|mercadolivre/i;

function deducirDelReferrer(ref: string): Partial<Origen> | null {
  if (!ref) return null;
  let host = '';
  try {
    host = new URL(ref).hostname;
  } catch {
    return null;
  }
  // Navegación dentro del propio sitio: no es un origen, es el visitante caminando.
  if (host === window.location.hostname) return null;
  if (NO_SON_ORIGEN.test(host)) return null;

  const conocida = REDES.find((r) => r.test.test(host));
  if (conocida) return { source: conocida.source, medium: conocida.medium, referrer: host };
  // Un sitio que nos linkeó y no está en la lista igual vale: se guarda el dominio.
  return { source: host.replace(/^www\./, ''), medium: 'referral', referrer: host };
}

/**
 * Corre una vez al abrir la app. Es deliberadamente silenciosa: si algo falla
 * (sessionStorage bloqueado en modo privado, URL rara), no rompe la compra.
 * Medir nunca puede costar una venta.
 */
export function capturarOrigen(): void {
  try {
    const params = new URLSearchParams(window.location.search);
    const utmSource = limpiar(params.get('utm_source'));

    let nuevo: Origen | null = null;

    if (utmSource) {
      // Campaña etiquetada a mano: es la señal más confiable que hay.
      nuevo = {
        source: utmSource.toLowerCase(),
        medium: limpiar(params.get('utm_medium'))?.toLowerCase(),
        campaign: limpiar(params.get('utm_campaign')),
        content: limpiar(params.get('utm_content')),
        term: limpiar(params.get('utm_term')),
        referrer: limpiar(document.referrer)?.slice(0, 120),
        landing: window.location.pathname.slice(0, 120),
        at: new Date().toISOString(),
      };
    } else {
      const delRef = deducirDelReferrer(document.referrer || '');
      if (delRef?.source) {
        nuevo = {
          source: delRef.source,
          medium: delRef.medium,
          referrer: delRef.referrer,
          landing: window.location.pathname.slice(0, 120),
          at: new Date().toISOString(),
        };
      }
    }

    if (!nuevo) {
      // Visita directa. Solo se registra si no había NADA antes: una vuelta
      // escribiendo la dirección a mano no le puede robar la venta a la red
      // que trajo a esa persona hace cinco minutos.
      if (sessionStorage.getItem(CLAVE)) return;
      nuevo = {
        source: 'directo',
        medium: 'none',
        landing: window.location.pathname.slice(0, 120),
        at: new Date().toISOString(),
      };
    }

    sessionStorage.setItem(CLAVE, JSON.stringify(nuevo));
  } catch {
    /* medir no puede romper nada */
  }
}

/** Lo que el checkout manda al backend. Devuelve null si no hay nada que contar. */
export function leerOrigen(): Origen | null {
  try {
    const crudo = sessionStorage.getItem(CLAVE);
    return crudo ? (JSON.parse(crudo) as Origen) : null;
  } catch {
    return null;
  }
}

/** Etiqueta legible para el panel del productor: "instagram · social". */
export function etiquetaOrigen(o?: Origen | null): string {
  if (!o?.source) return 'Sin dato';
  const base = o.source === 'directo' ? 'Directo' : o.source;
  return o.campaign ? `${base} · ${o.campaign}` : base;
}
