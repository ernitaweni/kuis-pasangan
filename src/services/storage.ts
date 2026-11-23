/**
 * Penyimpanan lokal yang aman (FR-21, FR-23, FR-24). Jika localStorage tidak tersedia
 * (mode privat, kuota penuh, diblokir), data disimpan di memori: game tetap berjalan,
 * hanya tidak bertahan setelah tab ditutup.
 */
import type { ActiveRoomRef, HistoryEntry, RoomCode } from '@/types';
import {
  isActiveRoomRef,
  isFreshActiveRoom,
  isHistoryList,
  parseVersioned,
  sanitizeHistory,
  serializeVersioned,
  upsertHistory,
} from '@/utils/persist';
import { NAME_MAX_LENGTH } from '@/utils/constants';

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export const STORAGE_KEYS = {
  activeRoom: 'kp:v1:activeRoom',
  history: 'kp:v1:history',
  lastName: 'kp:v1:lastName',
} as const;

function createMemoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
  };
}

/** localStorage jika benar-benar bisa ditulis, selain itu null. */
export function detectLocalStorage(): StorageLike | null {
  try {
    const store = window.localStorage;
    const probe = 'kp:probe';
    store.setItem(probe, probe);
    store.removeItem(probe);
    return store;
  } catch {
    return null;
  }
}

export function createAppStorage(backend: StorageLike | null, now: () => number = Date.now) {
  const store = backend ?? createMemoryStorage();
  const persistent = backend !== null;

  const read = <T>(key: string, guard: (value: unknown) => value is T): T | null => {
    try {
      return parseVersioned(store.getItem(key), guard);
    } catch {
      return null;
    }
  };

  const write = (key: string, data: unknown): void => {
    try {
      store.setItem(key, serializeVersioned(data));
    } catch {
      // Kuota penuh atau diblokir: abaikan, data tidak kritis.
    }
  };

  const remove = (key: string): void => {
    try {
      store.removeItem(key);
    } catch {
      // Abaikan.
    }
  };

  const isString = (value: unknown): value is string => typeof value === 'string';

  const loadHistory = (): HistoryEntry[] =>
    sanitizeHistory(read(STORAGE_KEYS.history, isHistoryList) ?? []);

  return {
    /** false = memakai memori (mode privat dsb.), data hilang saat tab ditutup. */
    persistent,

    loadActiveRoom(): ActiveRoomRef | null {
      const ref = read(STORAGE_KEYS.activeRoom, isActiveRoomRef);
      if (ref && isFreshActiveRoom(ref, now())) return ref;
      if (ref) remove(STORAGE_KEYS.activeRoom);
      return null;
    },
    saveActiveRoom(code: RoomCode): void {
      write(STORAGE_KEYS.activeRoom, { code, savedAt: now() } satisfies ActiveRoomRef);
    },
    clearActiveRoom(): void {
      remove(STORAGE_KEYS.activeRoom);
    },

    loadHistory,
    /** Waktu main diisi di sini (jam yang bisa diinjeksi), bukan oleh komponen. */
    saveHistoryEntry(entry: Omit<HistoryEntry, 'playedAt'>): HistoryEntry[] {
      const next = upsertHistory(loadHistory(), { ...entry, playedAt: now() });
      write(STORAGE_KEYS.history, next);
      return next;
    },
    clearHistory(): void {
      remove(STORAGE_KEYS.history);
    },

    loadLastName(): string {
      return (read(STORAGE_KEYS.lastName, isString) ?? '').slice(0, NAME_MAX_LENGTH);
    },
    saveLastName(name: string): void {
      write(STORAGE_KEYS.lastName, name.slice(0, NAME_MAX_LENGTH));
    },
  };
}

export type AppStorage = ReturnType<typeof createAppStorage>;

let appStorage: AppStorage | null = null;

/** Instance tunggal untuk aplikasi (dibuat saat pertama dipakai, di browser). */
export function getAppStorage(): AppStorage {
  appStorage ??= createAppStorage(detectLocalStorage());
  return appStorage;
}
