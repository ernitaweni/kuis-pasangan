import { describe, expect, it } from 'vitest';
import type { Category } from '@/types';
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from './constants';
import {
  buildInviteUrl,
  generateRoomCode,
  isValidRoomCode,
  normalizeRoomCode,
  readRoomCodeFromSearch,
  secureRandom,
} from './roomCode';
import { pickQuestionIds, shuffle } from './shuffle';

/** RNG deterministik untuk tes. */
const sequence = (...values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length] ?? 0;
};

describe('kode room', () => {
  it('generateRoomCode: 6 karakter dari alfabet tanpa karakter mirip', () => {
    for (let i = 0; i < 200; i += 1) {
      const code = generateRoomCode();
      expect(code).toHaveLength(ROOM_CODE_LENGTH);
      expect(isValidRoomCode(code)).toBe(true);
      expect(code).not.toMatch(/[01OIL]/);
    }
  });

  it('generateRoomCode memakai RNG yang diberikan, termasuk nilai di batas', () => {
    expect(generateRoomCode(() => 0)).toBe('AAAAAA');
    expect(generateRoomCode(() => 0.999999)).toBe('999999');
    expect(generateRoomCode(() => 1)).toBe('999999');
  });

  it('secureRandom ada di rentang [0, 1)', () => {
    for (let i = 0; i < 100; i += 1) {
      const n = secureRandom();
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(1);
    }
  });

  it('normalizeRoomCode & isValidRoomCode', () => {
    expect(normalizeRoomCode(' k7m-2qx ')).toBe('K7M2QX');
    expect(isValidRoomCode('K7M2QX')).toBe(true);
    expect(isValidRoomCode('K7M2Q')).toBe(false);
    expect(isValidRoomCode('K7M2QO')).toBe(false); // O tidak ada di alfabet
    expect(isValidRoomCode('k7m2qx')).toBe(false);
    expect(ROOM_CODE_ALPHABET).toHaveLength(31);
  });

  it('readRoomCodeFromSearch & buildInviteUrl', () => {
    expect(readRoomCodeFromSearch('?room=k7m2qx')).toBe('K7M2QX');
    expect(readRoomCodeFromSearch('?room=INVALID0')).toBeNull();
    expect(readRoomCodeFromSearch('?x=1')).toBeNull();
    expect(buildInviteUrl('https://kuis.app/', 'K7M2QX')).toBe('https://kuis.app/?room=K7M2QX');
  });
});

describe('shuffle & pickQuestionIds', () => {
  it('shuffle tidak mengubah input dan isinya tetap sama', () => {
    const input = [1, 2, 3, 4, 5];
    const result = shuffle(input, sequence(0.1, 0.7, 0.3, 0.9));
    expect(input).toEqual([1, 2, 3, 4, 5]);
    expect([...result].sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it('shuffle deterministik untuk RNG yang sama', () => {
    const a = shuffle(['a', 'b', 'c', 'd'], sequence(0.5, 0.2, 0.8));
    const b = shuffle(['a', 'b', 'c', 'd'], sequence(0.5, 0.2, 0.8));
    expect(a).toEqual(b);
  });

  it('shuffle aman untuk RNG bernilai 1 dan array pendek', () => {
    expect(shuffle(['x', 'y'], () => 1).sort()).toEqual(['x', 'y']);
    expect(shuffle([], () => 0.5)).toEqual([]);
  });

  it('pickQuestionIds mengambil sejumlah id unik dari kategori', () => {
    const category: Category = {
      id: 'santai',
      name: 'Santai',
      description: '',
      questions: Array.from({ length: 12 }, (_, i) => ({
        id: `santai-${i}`,
        text: '{subjek}',
        options: [],
      })),
    };
    const picked = pickQuestionIds(category, 10);
    expect(picked).toHaveLength(10);
    expect(new Set(picked).size).toBe(10);
    expect(pickQuestionIds(category)).toHaveLength(10);
  });
});
