import { WifiOff } from 'lucide-react';

/** Banner status koneksi, menempel di atas layar (FR-19, FR-20). */
export function Banner({ message }: { message: string }) {
  return (
    <div
      role="status"
      className="sticky top-0 z-20 flex animate-fade items-start gap-2.5 bg-tinta px-5 py-3 font-medium text-kertas md:px-6"
    >
      <WifiOff aria-hidden className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
      <span>{message}</span>
    </div>
  );
}
