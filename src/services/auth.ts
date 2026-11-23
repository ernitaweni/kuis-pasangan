import { type Auth, signInAnonymously } from 'firebase/auth';
import type { Uid } from '@/types';

/**
 * Memastikan perangkat ini punya identitas anonim. uid tersimpan di perangkat (IndexedDB),
 * sehingga tetap sama setelah refresh dan pemain bisa masuk kembali ke room-nya (FR-21).
 */
export async function ensureSignedIn(auth: Auth): Promise<Uid> {
  await auth.authStateReady();
  if (auth.currentUser) return auth.currentUser.uid;
  const credential = await signInAnonymously(auth);
  return credential.user.uid;
}
