import { CircleDashed, Heart, LoaderCircle, X } from 'lucide-react';
import { type ReactNode, useId, useRef, useState } from 'react';
import { ThreadLink } from '@/components/thread/ThreadLink';
import { ThreadProgress } from '@/components/thread/ThreadProgress';
import { Button, IconButton } from '@/components/ui/Button';
import {
  type ChoiceMarker,
  MARKER_FIRST,
  MARKER_SECOND,
  OptionButton,
  RevealOption,
} from '@/components/ui/Choices';
import { Lede, ScreenLayout, ScreenTitle } from '@/components/ui/ScreenLayout';
import { QUESTION_INDEX } from '@/data/questionBank';
import { radioItemProps } from '@/hooks/useRadioKeys';
import { useToast } from '@/hooks/useToast';
import type { RoomService } from '@/services/roomService';
import type { OptionId, PlayerView, Question, QuestionStep, RoomSnapshot } from '@/types';
import { COUNTDOWN_MS, OPTION_IDS } from '@/utils/constants';
import { countAnswered, deriveQuestionStep, revealedQuestionIds, roundIdOf } from '@/utils/phase';
import {
  getPerspective,
  questionHint,
  renderQuestionText,
  revealMessage,
} from '@/utils/questionText';
import { getAnswerOrder } from '@/utils/scoring';
import { initialOf } from '@/utils/validation';
import { partnerNameOf, threadEnds } from './threadEnds';

/** Hitung mundur 3-2-1 yang serentak di kedua HP (ADR-8). */
export function CountdownView({
  snapshot,
  serverNow,
  banner,
}: {
  snapshot: RoomSnapshot;
  serverNow: number;
  banner: ReactNode;
}) {
  const [hostEnd, guestEnd] = threadEnds(snapshot);
  const startedAt = snapshot.state.startedAt ?? serverNow;
  const remaining = Math.min(
    3,
    Math.max(1, Math.ceil((startedAt + COUNTDOWN_MS - serverNow) / 1000)),
  );

  return (
    <ScreenLayout banner={banner}>
      <ThreadLink connected left={hostEnd} right={guestEnd} />
      <ScreenTitle className="mt-5">Siap-siap.</ScreenTitle>
      <Lede>Soal pertama muncul bersamaan di HP kalian.</Lede>
      {/* Benang melingkari angka selama satu detik, lalu angka berikutnya muncul. */}
      <div className="relative mx-auto mt-6 grid size-36 place-items-center">
        <svg
          key={`cincin-${remaining}`}
          viewBox="0 0 100 100"
          className="absolute inset-0 -rotate-90 overflow-visible"
          aria-hidden
        >
          <circle cx={50} cy={50} r={48} fill="none" strokeWidth={1.5} className="stroke-garis" />
          <circle
            cx={50}
            cy={50}
            r={48}
            pathLength={1}
            fill="none"
            strokeWidth={2.25}
            strokeLinecap="round"
            className="animate-tick stroke-mawar [stroke-dasharray:1_2]"
          />
        </svg>
        <p
          key={`angka-${remaining}`}
          aria-live="assertive"
          className="animate-pop font-serif text-[6rem] leading-none font-medium text-tinta tabular-nums"
        >
          {remaining}
        </p>
      </div>
    </ScreenLayout>
  );
}

const progressOf = (player: PlayerView) => ({ answered: player.answered, ready: player.ready });

/**
 * Kuis dengan jawaban dibuka per soal. Soal yang tampil sama di kedua HP; setelah terbuka,
 * keduanya menekan "Siap" dan soal berikutnya muncul bersamaan.
 */
