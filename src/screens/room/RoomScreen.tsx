import { useEffect, useState } from 'react';
import { Banner } from '@/components/ui/Banner';
import { ConfirmDialog } from '@/components/ui/Dialogs';
import { useBackend } from '@/hooks/useBackend';
import { useRoom } from '@/hooks/useRoom';
import type { Backend } from '@/services/backend';
import { getAppStorage } from '@/services/storage';
import type { RoomCode } from '@/types';
import { ConnectingScreen } from '../ConnectingScreen';
import { EndedView } from './EndedView';
import { LobbyView } from './LobbyView';
import { CountdownView, QuizView } from './PlayViews';
import { ResultView } from './ResultView';
import { partnerNameOf } from './threadEnds';

export function RoomScreen({ code, onExit }: { code: RoomCode; onExit: () => void }) {
  const [state, retry] = useBackend();
  if (state.status !== 'ready') {
    return <ConnectingScreen failed={state.status === 'error'} onRetry={retry} onHome={onExit} />;
  }
  return <RoomSession code={code} backend={state.backend} onExit={onExit} />;
}

type ExitConfirm = 'close-lobby' | 'leave-game' | null;

/** Memilih layar berdasarkan fase room (ADR-3) dan menangani keluar dari room. */
function RoomSession({
  code,
  backend,
  onExit,
}: {
  code: RoomCode;
  backend: Backend;
  onExit: () => void;
}) {
  const room = useRoom(code, backend);
  const [confirm, setConfirm] = useState<ExitConfirm>(null);
  const { rooms, uid } = backend;

  const ended =
    room.kind === 'missing' ||
    room.kind === 'denied' ||
    (room.kind === 'ready' && (room.phase === 'closed' || room.phase === 'expired'));
  const active = room.kind === 'ready' && !ended;

  // Room aktif diingat untuk masuk kembali setelah refresh (FR-21); room yang berakhir dilupakan.
  useEffect(() => {
    const storage = getAppStorage();
    if (ended) storage.clearActiveRoom();
    else if (active) storage.saveActiveRoom(code);
  }, [ended, active, code]);

  if (room.kind === 'loading') {
    return <ConnectingScreen failed={false} onRetry={() => undefined} onHome={onExit} />;
  }
  if (room.kind === 'missing' || room.kind === 'denied') {
    return <EndedView reason={room.kind} onHome={onExit} />;
  }

  const { snapshot, phase, serverNow, offline } = room;
  const { me, partner } = snapshot;
  const partnerName = partnerNameOf(snapshot);
  const inGame = phase === 'countdown' || phase === 'answering';

  const banner = offline ? (
    <Banner message="Koneksi terputus. Jawabanmu tersimpan begitu tersambung lagi." />
  ) : partner && !partner.online && inGame ? (
    <Banner message={`${partnerName} terputus. Kuis lanjut otomatis begitu dia tersambung lagi.`} />
  ) : null;

  // Penulisan dikirim tanpa ditunggu: saat offline, Firebase mengantrenya (FR-20).
  const leaveLobby = () => {
    void rooms.leaveLobby({ code, uid, role: me.role }).catch(() => undefined);
    onExit();
  };
  const leaveGame = () => {
    void rooms.closeRoom(code, 'player-left').catch(() => undefined);
    onExit();
  };
  const requestExit = () => {
    if (phase === 'lobby') {
      if (me.role === 'host' && partner) setConfirm('close-lobby');
      else leaveLobby();
    } else if (inGame) {
      setConfirm('leave-game');
    } else {
      onExit();
    }
  };

  let view;
  switch (phase) {
    case 'lobby':
      view = (
        <LobbyView snapshot={snapshot} rooms={rooms} banner={banner} onRequestExit={requestExit} />
      );
      break;
    case 'countdown':
      view = <CountdownView snapshot={snapshot} serverNow={serverNow} banner={banner} />;
      break;
    case 'answering':
      view = (
        <QuizView
          key={snapshot.state.round}
          snapshot={snapshot}
          rooms={rooms}
          banner={banner}
          onRequestExit={requestExit}
        />
      );
      break;
    case 'result':
      view = (
        <ResultView
          key={snapshot.state.round}
          snapshot={snapshot}
          rooms={rooms}
          banner={banner}
          onHome={onExit}
        />
      );
      break;
    case 'closed':
      view = (
        <EndedView
          reason={snapshot.state.closedReason ?? 'player-left'}
          snapshot={snapshot}
          onHome={onExit}
        />
      );
      break;
    case 'expired':
      view = <EndedView reason="expired" snapshot={snapshot} onHome={onExit} />;
      break;
  }

  return (
    <>
      {view}
      <ConfirmDialog
        open={confirm === 'close-lobby'}
        title="Tutup room?"
        message={`${partnerName} juga akan keluar dari room ini.`}
        confirmLabel="Tutup room"
        onConfirm={() => {
          setConfirm(null);
          leaveLobby();
        }}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === 'leave-game'}
        title="Keluar dari kuis?"
        message="Room akan ditutup dan progres kalian berdua hilang."
        confirmLabel="Keluar"
        onConfirm={() => {
          setConfirm(null);
          leaveGame();
        }}
        onCancel={() => setConfirm(null)}
      />
    </>
  );
}
