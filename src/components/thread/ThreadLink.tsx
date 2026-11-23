import { useTween } from '@/hooks/useTween';
import { type Curve, curvePath, lerpCurve } from './geometry';
import { useWidth } from './useWidth';

export interface ThreadEnd {
  name: string;
  sub?: string;
  /** false = lingkaran kosong (belum hadir). */
  present: boolean;
  /** Huruf di dalam lingkaran. Tanpa ini, titik polos. */
  initial?: string;
}

/** Tinggi sama untuk kedua keadaan, jadi layar tidak bergeser saat benang tersambung. */
const HEIGHT = 34;
const apart = (width: number): Curve => ({ from: 12, to: width - 12, y: 12, sag: 18 });
const connected = (width: number): Curve => ({ from: 16, to: width - 16, y: 16, sag: 6 });
/** Jarak antartitik benang putus-putus. Mengecil ke 0 saat tersambung: titik-titiknya merapat. */
const DOT_GAP = 9;
const TIGHTEN_MS = 700;

/** Skala dan pancaran bertumpu di tengah lingkaran itu sendiri. */
const AROUND_SELF = '[transform-box:fill-box] origin-center';

function Dot({
  end,
  x,
  y,
  motion = '',
}: {
  end: ThreadEnd;
  x: number;
  y: number;
  motion?: string;
}) {
  if (end.present && end.initial) {
    return (
      <g className={`${AROUND_SELF} ${motion}`}>
        <circle cx={x} cy={y} r={15} className="fill-tinta" />
        <text
          x={x}
          y={y}
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-kertas font-sans font-bold"
        >
          {end.initial}
        </text>
      </g>
    );
  }
  if (end.present) {
    return <circle cx={x} cy={y} r={10} className={`fill-tinta ${AROUND_SELF} ${motion}`} />;
  }
  return (
    <circle
      cx={x}
      cy={y}
      r={9}
      strokeWidth={2}
      className={`fill-kertas stroke-bingkai ${AROUND_SELF} ${motion}`}
    />
  );
}

function Label({ end, align }: { end: ThreadEnd; align: 'left' | 'right' }) {
  return (
    <span className={`min-w-0 ${align === 'right' ? 'text-right' : ''}`}>
      <span className="block truncate font-semibold text-tinta">{end.name}</span>
      {end.sub ? <span className="block truncate">{end.sub}</span> : null}
    </span>
  );
}

const dotKey = (end: ThreadEnd) => (end.present ? (end.initial ? 'avatar' : 'dot') : 'empty');

/**
 * Benang penghubung dua pemain. Putus-putus, longgar, dan berayun pelan saat masih berjauhan;
 * titik-titiknya merapat menjadi benang utuh yang tegang saat keduanya sudah di room yang sama.
 */
export function ThreadLink({
  connected: isConnected,
  left,
  right,
  intro = false,
  waiting = false,
}: {
  connected: boolean;
  left: ThreadEnd;
  right: ThreadEnd;
  /** Benang terulur dari titik kiri saat layar dibuka, lalu titik kanan muncul. */
  intro?: boolean;
  /** Lingkaran kosong di kanan memancar: sedang menunggu pasangan masuk. */
  waiting?: boolean;
}) {
  const [ref, width] = useWidth<SVGSVGElement>();
  // 0 = longgar, 1 = tegang. Tidak bergerak saat mount; hanya saat keadaan berubah.
  const tension = useTween(isConnected ? 1 : 0, { duration: TIGHTEN_MS, easing: 'inOut' });
  const curve = lerpCurve(apart(width), connected(width), tension);
  const loose = tension === 0;
  const joining = isConnected && tension < 1;

  return (
    <div>
      <svg
        ref={ref}
        viewBox={`0 0 ${width} ${HEIGHT}`}
        height={HEIGHT}
        className="block w-full overflow-visible"
        aria-hidden
      >
        <g className={intro ? 'origin-[12px_12px] animate-unroll' : undefined}>
          <path
            d={curvePath(curve)}
            fill="none"
            strokeLinecap="round"
            strokeWidth={2.5 - 0.5 * tension}
            strokeDasharray={tension >= 1 ? undefined : `0.5 ${DOT_GAP * (1 - tension)}`}
            vectorEffect="non-scaling-stroke"
            className={`stroke-mawar ${loose ? 'origin-[center_12px] animate-sway' : ''}`}
          />
        </g>
        {waiting && !right.present ? (
          <circle
            cx={curve.to}
            cy={curve.y}
            r={9}
            fill="none"
            strokeWidth={1.5}
            className={`stroke-mawar opacity-0 ${AROUND_SELF} animate-ripple`}
          />
        ) : null}
        {joining ? (
          <circle
            cx={curve.to}
            cy={curve.y}
            r={15}
            fill="none"
            strokeWidth={2}
            className={`stroke-mawar opacity-0 ${AROUND_SELF} animate-ripple-once`}
          />
        ) : null}
        <Dot end={left} x={curve.from} y={curve.y} />
        <Dot
          key={dotKey(right)}
          end={right}
          x={curve.to}
          y={curve.y}
          motion={joining ? 'animate-pop' : intro ? 'animate-pop-late' : ''}
        />
      </svg>
      <div className="mt-1 flex justify-between gap-4 text-tinta-pudar">
        <Label end={left} align="left" />
        <Label end={right} align="right" />
      </div>
    </div>
  );
}
