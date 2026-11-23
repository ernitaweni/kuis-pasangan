import { describe, expect, it } from 'vitest';
import type { HistoryEntry } from '@/types';
import { ROOM_TTL_MS } from './constants';
import { isOneOf } from './guards';
import {
  isActiveRoomRef,
  isFreshActiveRoom,
  isHistoryEntry,
  parseVersioned,
  sanitizeHistory,
  serializeVersioned,
  upsertHistory,
} from './persist';
import {
  parseAnswerMap,
  parseMeta,
  parsePlayers,
  parsePresenceMap,
  parseProgressMap,
  parseSettings,
  parseState,
} from './roomParse';
import { type RoomData, buildRoomSnapshot, roleOf } from './roomSnapshot';

const entry = (id: string, percent = 80): HistoryEntry => ({
  id,
  playedAt: 1,
  myName: 'Sari',
  partnerName: 'Bima',
  categoryId: 'santai',
  mode: 'guess',
  percent,
  tierTitle: 'Partner sejati',
});

describe('persist: format penyimpanan lokal', () => {
  const isString = (v: unknown): v is string => typeof v === 'string';

  it('serialize → parse bolak-balik', () => {
    expect(parseVersioned(serializeVersioned('halo'), isString)).toBe('halo');
  });

  it('null untuk kosong, JSON rusak, versi lain, atau isi tidak valid', () => {
    expect(parseVersioned(null, isString)).toBeNull();
    expect(parseVersioned('{rusak', isString)).toBeNull();
    expect(parseVersioned(JSON.stringify({ v: 2, data: 'x' }), isString)).toBeNull();
    expect(parseVersioned(JSON.stringify({ v: 1, data: 5 }), isString)).toBeNull();
  });

  it('isActiveRoomRef & isFreshActiveRoom', () => {
    expect(isActiveRoomRef({ code: 'K7M2QX', savedAt: 1 })).toBe(true);
    expect(isActiveRoomRef({ code: 'salah', savedAt: 1 })).toBe(false);
    expect(isFreshActiveRoom({ code: 'K7M2QX', savedAt: 0 }, ROOM_TTL_MS - 1)).toBe(true);
    expect(isFreshActiveRoom({ code: 'K7M2QX', savedAt: 0 }, ROOM_TTL_MS)).toBe(false);
    // Jam perangkat mundur jauh: anggap tidak segar.
    expect(isFreshActiveRoom({ code: 'K7M2QX', savedAt: 10 * 60_000 }, 0)).toBe(false);
  });

  it('isHistoryEntry menolak entri rusak; sanitizeHistory membuangnya', () => {
    expect(isHistoryEntry(entry('a'))).toBe(true);
    expect(isHistoryEntry({ ...entry('a'), percent: 140 })).toBe(false);
    expect(isHistoryEntry({ ...entry('a'), categoryId: 'lain' })).toBe(false);
    expect(sanitizeHistory([entry('a'), 'x', null, entry('b')]).map((e) => e.id)).toEqual([
      'a',
      'b',
    ]);
  });

  it('upsertHistory: terbaru di depan, id sama diganti, maksimal 5', () => {
    let list: HistoryEntry[] = [];
    for (const id of ['1', '2', '3', '4', '5', '6']) list = upsertHistory(list, entry(id));
    expect(list.map((e) => e.id)).toEqual(['6', '5', '4', '3', '2']);
    list = upsertHistory(list, entry('4', 100));
    expect(list.map((e) => e.id)).toEqual(['4', '6', '5', '3', '2']);
    expect(list[0]?.percent).toBe(100);
  });

  it('isOneOf', () => {
    expect(isOneOf('a', ['a', 'b'])).toBe(true);
    expect(isOneOf(1, ['a'])).toBe(false);
  });
});

