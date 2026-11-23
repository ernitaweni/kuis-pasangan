import { useState } from 'react';
import { useToast } from './useToast';

/**
 * Berbagi dengan tiga lapis cadangan (FR-17): share sheet bawaan → salin ke clipboard + toast
 * → dialog berisi teks untuk disalin manual (`fallbackText`).
 */
export function useShare() {
  const toast = useToast();
  const [fallbackText, setFallbackText] = useState<string | null>(null);

  const share = async (input: {
    title: string;
    text: string;
    url?: string;
    copiedMessage: string;
  }) => {
    const fullText = input.url ? `${input.text}\n${input.url}` : input.text;

    if (typeof navigator.share === 'function') {
      try {
        await navigator.share(
          input.url
            ? { title: input.title, text: input.text, url: input.url }
            : { title: input.title, text: input.text },
        );
        return;
      } catch (error) {
        // Dibatalkan pengguna: jangan lanjut ke cadangan.
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }

    try {
      await navigator.clipboard.writeText(fullText);
      toast(input.copiedMessage);
    } catch {
      setFallbackText(fullText);
    }
  };

  return { share, fallbackText, closeFallback: () => setFallbackText(null) };
}
