import type {
  Category,
  CategoryId,
  Question,
  QuestionBank,
  QuestionId,
  QuestionOption,
} from '@/types';
import { CATEGORY_IDS, OPTION_IDS, QUESTION_TOKENS, QUESTIONS_PER_ROUND } from './constants';
import { type UnknownRecord, isOneOf, isRecord } from './guards';

/** Kesalahan struktur bank soal. `path` menunjuk lokasinya, misalnya `categories[1].questions[3].text`. */
export class QuestionBankError extends Error {
  readonly path: string;

  constructor(path: string, problem: string) {
    super(`Bank soal tidak valid di ${path}: ${problem}`);
    this.name = 'QuestionBankError';
    this.path = path;
  }
}

const TOKEN_PATTERN = /\{([^{}]*)\}/g;
const KNOWN_TOKENS: ReadonlySet<string> = new Set(QUESTION_TOKENS);

function expectRecord(value: unknown, path: string): UnknownRecord {
  if (!isRecord(value)) throw new QuestionBankError(path, 'harus berupa objek');
  return value;
}

function expectText(obj: UnknownRecord, key: string, path: string): string {
  const value = obj[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new QuestionBankError(`${path}.${key}`, 'harus berupa teks yang tidak kosong');
  }
  return value;
}

function expectArray(obj: UnknownRecord, key: string, path: string): unknown[] {
  const value = obj[key];
  if (!Array.isArray(value)) throw new QuestionBankError(`${path}.${key}`, 'harus berupa array');
  return value;
}

/** Semua nama token di dalam teks, misalnya "Lagu favorit{milik}?" → ["milik"]. */
export function findTokens(text: string): string[] {
  return Array.from(text.matchAll(TOKEN_PATTERN), (match) => match[1] ?? '');
}

function parseOption(raw: unknown, index: number, path: string): QuestionOption {
  const obj = expectRecord(raw, path);
  const expectedId = OPTION_IDS[index];
  if (expectedId === undefined || obj.id !== expectedId) {
    throw new QuestionBankError(`${path}.id`, `harus "${expectedId ?? '?'}" (opsi berurutan a–d)`);
  }
  const text = expectText(obj, 'text', path);
  if (findTokens(text).length > 0) {
    throw new QuestionBankError(`${path}.text`, 'opsi jawaban tidak boleh memakai token');
  }
  return { id: expectedId, text };
}

function parseQuestion(raw: unknown, categoryId: CategoryId, path: string): Question {
  const obj = expectRecord(raw, path);

  const id = expectText(obj, 'id', path);
  if (!new RegExp(`^${categoryId}-\\d{2}$`).test(id)) {
    throw new QuestionBankError(`${path}.id`, `harus berformat "${categoryId}-NN", bukan "${id}"`);
  }

  const text = expectText(obj, 'text', path);
  const tokens = findTokens(text);
  const unknownToken = tokens.find((token) => !KNOWN_TOKENS.has(token));
  if (unknownToken !== undefined) {
    throw new QuestionBankError(`${path}.text`, `token {${unknownToken}} tidak dikenal`);
  }
  if (tokens.length === 0) {
    throw new QuestionBankError(`${path}.text`, 'harus memakai {subjek} atau {milik}');
  }
  if (text.startsWith('{')) {
    throw new QuestionBankError(`${path}.text`, 'tidak boleh diawali token');
  }

  const rawOptions = expectArray(obj, 'options', path);
  if (rawOptions.length !== OPTION_IDS.length) {
    throw new QuestionBankError(`${path}.options`, `harus tepat ${OPTION_IDS.length} opsi`);
  }
  const options = rawOptions.map((option, i) => parseOption(option, i, `${path}.options[${i}]`));

  const seen = new Set<string>();
  for (const option of options) {
    const key = option.text.trim().toLowerCase();
    if (seen.has(key)) {
      throw new QuestionBankError(`${path}.options`, `opsi "${option.text}" muncul dua kali`);
    }
    seen.add(key);
  }

  return { id, text, options };
}

function parseCategory(raw: unknown, path: string): Category {
  const obj = expectRecord(raw, path);

  if (!isOneOf(obj.id, CATEGORY_IDS)) {
    throw new QuestionBankError(`${path}.id`, `harus salah satu dari: ${CATEGORY_IDS.join(', ')}`);
  }
  const id = obj.id;
  const name = expectText(obj, 'name', path);
  const description = expectText(obj, 'description', path);

  const rawQuestions = expectArray(obj, 'questions', path);
  if (rawQuestions.length < QUESTIONS_PER_ROUND) {
    throw new QuestionBankError(
      `${path}.questions`,
      `minimal ${QUESTIONS_PER_ROUND} soal, baru ada ${rawQuestions.length}`,
    );
  }
  const questions = rawQuestions.map((q, i) => parseQuestion(q, id, `${path}.questions[${i}]`));

  return { id, name, description, questions };
}

/**
 * Memvalidasi data mentah (hasil import JSON) dan mengembalikan bank soal yang bertipe aman.
 * Melempar QuestionBankError dengan lokasi kesalahan jika ada yang tidak sesuai aturan.
 */
export function parseQuestionBank(raw: unknown): QuestionBank {
  const obj = expectRecord(raw, 'bank');

  const version = obj.version;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    throw new QuestionBankError('bank.version', 'harus bilangan bulat ≥ 1');
  }

  const categories = expectArray(obj, 'categories', 'bank').map((c, i) =>
    parseCategory(c, `categories[${i}]`),
  );

  for (const id of CATEGORY_IDS) {
    const count = categories.filter((c) => c.id === id).length;
    if (count !== 1) {
      throw new QuestionBankError('categories', `kategori "${id}" harus ada tepat satu kali`);
    }
  }

  const questionIds = new Set<QuestionId>();
  for (const category of categories) {
    for (const question of category.questions) {
      if (questionIds.has(question.id)) {
        throw new QuestionBankError('categories', `id soal "${question.id}" dipakai dua kali`);
      }
      questionIds.add(question.id);
    }
  }

  return { version, categories };
}

/** Kategori berdasarkan id. Bank yang lolos parseQuestionBank pasti memiliki semua kategori. */
export function getCategory(bank: QuestionBank, id: CategoryId): Category {
  const category = bank.categories.find((c) => c.id === id);
  if (!category) throw new QuestionBankError('categories', `kategori "${id}" tidak ditemukan`);
  return category;
}

/** Indeks id → soal, untuk mengubah daftar id soal dari room menjadi soal lengkap. */
export function buildQuestionIndex(bank: QuestionBank): ReadonlyMap<QuestionId, Question> {
  return new Map(bank.categories.flatMap((c) => c.questions.map((q) => [q.id, q] as const)));
}
