import { useTween } from '@/hooks/useTween';

/**
 * Angka yang menghitung naik dari 0 (FR-14). Pembaca layar langsung mendapat angka akhirnya,
 * bukan setiap angka antara. Hanya komponen ini yang dirender ulang selama angkanya bergerak.
 */
export function CountUp({
  value,
  suffix = '',
  delay = 0,
  duration = 900,
}: {
  value: number;
  suffix?: string;
  delay?: number;
  duration?: number;
}) {
  const shown = Math.round(useTween(value, { from: 0, delay, duration, easing: 'out' }));
  return (
    <>
      <span aria-hidden>
        {shown}
        {suffix}
      </span>
      <span className="sr-only">
        {value}
        {suffix}
      </span>
    </>
  );
}
