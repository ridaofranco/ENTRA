/**
 * EL ORIGEN DE LA VISITA, PARA QUE VIAJE CON EL FORMULARIO DE CONTACTO (17/11/2026).
 *
 * `public/origen-casa.js` guarda en la cookie `der_o` de dónde vino la persona en su
 * primera visita (Google, pauta, ChatGPT, otro sitio, directo). La cookie es del mismo
 * dominio, así que el navegador la manda sola a `/api/lead`. Se lee acá, del lado del
 * servidor, y se suma como un campo más del aviso interno que recibe contacto@.
 *
 * El cliente no lo ve nunca: el receptor (somosder.ar/api/lead) usa `fields` solo en el
 * aviso interno y en la base, no en la confirmación que le llega a la persona.
 * Mismo archivo que tiene PASE (api/_origen.ts). Empieza con guión bajo: Vercel no lo
 * cuenta como función (ENTRÁ ya usa las 12 del plan).
 */

const corto = (v: unknown, n: number): string =>
  String(v ?? '').replace(/[\u0000-\u001f<>]/g, ' ').trim().slice(0, n);

type Origen = { o: string; c?: string; m?: string; r?: string; l?: string; t?: string; g?: string };

export function leerOrigen(req: any): Origen | null {
  const m = String(req?.headers?.cookie || '').match(/(?:^|;\s*)der_o=([^;]+)/);
  if (!m) return null;
  try {
    const v = JSON.parse(decodeURIComponent(m[1]));
    return v && typeof v.o === 'string' ? v : null;
  } catch {
    return null;
  }
}

/** El origen en palabras: origen, campaña, página de entrada y fecha de la primera visita. */
export function origenEnPalabras(o: Origen | null): string {
  if (!o) return 'Sin dato en ENTRÁ (la persona bloquea cookies o es su primera carga)';
  const partes = [corto(o.o, 80)];
  if (o.g) partes.push('clic en pauta de Google');
  if (o.m) partes.push(`medio ${corto(o.m, 40)}`);
  if (o.c) partes.push(`campaña ${corto(o.c, 120)}`);
  if (o.r && !String(o.o).includes(String(o.r))) partes.push(`desde ${corto(o.r, 80)}`);
  if (o.l) partes.push(`entró por entratickets.com${corto(o.l, 120)}`);
  if (o.t) partes.push(`primera visita ${corto(o.t, 10)}`);
  return partes.join(' · ');
}

/** La fila lista para sumar a `fields`. Mismo rótulo que usa el receptor de DER. */
export function filaOrigen(req: any): { label: string; value: string } {
  return { label: 'Cómo nos encontró (interno)', value: origenEnPalabras(leerOrigen(req)) };
}
