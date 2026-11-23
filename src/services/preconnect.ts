/**
 * Membuka koneksi ke server Firebase lebih awal (<link rel="preconnect">) saat membuka link
 * undangan atau room aktif, sementara SDK Firebase masih diunduh (temuan QA T1,
 * docs/04-qa-checklist.md). Beranda tidak memakainya, karena belum tentu butuh Firebase.
 */

/** Server yang pertama kali dihubungi: database (WebSocket) dan login anonim. */
export function firebaseOrigins(input: {
  useEmulators: boolean;
  databaseUrl: string | undefined;
}): string[] {
  // Emulator berjalan di laptop sendiri: tidak ada DNS/TLS yang perlu dipercepat.
  if (input.useEmulators) return [];
  const origins: string[] = [];
  try {
    if (input.databaseUrl) origins.push(new URL(input.databaseUrl).origin);
  } catch {
    // URL tidak valid: lewati. Kesalahan konfigurasi dilaporkan oleh services/firebase.ts.
  }
  origins.push('https://identitytoolkit.googleapis.com');
  return origins;
}

let done = false;

/** Menambahkan <link rel="preconnect"> sekali saja per halaman. */
export function preconnectFirebase(): void {
  if (done || typeof document === 'undefined') return;
  done = true;
  const origins = firebaseOrigins({
    useEmulators: import.meta.env.VITE_USE_EMULATORS === 'true',
    databaseUrl: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  });
  for (const href of origins) {
    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = href;
    // Login anonim memakai fetch CORS tanpa cookie, jadi koneksinya harus "anonymous".
    link.crossOrigin = 'anonymous';
    document.head.append(link);
  }
}
