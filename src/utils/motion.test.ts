import { describe, expect, it } from 'vitest';
import { lerpCurve } from '@/components/thread/geometry';
import { EASINGS, interpolate, prefersReducedMotion } from './motion';

describe('EASINGS', () => {
  it.each(Object.entries(EASINGS))('%s mulai di 0 dan berakhir di 1', (_name, ease) => {
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
  });

  it('out melambat di akhir; inOut simetris di tengah', () => {
    expect(EASINGS.out(0.5)).toBeGreaterThan(0.5);
    expect(EASINGS.inOut(0.5)).toBeCloseTo(0.5);
    expect(EASINGS.inOut(0.25)).toBeCloseTo(1 - EASINGS.inOut(0.75));
  });

  it('selalu naik (angka hasil tidak pernah mundur saat menghitung)', () => {
    for (const ease of Object.values(EASINGS)) {
      let previous = ease(0);
      for (let step = 1; step <= 20; step += 1) {
        const next = ease(step / 20);
        expect(next).toBeGreaterThanOrEqual(previous);
        previous = next;
      }
    }
  });
});

describe('interpolate', () => {
  it('mengambil nilai di antara dua angka, dan t dibatasi ke [0, 1]', () => {
    expect(interpolate(0, 72, 0.5)).toBe(36);
    expect(interpolate(10, 20, -1)).toBe(10);
    expect(interpolate(10, 20, 2)).toBe(20);
    expect(interpolate(20, 10, 0.25)).toBe(17.5);
  });
});

describe('lerpCurve', () => {
  const apart = { from: 12, to: 308, y: 12, sag: 18 };
  const tight = { from: 16, to: 304, y: 16, sag: 6 };

  it('t = 0 longgar, t = 1 tegang, t = 0,5 di tengahnya', () => {
    expect(lerpCurve(apart, tight, 0)).toEqual(apart);
    expect(lerpCurve(apart, tight, 1)).toEqual(tight);
    expect(lerpCurve(apart, tight, 0.5)).toEqual({ from: 14, to: 306, y: 14, sag: 12 });
  });
});

describe('prefersReducedMotion', () => {
  it('false di luar browser (tanpa window)', () => {
    expect(prefersReducedMotion()).toBe(false);
  });
});