export function QuizView({
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
  const { me, partner, state, myAnswers, partnerAnswers } = snapshot;
  const questionIds = state.questionIds ?? [];
  const step = deriveQuestionStep({
    questionIds,
    myAnswers,
    mine: progressOf(me),
    partner: partner ? progressOf(partner) : undefined,
  });
  const questionId = step ? questionIds[step.index] : undefined;
  const question = questionId === undefined ? undefined : QUESTION_INDEX.get(questionId);

  const revealed = revealedQuestionIds(questionIds, myAnswers, partnerAnswers);
  const matches = revealed.filter((id) => myAnswers[id] === partnerAnswers[id]).length;

  const exitButton = (
    <IconButton label="Keluar dari kuis" onClick={onRequestExit}>
      <X aria-hidden strokeWidth={1.75} className="size-6" />
    </IconButton>
  );

  if (!step || !question) {
    return (
      <ScreenLayout banner={banner} top={exitButton}>
        <ScreenTitle>Soal ronde ini tidak bisa dimuat.</ScreenTitle>
        <Lede>Keluar dari kuis, lalu buat room baru.</Lede>
      </ScreenLayout>
    );
  }

  return (
    <QuestionPanel
      // Kunci per soal: pilihan sementara dan kunci tap ganda direset otomatis setiap soal baru.
      key={`${state.round}-${step.index}`}
      snapshot={snapshot}
      rooms={rooms}
      banner={banner}
      top={
        <>
          <div className="flex items-center gap-1">
            {exitButton}
            <p className="font-semibold tabular-nums">
              Soal {step.index + 1} dari {questionIds.length}
            </p>
          </div>
          {revealed.length > 0 ? (
            <p className="pr-2 text-tinta-pudar tabular-nums">
              Cocok {matches} dari {revealed.length}
            </p>
          ) : null}
        </>
      }
      step={step}
      question={question}
    />
  );
}

function QuestionPanel({
  snapshot,
  rooms,
  banner,
  top,
  step,
  question,
}: {
  snapshot: RoomSnapshot;
  rooms: RoomService;
  banner: ReactNode;
  top: ReactNode;
  step: QuestionStep;
  question: Question;
}) {
  const toast = useToast();
  const titleId = useId();
  const [draft, setDraft] = useState<OptionId | null>(null);
  const answerLock = useRef(false);
  const readyLock = useRef(false);

  const { code, me, partner, settings, state, meta, myAnswers, partnerAnswers } = snapshot;
  const questionIds = state.questionIds ?? [];
  const total = questionIds.length;
  const roundId = roundIdOf(state.round);
  const partnerName = partnerNameOf(snapshot);
  const perspective = getPerspective(settings.mode, me.uid, settings.targetUid);
  const viewerIsTarget = settings.targetUid === me.uid;
  const targetName = viewerIsTarget ? me.name : partnerName;

  const myAnswer = myAnswers[question.id];
  const partnerAnswer = partnerAnswers[question.id];
  const isLast = step.index >= total - 1;

  // Penanda siapa memilih apa. Pemain pertama (Yang Ditebak / Host) terisi, kedua bergaris.
  const order = getAnswerOrder(settings, meta);
  const answerOf = (uid: string) => (uid === me.uid ? myAnswer : partnerAnswer);
  const nameOf = (uid: string) => (uid === me.uid ? me.name : partnerName);
  const roleLabel = (position: 'first' | 'second') =>
    settings.mode === 'guess' ? (position === 'first' ? 'Jawaban' : 'Tebakan') : 'Pilihan';
  const players = order
    ? ([
        [order.firstUid, 'first'],
        [order.secondUid, 'second'],
      ] as const)
    : [];
  const markersFor = (optionId: OptionId, onlyMine: boolean): ChoiceMarker[] =>
    players
      .filter(([uid]) => (onlyMine ? uid === me.uid : true) && answerOf(uid) === optionId)
      .map(([uid, position]) => ({
        initial: initialOf(nameOf(uid)),
        label: `${roleLabel(position)} ${nameOf(uid)}`,
        first: position === 'first',
      }));

  const lockAnswer = () => {
    if (answerLock.current || draft === null) return;
    answerLock.current = true;
    rooms
      .submitAnswer({
        code,
        roundId,
        uid: me.uid,
        questionId: question.id,
        optionId: draft,
        answered: countAnswered(questionIds, { ...myAnswers, [question.id]: draft }),
      })
      .catch(() => {
        answerLock.current = false;
        toast('Jawaban belum tersimpan. Coba kunci lagi.');
      });
  };

  const markReady = () => {
    if (readyLock.current) return;
    readyLock.current = true;
    rooms.markReady({ code, roundId, uid: me.uid, ready: step.index + 1 }).catch(() => {
      readyLock.current = false;
      toast('Belum tersimpan. Coba tekan lagi.');
    });
  };

  const isOpen = step.kind === 'revealed' || step.kind === 'waiting-ready';
  const partnerAnswerLoaded = partnerAnswer !== undefined;
  const isMatch = myAnswer !== undefined && myAnswer === partnerAnswer;

  let action: ReactNode;
  if (step.kind === 'answering') {
    action = (
      <Button fullWidth disabled={draft === null} onClick={lockAnswer}>
        Kunci jawaban
      </Button>
    );
  } else if (step.kind === 'revealed' && partnerAnswerLoaded) {
    action = (
      <Button fullWidth onClick={markReady}>
        {isLast ? 'Lihat hasil akhir' : 'Siap, soal berikutnya'}
      </Button>
    );
  } else {
    const waitingText =
      step.kind === 'waiting-answer'
        ? `Menunggu ${partnerName} menjawab…`
        : step.kind === 'waiting-ready'
          ? `Menunggu ${partnerName} siap…`
          : 'Membuka jawaban…';
    action = (
      <Button
        fullWidth
        disabled
        icon={<LoaderCircle aria-hidden className="size-5 animate-spin" />}
      >
        {waitingText}
      </Button>
    );
  }

  return (
    <ScreenLayout banner={banner} top={top} actions={action}>
      <ThreadProgress
        mine={me.answered}
        partner={partner?.answered ?? 0}
        total={total}
        partnerName={partnerName}
      />
      <p className="mt-4 font-semibold text-tinta">
        {questionHint(settings.mode, perspective, targetName, partnerName)}
      </p>
      <ScreenTitle id={titleId} size="question" className="mt-1">
        {renderQuestionText(question.text, perspective, targetName)}
      </ScreenTitle>

      {step.kind === 'answering' ? (
        <>
          <div role="radiogroup" aria-labelledby={titleId} className="mt-4 grid gap-2">
            {question.options.map((option, index) => (
              <OptionButton
                key={option.id}
                index={index}
                letter={option.id}
                text={option.text}
                radio={radioItemProps(OPTION_IDS, draft, setDraft, option.id)}
              />
            ))}
          </div>
          <p aria-live="polite" className="mt-3 text-tinta-pudar">
            <span key={String(step.partnerAnswered)} className="animate-fade">
              {step.partnerAnswered
                ? `${partnerName} sudah menjawab.`
                : `${partnerName} sedang memilih…`}
            </span>{' '}
            Jawaban terkunci setelah kamu menekan Kunci jawaban.
          </p>
        </>
      ) : (
        <>
          <ul aria-labelledby={titleId} className="mt-4 grid gap-2">
            {question.options.map((option) => (
              <RevealOption
                key={option.id}
                letter={option.id}
                text={option.text}
                markers={markersFor(option.id, !(isOpen && partnerAnswerLoaded))}
              />
            ))}
          </ul>

          {isOpen && partnerAnswerLoaded && order ? (
            <>
              <p className="mt-2.5 flex animate-fade flex-wrap gap-x-4 gap-y-1 text-tinta-pudar">
                {players.map(([uid, position]) => (
                  <span key={uid} className="inline-flex items-center gap-1.5">
                    <span
                      aria-hidden
                      className={`size-3 rounded-full ${position === 'first' ? MARKER_FIRST : MARKER_SECOND}`}
                    />
                    {roleLabel(position)} {nameOf(uid)}
                  </span>
                ))}
              </p>
              {/* Pesan naik setelah penanda bertemu; hati berdetak sekali jika cocok. */}
              <p
                role="status"
                style={{ animationDelay: '150ms' }}
                className="mt-2 flex animate-rise items-center gap-2 font-semibold"
              >
                {isMatch ? (
                  <Heart
                    aria-hidden
                    strokeWidth={2}
                    className="size-5 shrink-0 animate-beat fill-mawar text-mawar"
                  />
                ) : (
                  <CircleDashed aria-hidden strokeWidth={2} className="size-5 shrink-0" />
                )}
                {revealMessage({
                  mode: settings.mode,
                  isMatch,
                  viewerIsTarget,
                  targetName,
                  partnerName,
                })}
              </p>
            </>
          ) : (
            <p aria-live="polite" className="mt-3 text-tinta-pudar">
              {step.kind === 'waiting-answer'
                ? `Jawabanmu terkunci. Jawaban kalian terbuka begitu ${partnerName} selesai memilih.`
                : 'Membuka jawaban…'}
            </p>
          )}
        </>
      )}
    </ScreenLayout>
  );
}
