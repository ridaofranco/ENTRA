import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, doc, getDoc, setDoc, collection, query, where, onSnapshot, addDoc, updateDoc, getDocFromServer, Timestamp, getDocs, orderBy, limit, deleteDoc } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

// ── EL DOMINIO QUE VE EL QUE INICIA SESIÓN ────────────────────────────────────
// Con el authDomain que trae la config, la pantalla de Google decía:
//
//     Ir a gen-lang-client-0748196420.firebaseapp.com
//
// Ese nombre lo puso Google AI Studio al crear el proyecto y NO se puede cambiar
// (el project ID de Google Cloud es permanente). Un productor que va a poner sus
// eventos y su plata veía eso en la ventana de login.
//
// vercel.json YA proxea /__/auth/ hacia el handler de Firebase, así que la pieza
// que faltaba era solo esta: usar el dominio propio como authDomain. El comentario
// que estaba acá describía justamente esto, pero el código nunca lo hizo.
//
// Solo se cambia en los dominios propios, que son los únicos donde existe el
// proxy y los únicos que están en la lista de dominios autorizados de Firebase.
// En preview de Vercel y en localhost sigue el de siempre, así que ahí el login
// no se toca.
const DOMINIOS_PROPIOS = ['entratickets.com', 'www.entratickets.com'];
const AUTH_DOMAIN_PROPIO = 'www.entratickets.com';

const hostActual = typeof window !== 'undefined' ? window.location.hostname : '';
const config = DOMINIOS_PROPIOS.includes(hostActual)
  ? { ...firebaseConfig, authDomain: AUTH_DOMAIN_PROPIO }
  : firebaseConfig;

const app = initializeApp(config);

// Initialize Firestore with experimental long-polling to prevent connection blocking in proxy/iframe environments.
// `persistentLocalCache` activa la persistencia offline (IndexedDB): los tickets del evento
// quedan cacheados y las validaciones/check-ins funcionan SIN internet en la puerta, y se
// sincronizan solos al reconectar. persistentMultipleTabManager permite varias pestañas/dispositivos.
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
}, firebaseConfig.firestoreDatabaseId || '(default)');

export const auth = getAuth(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Error Handling Helper
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  // El detalle (con datos de sesión) queda solo en consola para debug; NO se propaga
  // a la UI para no filtrar email/uid/proveedor en un mensaje de error visible.
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(error instanceof Error ? error.message : String(error));
}

// Connection Test - Defer to allow browser sandboxed environment to establish network routes and DNS resolve first
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. The client appears to be offline.");
    }
  }
}

setTimeout(() => {
  testConnection();
}, 4000);

export { Timestamp };
