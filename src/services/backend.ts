/**
 * Pintu masuk lazy ke back-end untuk hooks: Firebase, login anonim, dan roomService
 * dimuat bersamaan saat pertama kali dibutuhkan.
 */
import type { Uid } from '@/types';
import type { RoomService } from './roomService';

export interface Backend {
  uid: Uid;
  rooms: RoomService;
}

let backend: Promise<Backend> | null = null;

async function connect(): Promise<Backend> {
  const [{ getFirebase }, { ensureSignedIn }, { createRoomService }] = await Promise.all([
    import('./firebase'),
    import('./auth'),
    import('./roomService'),
  ]);
  const { auth, db } = await getFirebase();
  const uid = await ensureSignedIn(auth);
  return { uid, rooms: createRoomService(db) };
}

export function getBackend(): Promise<Backend> {
  if (!backend) {
    backend = connect();
    backend.catch(() => {
      backend = null;
    });
  }
  return backend;
}
