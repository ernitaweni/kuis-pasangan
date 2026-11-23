import { useState } from 'react';
import { type Curve, curvePath, pointOnCurve } from './geometry';
import { useWidth } from './useWidth';

const HEIGHT = 22;
const curveFor = (width: number): Curve => ({ from: 8, to: width - 8, y: 8, sag: 5 });

/** Porsi benang yang sudah ditempuh, 0–0.5 (separuh jalan menuju tengah). */
function halfway(answered: number, total: number): number {
  if (total <= 0) return 0;
  return (Math.min(Math.max(answered, 0), total) / total) * 0.5;
}

/**
 * Pancaran sekali di posisi titik, setelah titik selesai bergeser: tanda ada jawaban baru.
 * `key` berganti setiap jumlah jawaban berubah, sehingga pancarannya diputar ulang.
 */
function Pulse({ x, y }: { x: number; y: number }) {
  return (
    <g style={{ transform: `translate(${x}px, ${y}px)` }}>
      <circle
        r={6}
        fill="none"
        strokeWidth={1.5}
        // Inline agar pasti mengalahkan jeda bawaan di shorthand animate-ripple-once.
        style={{ animationDelay: '0.25s' }}
        className="origin-center animate-ripple-once stroke-mawar opacity-0 [transform-box:fill-box]"
      />
    </g>
  );
}

/**
 * Pengganti progress bar (docs/02-system-design.md §6.1): dua titik bergerak dari ujung
 * menuju tengah sesuai jumlah jawaban. Setiap jawaban mendekatkan kalian. Titik memancar
 * saat jawabannya bertambah, jadi kamu tahu kapan pasanganmu baru saja menjawab.
 */
export function ThreadProgress({
  mine,
  partner,
  total,
  partnerName,
}: {
  mine: number;
  partner: number;
  total: number;
  partnerName: string;
}) {
  const [ref, width] = useWidth<SVGSVGElement>();
  // Jumlah jawaban saat panel dipasang. Pancaran hanya untuk jawaban yang bertambah sesudahnya.
  const [initial] = useState({ mine, partner });
  const curve = curveFor(width);
  const a = halfway(mine, total);
  const b = halfway(partner, total);
  const me = pointOnCurve(curve, a);
  const them = pointOnCurve(curve, 1 - b);
  const path = curvePath(curve);

  return (
    <div
      role="progressbar"
      aria-label="Progres kuis"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={mine}
      aria-valuetext={`Kamu ${mine} dari ${total}, ${partnerName} ${partner} dari ${total}`}
    >
      <svg
        ref={ref}
        viewBox={`0 0 ${width} ${HEIGHT}`}
        height={HEIGHT}
        className="block w-full overflow-visible"
        aria-hidden
      >
        <path
          d={path}
          fill="none"
          strokeWidth={2}
          strokeLinecap="round"
          strokeDasharray="0.5 7"
          className="stroke-mawar"
        />
        <path
          d={path}
          pathLength={1}
          fill="none"
          strokeWidth={2.25}
          strokeDasharray={`${a} ${Math.max(1 - a - b, 0)} ${b}`}
          className="stroke-mawar transition-[stroke-dasharray] duration-300 ease-thread"
        />
        <circle
          r={6}
          className="fill-tinta transition-transform duration-300 ease-thread"
          style={{ transform: `translate(${me.x}px, ${me.y}px)` }}
        />
        <circle
          r={6}
          className="fill-tinta transition-transform duration-300 ease-thread"
          style={{ transform: `translate(${them.x}px, ${them.y}px)` }}
        />
        {mine > initial.mine ? <Pulse key={`kamu-${mine}`} x={me.x} y={me.y} /> : null}
        {partner > initial.partner ? <Pulse key={`dia-${partner}`} x={them.x} y={them.y} /> : null}
      </svg>
      <div aria-hidden className="mt-1 flex justify-between gap-4 text-tinta-pudar tabular-nums">
        <span className="shrink-0">
          Kamu {mine}/{total}
        </span>
        <span className="min-w-0 truncate text-right">
          {partnerName} {partner}/{total}
        </span>
      </div>
    </div>
  );
}
