export class TimeoutError extends Error {
  constructor(ms: number) {
    super(`Melebihi batas waktu ${ms} ms`);
    this.name = 'TimeoutError';
  }
}

/**
 * Menolak jika `promise` belum selesai dalam `ms` milidetik. Dipakai agar tombol tidak berputar
 * selamanya saat koneksi putus (penulisan Firebase menunggu sampai tersambung lagi).
 */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError(ms)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}
