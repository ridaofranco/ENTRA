// ============================================================================
// INICIAR conexión de MercadoPago del productor (paso 1 del OAuth)
// ============================================================================
// El panel del productor manda su ID token de Firebase. Acá lo VERIFICAMOS con
// el Admin SDK para saber con certeza quién es (uid), firmamos ese uid en el
// `state` y devolvemos el link de autorización de MercadoPago. Así nadie puede
// conectar una cuenta de MP en nombre de otro organizador.

import { getAdminAuth } from './_lib/firebaseAdmin.js';
import { buildAuthUrl, signState } from './_lib/mpOAuth.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }
  try {
    const idToken = req.body?.idToken;
    if (!idToken) return res.status(401).json({ error: 'Falta el token de sesión.' });

    let uid: string;
    try {
      const decoded = await getAdminAuth().verifyIdToken(String(idToken));
      uid = decoded.uid;
    } catch {
      return res.status(401).json({ error: 'Sesión inválida. Volvé a iniciar sesión e intentá de nuevo.' });
    }

    const url = buildAuthUrl(signState(uid));
    return res.status(200).json({ url });
  } catch (err: any) {
    console.error('[mp-oauth-start] error:', err?.message || err);
    return res.status(500).json({ error: 'No se pudo iniciar la conexión con MercadoPago.' });
  }
}
