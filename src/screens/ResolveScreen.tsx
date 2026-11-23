import { useEffect, useState } from 'react';
import { getBackend } from '@/services/backend';
import { preconnectFirebase } from '@/services/preconnect';
import type { RoomCode } from '@/types';
import { withTimeout } from '@/utils/async';
import { type JoinAssessment, assessJoin } from '@/utils/phase';
import { ConnectingScreen } from './ConnectingScreen';

const TIMEOUT_MS = 15_000;

/**
 * Memeriksa room dari link undangan atau dari room aktif yang tersimpan: anggota langsung
 * masuk kembali, selain itu diarahkan ke layar Gabung atau Beranda.
 */
export function ResolveScreen({
  code,
  source,
  onResolved,
  onHome,
}: {
  code: RoomCode;
  source: 'link' | 'resume';
  /** Harus stabil (useCallback): dipakai sebagai dependensi effect. */
  onResolved: (code: RoomCode, source: 'link' | 'resume', assessment: JoinAssessment) => void;
  onHome: () => void;
}) {
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    // Buka koneksi ke server Firebase sambil SDK-nya masih diunduh (temuan QA T1).
    preconnectFirebase();
    withTimeout(getBackend(), TIMEOUT_MS)
      .then(async (backend) => {
        const info = await withTimeout(backend.rooms.getRoomInfo(code), TIMEOUT_MS);
        return assessJoin(
          info?.meta ?? null,
          info?.state ?? null,
          backend.uid,
          backend.rooms.serverNow(),
        );
      })
      .then(
        (assessment) => {
          if (active) onResolved(code, source, assessment);
        },
        () => {
          if (active) setFailed(true);
        },
      );
    return () => {
      active = false;
    };
  }, [code, source, attempt, onResolved]);

  return (
    <ConnectingScreen
      failed={failed}
      onRetry={() => {
        setFailed(false);
        setAttempt((n) => n + 1);
      }}
      onHome={onHome}
    />
  );
}
