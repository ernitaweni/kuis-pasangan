import { describe, expect, it } from 'vitest';
import rawBank from '@/data/questions.json';
import type { QuestionBank } from '@/types';
import { CATEGORY_IDS, QUESTIONS_PER_ROUND } from './constants';
import {
  QuestionBankError,
  buildQuestionIndex,
  findTokens,
  getCategory,
  parseQuestionBank,
} from './questionBank';

/** Bentuk data mentah yang longgar, supaya kasus uji bisa merusaknya dengan sengaja. */
type OptionFixture = { id: string; text: string };
type QuestionFixture = { id: string; text: string; options: OptionFixture[] };
type CategoryFixture = {
  id: string;
  name: string;
  description: string;
  questions: QuestionFixture[];
};
type Fixture = { version: number; categories: CategoryFixture[] };
type UnknownBank = { categories: unknown };

/** Bank minimal yang valid: 3 kategori × 10 soal. Diubah per kasus uji. */
function makeBank(): Fixture {
  return {
    version: 1,
    categories: CATEGORY_IDS.map((id) => ({
      id,
      name: `Kategori ${id}`,
      description: 'Deskripsi',
      questions: Array.from({ length: QUESTIONS_PER_ROUND }, (_, i) => ({
        id: `${id}-${String(i + 1).padStart(2, '0')}`,
        text: `Soal ${i + 1} tentang {subjek}?`,
        options: ['a', 'b', 'c', 'd'].map((o) => ({ id: o, text: `Opsi ${o}` })),
      })),
    })),
  };
}

const firstCategory = (bank: Fixture) => bank.categories[0] as CategoryFixture;
const firstQuestion = (bank: Fixture) => firstCategory(bank).questions[0] as QuestionFixture;

function errorOf(raw: unknown): QuestionBankError {
  try {
    parseQuestionBank(raw);
  } catch (error) {
    if (error instanceof QuestionBankError) return error;
    throw error;
  }
  throw new Error('parseQuestionBank seharusnya melempar QuestionBankError');
}

describe('questions.json (bank soal asli)', () => {
  const bank = parseQuestionBank(rawBank);

  it('lolos validasi dengan 3 kategori, masing-masing minimal 10 soal', () => {
    expect(bank.categories.map((c) => c.id)).toEqual([...CATEGORY_IDS]);
    for (const category of bank.categories) {
      expect(category.questions.length).toBeGreaterThanOrEqual(QUESTIONS_PER_ROUND);
    }
  });

  it('setiap id soal unik', () => {
    const ids = bank.categories.flatMap((c) => c.questions.map((q) => q.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('opsi jawaban tidak memakai "kamu" atau "aku" (rancu saat dibaca dari dua sisi)', () => {
    const offending = bank.categories
      .flatMap((c) => c.questions.flatMap((q) => q.options.map((o) => `${q.id}: ${o.text}`)))
      .filter((line) => /\b(kamu|aku)\b/i.test(line.split(': ')[1] ?? ''));
    expect(offending).toEqual([]);
  });
});

describe('parseQuestionBank menolak data rusak', () => {
  it('menolak input yang bukan objek', () => {
    expect(errorOf(null).path).toBe('bank');
    expect(errorOf([]).path).toBe('bank');
  });

  it.each<[string, (bank: Fixture) => void, string]>([
    ['versi bukan bilangan bulat positif', (b) => void (b.version = 0), 'bank.version'],
    ['categories bukan array', (b) => void ((b as UnknownBank).categories = {}), 'bank.categories'],
    ['kategori hilang', (b) => void b.categories.pop(), 'categories'],
    ['id kategori tidak dikenal', (b) => void (firstCategory(b).id = 'random'), 'categories[0].id'],
    [
      'nama kategori kosong',
      (b) => void ((b.categories[0] as { name: string }).name = ' '),
      'categories[0].name',
    ],
    [
      'soal kurang dari 10',
      (b) => void firstCategory(b).questions.pop(),
      'categories[0].questions',
    ],
    [
      'soal bukan objek',
      (b) => void (firstCategory(b).questions[0] = 'x' as never),
      'categories[0].questions[0]',
    ],
    ['format id soal salah', (b) => void (firstQuestion(b).id = 'santai-1'), 'questions[0].id'],
    [
      'id soal dipakai dua kali',
      (b) => void ((firstCategory(b).questions[1] as QuestionFixture).id = 'santai-01'),
      'categories',
    ],
    [
      'token tidak dikenal',
      (b) => void (firstQuestion(b).text = 'Apa kata {nama}?'),
      'questions[0].text',
    ],
    [
      'teks soal tanpa token',
      (b) => void (firstQuestion(b).text = 'Apa kabar?'),
      'questions[0].text',
    ],
    [
      'teks soal diawali token',
      (b) => void (firstQuestion(b).text = '{subjek} suka apa?'),
      'questions[0].text',
    ],
    ['jumlah opsi bukan 4', (b) => void firstQuestion(b).options.pop(), 'questions[0].options'],
    [
      'opsi bukan array',
      (b) => void ((firstQuestion(b) as { options: unknown }).options = 'a'),
      'questions[0].options',
    ],
    [
      'urutan id opsi salah',
      (b) => void ((firstQuestion(b).options[0] as { id: string }).id = 'b'),
      'options[0].id',
    ],
    [
      'opsi memakai token',
      (b) => void ((firstQuestion(b).options[2] as { text: string }).text = 'Mirip {subjek}'),
      'options[2].text',
    ],
    [
      'opsi kembar',
      (b) => void ((firstQuestion(b).options[3] as { text: string }).text = 'opsi A'),
      'questions[0].options',
    ],
  ])('menolak: %s', (_label, mutate, expectedPath) => {
    const bank = makeBank();
    mutate(bank);
    expect(errorOf(bank).path).toContain(expectedPath);
  });
});

describe('helper bank soal', () => {
  const bank = parseQuestionBank(makeBank());

  it('findTokens mengambil semua nama token', () => {
    expect(findTokens('Lagu favorit{milik}, kata {subjek}?')).toEqual(['milik', 'subjek']);
    expect(findTokens('Tanpa token')).toEqual([]);
  });

  it('getCategory mengembalikan kategori, atau melempar jika tidak ada', () => {
    expect(getCategory(bank, 'deep-talk').id).toBe('deep-talk');
    const empty: QuestionBank = { version: 1, categories: [] };
    expect(() => getCategory(empty, 'santai')).toThrowError(QuestionBankError);
  });

  it('buildQuestionIndex memetakan setiap id soal', () => {
    const index = buildQuestionIndex(bank);
    expect(index.size).toBe(CATEGORY_IDS.length * QUESTIONS_PER_ROUND);
    expect(index.get('kebiasaan-07')?.text).toBe('Soal 7 tentang {subjek}?');
  });
});
