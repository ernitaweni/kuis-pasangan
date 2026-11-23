import { describe, expect, it, vi } from 'vitest';
import { TimeoutError, withTimeout } from './async';
import { CREATE_ERROR_MESSAGES, JOIN_ERROR_MESSAGES, MODE_DESCRIPTIONS } from './messages';
import { initialOf } from './validation';

describe('withTimeout', () => {
  it('meneruskan hasil jika selesai tepat waktu', async () => {
    await expect(withTimeout(Promise.resolve(42), 1000)).resolves.toBe(42);
  });

  it('meneruskan error asli; nilai bukan Error dibungkus', async () => {
    await expect(withTimeout(Promise.reject(new Error('putus')), 1000)).rejects.toThrow('putus');
    // Sengaja menolak dengan string untuk menguji pembungkusan nilai yang bukan Error.
    // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
    await expect(withTimeout(Promise.reject('teks'), 1000)).rejects.toThrow('teks');
  });

  it('menolak dengan TimeoutError jika terlalu lama', async () => {
    vi.useFakeTimers();
    try {
      const pending = withTimeout(new Promise<never>(() => undefined), 500);
      const assertion = expect(pending).rejects.toBeInstanceOf(TimeoutError);
      await vi.advanceTimersByTimeAsync(500);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('teks antarmuka', () => {
  it('setiap jenis error dan mode punya teks, tanpa kata "salah"', () => {
    const texts = [
      ...Object.values(JOIN_ERROR_MESSAGES),
      ...Object.values(CREATE_ERROR_MESSAGES),
      ...Object.values(MODE_DESCRIPTIONS),
    ];
    expect(Object.keys(JOIN_ERROR_MESSAGES)).toHaveLength(7);
    for (const text of texts) {
      expect(text.trim().length).toBeGreaterThan(0);
      expect(text).not.toMatch(/\bsalah\b/i);
    }
  });
});

describe('initialOf', () => {
  it('huruf pertama dalam huruf besar, aman untuk emoji dan nama kosong', () => {
    expect(initialOf('  sari ')).toBe('S');
    expect(initialOf('😊 Bima')).toBe('😊');
    expect(initialOf('   ')).toBe('?');
  });
});
