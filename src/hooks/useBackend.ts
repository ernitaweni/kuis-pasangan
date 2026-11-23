import { useCallback, useEffect, useState } from 'react';
import { type Backend, getBackend } from '@/services/backend';
import { withTimeout } from '@/utils/async';

export type BackendState =
  { status: 'loading' } | { status: 'ready'; backend: Backend } | { status: 'error' };

const CONNECT_TIMEOUT_MS = 15_000;

/** Memuat Firebase + login anonim saat dibutuhkan, dengan tombol coba lagi jika gagal. */
export function useBackend() {
  const [state, setState] = useState<BackendState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    withTimeout(getBackend(), CONNECT_TIMEOUT_MS).then(
      (backend) => {
        if (active) setState({ status: 'ready', backend });
      },
      () => {
        if (active) setState({ status: 'error' });
      },
    );
    return () => {
      active = false;
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setState({ status: 'loading' });
    setAttempt((n) => n + 1);
  }, []);

  return [state, retry] as const;
}
