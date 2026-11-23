import { Component, type ErrorInfo, type ReactNode } from 'react';

interface State {
  failed: boolean;
}

/** Mencegah layar putih jika ada error tak terduga saat render (NFR Keandalan). */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Kuis Pasangan: error tak terduga', error, info.componentStack);
  }

  render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="mx-auto flex min-h-dvh max-w-[560px] flex-col justify-center px-5">
        <h1 className="font-serif text-title font-medium">Ada yang tidak beres.</h1>
        <p className="mt-2.5 max-w-[36ch] text-tinta-pudar">
          Muat ulang halaman. Kalau kamu sedang di dalam room, kamu akan masuk kembali ke posisi
          terakhir.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-6 h-12 w-full rounded-full bg-tinta font-semibold text-kertas hover:bg-tinta-terang"
        >
          Muat ulang
        </button>
      </main>
    );
  }
}
