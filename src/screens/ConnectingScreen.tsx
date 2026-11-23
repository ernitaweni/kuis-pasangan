import { LoaderCircle } from 'lucide-react';
import { ThreadLink } from '@/components/thread/ThreadLink';
import { Button } from '@/components/ui/Button';
import { Lede, ScreenLayout, ScreenTitle } from '@/components/ui/ScreenLayout';
import { CONNECTION_ERROR } from '@/utils/messages';

/** Saat Firebase dimuat atau room sedang diperiksa. Jika gagal: coba lagi atau ke beranda. */
export function ConnectingScreen({
  failed,
  onRetry,
  onHome,
}: {
  failed: boolean;
  onRetry: () => void;
  onHome: () => void;
}) {
  return (
    <ScreenLayout
      actions={
        failed ? (
          <>
            <Button variant="ghost" onClick={onHome}>
              Ke beranda
            </Button>
            <Button className="flex-1" onClick={onRetry}>
              Coba lagi
            </Button>
          </>
        ) : undefined
      }
    >
      <ThreadLink
        connected={false}
        left={{ name: 'Kamu', present: true }}
        right={{ name: 'Room', present: false }}
      />
      {failed ? (
        <>
          <ScreenTitle className="mt-5">Belum tersambung.</ScreenTitle>
          <Lede>{CONNECTION_ERROR}</Lede>
        </>
      ) : (
        <div className="mt-5 flex items-center gap-3">
          <LoaderCircle aria-hidden className="size-6 animate-spin text-tinta" />
          <ScreenTitle>Menyambungkan…</ScreenTitle>
        </div>
      )}
    </ScreenLayout>
  );
}
