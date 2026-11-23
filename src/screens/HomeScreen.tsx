import { useState } from 'react';
import { ThreadLoop } from '@/components/thread/ThreadLoop';
import { Button, TextButton } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Dialogs';
import { Disclosure } from '@/components/ui/Disclosure';
import { Lede, ScreenLayout, ScreenTitle } from '@/components/ui/ScreenLayout';
import { QUESTION_BANK } from '@/data/questionBank';
import { useHistory } from '@/hooks/useHistory';
import { MODE_LABELS } from '@/utils/constants';
import { getCategory } from '@/utils/questionBank';

const dateFormat = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' });

/**
 * Beranda: satu layar penuh. Benang bersimpul longgar menghubungkan "Kamu" dan "Dia", lalu judul
 * dan satu kalimat pembuka; tombol di bawah dalam jangkauan jempol. Di layar yang lebih tinggi,
 * benang menjuntai lebih panjang (maks. 240px) dan sisa ruang dibagi rata di atas benang dan di
 * atas tombol, jadi komposisinya tetap utuh dari HP pendek sampai laptop.
 */
export function HomeScreen({ onCreate, onJoin }: { onCreate: () => void; onJoin: () => void }) {
  const { entries, clear, persistent } = useHistory();
  const [confirmClear, setConfirmClear] = useState(false);

  return (
    <ScreenLayout fill>
      <p className="font-serif text-[1.0625rem] leading-6 font-medium">Kuis Pasangan</p>

      <div aria-hidden className="flex-[1_1_1rem]" />
      <ThreadLoop className="max-h-[240px] flex-[2_1_140px]" />
      <ScreenTitle size="display" className="mt-6">
        Seberapa kenal kamu sama dia?
      </ScreenTitle>
      <Lede className="mt-3">
        Jawab soal yang sama dari HP masing-masing, sejauh apa pun jarak kalian.
      </Lede>
      <div aria-hidden className="flex-[1_1_1.5rem]" />

      <div className="grid gap-2.5">
        <Button fullWidth onClick={onCreate}>
          Buat room
        </Button>
        <Button fullWidth variant="outline" onClick={onJoin}>
          Gabung pakai kode
        </Button>
      </div>

      {entries.length > 0 ? (
        <Disclosure
          className="mt-4"
          summary={
            <span>
              Riwayat main <span className="font-normal text-tinta-pudar">({entries.length})</span>
            </span>
          }
        >
          <ul>
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="flex items-center justify-between gap-4 border-t border-garis py-2"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold">{entry.partnerName}</p>
                  <p className="text-tinta-pudar">
                    {getCategory(QUESTION_BANK, entry.categoryId).name}, mode{' '}
                    {MODE_LABELS[entry.mode]}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-semibold tabular-nums">{entry.percent}%</p>
                  <time
                    dateTime={new Date(entry.playedAt).toISOString()}
                    className="text-tinta-pudar"
                  >
                    {dateFormat.format(entry.playedAt)}
                  </time>
                </div>
              </li>
            ))}
          </ul>
          <TextButton className="mt-1" onClick={() => setConfirmClear(true)}>
            Hapus riwayat
          </TextButton>
        </Disclosure>
      ) : null}

      <p className="mt-4 text-pretty text-tinta-pudar">
        Yang disimpan cuma nama panggilan dan jawaban.
        {persistent ? '' : ' Di mode privat, riwayat hilang saat tab ditutup.'}
      </p>

      <ConfirmDialog
        open={confirmClear}
        title="Hapus riwayat?"
        message="Skor terakhir di HP ini akan dihapus. Pasanganmu tetap menyimpan riwayatnya sendiri."
        confirmLabel="Hapus riwayat"
        onConfirm={() => {
          clear();
          setConfirmClear(false);
        }}
        onCancel={() => setConfirmClear(false)}
      />
    </ScreenLayout>
  );
}
