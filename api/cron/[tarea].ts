// ============================================================================
// LA ÚNICA PUERTA DE LOS CRONS
// ============================================================================
// Ruta dinámica: /api/cron/<tarea>. Una sola función de Vercel atiende TODAS las
// tareas programadas, en vez de una función por tarea.
//
// POR QUÉ. El plan Hobby topea en 12 funciones. Con un archivo por cron, cada
// tarea nueva se comía un slot y el proyecto ya había llegado al tope: no entraba
// una más sin romper el deploy. Así, sumar una tarea es agregar una línea a
// TAREAS y no cuesta ninguna función.
//
// LAS URLs NO CAMBIARON. /api/cron/recordatorio-evento y /api/cron/eventos-demo
// siguen respondiendo igual que antes, así que el despachador de Cloudflare no
// hay que tocarlo.
//
// La lógica de cada tarea vive en api/_cron-*.ts. El prefijo `_` las saca del
// ruteo de Vercel, así que no quedan expuestas por su cuenta: la autenticación
// pasa siempre por acá.

import { correrRecordatorioEvento } from '../_cron-recordatorio.js';
import { correrEventosDemo } from '../_cron-demos.js';

// El nombre de la tarea es el último tramo de la URL. Agregar una tarea nueva es
// sumar una entrada acá.
const TAREAS: Record<string, () => Promise<any>> = {
  'recordatorio-evento': correrRecordatorioEvento,
  'eventos-demo': correrEventosDemo,
};

export default async function handler(req: any, res: any) {
  // Acepta CRON_SECRET (el que inyecta Vercel en su propio cron) o
  // CF_CRON_SECRET (el del despachador de Cloudflare, que pasó a ser el
  // disparador real el 31/7/2026, porque el plan Hobby de Vercel solo permite
  // UNA corrida por día). Se SUMA una clave, no se reemplaza ninguna.
  //
  // ⚠️ ESTO ESTABA ABIERTO EN SU MOMENTO. Antes, si no había CRON_SECRET
  // cargada, el código dejaba pasar CUALQUIER request y solo escribía un
  // warning. Verificado el 31/7/2026 contra la API de Vercel: el proyecto
  // entra-by-der NO tenía CRON_SECRET, así que el endpoint venía aceptando
  // llamadas de cualquiera y mandando recordatorios a los asistentes. Es
  // fail-closed: sin ninguna clave cargada, 401.
  const aceptados = [process.env.CRON_SECRET, process.env.CF_CRON_SECRET].filter(Boolean);
  const auth = req.headers?.authorization;
  if (!aceptados.length) {
    console.error('[cron] sin CRON_SECRET ni CF_CRON_SECRET: no se atiende');
    return res.status(401).json({ ok: false, error: 'No autorizado' });
  }
  if (!aceptados.some((s) => auth === `Bearer ${s}`)) {
    console.error('[cron] rechazado: Authorization inválido');
    return res.status(401).json({ ok: false, error: 'No autorizado' });
  }

  // El 404 va DESPUÉS de la autenticación a propósito: si fuera antes, un
  // desconocido podría barrer nombres y enterarse de qué tareas existen por la
  // diferencia entre 404 y 401.
  const raw = req.query?.tarea;
  const nombre = Array.isArray(raw) ? raw[0] : raw;
  const tarea = nombre ? TAREAS[nombre] : undefined;
  if (!tarea) {
    console.error(`[cron] tarea desconocida: ${nombre}`);
    return res.status(404).json({ ok: false, error: 'Tarea desconocida' });
  }

  try {
    const resultado = await tarea();
    return res.status(200).json(resultado);
  } catch (err: any) {
    console.error(`[cron:${nombre}] error:`, err?.message || err);
    return res.status(500).json({ ok: false, error: `Falló la tarea ${nombre}.` });
  }
}
