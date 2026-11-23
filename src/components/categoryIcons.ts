import { Coffee, type LucideIcon, MessageCircleHeart, Popcorn } from 'lucide-react';
import type { CategoryId } from '@/types';

/** Ikon garis untuk tiap kategori (bukan emoji, docs/02-system-design.md §6.5). */
export const CATEGORY_ICONS: Readonly<Record<CategoryId, LucideIcon>> = {
  santai: Popcorn,
  'deep-talk': MessageCircleHeart,
  kebiasaan: Coffee,
};
