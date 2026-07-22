// ============================================================================
// OAUTH / MARKETPLACE de MercadoPago — conexión de la cuenta del PRODUCTOR
// ============================================================================
// Cada productor conecta su cuenta de MercadoPago a ENTRÁ una sola vez. A partir
// de ahí, cuando alguien compra una entrada de SU evento, la preferencia de pago
// se crea con el token del productor + un `marketplace_fee` (la comisión de ENTRÁ),
// y MercadoPago le manda la plata directo a él y a ENTRÁ la comisión, automáticamente.
//
// El access_token del productor se guarda SOLO del lado del servidor (colección
// mp_accounts, con reglas `if false`: el navegador nunca lo ve).
//
// Requiere en Vercel: MP_CLIENT_ID y MP_CLIENT_SECRET (credenciales OAuth de la
// aplicación de MercadoPago). La URL de retorno (redirect_uri) debe estar dada de
// alta en la config de la app de MercadoPago: https://www.entratickets.com/api/mp-oauth-callback

import { createHmac, timingSafeEqual } from 'crypto';

const OAUTH_TOKEN_URL = 'https://api.mercadopago.com/oauth/token';
const OAUTH_AUTH_URL = 'https://auth.mercadopago.com.ar/authorization';

export function getRedirectUri(): string {
  const base = process.env.PUBLIC_BASE_URL || 'https://www.entratickets.com';
  return `${base}/api/mp-oauth-callback`;
}

// --- Firma del `state` -------------------------------------------------------
// El `state` viaja hasta MercadoPago y vuelve. Lo firmamos con HMAC para que
// nadie pueda inventar un state con el id de OTRO organizador y quedarse con sus
// ventas. Solo el servidor (que tiene el secreto) puede generar states válidos.
function stateSecret(): string {
  return process.env.MP_CLIENT_SECRET || process.env.MP_ACCESS_TOKEN || 'entra-oauth-fallback';
}

export function signState(organizerId: string): string {
  const sig = createHmac('sha256', stateSecret()).update(organizerId).digest('hex').slice(0, 32);
  return `${organizerId}.${sig}`;
}

export function verifyState(state: string): string | null {
  if (!state || !state.includes('.')) return null;
  const idx = state.lastIndexOf('.');
  const organizerId = state.slice(0, idx);
  const sig = state.slice(idx + 1);
  const expected = createHmac('sha256', stateSecret()).update(organizerId).digest('hex').slice(0, 32);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return null;
    return timingSafeEqual(a, b) ? organizerId : null;
  } catch {
    return null;
  }
}

export function buildAuthUrl(state: string): string {
  const clientId = process.env.MP_CLIENT_ID;
  if (!clientId) throw new Error('Falta MP_CLIENT_ID en el servidor.');
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    platform_id: 'mp',
    state,
    redirect_uri: getRedirectUri(),
  });
  return `${OAUTH_AUTH_URL}?${params.toString()}`;
}

// Canjea el `code` que devuelve MercadoPago por el access_token del productor.
// Devuelve { access_token, refresh_token, user_id, public_key, expires_in, ... }
export async function exchangeCodeForToken(code: string): Promise<any> {
  const clientId = process.env.MP_CLIENT_ID;
  const clientSecret = process.env.MP_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('Faltan MP_CLIENT_ID / MP_CLIENT_SECRET en el servidor.');
  }
  const resp = await fetch(OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: getRedirectUri(),
    }),
  });
  const data = await resp.json().catch(() => null);
  if (!resp.ok || !data?.access_token) {
    throw new Error(`Error al canjear el código de MercadoPago: ${data?.message || resp.status}`);
  }
  return data;
}
