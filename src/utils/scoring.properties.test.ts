/**
 * Test properti untuk skor dan pencocokan jawaban (Fase 5).
 *
 * scoring.test.ts menguji contoh-contoh spesifik. File ini menguji ATURAN yang harus berlaku
 * untuk input apa pun: ratusan ronde acak dari bank soal sungguhan, dibuat dengan PRNG ber-seed
 * sehingga setiap kegagalan bisa diulang persis (seed-nya ikut tercetak di nama test).
 * Perhitungan di tiap HP disimulasikan persis seperti layar Kuis (skor berjalan per soal) dan
 * layar Hasil (urutan pembanding dari getAnswerOrder).
 */
import { describe, expect, it } from 'vitest';
import { QUESTION_BANK } from '@/data/questionBank';
import type { AnswerMap, GameMode, QuestionId, RoomMetaDoc, RoomSettingsDoc, Uid } from '@/types';
import { CATEGORY_IDS, OPTION_IDS, QUESTIONS_PER_ROUND, TALKING_POINTS_MAX } from './constants';
import { revealedQuestionIds } from './phase';
import { getCategory } from './questionBank';
import {
  RESULT_TIERS,
  buildResult,
  compareAnswers,
  getAnswerOrder,
  getTier,
  toPercent,
} from './scoring';
import { pickQuestionIds } from './shuffle';

const GAMES = 300;
const SEEDS = Array.from({ length: GAMES }, (_, i) => i + 1);

/** mulberry32: PRNG kecil dan deterministik. Seed yang sama selalu menghasilkan ronde yang sama. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(items: readonly T[], random: () => number): T {
  const item = items[Math.floor(random() * items.length)];
  if (item === undefined) throw new Error('daftar kosong');
  return item;
}

const HOST: Uid = 'uid-host';
const GUEST: Uid = 'uid-tamu';
const META: RoomMetaDoc = {
  hostUid: HOST,
  hostName: 'Sari',
  guestUid: GUEST,
  createdAt: 0,
  schemaVersion: 1,
};

interface Round {
  questionIds: QuestionId[];
  host: AnswerMap;
  guest: AnswerMap;
  settings: RoomSettingsDoc;
}

/**
 * Satu ronde acak: kategori, 10 soal, mode, dan siapa yang ditebak diacak. Tingkat kecocokan
 * juga diacak per ronde, jadi ada ronde yang hampir semua beda sampai yang semua cocok.
 */
function randomRound(seed: number): Round {
  const random = seeded(seed);
  const categoryId = pick(CATEGORY_IDS, random);
  const questionIds = pickQuestionIds(
    getCategory(QUESTION_BANK, categoryId),
    QUESTIONS_PER_ROUND,
    random,
  );
  const sameChance = random();
  const host: AnswerMap = {};
  const guest: AnswerMap = {};
  for (const id of questionIds) {
    const hostAnswer = pick(OPTION_IDS, random);
    host[id] = hostAnswer;
    guest[id] = random() < sameChance ? hostAnswer : pick(OPTION_IDS, random);
  }
  const mode: GameMode = random() < 0.5 ? 'guess' : 'match';
  const settings: RoomSettingsDoc = { categoryId, mode, targetUid: random() < 0.5 ? HOST : GUEST };
  return { questionIds, host, guest, settings };
}

/** Jawaban yang dilihat satu HP: miliknya sendiri dan milik pasangan. */
function perspective(round: Round, myUid: Uid) {
  const mine = myUid === HOST ? round.host : round.guest;
  const partner = myUid === HOST ? round.guest : round.host;
  return { mine, partner };
}

/** Persis seperti ResultView: jawaban dipetakan ke urutan pembanding lewat uid. */
function resultOnDevice(round: Round, myUid: Uid) {
  const { mine, partner } = perspective(round, myUid);
  const order = getAnswerOrder(round.settings, META);
  if (!order) throw new Error('Tamu belum bergabung');
  const answersOf = (uid: Uid) => (uid === myUid ? mine : partner);
  return buildResult({
    questionIds: round.questionIds,
    first: answersOf(order.firstUid),
    second: answersOf(order.secondUid),
    mode: round.settings.mode,
  });
}

/** Persis seperti QuizView: "Cocok X dari Y" setelah `opened` soal pertama terbuka. */
function runningScore(round: Round, myUid: Uid, opened: number) {
  const { mine, partner } = perspective(round, myUid);
  const upTo = (answers: AnswerMap) =>
    Object.fromEntries(round.questionIds.slice(0, opened).map((id) => [id, answers[id]]));
  const mineSoFar: AnswerMap = upTo(mine);
  const partnerSoFar: AnswerMap = upTo(partner);
  const revealed = revealedQuestionIds(round.questionIds, mineSoFar, partnerSoFar);
  return {
    matches: revealed.filter((id) => mineSoFar[id] === partnerSoFar[id]).length,
    revealed: revealed.length,
  };
}

