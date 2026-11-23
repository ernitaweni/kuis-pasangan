import { useId } from 'react';
import { THREAD_WIDTH } from './geometry';
import { useSize } from './useWidth';

/** Tinggi minimum (px). Di layar yang lebih tinggi, benang menjuntai lebih panjang. */
const MIN_HEIGHT = 140;
/** Tinggi kedua ujung benang (pusat titik "Kamu" dan "Dia"). */
const END_Y = 24;
const END_X = 12;

/**
 * Benang menjuntai dari "Kamu" ke "Dia" dengan satu simpul longgar di bagian bawah, seperti
 * goresan tulisan tangan atau kalung dengan liontin. Simpul ini belum terikat; di layar Hasil,
 * benang yang sama terikat menjadi hati. Bentuk dasarnya untuk tinggi 140px; di area yang lebih
 * tinggi, juntaiannya memanjang dan simpulnya membesar (maksimal 1,5×).
 */
function loopPath(width: number, height: number): string {
  const cx = width / 2;
  const right = width - END_X;
  const reach = Math.min(width * 0.22, 110);
  const drop = Math.max(height - 36, MIN_HEIGHT - 36);
  const scale = Math.min(Math.max(drop / (MIN_HEIGHT - 36), 1), 1.5);
  const bottom = END_Y + drop;
  const p = (dx: number, dy: number) => `${cx + dx * scale} ${bottom + dy * scale}`;
  return [
    `M${END_X} ${END_Y}`,
    // Turun dari "Kamu" ke bawah simpul.
    `C${END_X + reach} ${END_Y} ${p(-76, -6)} ${p(-6, -24)}`,
    // Naik melingkar di sisi kanan simpul sampai puncaknya.
    `C${p(38, -36)} ${p(32, -78)} ${p(0, -78)}`,
    // Turun di sisi kiri, menyilang benang yang datang.
    `C${p(-32, -78)} ${p(-40, -32)} ${p(4, -10)}`,
    // Naik ke "Dia".
    `C${p(60, 10)} ${right - reach} ${END_Y} ${right} ${END_Y}`,
  ].join(' ');
}

function EndLabel({
  name,
  place,
  align,
}: {
  name: string;
  place: string;
  align: 'left' | 'right';
}) {
  return (
    <p
      className={`absolute top-[42px] ${align === 'left' ? 'left-0' : 'right-0 text-right'} text-tinta-pudar`}
    >
      <span className="block font-semibold text-tinta">{name}</span>
      {place}
    </p>
  );
}

/**
 * Hero Beranda: dua titik yang berjauhan, dihubungkan benang bersimpul longgar. Mengisi tinggi
 * wadahnya (atur lewat `className`, misalnya flex-grow dengan batas tinggi).
 * Saat dibuka, benang tergambar dari "Kamu" melewati simpulnya sampai ke "Dia" (lewat mask, agar
 * pola titik-titiknya tetap), lalu titik "Dia" muncul dan mulai memancar: menunggu dia datang.
 * Setelah itu benang bernapas pelan. Dengan prefers-reduced-motion semuanya langsung utuh dan diam.
 */
export function ThreadLoop({ className = '' }: { className?: string }) {
  const [ref, { width, height }] = useSize<HTMLDivElement>({
    width: THREAD_WIDTH,
    height: MIN_HEIGHT,
  });
  const maskId = `benang-${useId().replace(/[^\w-]/g, '')}`;
  const d = loopPath(width, height);
  const right = width - END_X;

  return (
    <div ref={ref} className={`relative min-h-[140px] ${className}`} aria-hidden>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="absolute inset-0 block size-full overflow-visible"
      >
        <mask id={maskId} maskUnits="userSpaceOnUse" x={0} y={0} width={width} height={height}>
          <path
            d={d}
            pathLength={1}
            fill="none"
            stroke="white"
            strokeWidth={16}
            strokeLinecap="round"
            className="animate-loop-draw [stroke-dasharray:1_2]"
          />
        </mask>
        {/* Bernapas: menyusut ke arah garis kedua ujung, jadi titik-titiknya tidak ikut bergeser. */}
        <g className="origin-[center_24px] animate-breathe">
          <path
            d={d}
            mask={`url(#${maskId})`}
            fill="none"
            strokeWidth={2.75}
            strokeLinecap="round"
            strokeDasharray="0.5 7.5"
            vectorEffect="non-scaling-stroke"
            className="stroke-mawar"
          />
        </g>
        <circle cx={END_X} cy={END_Y} r={10} className="fill-tinta" />
        <circle
          cx={right}
          cy={END_Y}
          r={9}
          fill="none"
          strokeWidth={1.5}
          style={{ animationDelay: '2.2s' }}
          className="origin-center animate-ripple stroke-mawar opacity-0 [transform-box:fill-box]"
        />
        <circle
          cx={right}
          cy={END_Y}
          r={9}
          strokeWidth={2}
          className="origin-center animate-arrive fill-kertas stroke-bingkai [transform-box:fill-box]"
        />
      </svg>
      <EndLabel name="Kamu" place="di sini" align="left" />
      <EndLabel name="Dia" place="di sana" align="right" />
    </div>
  );
}
