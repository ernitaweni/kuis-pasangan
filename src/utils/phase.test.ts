import { describe, expect, it } from 'vitest';
import type { ProgressDoc, RoomMetaDoc, RoomStateDoc } from '@/types';
import { COUNTDOWN_MS, ROOM_TTL_MS } from './constants';
import {
  assessJoin,
  countAnswered,
  currentQuestionIndex,
  deriveQuestionStep,
  deriveRoomPhase,
  isRoomExpired,
  revealedQuestionIds,
  roundIdOf,
} from './phase';

const NOW = 1_800_000_000_000;
const meta = (extra: Partial<RoomMetaDoc> = {}): RoomMetaDoc => ({
  hostUid: 'H',
  hostName: 'Host',
  createdAt: NOW - 1000,
  schemaVersion: 1,
  ...extra,
});
const state = (extra: Partial<RoomStateDoc> = {}): RoomStateDoc => ({
  status: 'lobby',
  round: 1,
  ...extra,
});
const progress = (answered: number, ready: number): ProgressDoc => ({ answered, ready });
const IDS = ['q1', 'q2', 'q3'];

describe('roundIdOf & isRoomExpired', () => {
  it('membentuk id ronde', () => expect(roundIdOf(3)).toBe('r3'));

  it('kedaluwarsa tepat di 24 jam', () => {
    expect(isRoomExpired(NOW, NOW + ROOM_TTL_MS - 1)).toBe(false);
    expect(isRoomExpired(NOW, NOW + ROOM_TTL_MS)).toBe(true);
  });
});

describe('assessJoin', () => {
  it('room tidak ada', () => {
    expect(assessJoin(null, null, 'X', NOW)).toEqual({ kind: 'blocked', error: 'not-found' });
    expect(assessJoin(meta(), null, 'X', NOW)).toEqual({ kind: 'blocked', error: 'not-found' });
  });

  it('kedaluwarsa diperiksa sebelum keanggotaan', () => {
    const old = meta({ createdAt: NOW - ROOM_TTL_MS });
    expect(assessJoin(old, state(), 'H', NOW)).toEqual({ kind: 'blocked', error: 'expired' });
  });

  it('anggota lama boleh masuk kembali di status apa pun', () => {
    expect(assessJoin(meta(), state({ status: 'playing' }), 'H', NOW)).toEqual({
      kind: 'member',
      role: 'host',
    });
    expect(assessJoin(meta({ guestUid: 'G' }), state({ status: 'closed' }), 'G', NOW)).toEqual({
      kind: 'member',
      role: 'guest',
    });
  });

  it('orang baru: ditutup, penuh, sudah dimulai, atau boleh masuk', () => {
    expect(assessJoin(meta(), state({ status: 'closed' }), 'X', NOW)).toEqual({
      kind: 'blocked',
      error: 'closed',
    });
    expect(assessJoin(meta({ guestUid: 'G' }), state(), 'X', NOW)).toEqual({
      kind: 'blocked',
      error: 'full',
    });
    expect(assessJoin(meta(), state({ status: 'playing' }), 'X', NOW)).toEqual({
      kind: 'blocked',
      error: 'already-started',
    });
    expect(assessJoin(meta(), state(), 'X', NOW)).toEqual({ kind: 'can-join' });
  });
});

describe('currentQuestionIndex', () => {
  it('soal yang tampil = soal pertama yang belum disiapi kedua pemain', () => {
    expect(currentQuestionIndex(undefined, undefined)).toBe(0);
    expect(currentQuestionIndex(progress(3, 3), progress(2, 2))).toBe(2);
    expect(currentQuestionIndex(progress(3, 2), progress(3, 3))).toBe(2);
  });
});

