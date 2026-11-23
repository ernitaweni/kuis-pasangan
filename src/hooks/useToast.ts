import { createContext, use } from 'react';

export type ShowToast = (message: string) => void;

export const ToastContext = createContext<ShowToast>(() => undefined);

/** Menampilkan pesan singkat (2,5 detik), misalnya "Link disalin". */
export function useToast(): ShowToast {
  return use(ToastContext);
}
