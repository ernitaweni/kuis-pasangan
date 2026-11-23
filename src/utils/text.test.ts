import { describe, expect, it } from 'vitest';
import { getPerspective, questionHint, renderQuestionText, revealMessage } from './questionText';
import { buildShareText } from './share';
import { NAME_ERROR_MESSAGES, namesEqual, normalizeName, validateName } from './validation';

describe('normalizeName & validateName', () => {
  it('merapikan spasi dan Unicode', () => {
    expect(normalizeName('  Budi   Santoso ')).toBe('Budi Santoso');
    expect(normalizeName('José')).toBe('José');
  });

  it('kosong, terlalu panjang, sama dengan pasangan', () => {
    expect(validateName('   ')).toBe('empty');
    expect(validateName('a'.repeat(21))).toBe('too-long');
    expect(validateName('a'.repeat(20))).toBeNull();
    expect(validateName(' ayu ', 'AYU')).toBe('same-as-partner');
    expect(validateName('Ayu', 'Ayu Lestari')).toBeNull();
  });

  it('namesEqual tidak peka huruf besar/kecil dan spasi', () => {
    expect(namesEqual('Rina  Putri', ' rina putri')).toBe(true);
  });

  it('setiap jenis error punya pesan', () => {
    expect(Object.keys(NAME_ERROR_MESSAGES).sort()).toEqual([
      'empty',
      'same-as-partner',
      'too-long',
    ]);
  });
});

describe('getPerspective', () => {
  it('guess: Penebak membaca versi nama, Yang Ditebak versi "kamu"', () => {
    expect(getPerspective('guess', 'G', 'H')).toBe('partner');
    expect(getPerspective('guess', 'H', 'H')).toBe('self');
  });

  it('match: selalu "kamu"', () => {
    expect(getPerspective('match', 'G', 'H')).toBe('self');
  });
});

describe('renderQuestionText', () => {
  it('mengganti {subjek}', () => {
    expect(renderQuestionText('Kalau bete, {subjek} biasanya…', 'self', 'Sari')).toBe(
      'Kalau bete, kamu biasanya…',
    );
    expect(renderQuestionText('Kalau bete, {subjek} biasanya…', 'partner', 'Sari')).toBe(
      'Kalau bete, Sari biasanya…',
    );
  });

  it('mengganti {milik}: menempel untuk "mu", berspasi untuk nama', () => {
    expect(renderQuestionText('Lagu favorit{milik}?', 'self', 'Sari')).toBe('Lagu favoritmu?');
    expect(renderQuestionText('Lagu favorit{milik}?', 'partner', 'Sari')).toBe(
      'Lagu favorit Sari?',
    );
  });

  it('membesarkan huruf pertama', () => {
    expect(renderQuestionText('{subjek} suka apa?', 'self', 'X')).toBe('Kamu suka apa?');
  });

  it('nama berisi "$&" atau "$1" tidak ditafsirkan sebagai pola', () => {
    expect(renderQuestionText('Hai {subjek}', 'partner', 'A$&B$1')).toBe('Hai A$&B$1');
  });

  it('nama kosong diganti "pasanganmu"', () => {
    expect(renderQuestionText('Kalau bete, {subjek} biasanya…', 'partner', '  ')).toBe(
      'Kalau bete, pasanganmu biasanya…',
    );
  });
});

describe('revealMessage', () => {
  const base = { targetName: 'Sari', partnerName: 'Bima' };

  it('mode guess dari sisi Penebak dan Yang Ditebak', () => {
    expect(revealMessage({ ...base, mode: 'guess', isMatch: true, viewerIsTarget: false })).toBe(
      'Cocok! Tebakanmu tepat.',
    );
    expect(revealMessage({ ...base, mode: 'guess', isMatch: false, viewerIsTarget: false })).toBe(
      'Beda. Sari memilih jawaban lain.',
    );
    expect(revealMessage({ ...base, mode: 'guess', isMatch: true, viewerIsTarget: true })).toBe(
      'Cocok! Bima menebak dengan tepat.',
    );
    expect(revealMessage({ ...base, mode: 'guess', isMatch: false, viewerIsTarget: true })).toBe(
      'Beda. Tebakan Bima belum tepat.',
    );
  });

  it('mode match', () => {
    expect(revealMessage({ ...base, mode: 'match', isMatch: true, viewerIsTarget: true })).toBe(
      'Cocok! Kalian memilih jawaban yang sama.',
    );
    expect(revealMessage({ ...base, mode: 'match', isMatch: false, viewerIsTarget: false })).toBe(
      'Beda. Kalian memilih jawaban yang berbeda.',
    );
  });

  it('nama kosong diganti kata umum, dan tidak pernah memakai kata "salah"', () => {
    const messages = [true, false].flatMap((isMatch) =>
      [true, false].map((viewerIsTarget) =>
        revealMessage({ mode: 'guess', isMatch, viewerIsTarget, targetName: ' ', partnerName: '' }),
      ),
    );
    expect(messages).toContain('Beda. Pasanganmu memilih jawaban lain.');
    expect(messages).toContain('Cocok! Pasanganmu menebak dengan tepat.');
    for (const message of messages) expect(message).not.toMatch(/\bsalah\b/i);
  });
});

describe('questionHint', () => {
  it('sesuai mode dan sudut pandang', () => {
    expect(questionHint('match', 'self', 'A', 'B')).toBe('Jawab tentang dirimu.');
    expect(questionHint('guess', 'partner', 'Sari', 'Bima')).toBe('Tebak jawaban Sari');
    expect(questionHint('guess', 'self', 'Sari', 'Bima')).toBe(
      'Jawab tentang dirimu. Bima sedang menebak.',
    );
    expect(questionHint('guess', 'self', 'Sari', '')).toBe(
      'Jawab tentang dirimu. Pasanganmu sedang menebak.',
    );
  });
});

describe('buildShareText', () => {
  const text = buildShareText({
    names: ['  Sari ', 'Bima'],
    categoryName: 'Santai',
    mode: 'guess',
    percent: 80,
    tierTitle: 'Partner sejati',
    url: 'https://contoh.app',
  });

  it('memuat nama, persen, tingkat, kategori, mode, dan link', () => {
    expect(text).toContain('Sari dan Bima cocok 80%');
    expect(text).toContain('“Partner sejati”');
    expect(text).toContain('kategori Santai, mode Tebak Aku');
    expect(text).toContain('https://contoh.app');
  });

  it('nama kosong tidak membuat teks janggal', () => {
    const t = buildShareText({
      names: ['', 'Bima'],
      categoryName: 'Santai',
      mode: 'match',
      percent: 0,
      tierTitle: 'X',
      url: 'u',
    });
    expect(t).toContain('Pasangan dan Bima cocok 0%');
  });
});