describe('deriveRoomPhase', () => {
  const base = { createdAt: NOW - 1000 };
  const playing = state({ status: 'playing', startedAt: NOW - 10_000, questionIds: IDS });

  it('closed menang atas segalanya, lalu expired', () => {
    expect(deriveRoomPhase({ ...base, state: state({ status: 'closed' }) }, NOW)).toBe('closed');
    expect(deriveRoomPhase({ createdAt: NOW - ROOM_TTL_MS, state: playing }, NOW)).toBe('expired');
  });

  it('lobby', () => expect(deriveRoomPhase({ ...base, state: state() }, NOW)).toBe('lobby'));

  it('countdown selama 3 detik pertama setelah Mulai', () => {
    const justStarted = state({ status: 'playing', startedAt: NOW - 1000, questionIds: IDS });
    expect(deriveRoomPhase({ ...base, state: justStarted }, NOW)).toBe('countdown');
    expect(deriveRoomPhase({ ...base, state: justStarted }, NOW - 1000 + COUNTDOWN_MS)).toBe(
      'answering',
    );
  });

  it('answering sampai KEDUANYA siap melewati soal terakhir, lalu result', () => {
    const at = (mine: ProgressDoc, partner: ProgressDoc) =>
      deriveRoomPhase({ ...base, state: playing, mine, partner }, NOW);
    expect(at(progress(0, 0), progress(0, 0))).toBe('answering');
    expect(at(progress(3, 3), progress(3, 2))).toBe('answering');
    expect(at(progress(3, 3), progress(3, 3))).toBe('result');
  });

  it('tanpa startedAt (data lama) langsung answering', () => {
    expect(
      deriveRoomPhase({ ...base, state: state({ status: 'playing', questionIds: IDS }) }, NOW),
    ).toBe('answering');
  });

  it('daftar soal kosong tidak pernah dianggap selesai', () => {
    const empty = state({ status: 'playing', questionIds: [] });
    expect(deriveRoomPhase({ ...base, state: empty }, NOW)).toBe('answering');
  });
});

describe('deriveQuestionStep: menjawab → menunggu → terbuka → menunggu siap', () => {
  const step = (myAnswers: Record<string, 'a' | 'b'>, mine: ProgressDoc, partner: ProgressDoc) =>
    deriveQuestionStep({ questionIds: IDS, myAnswers, mine, partner });

  it('belum menjawab, dengan info apakah pasangan sudah menjawab', () => {
    expect(step({}, progress(0, 0), progress(0, 0))).toEqual({
      kind: 'answering',
      index: 0,
      partnerAnswered: false,
    });
    expect(step({}, progress(0, 0), progress(1, 0))).toEqual({
      kind: 'answering',
      index: 0,
      partnerAnswered: true,
    });
  });

  it('sudah menjawab, pasangan belum → menunggu jawaban', () => {
    expect(step({ q1: 'a' }, progress(1, 0), progress(0, 0))).toEqual({
      kind: 'waiting-answer',
      index: 0,
    });
  });

  it('keduanya menjawab → terbuka; setelah menekan Siap → menunggu pasangan siap', () => {
    expect(step({ q1: 'a' }, progress(1, 0), progress(1, 0))).toEqual({
      kind: 'revealed',
      index: 0,
    });
    expect(step({ q1: 'a' }, progress(1, 1), progress(1, 0))).toEqual({
      kind: 'waiting-ready',
      index: 0,
    });
  });

  it('keduanya siap → soal berikutnya muncul bersamaan', () => {
    expect(step({ q1: 'a' }, progress(1, 1), progress(1, 1))).toEqual({
      kind: 'answering',
      index: 1,
      partnerAnswered: false,
    });
  });

  it('null setelah semua soal dilewati', () => {
    expect(step({ q1: 'a', q2: 'a', q3: 'b' }, progress(3, 3), progress(3, 3))).toBeNull();
  });
});

describe('countAnswered & revealedQuestionIds', () => {
  it('menghitung hanya jawaban untuk soal ronde ini', () => {
    expect(countAnswered(IDS, { q1: 'a', q3: 'b', lain: 'c' })).toBe(2);
  });

  it('soal terbuka = dijawab keduanya, sesuai urutan soal', () => {
    expect(revealedQuestionIds(IDS, { q1: 'a', q2: 'b' }, { q2: 'c', q1: 'a' })).toEqual([
      'q1',
      'q2',
    ]);
    expect(revealedQuestionIds(IDS, { q1: 'a' }, {})).toEqual([]);
  });
});
