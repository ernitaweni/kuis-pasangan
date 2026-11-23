import { ThreadLink } from '@/components/thread/ThreadLink';
import { Button } from '@/components/ui/Button';
import { Lede, ScreenLayout, ScreenTitle } from '@/components/ui/ScreenLayout';
import type { ClosedReason, RoomSnapshot } from '@/types';

export type EndReason = ClosedReason | 'expired' | 'missing' | 'denied';

/** Room ditutup, kedaluwarsa, tidak ditemukan, atau bukan anggota. */
export function EndedView({
  reason,
  snapshot,
  onHome,
}: {
  reason: EndReason;
  snapshot?: RoomSnapshot;
  onHome: () => void;
}) {
  const partnerName = snapshot?.partner?.name || 'Pasanganmu';
  const hostName = snapshot?.meta.hostName || 'Pembuat room';

  const copy: Record<EndReason, [string, string]> = {
    'host-left': [`${hostName} menutup room.`, 'Buat room baru kalau mau main lagi.'],
    'player-left': [
      `${partnerName} keluar dari kuis.`,
      'Room ini sudah ditutup. Kalian bisa mulai lagi dari room baru.',
    ],
    expired: ['Room ini sudah lewat 24 jam.', 'Buat room baru untuk main lagi.'],
    missing: ['Room ini tidak ditemukan.', 'Mungkin kodenya salah, atau room-nya sudah ditutup.'],
    denied: [
      'Kamu tidak terdaftar di room ini.',
      'Minta pasanganmu mengirim link baru, atau buat room sendiri.',
    ],
  };
  const [title, lede] = copy[reason];

  return (
    <ScreenLayout
      actions={
        <Button fullWidth onClick={onHome}>
          Ke beranda
        </Button>
      }
    >
      <ThreadLink
        connected={false}
        left={{ name: 'Kamu', present: true }}
        right={{ name: snapshot?.partner?.name || 'Dia', present: false }}
      />
      <ScreenTitle className="mt-5">{title}</ScreenTitle>
      <Lede>{lede}</Lede>
    </ScreenLayout>
  );
}
