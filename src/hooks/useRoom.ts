import { useEffect, useState } from 'react';
import type { Backend } from '@/services/backend';
import type { RoomSubscriptionState } from '@/services/roomService';
import type { RoomCode, RoomPhase, RoomSnapshot } from '@/types';
import { COUNTDOWN_MS } from '@/utils/constants';
import { deriveRoomPhase } from '@/utils/phase';
import { buildRoomSnapshot } from '@/utils/roomSnapshot';

export type RoomView =
  | { kind: 'loading' }
  | { kind: 'missing' }
  | { kind: 'denied' }
  | {
      kind: 'ready';
      snapshot: RoomSnapshot;
      phase: RoomPhase;
      serverNow: number;
      /** false hanya jika pernah tersambung lalu putus (bukan saat baru memuat). */
      offline: boolean;
    };

/**
 * Jam server yang hanya berdetak saat dibutuhkan (hitung mundur), lalu berhenti sendiri.
 * `until` = waktu server ketika detak boleh berhenti.
 */
function useServerClock(offset: number, until: number | undefined): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (until === undefined) return;
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const timer = setInterval(() => {
      tick();
      if (Date.now() + offset >= until) clearInterval(timer);
    }, 200);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [offset, until]);
  return now + offset;
}

/**
 * Langganan room + presence + status koneksi, disusun menjadi snapshot dan fase (ADR-3:
 * layar diturunkan dari data server, sehingga kedua HP sinkron dan refresh aman).
 */
export function useRoom(code: RoomCode, backend: Backend): RoomView {
  const { rooms, uid } = backend;
  const [subscription, setSubscription] = useState<RoomSubscriptionState>({ status: 'loading' });
  const [denied, setDenied] = useState(false);
  const [connection, setConnection] = useState({ connected: false, everConnected: false });

  useEffect(
    () =>
      rooms.subscribeRoom(code, uid, {
        onChange: setSubscription,
        onError: () => setDenied(true),
      }),
    [rooms, code, uid],
  );

  useEffect(() => rooms.startPresence(code, uid), [rooms, code, uid]);

  useEffect(
    () =>
      rooms.watchConnection((connected) =>
        setConnection((previous) => ({
          connected,
          everConnected: previous.everConnected || connected,
        })),
      ),
    [rooms],
  );

  const data = subscription.status === 'ready' ? subscription.data : null;
  const startedAt = data?.state.status === 'playing' ? data.state.startedAt : undefined;
  const serverNow = useServerClock(
    rooms.serverOffset(),
    startedAt === undefined ? undefined : startedAt + COUNTDOWN_MS + 200,
  );

  if (denied) return { kind: 'denied' };
  if (subscription.status === 'missing') return { kind: 'missing' };
  if (!data) return { kind: 'loading' };

  const snapshot = buildRoomSnapshot(data, uid);
  if (!snapshot) return { kind: 'denied' };

  const partnerUid = snapshot.partner?.uid;
  const phase = deriveRoomPhase(
    {
      createdAt: data.meta.createdAt,
      state: data.state,
      mine: data.progress[uid],
      partner: partnerUid ? data.progress[partnerUid] : undefined,
    },
    serverNow,
  );

  return {
    kind: 'ready',
    snapshot,
    phase,
    serverNow,
    offline: connection.everConnected && !connection.connected,
  };
}
