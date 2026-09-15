// ============================================================================
// QUIÉN ESTÁ DEL OTRO LADO CUANDO LLAMA EL PANEL
// ============================================================================
// Hay endpoints que tienen que poder usarse desde dos lados: el backend (con un
// secreto en variable de entorno) y el panel, que corre en el NAVEGADOR de un
// admin o de un productor. Un secreto en el browser no es un secreto, así que el
// panel no puede mandar el de la casa.
//
// Lo que sí puede mandar es su sesión: el ID token de Firebase del usuario
// logueado. Acá se verifica ese token con el Admin SDK y se mira el rol real en
// Firestore, no lo que diga el navegador.
//
// Esto es lo que permite cerrar el candado de /api/send-ticket-email (hoy abierto)
// sin romper el reenvío manual desde el panel.

import { getAdminAuth, getAdminDb } from './firebaseAdmin.js';

export type UsuarioPanel = { uid: string; email: string; role: string };

/** Verifica el `Authorization: Bearer <idToken>` y devuelve el usuario, o null. */
export async function usuarioDelRequest(req: any): Promise<UsuarioPanel | null> {
  const header = req?.headers?.authorization || req?.headers?.Authorization;
  if (!header || typeof header !== 'string' || !header.startsWith('Bearer ')) return null;
  const idToken = header.slice(7).trim();
  if (!idToken) return null;

  try {
    const decoded = await getAdminAuth().verifyIdToken(idToken);
    const snap = await getAdminDb().collection('users').doc(decoded.uid).get();
    const role = snap.exists ? String((snap.data() as any)?.role || '') : '';
    return { uid: decoded.uid, email: String(decoded.email || ''), role };
  } catch {
    return null;
  }
}

export function esAdmin(u: UsuarioPanel | null): boolean {
  return !!u && (u.role === 'admin' || u.role === 'superadmin');
}

/** Admin, o el organizador dueño de ese evento. */
export async function puedeSobreEvento(u: UsuarioPanel | null, eventId: string): Promise<boolean> {
  if (!u) return false;
  if (esAdmin(u)) return true;
  if (!eventId) return false;
  try {
    const ev = await getAdminDb().collection('events').doc(eventId).get();
    return ev.exists && String((ev.data() as any)?.organizerId || '') === u.uid;
  } catch {
    return false;
  }
}
