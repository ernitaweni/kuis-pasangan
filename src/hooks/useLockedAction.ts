import { useRef, useState } from 'react';

/**
 * Membungkus aksi async agar tap ganda hanya diproses sekali (FR-22).
 * Kunci dipegang di ref (sinkron), jadi dua klik dalam satu frame pun tetap tertahan.
 */
export function useLockedAction<A extends unknown[]>(action: (...args: A) => Promise<void>) {
  const locked = useRef(false);
  const [pending, setPending] = useState(false);

  const run = (...args: A): void => {
    if (locked.current) return;
    locked.current = true;
    setPending(true);
    void action(...args).finally(() => {
      locked.current = false;
      setPending(false);
    });
  };

  return [run, pending] as const;
}
