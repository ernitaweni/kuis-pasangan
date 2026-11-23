import type {
  AnswerMap,
  ComparisonRow,
  GameMode,
  GameResult,
  QuestionId,
  ResultTier,
  RoomMetaDoc,
  RoomSettingsDoc,
  ScoreSummary,
  Uid,
} from '@/types';
import { TALKING_POINTS_MAX } from './constants';

/**
 * Ringkasan karakter per mode, dari tingkat tertinggi ke terendah.
 * Semua teks sengaja positif: tidak ada hasil yang "buruk" (PRD §4.6).
 */
export const RESULT_TIERS: Readonly<Record<GameMode, readonly ResultTier[]>> = {
  guess: [
    {
      level: 4,
      minPercent: 90,
      title: 'Pembaca pikiran',
      description:
        'Hampir semua tebakan tepat. Kalian hafal satu sama lain sampai ke hal paling kecil.',
    },
    {
      level: 3,
      minPercent: 70,
      title: 'Partner sejati',
      description: 'Kalian hafal kebiasaan kecil satu sama lain, termasuk yang jarang diomongin.',
    },
    {
      level: 2,
      minPercent: 40,
      title: 'Masih banyak kejutan',
      description: 'Sebagian sudah hafal, sebagian lagi bisa jadi bahan cerita malam ini.',
    },
    {
      level: 1,
      minPercent: 0,
      title: 'Petualangan baru dimulai',
      description:
        'Banyak hal baru yang bisa kalian kenali. Mulai dari jawaban yang beda di bawah, yuk.',
    },
  ],
  match: [
    {
      level: 4,
      minPercent: 90,
      title: 'Belahan jiwa',
      description: 'Jawaban kalian hampir selalu sama. Satu selera, satu cara pandang.',
    },
    {
      level: 3,
      minPercent: 70,
      title: 'Satu frekuensi',
      description: 'Banyak kesamaan, dengan sedikit beda yang bikin obrolan tetap seru.',
    },
    {
      level: 2,
      minPercent: 40,
      title: 'Saling melengkapi',
      description: 'Kesamaan dan perbedaan kalian seimbang. Pas untuk saling belajar.',
    },
    {
      level: 1,
      minPercent: 0,
      title: 'Beda itu seru',
      description:
        'Kalian melihat banyak hal dari sisi berbeda. Itu yang bikin obrolan nggak pernah habis.',
    },
  ],
};

/** Jawaban kosong di salah satu sisi dihitung tidak cocok. */
export function compareAnswers(
  questionIds: readonly QuestionId[],
  first: AnswerMap,
  second: AnswerMap,
): ComparisonRow[] {
  return questionIds.map((questionId) => {
    const a = first[questionId];
    const b = second[questionId];
    return { questionId, first: a, second: b, isMatch: a !== undefined && a === b };
  });
}

/** round(matches / total × 100), dibatasi 0–100. total ≤ 0 → 0. */
export function toPercent(matches: number, total: number): number {
  if (!Number.isFinite(total) || !Number.isFinite(matches) || total <= 0) return 0;
  const clamped = Math.min(Math.max(matches, 0), total);
  return Math.round((clamped / total) * 100);
}

export function summarize(rows: readonly ComparisonRow[]): ScoreSummary {
  const matches = rows.filter((row) => row.isMatch).length;
  return { matches, total: rows.length, percent: toPercent(matches, rows.length) };
}

export function getTier(percent: number, mode: GameMode): ResultTier {
  const tiers = RESULT_TIERS[mode];
  const found = tiers.find((tier) => percent >= tier.minPercent);
  if (found) return found;
  // Persentase negatif/NaN tidak mungkin dari toPercent, tapi tetap aman: pakai tingkat terendah.
  const lowest = tiers[tiers.length - 1];
  if (!lowest) throw new Error(`RESULT_TIERS.${mode} kosong`);
  return lowest;
}

/** Soal yang tidak cocok, sesuai urutan soal, untuk bagian "Ngobrolin ini, yuk". */
export function pickTalkingPoints(
  rows: readonly ComparisonRow[],
  max: number = TALKING_POINTS_MAX,
): ComparisonRow[] {
  return rows.filter((row) => !row.isMatch).slice(0, Math.max(max, 0));
}

export function buildResult(input: {
  questionIds: readonly QuestionId[];
  first: AnswerMap;
  second: AnswerMap;
  mode: GameMode;
}): GameResult {
  const rows = compareAnswers(input.questionIds, input.first, input.second);
  const summary = summarize(rows);
  return {
    ...summary,
    rows,
    tier: getTier(summary.percent, input.mode),
    talkingPoints: pickTalkingPoints(rows),
  };
}

/**
 * Urutan pembanding di layar Hasil.
 * guess: [Yang Ditebak, Penebak] · match: [Host, Tamu]. null jika Tamu belum ada.
 */
export function getAnswerOrder(
  settings: RoomSettingsDoc,
  meta: RoomMetaDoc,
): { firstUid: Uid; secondUid: Uid } | null {
  const { hostUid, guestUid } = meta;
  if (guestUid === undefined) return null;
  if (settings.mode === 'match') return { firstUid: hostUid, secondUid: guestUid };
  const firstUid = settings.targetUid === guestUid ? guestUid : hostUid;
  return { firstUid, secondUid: firstUid === hostUid ? guestUid : hostUid };
}
