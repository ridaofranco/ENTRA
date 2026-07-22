// ============================================================================
// RETORNO de la conexión de MercadoPago del productor (paso 2 del OAuth)
// ============================================================================
// MercadoPago redirige acá con ?code=...&state=... tras autorizar. Verificamos la
// firma del `state` (para confirmar el organizador), canjeamos el código por el
// access_token del productor y lo guardamos SOLO del lado del servidor:
//   - mp_accounts/{uid}     → token + refresh (reglas: nadie lo lee desde el cliente)
//   - mp_connections/{uid}  → estado "conectado" (esto SÍ lo puede leer el dueño)
// Después redirige al panel con ?mp=connected (o ?mp=error).

import { Timestamp } from 'firebase-admin/firestore';
import { getAdminDb } from './_lib/firebaseAdmin.js';
import { exchangeCodeForToken, verifyState } from './_lib/mpOAuth.js';

const BASE_URL = process.env.PUBLIC_BASE_URL || 'https://www.entratickets.com';

function redirect(res: any, status: 'connected' | 'error', detail?: string) {
  const url = `${BASE_URL}/dashboard?mp=${status}${detail ? `&mp_detail=${encodeURIComponent(detail)}` : ''}`;
  res.writeHead(302, { Location: url });
  res.end();
}

export default async function handler(req: any, res: any) {
  try {
    const code = String(req.query?.code || '');
    const state = String(req.query?.state || '');

    if (!code) return redirect(res, 'error', 'Sin código de autorización');

    const organizerId = verifyState(state);
    if (!organizerId) return redirect(res, 'error', 'Estado inválido');

    const token = await exchangeCodeForToken(code);

    const db = getAdminDb();
    // Token privado del productor: SOLO backend (reglas mp_accounts: if false).
    await db.collection('mp_accounts').doc(organizerId).set({
      access_token: token.access_token,
      refresh_token: token.refresh_token || null,
      mp_user_id: token.user_id ? String(token.user_id) : null,
      public_key: token.public_key || null,
      expires_in: token.expires_in || null,
      live_mode: token.live_mode ?? null,
      updatedAt: Timestamp.now(),
    }, { merge: true });

    // Estado de conexión (SIN secretos): el productor lo lee en su panel.
    await db.collection('mp_connections').doc(organizerId).set({
      connected: true,
      mpUserId: token.user_id ? String(token.user_id) : null,
      connectedAt: Timestamp.now(),
    }, { merge: true });

    return redirect(res, 'connected');
  } catch (err: any) {
    console.error('[mp-oauth-callback] error:', err?.message || err);
    return redirect(res, 'error', 'No se pudo completar la conexión');
  }
}
