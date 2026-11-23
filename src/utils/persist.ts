import type { ActiveRoomRef, HistoryEntry, Versioned } from '@/types';
import { CATEGORY_IDS, GAME_MODES, HISTORY_MAX, ROOM_TTL_MS } from './constants';
import { isFiniteNumber, isNonEmptyString, isOneOf, isRecord } from './guards';
import { isValidRoomCode } from './roomCode';

/** Format penyimpanan lokal: { v: 1, data }. Versi berbeda dianggap tidak ada. */
export function serializeVersioned<T>(data: T): string {
  const wrapped: Versioned<T> = { v: 1, data };
  return JSON.stringify(wrapped);
}

/** null jika kosong, JSON rusak, versi berbeda, atau isinya tidak lolos `guard`. */
export function parseVersioned<T>(
  raw: string | null,
  guard: (value: unknown) => value is T,
): T | null {
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (isRecord(parsed) && parsed.v === 1 && guard(parsed.data)) return parsed.data;
  } catch {
    // JSON rusak: perlakukan seperti tidak ada data.
  }
  return null;
}

export function isActiveRoomRef(value: unknown): value is ActiveRoomRef {
  return (
    isRecord(value) &&
    typeof value.code === 'string' &&
    isValidRoomCode(value.code) &&
    isFiniteNumber(value.savedAt)
  );
}

/** Room aktif masih layak dimasuki kembali (≤ 24 jam sejak disimpan). */
export function isFreshActiveRoom(ref: ActiveRoomRef, now: number): boolean {
  return now - ref.savedAt < ROOM_TTL_MS && ref.savedAt <= now + 60_000;
}

export function isHistoryEntry(value: unknown): value is HistoryEntry {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isFiniteNumber(value.playedAt) &&
    typeof value.myName === 'string' &&
    typeof value.partnerName === 'string' &&
    isOneOf(value.categoryId, CATEGORY_IDS) &&
    isOneOf(value.mode, GAME_MODES) &&
    isFiniteNumber(value.percent) &&
    value.percent >= 0 &&
    value.percent <= 100 &&
    typeof value.tierTitle === 'string'
  );
}

/** Daftar riwayat. Entri yang rusak dibuang, bukan menggagalkan seluruh daftar. */
export function isHistoryList(value: unknown): value is HistoryEntry[] {
  return Array.isArray(value);
}

export function sanitizeHistory(list: readonly unknown[]): HistoryEntry[] {
  return list.filter(isHistoryEntry).slice(0, HISTORY_MAX);
}

/** Tambah entri di depan. Id yang sama diganti (idempoten), lalu dipotong ke `max` entri. */
export function upsertHistory(
  list: readonly HistoryEntry[],
  entry: HistoryEntry,
  max: number = HISTORY_MAX,
): HistoryEntry[] {
  return [entry, ...list.filter((item) => item.id !== entry.id)].slice(0, Math.max(max, 0));
}
