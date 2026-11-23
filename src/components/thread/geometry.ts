import { interpolate } from '@/utils/motion';

/** Benang = kurva kuadratik dari (from, y) ke (to, y) yang melengkung turun sedalam `sag`. */
export interface Curve {
  from: number;
  to: number;
  y: number;
  sag: number;
}

/** Lebar awal (px) sebelum lebar sebenarnya terukur oleh useWidth. */
export const THREAD_WIDTH = 320;

export function curvePath({ from, to, y, sag }: Curve): string {
  const mid = (from + to) / 2;
  return `M${from} ${y} Q${mid} ${y + 2 * sag} ${to} ${y}`;
}

/** Titik pada kurva untuk t ∈ [0, 1]. x linear, y mengikuti lengkungan. */
export function pointOnCurve({ from, to, y, sag }: Curve, t: number): { x: number; y: number } {
  const u = Math.min(Math.max(t, 0), 1);
  return { x: from + (to - from) * u, y: y + 4 * sag * u * (1 - u) };
}

/** Bentuk benang di antara `a` (t = 0) dan `b` (t = 1): benang longgar yang perlahan menegang. */
export function lerpCurve(a: Curve, b: Curve, t: number): Curve {
  return {
    from: interpolate(a.from, b.from, t),
    to: interpolate(a.to, b.to, t),
    y: interpolate(a.y, b.y, t),
    sag: interpolate(a.sag, b.sag, t),
  };
}
