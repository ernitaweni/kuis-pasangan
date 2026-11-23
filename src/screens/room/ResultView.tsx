import { CircleDashed, Heart } from 'lucide-react';
import { type ReactNode, useEffect } from 'react';
import { ThreadKnot } from '@/components/thread/ThreadKnot';
import { Button, TextButton } from '@/components/ui/Button';
import { CountUp } from '@/components/ui/CountUp';
import { CopyTextDialog } from '@/components/ui/Dialogs';
import { Disclosure } from '@/components/ui/Disclosure';
import { Lede, ScreenLayout, ScreenTitle } from '@/components/ui/ScreenLayout';
import { QUESTION_BANK, QUESTION_INDEX } from '@/data/questionBank';
import { useLockedAction } from '@/hooks/useLockedAction';
import { useShare } from '@/hooks/useShare';
import { useToast } from '@/hooks/useToast';
import type { RoomService } from '@/services/roomService';
import { getAppStorage } from '@/services/storage';
import type { ComparisonRow, OptionId, QuestionId, RoomSnapshot, Uid } from '@/types';
import { revealedQuestionIds, roundIdOf } from '@/utils/phase';
import { getCategory } from '@/utils/questionBank';
import { getPerspective, renderQuestionText } from '@/utils/questionText';
import { buildResult, getAnswerOrder } from '@/utils/scoring';
import { buildShareText } from '@/utils/share';
import { initialOf } from '@/utils/validation';
import { partnerNameOf } from './threadEnds';

function optionText(questionId: QuestionId, optionId: OptionId | undefined): string {
  if (optionId === undefined) return 'belum dijawab';
  return (
    QUESTION_INDEX.get(questionId)?.options.find((option) => option.id === optionId)?.text ??
    'belum dijawab'
  );
}

/**
 * Urutan momen Hasil dalam ms sejak layar muncul. Simpul hati selesai terikat sekitar 1,8 detik
 * (`--animate-thread-draw` di index.css), dan angka mulai menghitung naik bersamaan dengan
 * `--animate-reveal`.
 */
const REVEAL = { scoreAt: 1700, countFor: 900, titleAt: 2250, restAt: 2450 } as const;

