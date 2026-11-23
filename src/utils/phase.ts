import type {
  AnswerMap,
  JoinError,
  PlayerRole,
  ProgressDoc,
  QuestionId,
  QuestionStep,
  RoomMetaDoc,
  RoomPhase,
  RoomStateDoc,
  RoundId,
  Uid,
} from '@/types';
import { COUNTDOWN_MS, QUESTIONS_PER_ROUND, ROOM_TTL_MS } from './constants';

export function roundIdOf(round: number): RoundId {
  return `r${round}`;
}

export function isRoomExpired(createdAt: number, now: number): boolean {
  return now - createdAt >= ROOM_TTL_MS;
}

export type JoinAssessment =
  | { kind: 'member'; role: PlayerRole }
  | { kind: 'can-join' }
  | { kind: 'blocked'; error: JoinError };

/**
 * Bolehkah `myUid` masuk ke room ini? Anggota lama (misalnya setelah refresh) selalu boleh
 * masuk kembali selama room belum kedaluwarsa.
 */
export function assessJoin(
  meta: RoomMetaDoc | null,
  state: RoomStateDoc | null,
  myUid: Uid,
  now: number,
): JoinAssessment {
  if (!meta || !state) return { kind: 'blocked', error: 'not-found' };
  if (isRoomExpired(meta.createdAt, now)) return { kind: 'blocked', error: 'expired' };
  if (myUid === meta.hostUid) return { kind: 'member', role: 'host' };
  if (myUid === meta.guestUid) return { kind: 'member', role: 'guest' };
  if (state.status === 'closed') return { kind: 'blocked', error: 'closed' };
  if (meta.guestUid !== undefined) return { kind: 'blocked', error: 'full' };
  if (state.status !== 'lobby') return { kind: 'blocked', error: 'already-started' };
  return { kind: 'can-join' };
}

/** Soal yang sedang tampil di kedua HP: soal pertama yang belum disiapi KEDUA pemain. */
export function currentQuestionIndex(
  mine: ProgressDoc | undefined,
  partner: ProgressDoc | undefined,
): number {
  return Math.min(mine?.ready ?? 0, partner?.ready ?? 0);
}

export interface PhaseInput {
  createdAt: number;
  state: RoomStateDoc;
  mine?: ProgressDoc | undefined;
  partner?: ProgressDoc | undefined;
}

/** Inti state machine room (docs/02-system-design.md §3.2). `serverNow` = waktu server (ms). */
export function deriveRoomPhase(input: PhaseInput, serverNow: number): RoomPhase {
  const { createdAt, state, mine, partner } = input;
  if (state.status === 'closed') return 'closed';
  if (isRoomExpired(createdAt, serverNow)) return 'expired';
  if (state.status === 'lobby') return 'lobby';

  const total = state.questionIds?.length ?? QUESTIONS_PER_ROUND;
  if (total > 0 && currentQuestionIndex(mine, partner) >= total) return 'result';
  if (state.startedAt !== undefined && serverNow < state.startedAt + COUNTDOWN_MS) {
    return 'countdown';
  }
  return 'answering';
}

/**
 * Langkah di soal yang sedang tampil. null jika semua soal sudah dilewati (fase hasil).
 * "Pasangan sudah menjawab" dibaca dari progresnya, karena isi jawabannya masih dikunci Rules.
 */
export function deriveQuestionStep(input: {
  questionIds: readonly QuestionId[];
  myAnswers: AnswerMap;
  mine: ProgressDoc | undefined;
  partner: ProgressDoc | undefined;
}): QuestionStep | null {
  const index = currentQuestionIndex(input.mine, input.partner);
  const questionId = input.questionIds[index];
  if (questionId === undefined) return null;

  const iAnswered = input.myAnswers[questionId] !== undefined;
  const partnerAnswered = (input.partner?.answered ?? 0) > index;
  if (!iAnswered) return { kind: 'answering', index, partnerAnswered };
  if (!partnerAnswered) return { kind: 'waiting-answer', index };
  if ((input.mine?.ready ?? 0) <= index) return { kind: 'revealed', index };
  return { kind: 'waiting-ready', index };
}

/** Jumlah soal ronde ini yang sudah dijawab (jawaban di luar daftar soal diabaikan). */
export function countAnswered(questionIds: readonly QuestionId[], answers: AnswerMap): number {
  return questionIds.filter((id) => answers[id] !== undefined).length;
}

/** Soal yang sudah terbuka: dijawab oleh kedua pemain. */
export function revealedQuestionIds(
  questionIds: readonly QuestionId[],
  mine: AnswerMap,
  partner: AnswerMap,
): QuestionId[] {
  return questionIds.filter((id) => mine[id] !== undefined && partner[id] !== undefined);
}
