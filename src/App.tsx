import { useCallback, useEffect, useState } from 'react';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { ToastProvider } from '@/components/ui/ToastProvider';
import { CreateRoomScreen } from '@/screens/CreateRoomScreen';
import { HomeScreen } from '@/screens/HomeScreen';
import { JoinScreen } from '@/screens/JoinScreen';
import { ResolveScreen } from '@/screens/ResolveScreen';
import { RoomScreen } from '@/screens/room/RoomScreen';
import { getAppStorage } from '@/services/storage';
import type { JoinError, RoomCode } from '@/types';
import type { JoinAssessment } from '@/utils/phase';
import { readRoomCodeFromSearch } from '@/utils/roomCode';

/** Layar tingkat atas. Di dalam room, isi layar ditentukan fase room (tanpa router, ADR-3). */
type View =
  | { name: 'home' }
  | { name: 'create' }
  | { name: 'join'; code: RoomCode | null; error: JoinError | null }
  | { name: 'resolving'; code: RoomCode; source: 'link' | 'resume' }
  | { name: 'room'; code: RoomCode };

/** Link undangan (?room=) diutamakan, lalu room aktif yang tersimpan (FR-21), lalu Beranda. */
function initialView(): View {
  const fromLink = readRoomCodeFromSearch(window.location.search);
  if (fromLink) return { name: 'resolving', code: fromLink, source: 'link' };
  const active = getAppStorage().loadActiveRoom();
  if (active) return { name: 'resolving', code: active.code, source: 'resume' };
  return { name: 'home' };
}

/** URL selalu memuat ?room=KODE selama di dalam room, agar refresh dan berbagi link aman. */
function syncUrl(view: View) {
  const code =
    view.name === 'room' || view.name === 'resolving' || view.name === 'join' ? view.code : null;
  const search = code ? `?room=${code}` : '';
  if (window.location.search !== search) {
    window.history.replaceState(null, '', `${window.location.pathname}${search}`);
  }
}

export default function App() {
  const [view, setView] = useState<View>(initialView);

  useEffect(() => {
    syncUrl(view);
    window.scrollTo(0, 0);
  }, [view]);

  const goHome = useCallback(() => {
    getAppStorage().clearActiveRoom();
    setView({ name: 'home' });
  }, []);

  const enterRoom = useCallback((code: RoomCode) => setView({ name: 'room', code }), []);

  const handleResolved = useCallback(
    (code: RoomCode, source: 'link' | 'resume', assessment: JoinAssessment) => {
      if (assessment.kind === 'member') {
        setView({ name: 'room', code });
      } else if (source === 'resume') {
        getAppStorage().clearActiveRoom();
        setView({ name: 'home' });
      } else {
        setView({
          name: 'join',
          code,
          error: assessment.kind === 'blocked' ? assessment.error : null,
        });
      }
    },
    [],
  );

  let screen;
  switch (view.name) {
    case 'home':
      screen = (
        <HomeScreen
          onCreate={() => setView({ name: 'create' })}
          onJoin={() => setView({ name: 'join', code: null, error: null })}
        />
      );
      break;
    case 'create':
      screen = <CreateRoomScreen onBack={goHome} onCreated={enterRoom} />;
      break;
    case 'join':
      screen = (
        <JoinScreen
          key={view.code ?? 'manual'}
          initialCode={view.code}
          initialError={view.error}
          onBack={goHome}
          onJoined={enterRoom}
        />
      );
      break;
    case 'resolving':
      screen = (
        <ResolveScreen
          key={view.code}
          code={view.code}
          source={view.source}
          onResolved={handleResolved}
          onHome={goHome}
        />
      );
      break;
    case 'room':
      screen = <RoomScreen key={view.code} code={view.code} onExit={goHome} />;
      break;
  }

  return (
    <ErrorBoundary>
      <ToastProvider>{screen}</ToastProvider>
    </ErrorBoundary>
  );
}