describe('properti: hasil di dua HP', () => {
  it(`identik di HP Host dan HP Tamu (${GAMES} ronde acak)`, () => {
    for (const seed of SEEDS) {
      const round = randomRound(seed);
      expect(resultOnDevice(round, GUEST), `seed ${seed}`).toEqual(resultOnDevice(round, HOST));
    }
  });

  it('Cocok/Beda per soal saat terbuka sama di kedua HP dan sama dengan baris di Hasil', () => {
    for (const seed of SEEDS) {
      const round = randomRound(seed);
      const rows = resultOnDevice(round, HOST).rows;
      round.questionIds.forEach((id, index) => {
        // Rumus di layar soal (PlayViews): jawabanku ada dan sama dengan jawaban pasangan.
        const onHost = round.host[id] !== undefined && round.host[id] === round.guest[id];
        const onGuest = round.guest[id] !== undefined && round.guest[id] === round.host[id];
        expect(onGuest, `seed ${seed}, soal ${index + 1}`).toBe(onHost);
        expect(rows[index]?.isMatch, `seed ${seed}, soal ${index + 1}`).toBe(onHost);
      });
    }
  });

  it('menukar peran (Main lagi) tidak mengubah skor, hanya urutan pembanding', () => {
    for (const seed of SEEDS) {
      const round = randomRound(seed);
      if (round.settings.mode !== 'guess') continue;
      const swapped: Round = {
        ...round,
        settings: {
          ...round.settings,
          targetUid: round.settings.targetUid === HOST ? GUEST : HOST,
        },
      };
      const before = resultOnDevice(round, HOST);
      const after = resultOnDevice(swapped, HOST);
      expect(after.percent, `seed ${seed}`).toBe(before.percent);
      expect(after.rows.map((r) => [r.second, r.first])).toEqual(
        before.rows.map((r) => [r.first, r.second]),
      );
    }
  });
});

describe('properti: skor berjalan per soal', () => {
  it('"Cocok X dari Y" tidak pernah turun, naik tepat saat soal cocok, dan berakhir di skor akhir', () => {
    for (const seed of SEEDS) {
      const round = randomRound(seed);
      const final = resultOnDevice(round, HOST);
      for (const device of [HOST, GUEST]) {
        let previous = runningScore(round, device, 0);
        expect(previous).toEqual({ matches: 0, revealed: 0 });
        round.questionIds.forEach((_, index) => {
          const now = runningScore(round, device, index + 1);
          const gained = final.rows[index]?.isMatch ? 1 : 0;
          expect(now.revealed, `seed ${seed}, soal ${index + 1}`).toBe(index + 1);
          expect(now.matches, `seed ${seed}, soal ${index + 1}`).toBe(previous.matches + gained);
          previous = now;
        });
        expect(previous.matches, `seed ${seed}`).toBe(final.matches);
      }
    }
  });
});

describe('properti: pencocokan jawaban', () => {
  it('simetris: menukar jawaban kedua pemain tidak mengubah Cocok/Beda', () => {
    for (const seed of SEEDS) {
      const { questionIds, host, guest } = randomRound(seed);
      const ab = compareAnswers(questionIds, host, guest).map((r) => r.isMatch);
      const ba = compareAnswers(questionIds, guest, host).map((r) => r.isMatch);
      expect(ba, `seed ${seed}`).toEqual(ab);
    }
  });

  it('soal yang belum dijawab salah satu atau kedua pemain tidak pernah dihitung cocok', () => {
    for (const seed of SEEDS) {
      const random = seeded(seed);
      const { questionIds, host, guest } = randomRound(seed);
      const holes = (answers: AnswerMap): AnswerMap =>
        Object.fromEntries(Object.entries(answers).filter(() => random() < 0.7));
      const a = holes(host);
      const b = holes(guest);
      for (const row of compareAnswers(questionIds, a, b)) {
        if (row.first === undefined || row.second === undefined) {
          expect(row.isMatch, `seed ${seed}, ${row.questionId}`).toBe(false);
        }
      }
    }
  });

  it('hanya opsi yang persis sama yang cocok (a–d)', () => {
    for (const first of OPTION_IDS) {
      for (const second of OPTION_IDS) {
        const [row] = compareAnswers(['q'], { q: first }, { q: second });
        expect(row?.isMatch).toBe(first === second);
      }
    }
  });
});

describe('properti: persen, tingkat, dan bahan obrolan', () => {
  it('persen = round(cocok ÷ total × 100), dalam 0–100, dan tidak pernah turun saat cocok bertambah', () => {
    for (let total = 1; total <= 20; total += 1) {
      let previous = -1;
      for (let matches = 0; matches <= total; matches += 1) {
        const percent = toPercent(matches, total);
        expect(percent).toBe(Math.round((matches / total) * 100));
        expect(percent).toBeGreaterThanOrEqual(0);
        expect(percent).toBeLessThanOrEqual(100);
        expect(percent).toBeGreaterThanOrEqual(previous);
        previous = percent;
      }
    }
  });

  it('dengan 10 soal, setiap jawaban cocok menambah tepat 10%', () => {
    for (let matches = 0; matches <= 10; matches += 1) {
      expect(toPercent(matches, 10)).toBe(matches * 10);
    }
  });

  it('tingkat hasil tidak pernah turun saat persen naik, di kedua mode', () => {
    for (const mode of Object.keys(RESULT_TIERS) as GameMode[]) {
      let previous = 0;
      for (let percent = 0; percent <= 100; percent += 1) {
        const { level } = getTier(percent, mode);
        expect(level, `${mode} ${percent}%`).toBeGreaterThanOrEqual(previous);
        previous = level;
      }
    }
  });

  it(`bahan obrolan = maksimal ${TALKING_POINTS_MAX} soal beda pertama, sesuai urutan soal`, () => {
    for (const seed of SEEDS) {
      const result = resultOnDevice(randomRound(seed), HOST);
      const expected = result.rows
        .filter((row) => !row.isMatch)
        .slice(0, TALKING_POINTS_MAX)
        .map((row) => row.questionId);
      expect(
        result.talkingPoints.map((row) => row.questionId),
        `seed ${seed}`,
      ).toEqual(expected);
      expect(result.matches + result.rows.filter((r) => !r.isMatch).length).toBe(result.total);
    }
  });

  it('ronde acak mencakup semua tingkat hasil (data uji cukup beragam)', () => {
    const levels = new Set(SEEDS.map((seed) => resultOnDevice(randomRound(seed), HOST).tier.level));
    expect([...levels].sort()).toEqual([1, 2, 3, 4]);
  });
});
