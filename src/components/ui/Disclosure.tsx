import { ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * Bagian yang bisa dibuka-tutup (<details> bawaan). Dipakai untuk isi sekunder yang panjang,
 * agar layar utama tetap muat tanpa scroll. Saat dibuka, panah berputar dan isinya naik pelan.
 * Tingginya ikut bergerak di browser yang mendukung `interpolate-size` (lihat index.css).
 */
export function Disclosure({
  summary,
  children,
  className = '',
}: {
  summary: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <details className={`group border-t border-garis ${className}`}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-option py-3 font-semibold [&::-webkit-details-marker]:hidden">
        {summary}
        <ChevronDown
          aria-hidden
          strokeWidth={1.75}
          className="size-5 shrink-0 text-tinta transition-[rotate] duration-300 ease-lembut group-open:rotate-180"
        />
      </summary>
      <div className="pb-3 group-open:animate-rise">{children}</div>
    </details>
  );
}
