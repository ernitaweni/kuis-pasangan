import { useEffect, useRef, useState } from 'react';
import { EASINGS, type EasingName, interpolate, prefersReducedMotion } from '@/utils/motion';

interface TweenOptions {
  /** Lama gerak dalam milidetik. */
  duration?: number;
  /** Jeda sebelum gerak dimulai, dalam milidetik. */
  delay?: number;
  /** Nilai saat pertama dipasang. Tanpa ini, nilai langsung di target (tidak bergerak saat mount). */
  from?: number;
  easing?: EasingName;
}

/**
 * Angka yang bergerak halus menuju `target` (requestAnimationFrame). Dipakai untuk gerak yang
 * tidak bisa ditulis dengan CSS saja di semua browser: benang yang menegang saat pasangan masuk
 * dan angka hasil yang menghitung naik. Jika target berubah di tengah jalan, gerak berlanjut
 * dari posisi saat itu. Dengan prefers-reduced-motion, nilainya langsung melompat ke target.
 */
export function useTween(
  target: number,
  { duration = 600, delay = 0, from, easing = 'out' }: TweenOptions = {},
): number {
  const [value, setValue] = useState(from ?? target);
  const current = useRef(from ?? target);

  useEffect(() => {
    const origin = current.current;
    if (origin === target) return;
    const ease = EASINGS[easing];
    const reduce = prefersReducedMotion();
    let frame = 0;
    let start: number | undefined;

    const tick = (now: number) => {
      start ??= now;
      const t = reduce || duration <= 0 ? 1 : Math.min((now - start) / duration, 1);
      const next = interpolate(origin, target, ease(t));
      current.current = next;
      setValue(next);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    const timer = setTimeout(
      () => {
        frame = requestAnimationFrame(tick);
      },
      reduce ? 0 : delay,
    );
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
    };
  }, [target, duration, delay, easing]);

  return value;
}
