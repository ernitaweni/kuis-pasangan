import { useLayoutEffect, useRef, useState } from 'react';
import { THREAD_WIDTH } from './geometry';

interface Size {
  width: number;
  height: number;
}

/** Ukuran elemen dalam piksel (dibulatkan), diperbarui setiap kali elemen berubah ukuran. */
export function useSize<T extends Element>(initial: Size) {
  const ref = useRef<T>(null);
  const [size, setSize] = useState(initial);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.round(entry?.contentRect.width ?? 0);
      const height = Math.round(entry?.contentRect.height ?? 0);
      if (width > 0 && height > 0) {
        setSize((previous) =>
          previous.width === width && previous.height === height ? previous : { width, height },
        );
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return [ref, size] as const;
}

/**
 * Lebar elemen dalam piksel. Benang digambar dengan 1 unit SVG = 1 piksel, sehingga tinggi,
 * titik, dan huruf inisialnya sama di HP maupun laptop (tidak ikut membesar bersama lebar).
 */
export function useWidth<T extends Element>() {
  const [ref, size] = useSize<T>({ width: THREAD_WIDTH, height: 1 });
  return [ref, size.width] as const;
}
