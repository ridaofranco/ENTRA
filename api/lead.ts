// /api/lead — el puente de ENTRÁ hacia el receptor único del ecosistema.
//
// POR QUÉ EXISTE (7/9/2026): la página de contacto de ENTRÁ tenía un formulario
// que NO HACÍA NADA. Sin `onSubmit`, sin `name` en los campos, sin destino: la
// persona escribía, apretaba "Enviar Mensaje" y el mensaje no llegaba a ningún
// lado. Peor que no tener formulario, porque aparenta funcionar.
//
// NO ESTRENA CIRCUITO, y es a propósito: reenvía al mismo receptor que usan
// somosder.ar, PASE, LABURO y HITO, así el lead cae en la misma lista
// (public.web_leads), avisa a contacto@ con [ENTRA] adelante del asunto, y la
// confirmación le llega al cliente CON LA MARCA ENTRÁ, no con la de DER.
//
// ⚠️ POR QUÉ UN PUENTE Y NO UN FETCH DIRECTO DESDE EL NAVEGADOR: el receptor no
// manda cabeceras de CORS, así que el navegador bloquearía el POST. Server a
// server no hay CORS que valga.
//
// ⚠️ ESTA ES LA FUNCIÓN NÚMERO 12 DE 12. El plan de Vercel permite 12 funciones
// serverless y con 13 el deploy queda en ERROR sin ningún error de código. Si
// hace falta una más, hay que mirar primero si algo de `api/` no es un endpoint
// de verdad: Vercel ignora todo lo que empieza con guión bajo.
import { frenado } from './_rate-limit.js';

// ⚠️ CON www. El dominio pelado devuelve un 308 hacia `www.somosder.ar` y ese
// salto no sobrevive adentro de la función: el reenvío falla entero.
const DESTINO = 'https://www.somosder.ar/api/lead';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const body = typeof req.body === 'string' ? safeParse(req.body) : req.body;
  if (!body || typeof body !== 'object') return res.status(400).json({ error: 'bad_request' });

  // Honeypot: campo invisible que una persona nunca completa.
  if (String((body as any).sitio || '').trim() !== '') return res.status(200).json({ ok: true });

  const name = String((body as any).name || '').trim().slice(0, 120);
  const email = String((body as any).email || '').trim().slice(0, 200);
  const asunto = String((body as any).asunto || '').trim().slice(0, 200);
  const mensaje = String((body as any).mensaje || '').trim().slice(0, 2000);

  if (!name || !EMAIL_RE.test(email) || !mensaje) {
    return res.status(422).json({ error: 'faltan_datos' });
  }

  // ⚠️ EL FRENO VA DESPUÉS DE VALIDAR. Lo que hay que proteger es el reenvío, que
  // es lo que cuesta (dos mails y una fila); un pedido incompleto no cuesta nada.
  // Con el freno arriba, quien se equivoca tres veces al escribir su mail queda
  // bloqueado un minuto por haber tipeado mal.
  if (frenado(req, res, 'lead', 5, 60_000)) return;
  if (frenado(req, res, 'lead:hora', 20, 3_600_000)) return;

  try {
    // ⚠️ 25 SEGUNDOS: el destino tarda ~11s porque manda DOS mails y escribe en la
    // base antes de contestar. Con un timeout corto esto aborta justo antes de que
    // llegue la respuesta y la persona ve un error con el formulario lleno.
    const ctrl = new AbortController();
    const reloj = setTimeout(() => ctrl.abort(), 25_000);

    const r = await fetch(DESTINO, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // ⚠️ ORIGEN FIJO, del lado del servidor: define el asunto del aviso Y la
        // marca con la que se le contesta al cliente. No se toma del pedido, así
        // ninguna landing puede hacerse pasar por otra.
        origen: 'ENTRA',
        kind: 'contacto',
        lang: 'es',
        name,
        email,
        phone: String((body as any).phone || '').trim(),
        page: 'entratickets.com/contacto',
        fields: [
          ...(asunto ? [{ label: 'Asunto', value: asunto }] : []),
          { label: 'Mensaje', value: mensaje },
        ],
      }),
      signal: ctrl.signal,
    });
    clearTimeout(reloj);

    if (!r.ok) return res.status(502).json({ error: 'destino_rechazo', status: r.status });
    return res.status(200).json({ ok: true });
  } catch {
    return res.status(502).json({ error: 'destino_no_responde' });
  }
}

function safeParse(s: string): unknown {
  try { return JSON.parse(s); } catch { return null; }
}
