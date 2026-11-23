import type { GameMode, Perspective, Uid } from '@/types';
import { normalizeName } from './validation';

const FALLBACK_SUBJECT = 'pasanganmu';

/**
 * Mode guess: Yang Ditebak membaca versi "kamu", Penebak membaca versi nama.
 * Mode match: keduanya menjawab tentang diri sendiri.
 */
export function getPerspective(mode: GameMode, viewerUid: Uid, targetUid: Uid): Perspective {
  return mode === 'guess' && viewerUid !== targetUid ? 'partner' : 'self';
}

/**
 * Mengganti token {subjek} dan {milik}, lalu membesarkan huruf pertama.
 * Penggantinya lewat fungsi, agar nama berisi "$&" atau "$1" tidak ditafsirkan sebagai pola.
 */
export function renderQuestionText(
  template: string,
  perspective: Perspective,
  subjectName: string,
): string {
  const name = normalizeName(subjectName) || FALLBACK_SUBJECT;
  const subject = perspective === 'self' ? 'kamu' : name;
  const possessive = perspective === 'self' ? 'mu' : ` ${name}`;
  const text = template
    .replaceAll('{subjek}', () => subject)
    .replaceAll('{milik}', () => possessive);
  return text.charAt(0).toLocaleUpperCase('id-ID') + text.slice(1);
}

/**
 * Kalimat saat satu soal terbuka. Tidak pernah memakai kata "salah" (docs/02 §6.5).
 * `viewerIsTarget` hanya berarti di mode guess.
 */
export function revealMessage(input: {
  mode: GameMode;
  isMatch: boolean;
  viewerIsTarget: boolean;
  targetName: string;
  partnerName: string;
}): string {
  // Nama bisa berada di awal kalimat ("Beda. Pasanganmu memilih…"), jadi cadangannya berhuruf besar.
  const target = normalizeName(input.targetName) || 'Pasanganmu';
  const partner = normalizeName(input.partnerName) || 'Pasanganmu';
  if (input.mode === 'match') {
    return input.isMatch
      ? 'Cocok! Kalian memilih jawaban yang sama.'
      : 'Beda. Kalian memilih jawaban yang berbeda.';
  }
  if (input.viewerIsTarget) {
    return input.isMatch
      ? `Cocok! ${partner} menebak dengan tepat.`
      : `Beda. Tebakan ${partner} belum tepat.`;
  }
  return input.isMatch ? 'Cocok! Tebakanmu tepat.' : `Beda. ${target} memilih jawaban lain.`;
}

/** Petunjuk kecil di atas soal. */
export function questionHint(
  mode: GameMode,
  perspective: Perspective,
  targetName: string,
  partnerName: string,
): string {
  if (mode === 'match') return 'Jawab tentang dirimu.';
  if (perspective === 'partner')
    return `Tebak jawaban ${normalizeName(targetName) || FALLBACK_SUBJECT}`;
  return `Jawab tentang dirimu. ${normalizeName(partnerName) || 'Pasanganmu'} sedang menebak.`;
}
