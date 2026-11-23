import { describe, expect, it } from 'vitest';
import type { HistoryEntry } from '@/types';
import { ROOM_TTL_MS } from '@/utils/constants';
import { STORAGE_KEYS, type StorageLike, createAppStorage } from './storage';

function fakeStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

/** Storage yang selalu melempar, seperti Safari mode privat lama atau kuota penuh. */
const brokenStorage: StorageLike = {
  getItem: () => {
    throw new Error('SecurityError');
  },
  setItem: () => {
    throw new Error('QuotaExceededError');
  },
  removeItem: () => {
    throw new Error('SecurityError');
  },
};

const entry = (id: string): HistoryEntry => ({
  id,
  playedAt: 1,
  myName: 'Sari',
  partnerName: 'Bima',
  categoryId: 'deep-talk',
  mode: 'match',
  percent: 60,
  tierTitle: 'Saling melengkapi',
});

describe('createAppStorage', () => {
  it('menyimpan dan membaca room aktif selama ≤ 24 jam', () => {
    let now = 1000;
    const storage = createAppStorage(fakeStorage(), () => now);
    storage.saveActiveRoom('K7M2QX');
    expect(storage.loadActiveRoom()).toEqual({ code: 'K7M2QX', savedAt: 1000 });
    now += ROOM_TTL_MS;
    expect(storage.loadActiveRoom()).toBeNull();
  });

  it('room aktif yang kedaluwarsa ikut dihapus', () => {
    const backend = fakeStorage();
    let now = 0;
    const storage = createAppStorage(backend, () => now);
    storage.saveActiveRoom('K7M2QX');
    now = ROOM_TTL_MS + 1;
    storage.loadActiveRoom();
    expect(backend.data.has(STORAGE_KEYS.activeRoom)).toBe(false);
  });

  it('riwayat: simpan, baca, hapus', () => {
    const storage = createAppStorage(fakeStorage());
    storage.saveHistoryEntry(entry('a'));
    storage.saveHistoryEntry(entry('b'));
    expect(storage.loadHistory().map((e) => e.id)).toEqual(['b', 'a']);
    storage.clearHistory();
    expect(storage.loadHistory()).toEqual([]);
  });

  it('data rusak di localStorage diabaikan, bukan membuat crash', () => {
    const backend = fakeStorage();
    backend.data.set(STORAGE_KEYS.history, '{bukan json');
    backend.data.set(STORAGE_KEYS.activeRoom, JSON.stringify({ v: 1, data: { code: 'xx' } }));
    const storage = createAppStorage(backend);
    expect(storage.loadHistory()).toEqual([]);
    expect(storage.loadActiveRoom()).toBeNull();
  });

  it('nama terakhir dipotong ke 20 karakter', () => {
    const storage = createAppStorage(fakeStorage());
    expect(storage.loadLastName()).toBe('');
    storage.saveLastName('x'.repeat(30));
    expect(storage.loadLastName()).toHaveLength(20);
  });

  it('tanpa localStorage: pakai memori, tetap berfungsi dalam satu sesi', () => {
    const storage = createAppStorage(null);
    expect(storage.persistent).toBe(false);
    storage.saveLastName('Sari');
    expect(storage.loadLastName()).toBe('Sari');
  });

  it('localStorage yang melempar error tidak membuat crash', () => {
    const storage = createAppStorage(brokenStorage);
    expect(() => storage.saveHistoryEntry(entry('a'))).not.toThrow();
    expect(storage.loadHistory()).toEqual([]);
    expect(() => storage.clearActiveRoom()).not.toThrow();
    expect(storage.loadActiveRoom()).toBeNull();
  });
});
