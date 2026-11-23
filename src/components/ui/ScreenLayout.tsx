import { type ReactNode, useEffect, useRef } from 'react';

/**
 * Kerangka layar: banner (opsional), top bar, konten yang bisa di-scroll, dan action bar
 * yang menempel di bawah (zona jempol). Satu kolom rata kiri, maksimal 560px.
 * `fill`: isi menjadi kolom flex setinggi layar, jadi anaknya bisa memakai `my-auto`/`mt-auto`
 * untuk menyusun komposisi satu layar penuh (dipakai Beranda).
 */
export function ScreenLayout({
  banner,
  top,
  children,
  actions,
  fill = false,
}: {
  banner?: ReactNode;
  top?: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
  fill?: boolean;
}) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[560px] flex-col">
      {banner}
      {top ? (
        <header className="flex h-12 shrink-0 items-center justify-between gap-2 px-2.5 md:px-3.5">
          {top}
        </header>
      ) : null}
      <main
        className={`flex-1 animate-fade px-5 md:px-6 ${top ? 'pt-1' : 'pt-4'} ${
          fill ? 'flex flex-col pb-[max(1rem,env(safe-area-inset-bottom))]' : 'pb-4'
        }`}
      >
        {children}
      </main>
      {actions ? (
        <footer className="sticky bottom-0 border-t border-garis bg-kertas px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] md:px-6">
          <div className="flex items-center gap-3">{actions}</div>
        </footer>
      ) : null}
    </div>
  );
}

/** Ukuran judul sama di semua lebar layar, agar setiap layar muat tanpa scroll. */
const TITLE_SIZES = {
  display: 'text-display tracking-[-0.015em]',
  title: 'text-title tracking-[-0.01em]',
  question: 'text-question',
} as const;

/**
 * Judul layar (h1). Difokuskan saat muncul agar pembaca layar langsung mengumumkan layar baru.
 */
export function ScreenTitle({
  children,
  size = 'title',
  className = '',
  id,
}: {
  children: ReactNode;
  size?: keyof typeof TITLE_SIZES;
  className?: string;
  id?: string;
}) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);
  return (
    <h1
      ref={ref}
      id={id}
      tabIndex={-1}
      className={`font-serif font-medium text-balance focus:outline-none ${TITLE_SIZES[size]} ${className}`}
    >
      {children}
    </h1>
  );
}

/** Paragraf pembuka di bawah judul. */
export function Lede({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <p className={`mt-1.5 max-w-[46ch] text-pretty text-tinta-pudar ${className}`}>{children}</p>
  );
}
