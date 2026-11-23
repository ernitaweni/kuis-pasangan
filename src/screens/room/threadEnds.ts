import type { ThreadEnd } from '@/components/thread/ThreadLink';
import type { RoomSnapshot } from '@/types';
import { initialOf } from '@/utils/validation';

/** Ujung benang [Host, Tamu] dari sudut pandang pemain ini, lengkap dengan status online. */
export function threadEnds(snapshot: RoomSnapshot): [ThreadEnd, ThreadEnd] {
  const { me, partner, meta } = snapshot;
  const isHost = me.role === 'host';
  const host = isHost ? me : partner;
  const guest = isHost ? partner : me;
  const hostName = host?.name || meta.hostName;

  const status = (online: boolean | undefined) => (online ? 'tersambung' : 'terputus');

  const hostEnd: ThreadEnd = {
    name: hostName,
    sub: isHost ? 'kamu' : status(host?.online),
    present: true,
    initial: initialOf(hostName),
  };
  const guestEnd: ThreadEnd = guest
    ? {
        name: guest.name || 'Pasanganmu',
        sub: isHost ? status(guest.online) : 'kamu',
        present: true,
        initial: initialOf(guest.name),
      }
    : { name: 'Pasanganmu', sub: 'belum masuk', present: false };

  return [hostEnd, guestEnd];
}

export function partnerNameOf(snapshot: RoomSnapshot): string {
  return snapshot.partner?.name || 'Pasanganmu';
}
