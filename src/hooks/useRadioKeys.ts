import type { KeyboardEvent } from 'react';

/**
 * Perilaku keyboard radio group standar (WAI-ARIA): panah memindahkan fokus sekaligus memilih,
 * Home/End ke ujung, dan hanya satu item yang bisa di-Tab (roving tabindex).
 */
export function radioItemProps<T extends string>(
  values: readonly T[],
  selected: T | null,
  onSelect: (value: T) => void,
  item: T,
) {
  const focusable = selected ?? values[0];

  const moveTo = (event: KeyboardEvent<HTMLElement>, target: T | undefined) => {
    if (target === undefined) return;
    event.preventDefault();
    onSelect(target);
    const group = event.currentTarget.closest('[role="radiogroup"]');
    group?.querySelector<HTMLElement>(`[data-radio-value="${CSS.escape(target)}"]`)?.focus();
  };

  return {
    role: 'radio' as const,
    'aria-checked': selected === item,
    'data-radio-value': item,
    tabIndex: item === focusable ? 0 : -1,
    onClick: () => onSelect(item),
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      const index = values.indexOf(item);
      const count = values.length;
      switch (event.key) {
        case 'ArrowDown':
        case 'ArrowRight':
          moveTo(event, values[(index + 1) % count]);
          break;
        case 'ArrowUp':
        case 'ArrowLeft':
          moveTo(event, values[(index - 1 + count) % count]);
          break;
        case 'Home':
          moveTo(event, values[0]);
          break;
        case 'End':
          moveTo(event, values[count - 1]);
          break;
        default:
          break;
      }
    },
  };
}
