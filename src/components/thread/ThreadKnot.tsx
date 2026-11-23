import { useWidth } from './useWidth';

const BASE = 45;
const HEIGHT = 62;

type Point = (dx: number, dy: number) => string;

/** Titik relatif ke ujung bawah hati, yang berada di tengah lebar. */
const pointFrom =
  (width: number): Point =>
  (dx, dy) =>
    `${width / 2 + dx} ${BASE + dy}`;

/** Lengkung hati, dimulai dan berakhir di ujung bawahnya. */
const heartCurves = (p: Point) => [
  `C${p(-12, -9)} ${p(-24, -18)} ${p(-24, -28)}`,
  `C${p(-24, -37)} ${p(-17, -43)} ${p(-10, -43)}`,
  `C${p(-5, -43)} ${p(-2, -40)} ${p(0, -36)}`,
  `C${p(2, -40)} ${p(5, -43)} ${p(10, -43)}`,
  `C${p(17, -43)} ${p(24, -37)} ${p(24, -28)}`,
  `C${p(24, -18)} ${p(12, -9)} ${p(0, 0)}`,
];

/**
 * Benang masuk dari kiri, membentuk hati di tengah, lalu keluar ke kanan (satu garis).
 * Hati digambar relatif ke ujung bawahnya di tengah lebar, jadi bentuknya tetap di layar apa pun.
 */
function knotPath(width: number): string {
  const p = pointFrom(width);
  return [`M16 ${BASE} L${p(0, 0)}`, ...heartCurves(p), `L${width - 16} ${BASE}`].join(' ');
}

/** Isi hati: muncul begitu simpulnya selesai terikat. */
function heartFill(width: number): string {
  const p = pointFrom(width);
  return [`M${p(0, 0)}`, ...heartCurves(p), 'Z'].join(' ');
}

function Avatar({ x, initial, className }: { x: number; initial: string; className?: string }) {
  return (
    <g className={`origin-center [transform-box:fill-box] ${className ?? ''}`}>
      <circle cx={x} cy={BASE} r={15} className="fill-tinta" />
      <text
        x={x}
        y={BASE}
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-kertas font-sans font-bold"
      >
        {initial}
      </text>
    </g>
  );
}

/**
 * Simpul hati di layar Hasil, momen utama game. Saat `animate`: benang berangkat dari avatar
 * kiri (1,6 detik), mengikat hati, lalu tiba di avatar kanan yang muncul saat itu juga; isi hati
 * mengembang setelah simpulnya terikat. Dengan prefers-reduced-motion semuanya langsung tampil.
 */
export function ThreadKnot({
  leftInitial,
  rightInitial,
  animate,
}: {
  leftInitial: string;
  rightInitial: string;
  animate: boolean;
}) {
  const [ref, width] = useWidth<SVGSVGElement>();
  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${width} ${HEIGHT}`}
      height={HEIGHT}
      className="block w-full overflow-visible"
      aria-hidden
    >
      <path
        d={heartFill(width)}
        className={`origin-[50%_90%] fill-mawar-muda [transform-box:fill-box] ${animate ? 'animate-knot-fill' : ''}`}
      />
      {/* Pola 1-2 (bukan 1): potongan berikutnya jauh di luar ujung jalur, jadi tidak ada
          titik sisa di ujung kanan saat benang belum tergambar. */}
      <path
        d={knotPath(width)}
        pathLength={1}
        fill="none"
        strokeWidth={2.25}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`stroke-mawar ${animate ? 'animate-thread-draw [stroke-dasharray:1_2]' : ''}`}
      />
      <Avatar x={16} initial={leftInitial} className={animate ? 'animate-fade' : undefined} />
      <Avatar
        x={width - 16}
        initial={rightInitial}
        className={animate ? 'animate-arrive' : undefined}
      />
    </svg>
  );
}
