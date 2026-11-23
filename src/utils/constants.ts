import type { CategoryId, GameMode, OptionId } from '@/types';

export const QUESTIONS_PER_ROUND = 10;
export const NAME_MAX_LENGTH = 20;

export const ROOM_CODE_LENGTH = 6;
/** Tanpa 0/O dan 1/I/L agar tidak tertukar saat dibacakan lewat telepon. 31 karakter ≈ 887 juta kombinasi. */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const ROOM_TTL_MS = 24 * 60 * 60 * 1000;
export const CREATE_ROOM_MAX_RETRY = 5;

export const COUNTDOWN_MS = 3000;
export const HISTORY_MAX = 5;
export const TALKING_POINTS_MAX = 3;

/** Urutan tampilan kategori di UI. */
export const CATEGORY_IDS = [
  'santai',
  'deep-talk',
  'kebiasaan',
] as const satisfies readonly CategoryId[];

export const OPTION_IDS = ['a', 'b', 'c', 'd'] as const satisfies readonly OptionId[];

export const GAME_MODES = ['guess', 'match'] as const satisfies readonly GameMode[];

export const MODE_LABELS: Readonly<Record<GameMode, string>> = {
  guess: 'Tebak Aku',
  match: 'Kita Mirip?',
};

/** Token yang boleh dipakai di teks soal. */
export const QUESTION_TOKENS = ['subjek', 'milik'] as const;
