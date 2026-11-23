import { Share2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { CATEGORY_ICONS } from '@/components/categoryIcons';
import { ThreadLink } from '@/components/thread/ThreadLink';
import { Button, TextButton } from '@/components/ui/Button';
import { ChoiceGroup, ChoiceTile, Segment } from '@/components/ui/Choices';
import { CopyTextDialog } from '@/components/ui/Dialogs';
import { RoomCodeChip } from '@/components/ui/RoomCodeChip';
import { Lede, ScreenLayout, ScreenTitle } from '@/components/ui/ScreenLayout';
import { QUESTION_BANK } from '@/data/questionBank';
import { useLockedAction } from '@/hooks/useLockedAction';
import { radioItemProps } from '@/hooks/useRadioKeys';
import { useShare } from '@/hooks/useShare';
import { useToast } from '@/hooks/useToast';
import type { RoomService } from '@/services/roomService';
import type { RoomSettingsDoc, RoomSnapshot, Uid } from '@/types';
import { CATEGORY_IDS, GAME_MODES, MODE_LABELS } from '@/utils/constants';
import { MODE_DESCRIPTIONS } from '@/utils/messages';
import { getCategory } from '@/utils/questionBank';
import { buildInviteUrl } from '@/utils/roomCode';
import { pickQuestionIds } from '@/utils/shuffle';
import { partnerNameOf, threadEnds } from './threadEnds';

export function LobbyView({
  snapshot,
  rooms,
  banner,
  onRequestExit,
}: {
  snapshot: RoomSnapshot;
  rooms: RoomService;
  banner: ReactNode;
  onRequestExit: () => void;
}) {
  const toast = useToast();
  const { share, fallbackText, closeFallback } = useShare();
  const { code, me, partner, settings, meta } = snapshot;
  const isHost = me.role === 'host';
  const [hostEnd, guestEnd] = threadEnds(snapshot);
  const partnerName = partnerNameOf(snapshot);
  const category = getCategory(QUESTION_BANK, settings.categoryId);
  const canStart = isHost && partner !== null && partner.online;

  const updateSettings = (patch: Partial<RoomSettingsDoc>) => {
    rooms.updateSettings(code, patch).catch(() => toast('Pengaturan belum tersimpan. Coba lagi.'));
  };

  const [start, starting] = useLockedAction(async () => {
    try {
      await rooms.startRound(code, pickQuestionIds(category));
    } catch {
      toast('Kuis belum bisa dimulai. Pastikan pasanganmu masih di room.');
    }
  });

  const invite = () => {
    void share({
      title: 'Kuis Pasangan',
      text: `${me.name} ngajak kamu main Kuis Pasangan. Kode room: ${code}`,
      url: buildInviteUrl(`${window.location.origin}${window.location.pathname}`, code),
      copiedMessage: 'Link disalin',
    });
  };

  // Mode Tebak Aku: pemain yang bukan Yang Ditebak menjadi Penebak.
  const players: Uid[] = meta.guestUid ? [meta.hostUid, meta.guestUid] : [];
  const guesserUid = players.find((uid) => uid !== settings.targetUid);
  const nameOfUid = (uid: Uid) => (uid === me.uid ? me.name : partnerName);

  return (
    <ScreenLayout
      banner={banner}
      top={
        <>
          <TextButton className="ml-0 text-tinta" onClick={onRequestExit}>
            Keluar
          </TextButton>
          <RoomCodeChip code={code} />
        </>
      }
      actions={
        isHost ? (
          <Button fullWidth disabled={!canStart} loading={starting} onClick={start}>
            Mulai kuis
          </Button>
        ) : undefined
      }
    >
      <ThreadLink
        connected={partner !== null}
        left={hostEnd}
        right={guestEnd}
        intro={isHost && !partner}
        waiting={!partner}
      />

      {isHost && !partner ? (
        <>
          <ScreenTitle className="mt-5">Ajak pasanganmu masuk.</ScreenTitle>
          <Lede>Kirim link ini lewat chat. Begitu dia masuk, benangnya tersambung.</Lede>
          <div className="mt-4 rounded-dialog bg-mawar-muda p-4">
            <p className="font-semibold text-tinta-pudar">Kode room</p>
            <p
              aria-label={code.split('').join(' ')}
              className="mt-1 text-[2rem] leading-none font-bold tracking-[0.2em] tabular-nums"
            >
              {code}
            </p>
            <Button
              className="mt-4"
              fullWidth
              variant="outline"
              icon={<Share2 aria-hidden strokeWidth={1.75} className="size-5" />}
              onClick={invite}
            >
              Bagikan link
            </Button>
          </div>
          {/* Pengaturan lengkap baru muncul setelah pasangan masuk, agar layar ini fokus ke undangan. */}
          <p className="mt-4 text-tinta-pudar">
            Kategori {category.name}, mode {MODE_LABELS[settings.mode]}. Bisa diubah begitu
            pasanganmu masuk.
          </p>
        </>
      ) : isHost ? (
        // Begitu pasangan masuk: benang menegang dulu, lalu pengaturan naik menyusul.
        <div className="animate-rise" style={{ animationDelay: '250ms' }}>
          <ScreenTitle className="mt-5">{partnerName} sudah masuk.</ScreenTitle>
          <Lede>
            {partner?.online
              ? 'Pilih kuisnya, lalu mulai bareng.'
              : `${partnerName} sedang terputus. Tombol mulai aktif lagi begitu dia online.`}
          </Lede>

          <ChoiceGroup legend="Kategori" layout="tiles" hint={category.description}>
            {CATEGORY_IDS.map((id) => (
              <ChoiceTile
                key={id}
                icon={CATEGORY_ICONS[id]}
                title={getCategory(QUESTION_BANK, id).name}
                radio={radioItemProps(
                  CATEGORY_IDS,
                  settings.categoryId,
                  (categoryId) => updateSettings({ categoryId }),
                  id,
                )}
              />
            ))}
          </ChoiceGroup>

          <ChoiceGroup
            legend="Mode"
            layout="segmented"
            hint={
              settings.mode === 'guess' && guesserUid ? (
                <>
                  {nameOfUid(settings.targetUid)} menjawab tentang dirinya, {nameOfUid(guesserUid)}{' '}
                  menebak.{' '}
                  <button
                    type="button"
                    onClick={() => updateSettings({ targetUid: guesserUid })}
                    className="-my-3 py-3 font-semibold text-tinta underline decoration-mawar decoration-2 underline-offset-4"
                  >
                    Tukar peran
                  </button>
                </>
              ) : (
                MODE_DESCRIPTIONS[settings.mode]
              )
            }
          >
            {GAME_MODES.map((mode) => (
              <Segment
                key={mode}
                label={MODE_LABELS[mode]}
                radio={radioItemProps(
                  GAME_MODES,
                  settings.mode,
                  (value) => updateSettings({ mode: value }),
                  mode,
                )}
              />
            ))}
          </ChoiceGroup>
        </div>
      ) : (
        <>
          <ScreenTitle className="mt-5">Kamu sudah masuk.</ScreenTitle>
          <Lede>{hostEnd.name} yang memulai kuisnya. Tunggu sebentar, ya.</Lede>
          <dl className="mt-5 border-y border-garis">
            <div className="flex items-baseline justify-between gap-4 py-2.5">
              <dt className="text-tinta-pudar">Kategori</dt>
              <dd className="text-right font-semibold">{category.name}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 border-t border-garis py-2.5">
              <dt className="text-tinta-pudar">Mode</dt>
              <dd className="text-right font-semibold">{MODE_LABELS[settings.mode]}</dd>
            </div>
            {settings.mode === 'guess' ? (
              <div className="flex items-baseline justify-between gap-4 border-t border-garis py-2.5">
                <dt className="text-tinta-pudar">Yang ditebak</dt>
                <dd className="text-right font-semibold">
                  {settings.targetUid === me.uid ? 'Kamu' : hostEnd.name}
                </dd>
              </div>
            ) : null}
          </dl>
        </>
      )}

      <CopyTextDialog text={fallbackText} onClose={closeFallback} />
    </ScreenLayout>
  );
}
