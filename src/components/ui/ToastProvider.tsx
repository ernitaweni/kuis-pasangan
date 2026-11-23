import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { ToastContext } from '@/hooks/useToast';

const TOAST_MS = 2500;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);

  const show = useCallback((message: string) => {
    setToast((previous) => ({ id: (previous?.id ?? 0) + 1, message }));
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  return (
    <ToastContext value={show}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-28 z-50 flex justify-center px-5"
      >
        {toast ? (
          <p
            key={toast.id}
            className="animate-pop rounded-full bg-tinta px-4 py-2.5 font-medium text-kertas"
          >
            {toast.message}
          </p>
        ) : null}
      </div>
    </ToastContext>
  );
}
