/**
 * Mengubah nilai mentah dari Realtime Database menjadi tipe yang aman.
 * Data dari server diperlakukan tidak dipercaya: entri yang rusak dibuang, bukan dilempar.
 */
import type {
  AnswerMap,
  PlayerDoc,
  PresenceDoc,
  ProgressDoc,
  RoomMetaDoc,
  RoomSettingsDoc,
  RoomStateDoc,
  Uid,
} from '@/types';
import { CATEGORY_IDS, GAME_MODES, OPTION_IDS } from './constants';
import { isFiniteNumber, isNonEmptyString, isOneOf, isRecord } from './guards';

const STATUSES = ['lobby', 'playing', 'closed'] as const;
const CLOSED_REASONS = ['host-left', 'player-left'] as const;
const ROLES = ['host', 'guest'] as const;

export function parseMeta(value: unknown): RoomMetaDoc | null {
  if (!isRecord(value)) return null;
  const { hostUid, hostName, guestUid, createdAt, schemaVersion } = value;
  if (!isNonEmptyString(hostUid) || typeof hostName !== 'string' || !isFiniteNumber(createdAt)) {
    return null;
  }
  if (schemaVersion !== 1) return null;
  return {
    hostUid,
    hostName,
    createdAt,
    schemaVersion: 1,
    ...(isNonEmptyString(guestUid) ? { guestUid } : {}),
  };
}

export function parseSettings(value: unknown): RoomSettingsDoc | null {
  if (!isRecord(value)) return null;
  const { categoryId, mode, targetUid } = value;
  if (!isOneOf(categoryId, CATEGORY_IDS) || !isOneOf(mode, GAME_MODES)) return null;
  if (!isNonEmptyString(targetUid)) return null;
  return { categoryId, mode, targetUid };
}

/** RTDB mengembalikan array untuk key 0..n, tapi bisa juga objek. Keduanya diterima. */
function parseQuestionIds(value: unknown): string[] | undefined {
  const list = Array.isArray(value) ? value : isRecord(value) ? Object.values(value) : null;
  if (!list) return undefined;
  const ids = list.filter(isNonEmptyString);
  return ids.length === list.length ? ids : undefined;
}

export function parseState(value: unknown): RoomStateDoc | null {
  if (!isRecord(value)) return null;
  const { status, round, questionIds, startedAt, closedReason } = value;
  if (!isOneOf(status, STATUSES)) return null;
  if (!isFiniteNumber(round) || !Number.isInteger(round) || round < 1) return null;
  const ids = parseQuestionIds(questionIds);
  return {
    status,
    round,
    ...(ids ? { questionIds: ids } : {}),
    ...(isFiniteNumber(startedAt) ? { startedAt } : {}),
    ...(isOneOf(closedReason, CLOSED_REASONS) ? { closedReason } : {}),
  };
}

function parseRecordOf<T>(value: unknown, parseItem: (item: unknown) => T | null): Record<Uid, T> {
  if (!isRecord(value)) return {};
  const result: Record<Uid, T> = {};
  for (const [key, item] of Object.entries(value)) {
    const parsed = parseItem(item);
    if (parsed !== null) result[key] = parsed;
  }
  return result;
}

export function parsePlayer(value: unknown): PlayerDoc | null {
  if (!isRecord(value)) return null;
  const { name, role, joinedAt } = value;
  if (!isNonEmptyString(name) || !isOneOf(role, ROLES)) return null;
  return { name, role, joinedAt: isFiniteNumber(joinedAt) ? joinedAt : 0 };
}

export function parsePresence(value: unknown): PresenceDoc | null {
  if (!isRecord(value) || typeof value.online !== 'boolean') return null;
  return { online: value.online, lastSeen: isFiniteNumber(value.lastSeen) ? value.lastSeen : 0 };
}

export function parseProgress(value: unknown): ProgressDoc | null {
  if (!isRecord(value)) return null;
  const { answered, ready } = value;
  if (!isFiniteNumber(answered) || answered < 0) return null;
  return { answered, ready: isFiniteNumber(ready) && ready >= 0 ? ready : 0 };
}

export const parsePlayers = (value: unknown) => parseRecordOf(value, parsePlayer);
export const parsePresenceMap = (value: unknown) => parseRecordOf(value, parsePresence);
export const parseProgressMap = (value: unknown) => parseRecordOf(value, parseProgress);

export function parseAnswerMap(value: unknown): AnswerMap {
  if (!isRecord(value)) return {};
  const result: AnswerMap = {};
  for (const [questionId, optionId] of Object.entries(value)) {
    if (isOneOf(optionId, OPTION_IDS)) result[questionId] = optionId;
  }
  return result;
}
