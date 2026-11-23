/**
 * Inisialisasi Firebase secara lazy (ADR-6): SDK baru diunduh saat pertama kali dibutuhkan,
 * sehingga Beranda tampil tanpa menunggu Firebase.
 */
import type { FirebaseApp, FirebaseOptions } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import type { Database } from 'firebase/database';

export interface FirebaseHandles {
  app: FirebaseApp;
  auth: Auth;
  db: Database;
}

export const EMULATOR_PROJECT_ID = 'demo-kuis-pasangan';
const EMULATOR_PORTS = { auth: 9099, database: 9000 } as const;

export const useEmulators = import.meta.env.VITE_USE_EMULATORS === 'true';

function readProductionConfig(): FirebaseOptions {
  const env = import.meta.env;
  const config = {
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    databaseURL: env.VITE_FIREBASE_DATABASE_URL,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    appId: env.VITE_FIREBASE_APP_ID,
  };
  const missing = Object.entries(config)
    .filter(([, value]) => !value)
    .map(([key]) => key);
  if (missing.length > 0) {
    throw new Error(
      `Konfigurasi Firebase belum lengkap (${missing.join(', ')}). Isi .env.local, atau set VITE_USE_EMULATORS=true.`,
    );
  }
  return config;
}

/** Host emulator: 127.0.0.1 di komputer sendiri, IP komputer saat dibuka dari HP di Wi-Fi yang sama. */
function emulatorHost(): string {
  const host = window.location.hostname;
  return host === 'localhost' || host === '' ? '127.0.0.1' : host;
}

async function initFirebase(): Promise<FirebaseHandles> {
  const [{ initializeApp }, authModule, databaseModule] = await Promise.all([
    import('firebase/app'),
    import('firebase/auth'),
    import('firebase/database'),
  ]);

  const config: FirebaseOptions = useEmulators
    ? {
        apiKey: 'demo-api-key',
        projectId: EMULATOR_PROJECT_ID,
        // Rules hanya berlaku pada namespace "<projectId>-default-rtdb" (docs/03-setup.md §4.6).
        databaseURL: `https://${EMULATOR_PROJECT_ID}-default-rtdb.firebaseio.com`,
      }
    : readProductionConfig();

  const app = initializeApp(config);
  // Sama seperti getAuth(), tapi TANPA popupRedirectResolver: game ini hanya memakai login
  // anonim, jadi iframe/api.js Google untuk login popup tidak perlu diunduh (lebih cepat dan
  // tanpa permintaan pihak ketiga). Urutan persistence sama dengan bawaan getAuth(), sehingga
  // uid tetap sama setelah refresh.
  const auth = authModule.initializeAuth(app, {
    persistence: [
      authModule.indexedDBLocalPersistence,
      authModule.browserLocalPersistence,
      authModule.browserSessionPersistence,
    ],
  });
  const db = databaseModule.getDatabase(app);

  if (useEmulators) {
    const host = emulatorHost();
    authModule.connectAuthEmulator(auth, `http://${host}:${EMULATOR_PORTS.auth}`, {
      disableWarnings: true,
    });
    databaseModule.connectDatabaseEmulator(db, host, EMULATOR_PORTS.database);
  }

  return { app, auth, db };
}

let handles: Promise<FirebaseHandles> | null = null;

export function getFirebase(): Promise<FirebaseHandles> {
  if (!handles) {
    handles = initFirebase();
    // Jika gagal (misalnya jaringan), izinkan percobaan ulang berikutnya.
    handles.catch(() => {
      handles = null;
    });
  }
  return handles;
}
