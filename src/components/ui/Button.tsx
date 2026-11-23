import { LoaderCircle } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'outline' | 'ghost' | 'danger';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-tinta px-6 text-kertas hover:bg-tinta-terang active:bg-tinta-terang disabled:bg-kabut disabled:text-tinta-pudar',
  outline:
    'bg-kertas px-6 text-tinta shadow-[inset_0_0_0_1.5px_var(--color-tinta)] hover:bg-kabut disabled:text-tinta-pudar disabled:shadow-[inset_0_0_0_1.5px_var(--color-garis)]',
  ghost: 'bg-transparent px-4 text-tinta hover:bg-kabut disabled:text-tinta-pudar',
  danger: 'bg-bahaya px-6 text-kertas hover:brightness-95',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  /** Menampilkan spinner dan menolak klik (anti tap ganda), tapi tetap bisa difokus. */
  loading?: boolean;
  fullWidth?: boolean;
  icon?: ReactNode;
}

export function Button({
  variant = 'primary',
  loading = false,
  fullWidth = false,
  icon,
  className = '',
  children,
  onClick,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      aria-busy={loading || undefined}
      onClick={loading ? undefined : onClick}
      className={`inline-flex h-12 min-w-0 items-center justify-center gap-2 rounded-full font-semibold transition-[background-color,color,box-shadow,scale] duration-150 ease-out enabled:active:scale-[0.97] disabled:cursor-not-allowed ${VARIANTS[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...rest}
    >
      {loading ? <LoaderCircle aria-hidden className="size-5 shrink-0 animate-spin" /> : icon}
      <span className="truncate">{children}</span>
    </button>
  );
}

/** Tombol ikon bulat 44px. `label` wajib karena tidak ada teks yang terlihat. */
export function IconButton({
  label,
  children,
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      className={`grid size-11 shrink-0 place-items-center rounded-full text-tinta transition-[background-color,scale] duration-150 ease-out hover:bg-kabut active:scale-90 ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

/** Tombol teks kecil untuk aksi sekunder di top bar atau di dalam konten. */
export function TextButton({ className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`-mx-2 rounded-full px-2 py-3 font-semibold text-tinta underline decoration-mawar decoration-2 underline-offset-4 transition-[background-color,scale] duration-150 ease-out hover:bg-kabut active:scale-95 ${className}`}
      {...rest}
    />
  );
}
