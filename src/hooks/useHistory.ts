import { useState } from 'react';
import { getAppStorage } from '@/services/storage';

/** Riwayat 5 skor terakhir di perangkat ini (FR-23). */
export function useHistory() {
  const storage = getAppStorage();
  const [entries, setEntries] = useState(() => storage.loadHistory());
  const clear = () => {
    storage.clearHistory();
    setEntries([]);
  };
  return { entries, clear, persistent: storage.persistent };
}