describe('roomParse: data dari database tidak dipercaya', () => {
  it('parseMeta', () => {
    const ok = { hostUid: 'H', hostName: 'Sari', createdAt: 5, schemaVersion: 1 };
    expect(parseMeta(ok)).toEqual(ok);
    expect(parseMeta({ ...ok, guestUid: 'G' })?.guestUid).toBe('G');
    expect(parseMeta({ ...ok, guestUid: 7 })).toEqual(ok);
    expect(parseMeta({ ...ok, schemaVersion: 2 })).toBeNull();
    expect(parseMeta({ ...ok, createdAt: 'x' })).toBeNull();
    expect(parseMeta(null)).toBeNull();
  });

  it('parseSettings', () => {
    expect(parseSettings({ categoryId: 'santai', mode: 'match', targetUid: 'H' })).not.toBeNull();
    expect(parseSettings({ categoryId: 'lain', mode: 'match', targetUid: 'H' })).toBeNull();
    expect(parseSettings({ categoryId: 'santai', mode: 'match', targetUid: '' })).toBeNull();
    expect(parseSettings('x')).toBeNull();
  });

  it('parseState: questionIds bisa array atau objek; field rusak dibuang', () => {
    expect(
      parseState({ status: 'playing', round: 2, questionIds: ['a', 'b'], startedAt: 9 }),
    ).toEqual({
      status: 'playing',
      round: 2,
      questionIds: ['a', 'b'],
      startedAt: 9,
    });
    expect(
      parseState({ status: 'playing', round: 1, questionIds: { 0: 'a', 1: 'b' } })?.questionIds,
    ).toEqual(['a', 'b']);
    expect(
      parseState({ status: 'lobby', round: 1, questionIds: ['a', 3] })?.questionIds,
    ).toBeUndefined();
    expect(
      parseState({ status: 'closed', round: 1, closedReason: 'host-left' })?.closedReason,
    ).toBe('host-left');
    expect(
      parseState({ status: 'closed', round: 1, closedReason: 'aneh' })?.closedReason,
    ).toBeUndefined();
    expect(parseState({ status: 'aneh', round: 1 })).toBeNull();
    expect(parseState({ status: 'lobby', round: 0 })).toBeNull();
    expect(parseState({ status: 'lobby', round: 1.5 })).toBeNull();
  });

  it('peta pemain, presence, progress, jawaban: entri rusak dibuang', () => {
    expect(
      parsePlayers({
        A: { name: 'Sari', role: 'host', joinedAt: 1 },
        B: { name: '', role: 'guest' },
      }),
    ).toEqual({
      A: { name: 'Sari', role: 'host', joinedAt: 1 },
    });
    expect(parsePlayers({ A: { name: 'Sari', role: 'host' } }).A?.joinedAt).toBe(0);
    expect(parsePresenceMap({ A: { online: true, lastSeen: 3 }, B: { online: 'ya' } })).toEqual({
      A: { online: true, lastSeen: 3 },
    });
    expect(parsePresenceMap({ A: { online: false } }).A?.lastSeen).toBe(0);
    expect(
      parseProgressMap({
        A: { answered: 4 },
        B: { answered: 10, ready: 7 },
        C: { answered: -1 },
        D: 'x',
        E: { answered: 2, ready: -3 },
      }),
    ).toEqual({
      A: { answered: 4, ready: 0 },
      B: { answered: 10, ready: 7 },
      E: { answered: 2, ready: 0 },
    });
    expect(parseAnswerMap({ q1: 'a', q2: 'z', q3: 4 })).toEqual({ q1: 'a' });
    expect(parseAnswerMap(null)).toEqual({});
    expect(parsePlayers([1, 2])).toEqual({});
  });
});

describe('roomSnapshot', () => {
  const data: RoomData = {
    code: 'K7M2QX',
    meta: { hostUid: 'H', hostName: 'Sari', guestUid: 'G', createdAt: 0, schemaVersion: 1 },
    settings: { categoryId: 'santai', mode: 'guess', targetUid: 'H' },
    state: { status: 'playing', round: 1 },
    players: {
      H: { name: 'Sari', role: 'host', joinedAt: 0 },
      G: { name: 'Bima', role: 'guest', joinedAt: 0 },
    },
    presence: { H: { online: true, lastSeen: 0 } },
    progress: { G: { answered: 10, ready: 9 } },
    myAnswers: { q: 'a' },
    partnerAnswers: {},
  };

  it('roleOf', () => {
    expect(roleOf(data.meta, 'H')).toBe('host');
    expect(roleOf(data.meta, 'G')).toBe('guest');
    expect(roleOf(data.meta, 'X')).toBeNull();
  });

  it('menyusun me & partner dari sudut pandang Host', () => {
    const snap = buildRoomSnapshot(data, 'H');
    expect(snap?.me).toEqual({
      uid: 'H',
      role: 'host',
      name: 'Sari',
      online: true,
      answered: 0,
      ready: 0,
    });
    expect(snap?.partner).toEqual({
      uid: 'G',
      role: 'guest',
      name: 'Bima',
      online: false,
      answered: 10,
      ready: 9,
    });
  });

  it('dari sudut pandang Tamu, dan fallback nama Host dari meta', () => {
    const snap = buildRoomSnapshot({ ...data, players: {} }, 'G');
    expect(snap?.me.role).toBe('guest');
    expect(snap?.partner?.name).toBe('Sari');
    expect(snap?.me.name).toBe('');
  });

  it('partner null sebelum Tamu bergabung; null untuk bukan anggota', () => {
    const { guestUid: _omit, ...meta } = data.meta;
    expect(buildRoomSnapshot({ ...data, meta }, 'H')?.partner).toBeNull();
    expect(buildRoomSnapshot(data, 'X')).toBeNull();
  });
});
