import { Copy } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import type { RoomCode } from '@/types';

/** Kode room yang bisa diketuk untuk disalin. Dibacakan per karakter oleh pembaca layar. */
export function RoomCodeChip({ code }: { code: RoomCode }) {
  const toast = useToast();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      toast('Kode disalin');
    } catch {
      toast(`Kode room: ${code}`);
    }
  };
  return (
    <button
      type="button"
      onClick={() => void copy()}
      aria-label={`Salin kode room ${code.split('').join(' ')}`}
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-2.5 font-bold tracking-[0.12em] text-tinta tabular-nums hover:bg-kabut"
    >
      <span>{code}</span>
      <Copy aria-hidden strokeWidth={1.75} className="size-4.5 text-tinta" />
    </button>
  );
}
