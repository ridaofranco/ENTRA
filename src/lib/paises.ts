// ============================================================================
// LOS PAÍSES DONDE OPERA ENTRÁ
// ============================================================================
// ENTRÁ nació 100% argentina: moneda, documento y huso estaban escritos a mano en
// 20 archivos. Paraguay es el primer país nuevo, y este archivo es el único lugar
// donde se define en qué se diferencia uno de otro.
//
// ── POR QUÉ PARAGUAY NO COBRA (todavía) ──
// MercadoPago no opera en Paraguay, así que no hay con qué cobrar una entrada
// paga. Lo que SÍ funciona hoy, sin tocar ningún procesador, es la reserva sin
// cargo: create-payment resuelve los eventos gratis por su cuenta (emite los
// tickets con QR de servidor, descuenta stock y manda el mail) sin pasar por
// MercadoPago. Por eso Paraguay arranca con `cobra: false`, y esa bandera es la
// que frena en el servidor cualquier intento de cobrar en guaraníes por un
// procesador argentino.
// Cuando entre Bancard (o el que se elija), esto pasa a `true` y el resto del
// circuito ya está.
//
// ⚠️ Si agregás un país, acordate de sumarlo a `country` en firestore.rules:
// isValidEvent() usa hasOnlyAllowedFields() y valida el valor contra esta lista.

export type Pais = 'AR' | 'PY';

export interface ConfigPais {
  codigo: Pais;
  nombre: string;
  /** Locale para plata. Las FECHAS siguen usando el idioma del comprador (i18n). */
  locale: string;
  moneda: string;
  /** Cómo se llama el documento de identidad del comprador en ese país. */
  documento: string;
  /** Zona horaria IANA. Paraguay eliminó el horario de verano en 2024, así que
   *  hoy es UTC-3 fijo igual que Argentina — pero se deja explícito porque es
   *  una coincidencia, no una regla. */
  zonaHoraria: string;
  /** Si hay un procesador de pagos disponible. En false, solo eventos sin cargo. */
  cobra: boolean;
}

export const PAISES: Record<Pais, ConfigPais> = {
  AR: {
    codigo: 'AR',
    nombre: 'Argentina',
    locale: 'es-AR',
    moneda: 'ARS',
    documento: 'DNI',
    zonaHoraria: 'America/Argentina/Buenos_Aires',
    cobra: true,
  },
  PY: {
    codigo: 'PY',
    nombre: 'Paraguay',
    locale: 'es-PY',
    moneda: 'PYG',
    documento: 'Cédula',
    zonaHoraria: 'America/Asuncion',
    cobra: false,
  },
};

export const PAIS_POR_DEFECTO: Pais = 'AR';

/**
 * El país de un evento. Todos los eventos que existían antes de Paraguay no
 * tienen el campo: son argentinos, y esa es la razón del fallback. Nunca tirar
 * este default, o media base se vuelve invisible.
 */
export function paisDe(evento: { country?: string } | null | undefined): Pais {
  const c = evento?.country;
  return c === 'PY' || c === 'AR' ? c : PAIS_POR_DEFECTO;
}

export function configDe(evento: { country?: string } | null | undefined): ConfigPais {
  return PAISES[paisDe(evento)];
}
