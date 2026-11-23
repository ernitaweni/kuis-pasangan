import type {
  AnswerMap,
  PlayerDoc,
  PlayerRole,
  PlayerView,
  PresenceDoc,
  ProgressDoc,
  RoomCode,
  RoomMetaDoc,
  RoomSettingsDoc,
  RoomSnapshot,
  RoomStateDoc,
  Uid,
} from '@/types';

/** Data room hasil langganan (services/roomService), sudah lolos parser. */
export interface RoomData {
  code: RoomCode;
  meta: RoomMetaDoc;
  settings: RoomSettingsDoc;
  state: RoomStateDoc;
  players: Record<Uid, PlayerDoc>;
  presence: Record<Uid, PresenceDoc>;
  /** Progres ronde aktif saja. */
  progress: Record<Uid, ProgressDoc>;
  myAnswers: AnswerMap;
  /** Hanya soal yang sudah terbuka (keduanya menjawab). */
  partnerAnswers: AnswerMap;
}

export function roleOf(meta: RoomMetaDoc, uid: Uid): PlayerRole | null {
  if (uid === meta.hostUid) return 'host';
  if (uid === meta.guestUid) return 'guest';
  return null;
}

function playerView(data: RoomData, uid: Uid, role: PlayerRole): PlayerView {
  const progress = data.progress[uid];
  const fallbackName = role === 'host' ? data.meta.hostName : '';
  return {
    uid,
    role,
    name: data.players[uid]?.name ?? fallbackName,
    online: data.presence[uid]?.online ?? false,
    answered: progress?.answered ?? 0,
    ready: progress?.ready ?? 0,
  };
}

/** null jika `myUid` bukan anggota room ini. */
export function buildRoomSnapshot(data: RoomData, myUid: Uid): RoomSnapshot | null {
  const myRole = roleOf(data.meta, myUid);
  if (!myRole) return null;
  const partnerUid = myRole === 'host' ? data.meta.guestUid : data.meta.hostUid;
  const partnerRole: PlayerRole = myRole === 'host' ? 'guest' : 'host';
  return {
    code: data.code,
    meta: data.meta,
    settings: data.settings,
    state: data.state,
    me: playerView(data, myUid, myRole),
    partner: partnerUid === undefined ? null : playerView(data, partnerUid, partnerRole),
    myAnswers: data.myAnswers,
    partnerAnswers: data.partnerAnswers,
  };
}