/** Hasil terbuka serentak: simpul hati, persen, ringkasan karakter, perbandingan (FR-13–FR-18). */
export function ResultView({
  snapshot,
  rooms,
  banner,
  onHome,
}: {
  snapshot: RoomSnapshot;
  rooms: RoomService;
  banner: ReactNode;
  onHome: () => void;
}) {
  const toast = useToast();
  const { share, fallbackText, closeFallback } = useShare();
  const { code, me, partner, settings, state, meta, myAnswers, partnerAnswers } = snapshot;
  const isHost = me.role === 'host';
  const partnerName = partnerNameOf(snapshot);
  const questionIds = state.questionIds ?? [];
  const category = getCategory(QUESTION_BANK, settings.categoryId);

  const order = getAnswerOrder(settings, meta);
  const nameOf = (uid: Uid) => (uid === me.uid ? me.name : partnerName);
  const answersOf = (uid: Uid) => (uid === me.uid ? myAnswers : partnerAnswers);
  // Hasil akhir baru dihitung setelah semua jawaban pasangan terbuka (diambil per soal).
  const complete =
    questionIds.length > 0 &&
    revealedQuestionIds(questionIds, myAnswers, partnerAnswers).length === questionIds.length;
  const result =
    complete && order
      ? buildResult({
          questionIds,
          first: answersOf(order.firstUid),
          second: answersOf(order.secondUid),
          mode: settings.mode,
        })
      : null;
  const firstName = order ? nameOf(order.firstUid) : me.name;
  const secondName = order ? nameOf(order.secondUid) : partnerName;

  const perspective = getPerspective(settings.mode, me.uid, settings.targetUid);
  const targetName = settings.targetUid === me.uid ? me.name : partnerName;
  const questionText = (questionId: QuestionId) => {
    const question = QUESTION_INDEX.get(questionId);
    return question
      ? renderQuestionText(question.text, perspective, targetName)
      : 'Soal tidak tersedia';
  };

  // Simpan ke riwayat sekali per ronde (id = KODE-rN, idempoten).
  const historyId = `${code}-${roundIdOf(state.round)}`;
  const percent = result?.percent;
  const tierTitle = result?.tier.title;
  useEffect(() => {
    if (percent === undefined || tierTitle === undefined) return;
    getAppStorage().saveHistoryEntry({
      id: historyId,
      myName: me.name,
      partnerName,
      categoryId: settings.categoryId,
      mode: settings.mode,
      percent,
      tierTitle,
    });
  }, [historyId, percent, tierTitle, me.name, partnerName, settings.categoryId, settings.mode]);

  const [playAgain, restarting] = useLockedAction(async () => {
    if (!partner) return;
    try {
      await rooms.playAgain({
        code,
        currentRound: state.round,
        nextTargetUid: settings.targetUid === me.uid ? partner.uid : me.uid,
      });
    } catch {
      toast('Ronde baru belum bisa dimulai. Coba lagi.');
    }
  });

  const shareResult = () => {
    if (!result) return;
    void share({
      title: 'Hasil Kuis Pasangan',
      text: buildShareText({
        names: [firstName, secondName],
        categoryName: category.name,
        mode: settings.mode,
        percent: result.percent,
        tierTitle: result.tier.title,
        url: `${window.location.origin}${window.location.pathname}`,
      }),
      copiedMessage: 'Hasil disalin',
    });
  };

  const describe = (row: ComparisonRow): string[] => {
    const a = optionText(row.questionId, row.first);
    const b = optionText(row.questionId, row.second);
    if (settings.mode === 'guess') {
      return row.isMatch
        ? [`Jawaban ${firstName} dan tebakan ${secondName}: ${a}.`]
        : [`Jawaban ${firstName}: ${a}.`, `Tebakan ${secondName}: ${b}.`];
    }
    return row.isMatch
      ? [`Kalian sama-sama memilih: ${a}.`]
      : [`${firstName}: ${a}.`, `${secondName}: ${b}.`];
  };

  return (
    <ScreenLayout
      banner={banner}
      top={
        <>
          <TextButton className="ml-0" onClick={onHome}>
            Ke beranda
          </TextButton>
          <p className="pr-2 text-tinta-pudar tabular-nums">Ronde {state.round}</p>
        </>
      }
      actions={
        result ? (
          <>
            {/* Tanpa ikon: dua tombol berdampingan di layar 360px tetap muat tanpa terpotong. */}
            <Button variant="outline" className="flex-1" onClick={shareResult}>
              Bagikan hasil
            </Button>
            {isHost ? (
              <Button
                className="flex-1"
                loading={restarting}
                disabled={!partner}
                onClick={playAgain}
              >
                Main lagi
              </Button>
            ) : (
              <p className="flex-1 text-tinta-pudar">
                {partnerName} bisa memulai ronde berikutnya.
              </p>
            )}
          </>
        ) : undefined
      }
    >
      <ThreadKnot leftInitial={initialOf(firstName)} rightInitial={initialOf(secondName)} animate />

      {result ? (
        <>
          <p className="mt-3 animate-reveal font-serif text-score font-medium tracking-[-0.03em] text-tinta tabular-nums">
            <CountUp
              value={result.percent}
              suffix="%"
              delay={REVEAL.scoreAt}
              duration={REVEAL.countFor}
            />
          </p>
          <div className="animate-rise" style={{ animationDelay: `${REVEAL.titleAt}ms` }}>
            <ScreenTitle className="mt-1">{result.tier.title}</ScreenTitle>
            <Lede>
              {firstName} dan {secondName} cocok di {result.matches} dari {result.total} jawaban.{' '}
              {result.tier.description}
            </Lede>
          </div>

          <div className="animate-rise" style={{ animationDelay: `${REVEAL.restAt}ms` }}>
            <section aria-labelledby="obrolan" className="mt-5">
              <h2 id="obrolan" className="font-serif text-[1.25rem] leading-tight font-medium">
                Ngobrolin ini, yuk
              </h2>
              {result.talkingPoints.length > 0 ? (
                <ul className="mt-2 grid gap-2">
                  {result.talkingPoints.map((row) => (
                    <li key={row.questionId} className="border-l-2 border-mawar pl-3 font-serif">
                      {questionText(row.questionId)}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1.5 text-tinta-pudar">Semua jawaban kalian sama. Kompak banget.</p>
              )}
            </section>

            <Disclosure summary="Lihat semua jawaban" className="mt-5">
              <ol>
                {result.rows.map((row, index) => (
                  <li
                    key={row.questionId}
                    className="grid grid-cols-[1.25rem_1fr_auto] gap-x-2.5 gap-y-0.5 border-t border-garis py-2.5"
                  >
                    <span aria-hidden className="text-tinta-pudar tabular-nums">
                      {index + 1}
                    </span>
                    <p className="font-serif">{questionText(row.questionId)}</p>
                    <span
                      className={`inline-flex items-center gap-1 font-semibold ${row.isMatch ? 'text-tinta' : 'text-tinta-pudar'}`}
                    >
                      {row.isMatch ? (
                        <Heart
                          aria-hidden
                          strokeWidth={2}
                          className="size-4 fill-mawar text-mawar"
                        />
                      ) : (
                        <CircleDashed aria-hidden strokeWidth={2} className="size-4" />
                      )}
                      {row.isMatch ? 'Cocok' : 'Beda'}
                    </span>
                    <div className="col-start-2 col-end-4 text-tinta-pudar">
                      {describe(row).map((line) => (
                        <p key={line}>{line}</p>
                      ))}
                    </div>
                  </li>
                ))}
              </ol>
            </Disclosure>
          </div>
        </>
      ) : (
        <p role="status" className="mt-6 text-center text-tinta-pudar">
          Membuka hasil…
        </p>
      )}

      <CopyTextDialog text={fallbackText} onClose={closeFallback} />
    </ScreenLayout>
  );
}
