import type { GameMode } from '@/types';
import { MODE_LABELS } from './constants';
import { normalizeName } from './validation';

export interface ShareInput {
  names: readonly [string, string];
  categoryName: string;
  mode: GameMode;
  percent: number;
  tierTitle: string;
  url: string;
}

/** Teks untuk dibagikan (FR-17). Sengaja tanpa detail jawaban. */
export function buildShareText(input: ShareInput): string {
  const [a, b] = input.names.map((name) => normalizeName(name) || 'Pasangan');
  return [
    `Kuis Pasangan: ${a} dan ${b} cocok ${input.percent}%.`,
    `Hasilnya “${input.tierTitle}”, kategori ${input.categoryName}, mode ${MODE_LABELS[input.mode]}.`,
    `Coba juga bareng pasanganmu: ${input.url}`,
  ].join('\n');
}
