import { Check, type LucideIcon } from 'lucide-react';
import { Fragment, type ReactNode, type Ref, useId } from 'react';
import type { radioItemProps } from '@/hooks/useRadioKeys';

const LAYOUTS = {
  stack: 'grid gap-2',
  tiles: 'grid grid-cols-3 gap-2',
  segmented: 'grid auto-cols-fr grid-flow-col gap-1 rounded-full bg-kabut p-1',
} as const;

/**
 * Fieldset + legend + radiogroup. Di bawahnya tampil pesan error, atau jika tidak ada error,
 * keterangan (`hint`) tentang pilihan yang aktif.
 */
export function ChoiceGroup({
  legend,
  error,
  hint,
  children,
  className = 'mt-5',
  groupRef,
  layout = 'stack',
}: {
  legend: string;
  error?: string | null;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
  groupRef?: Ref<HTMLDivElement>;
  layout?: keyof typeof LAYOUTS;
}) {
  const id = useId();
  const noteId = `${id}-keterangan`;
  const note = error ?? hint;
  return (
    <fieldset className={className}>
      <legend id={`${id}-legend`} className="mb-1.5 font-semibold text-tinta-pudar">
        {legend}
      </legend>
      <div
        ref={groupRef}
        role="radiogroup"
        aria-labelledby={`${id}-legend`}
        aria-describedby={note ? noteId : undefined}
        aria-invalid={error ? true : undefined}
        className={LAYOUTS[layout]}
      >
        {children}
      </div>
      {note ? (
        <p
          // Ganti kunci saat isinya berganti, agar keterangan baru muncul perlahan.
          key={error ? `error-${error}` : typeof hint === 'string' ? hint : 'hint'}
          id={noteId}
          className={`mt-1.5 ${error ? 'animate-rise font-medium text-bahaya' : 'animate-fade text-tinta-pudar'}`}
        >
          {note}
        </p>
      ) : null}
    </fieldset>
  );
}

type RadioProps = ReturnType<typeof radioItemProps>;

/** Tekan terasa: pilihan sedikit mengecil saat ditekan, warna dan tepi berpindah halus. */
const PRESSABLE =
  'transition-[background-color,box-shadow,scale] duration-150 ease-out active:scale-[0.98]';
/** Centang muncul dengan sedikit pantulan saat terpilih. */
const CHECK_POP =
  'scale-50 opacity-0 transition-[opacity,scale] duration-300 ease-pegas group-aria-checked:scale-100 group-aria-checked:opacity-100';

/**
 * Kotak pilihan kategori (tiga sejajar): ikon, nama, dan centang saat terpilih. Deskripsi
 * kategori yang aktif ditampilkan oleh ChoiceGroup lewat `hint`.
 */
export function ChoiceTile({
  icon: Icon,
  title,
  radio,
}: {
  icon: LucideIcon;
  title: string;
  radio: RadioProps;
}) {
  return (
    <button
      type="button"
      {...radio}
      className={`group flex min-w-0 flex-col gap-1.5 rounded-option p-2.5 text-left shadow-[inset_0_0_0_1px_var(--color-bingkai)] aria-checked:bg-kabut aria-checked:shadow-[inset_0_0_0_2px_var(--color-tinta)] ${PRESSABLE}`}
    >
      <span className="flex w-full items-center justify-between">
        <Icon aria-hidden strokeWidth={1.75} className="size-5 shrink-0 text-tinta" />
        <Check aria-hidden strokeWidth={2} className={`size-4 shrink-0 text-tinta ${CHECK_POP}`} />
      </span>
      {/* Setiap kata tidak boleh terpotong, agar "sehari-hari" tidak pecah di tanda hubung. */}
      <span className="leading-tight font-semibold">
        {title.split(' ').map((word, index) => (
          <Fragment key={`${index}-${word}`}>
            {index > 0 ? ' ' : null}
            <span className="whitespace-nowrap">{word}</span>
          </Fragment>
        ))}
      </span>
    </button>
  );
}

/**
 * Opsi jawaban A–D. Saat terpilih: huruf terisi navy dan muncul centang. Saat soal baru muncul,
 * opsi naik satu per satu sesuai `index`, seperti baris surat yang ditulis berurutan.
 */
