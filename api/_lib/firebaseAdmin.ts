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
import { getAuth, type Auth } from 'firebase-admin/auth';

let cachedApp: App | null = null;
let cachedDb: Firestore | null = null;

function ensureApp(): App {
  if (cachedApp) return cachedApp;

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

  cachedApp = getApps().length
    ? getApps()[0]!
    : initializeApp({ credential: cert(serviceAccount as any) });
  return cachedApp;
}

export function getAdminDb(): Firestore {
  if (cachedDb) return cachedDb;

  const app = ensureApp();

  // ⚠️ La app fue creada desde Google AI Studio y su base de datos Firestore
  // NO es la '(default)': tiene un nombre propio (ver firestoreDatabaseId en
  // firebase-applet-config.json). El cliente ya apunta a esa base con nombre.
  // El Admin SDK debe apuntar a la MISMA base o Firestore devuelve '5 NOT_FOUND'
  // (la base '(default)' no existe en este proyecto). Se puede sobreescribir con
  // la env var FIREBASE_DATABASE_ID; por defecto usa el nombre real del repo.
  const databaseId = process.env.FIREBASE_DATABASE_ID || 'ai-studio-1f48d1a4-8f81-4978-8af2-62a9d8c7f9ea';

  cachedDb = getFirestore(app, databaseId);
  return cachedDb;
}

// Verifica el ID token de Firebase de un usuario (para saber, del lado del
// servidor, QUIÉN está haciendo la acción). Se usa al conectar MercadoPago:
// así nadie puede vincular una cuenta de MP a un organizador que no es él.
export function getAdminAuth(): Auth {
  return getAuth(ensureApp());
}
