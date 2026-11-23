/**
 * Kurva percepatan untuk gerak yang digerakkan JavaScript (useTween). Gerak lain memakai CSS
 * (token `--ease-*` dan `--animate-*` di src/styles/index.css).
 */
export const EASINGS = {
  /** Melambat di akhir: angka hasil yang menghitung naik. */
  out: (t: number) => 1 - (1 - t) ** 3,
  /** Pelan, cepat, pelan: benang yang ditarik hingga tegang. */
  inOut: (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2),
} as const;

export type EasingName = keyof typeof EASINGS;

/** Nilai di antara `from` dan `to` pada progres t, dengan t dibatasi ke [0, 1]. */
export function interpolate(from: number, to: number, t: number): number {
  const u = Math.min(Math.max(t, 0), 1);
  return from + (to - from) * u;
}

/** true jika pengguna meminta gerak dikurangi. Semua animasi lalu langsung ke keadaan akhir. */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}