export function OptionButton({
  letter,
  text,
  radio,
  index = 0,
}: {
  letter: string;
  text: string;
  radio: RadioProps;
  index?: number;
}) {
  return (
    <button
      type="button"
      {...radio}
      style={{ animationDelay: `${80 + index * 50}ms` }}
      className={`group flex min-h-12 w-full animate-rise items-center gap-3 rounded-option px-3 py-2 text-left font-medium shadow-[inset_0_0_0_1px_var(--color-bingkai)] aria-checked:bg-kabut aria-checked:shadow-[inset_0_0_0_2px_var(--color-tinta)] ${PRESSABLE}`}
    >
      <span
        aria-hidden
        className="grid size-7 shrink-0 place-items-center rounded-full font-bold text-tinta uppercase shadow-[inset_0_0_0_1px_var(--color-garis)] transition-colors duration-150 group-aria-checked:bg-tinta group-aria-checked:text-kertas group-aria-checked:shadow-none"
      >
        {letter}
      </span>
      <span className="min-w-0 flex-1">{text}</span>
      <Check aria-hidden strokeWidth={2} className={`size-5 shrink-0 text-tinta ${CHECK_POP}`} />
    </button>
  );
}

export interface ChoiceMarker {
  initial: string;
  /** Untuk pembaca layar, misalnya "Jawaban Sari". */
  label: string;
  /** true = pemain pertama (Yang Ditebak / Host), false = pemain kedua. */
  first: boolean;
}

/**
 * Warna penanda pemain: navy untuk pemain pertama, mawar untuk pemain kedua. Beda gelap-terang
 * keduanya jauh, jadi tetap terbedakan tanpa melihat warna. Dipakai juga oleh legenda.
 */
export const MARKER_FIRST = 'bg-tinta text-kertas';
export const MARKER_SECOND = 'bg-mawar text-tinta';

/**
 * Opsi setelah dikunci atau terbuka: bukan tombol lagi. Penanda inisial menunjukkan siapa
 * memilih apa. Opsi yang dipilih keduanya (cocok) berwarna mawar, warna benang.
 * Penanda baru meluncur dari sisi pemainnya (pertama dari kiri, kedua dari kanan), sehingga
 * di opsi yang cocok keduanya terlihat bertemu.
 */
export function RevealOption({
  letter,
  text,
  markers,
}: {
  letter: string;
  text: string;
  markers: readonly ChoiceMarker[];
}) {
  const tone =
    markers.length >= 2
      ? 'bg-mawar-muda shadow-[inset_0_0_0_2px_var(--color-mawar)]'
      : markers.length === 1
        ? 'bg-kabut shadow-[inset_0_0_0_1px_var(--color-bingkai)]'
        : 'text-tinta-pudar shadow-[inset_0_0_0_1px_var(--color-garis)]';
  return (
    <li
      className={`flex min-h-12 items-center gap-3 rounded-option px-3 py-2 font-medium transition-[background-color,box-shadow,color] duration-300 ease-lembut ${tone}`}
    >
      <span
        aria-hidden
        className="grid size-7 shrink-0 place-items-center rounded-full font-bold text-tinta uppercase shadow-[inset_0_0_0_1px_var(--color-garis)]"
      >
        {letter}
      </span>
      <span className="min-w-0 flex-1">{text}</span>
      {markers.length > 0 ? (
        <span className="flex shrink-0 -space-x-1.5">
          {markers.map((marker, index) => (
            <span
              key={marker.label}
              aria-hidden
              style={{ animationDelay: `${index * 90}ms` }}
              className={`grid size-7 animate-meet place-items-center rounded-full font-bold ring-2 ring-kertas ${
                marker.first
                  ? `${MARKER_FIRST} [--meet-from:-10px]`
                  : `${MARKER_SECOND} [--meet-from:10px]`
              }`}
            >
              {marker.initial}
            </span>
          ))}
          <span className="sr-only">{markers.map((marker) => marker.label).join(', ')}</span>
        </span>
      ) : null}
    </li>
  );
}

/** Satu segmen di SegmentedControl (dipakai di dalam ChoiceGroup layout="segmented"). */
export function Segment({ label, radio }: { label: string; radio: RadioProps }) {
  return (
    <button
      type="button"
      {...radio}
      className="h-11 min-w-0 truncate rounded-full px-3 font-semibold text-tinta-pudar transition-[background-color,color,box-shadow] duration-200 ease-lembut aria-checked:bg-kertas aria-checked:text-tinta aria-checked:shadow-[inset_0_0_0_1.5px_var(--color-tinta)]"
    >
      {label}
    </button>
  );
}
