import { describe, expect, it } from 'vitest';
import type { AnswerMap, RoomMetaDoc, RoomSettingsDoc } from '@/types';
import {
  RESULT_TIERS,
  buildResult,
  compareAnswers,
  getAnswerOrder,
  getTier,
  pickTalkingPoints,
  summarize,
  toPercent,
} from './scoring';

const ids = ['q1', 'q2', 'q3', 'q4'];

describe('compareAnswers', () => {
  it('menandai cocok hanya jika kedua jawaban sama persis', () => {
    const first: AnswerMap = { q1: 'a', q2: 'b', q3: 'c', q4: 'd' };
    const second: AnswerMap = { q1: 'a', q2: 'c', q3: 'c', q4: 'a' };
    expect(compareAnswers(ids, first, second).map((r) => r.isMatch)).toEqual([
      true,
      false,
      true,
      false,
    ]);
  });

  it('jawaban kosong di salah satu sisi (atau keduanya) dihitung tidak cocok', () => {
    const rows = compareAnswers(ids, { q1: 'a', q3: 'b' }, { q1: 'a', q2: 'b' });
    expect(rows.map((r) => r.isMatch)).toEqual([true, false, false, false]);
    expect(rows[3]).toEqual({
      questionId: 'q4',
      first: undefined,
      second: undefined,
      isMatch: false,
    });
  });

  it('mengikuti urutan questionIds dan mengabaikan jawaban di luar daftar', () => {
    const rows = compareAnswers(
      ['q2', 'q1'],
      { q1: 'a', q2: 'b', extra: 'c' },
      { q1: 'a', q2: 'b' },
    );
    expect(rows.map((r) => r.questionId)).toEqual(['q2', 'q1']);
  });
});

describe('toPercent', () => {
  it.each([
    [8, 10, 80],
    [10, 10, 100],
    [0, 10, 0],
    [1, 3, 33],
    [2, 3, 67],
  ])('%i dari %i → %i%%', (matches, total, expected) => {
    expect(toPercent(matches, total)).toBe(expected);
  });

  it('total 0, negatif, atau tidak valid → 0 (tidak pernah NaN)', () => {
    expect(toPercent(0, 0)).toBe(0);
    expect(toPercent(5, -1)).toBe(0);
    expect(toPercent(Number.NaN, 10)).toBe(0);
    expect(toPercent(3, Number.POSITIVE_INFINITY)).toBe(0);
  });

  it('dibatasi 0–100 walau input di luar rentang', () => {
    expect(toPercent(12, 10)).toBe(100);
    expect(toPercent(-2, 10)).toBe(0);
  });
});

describe('getTier', () => {
  it.each([
    [100, 4],
    [90, 4],
    [89, 3],
    [70, 3],
    [69, 2],
    [40, 2],
    [39, 1],
    [0, 1],
  ])('%i%% → tingkat %i', (percent, level) => {
    expect(getTier(percent, 'guess').level).toBe(level);
    expect(getTier(percent, 'match').level).toBe(level);
  });

  it('judul berbeda per mode', () => {
    expect(getTier(80, 'guess').title).toBe('Partner sejati');
    expect(getTier(80, 'match').title).toBe('Satu frekuensi');
  });

  it('persentase tidak valid jatuh ke tingkat terendah', () => {
    expect(getTier(-5, 'guess').level).toBe(1);
    expect(getTier(Number.NaN, 'match').level).toBe(1);
  });

  it('tidak ada kata bernada negatif di ringkasan karakter', () => {
    const texts = Object.values(RESULT_TIERS).flatMap((tiers) =>
      tiers.flatMap((t) => [t.title, t.description]),
    );
    for (const text of texts) expect(text).not.toMatch(/\b(salah|gagal|buruk|jelek)\b/i);
  });
});

describe('pickTalkingPoints & summarize', () => {
  const rows = compareAnswers(
    ['q1', 'q2', 'q3', 'q4', 'q5'],
    { q1: 'a', q2: 'a', q3: 'a', q4: 'a', q5: 'a' },
    { q1: 'b', q2: 'a', q3: 'b', q4: 'b', q5: 'b' },
  );

  it('maksimal 3 soal yang beda, sesuai urutan soal', () => {
    expect(pickTalkingPoints(rows).map((r) => r.questionId)).toEqual(['q1', 'q3', 'q4']);
    expect(pickTalkingPoints(rows, 1)).toHaveLength(1);
    expect(pickTalkingPoints(rows, -1)).toEqual([]);
  });

  it('kosong jika semua cocok', () => {
    expect(pickTalkingPoints(compareAnswers(['q1'], { q1: 'a' }, { q1: 'a' }))).toEqual([]);
  });

  it('summarize menghitung cocok, total, persen', () => {
    expect(summarize(rows)).toEqual({ matches: 1, total: 5, percent: 20 });
    expect(summarize([])).toEqual({ matches: 0, total: 0, percent: 0 });
  });
});

describe('buildResult', () => {
  it('menggabungkan perbandingan, skor, tingkat, dan bahan obrolan', () => {
    const questionIds = Array.from({ length: 10 }, (_, i) => `q${i}`);
    const first = Object.fromEntries(questionIds.map((id) => [id, 'a'])) as AnswerMap;
    const second: AnswerMap = { ...first, q3: 'b', q7: 'c' };
    const result = buildResult({ questionIds, first, second, mode: 'guess' });
    expect(result).toMatchObject({ matches: 8, total: 10, percent: 80 });
    expect(result.tier.title).toBe('Partner sejati');
    expect(result.talkingPoints.map((r) => r.questionId)).toEqual(['q3', 'q7']);
  });

  it('hasil identik untuk input yang sama (dihitung di dua HP)', () => {
    const input = {
      questionIds: ids,
      first: { q1: 'a' } as AnswerMap,
      second: { q1: 'a' } as AnswerMap,
      mode: 'match' as const,
    };
    expect(buildResult(input)).toEqual(buildResult(structuredClone(input)));
  });
});

describe('getAnswerOrder', () => {
  const meta: RoomMetaDoc = {
    hostUid: 'H',
    hostName: 'Host',
    guestUid: 'G',
    createdAt: 0,
    schemaVersion: 1,
  };
  const settings = (mode: RoomSettingsDoc['mode'], targetUid: string): RoomSettingsDoc => ({
    categoryId: 'santai',
    mode,
    targetUid,
  });

  it('mode guess: Yang Ditebak lebih dulu', () => {
    expect(getAnswerOrder(settings('guess', 'H'), meta)).toEqual({ firstUid: 'H', secondUid: 'G' });
    expect(getAnswerOrder(settings('guess', 'G'), meta)).toEqual({ firstUid: 'G', secondUid: 'H' });
  });

  it('mode match: Host lalu Tamu, apa pun targetnya', () => {
    expect(getAnswerOrder(settings('match', 'G'), meta)).toEqual({ firstUid: 'H', secondUid: 'G' });
  });

  it('null jika Tamu belum bergabung', () => {
    const { guestUid: _omit, ...withoutGuest } = meta;
    expect(getAnswerOrder(settings('guess', 'H'), withoutGuest)).toBeNull();
  });
});
