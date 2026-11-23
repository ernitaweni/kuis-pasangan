import type { Category, QuestionId } from '@/types';
import { QUESTIONS_PER_ROUND } from './constants';

/** Fisher–Yates. Mengembalikan salinan baru; `random` bisa diganti agar tes deterministik. */
export function shuffle<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.min(Math.floor(random() * (i + 1)), i);
    [result[i], result[j]] = [result[j] as T, result[i] as T];
  }
  return result;
}

/** Id soal acak untuk satu ronde. Dipanggil Host saat menekan Mulai. */
export function pickQuestionIds(
  category: Category,
  count: number = QUESTIONS_PER_ROUND,
  random: () => number = Math.random,
): QuestionId[] {
  return shuffle(
    category.questions.map((q) => q.id),
    random,
  ).slice(0, count);
}
