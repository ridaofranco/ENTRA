// Conexión de servidor a Firebase (Admin SDK). El Admin SDK SALTEA las reglas de
// Firestore, así que solo debe usarse desde el backend (funciones serverless), nunca
// desde el navegador. Esto es lo que permite que ENTRÁ emita tickets y descuente stock
// de forma segura: el cliente ya no puede hacerlo (las reglas se cierran), solo este backend.
//
// Requiere la variable de entorno FIREBASE_SERVICE_ACCOUNT en Vercel: el contenido
// completo del JSON de cuenta de servicio (Firebase → Configuración → Cuentas de servicio →
// Generar nueva clave privada). NO se commitea el JSON: vive solo como variable de entorno.

import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

let cachedDb: Firestore | null = null;

export function getAdminDb(): Firestore {
  if (cachedDb) return cachedDb;

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    throw new Error(
      'Falta FIREBASE_SERVICE_ACCOUNT. Cargá el JSON de la cuenta de servicio de Firebase como variable de entorno en Vercel.'
    );
  }

  let serviceAccount: Record<string, unknown>;
  try {
    serviceAccount = JSON.parse(raw);
  } catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT no es un JSON válido. Pegá el contenido completo del archivo .json.');
  }

  const app: App = getApps().length
    ? getApps()[0]!
    : initializeApp({ credential: cert(serviceAccount as any) });

  cachedDb = getFirestore(app);
  return cachedDb;
}
