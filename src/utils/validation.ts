import type { NameError } from '@/types';
import { NAME_MAX_LENGTH } from './constants';

/** Merapikan nama: Unicode NFC, spasi ganda diringkas, spasi di ujung dibuang. */
export function normalizeName(raw: string): string {
  return raw.normalize('NFC').replace(/\s+/g, ' ').trim();
}

/** Sama atau tidak, tanpa memedulikan huruf besar/kecil dan spasi berlebih. */
export function namesEqual(a: string, b: string): boolean {
  return (
    normalizeName(a).toLocaleLowerCase('id-ID') === normalizeName(b).toLocaleLowerCase('id-ID')
  );
}

/** null = valid. `partnerName` diisi saat Tamu bergabung, agar nama keduanya berbeda. */
export function validateName(raw: string, partnerName?: string): NameError | null {
  const name = normalizeName(raw);
  if (name === '') return 'empty';
  if (name.length > NAME_MAX_LENGTH) return 'too-long';
  if (partnerName !== undefined && namesEqual(name, partnerName)) return 'same-as-partner';
  return null;
}

/** Huruf pertama untuk avatar. Aman untuk emoji (dihitung per code point). */
export function initialOf(name: string): string {
  const first = Array.from(normalizeName(name))[0];
  return first ? first.toLocaleUpperCase('id-ID') : '?';
}

export const NAME_ERROR_MESSAGES: Readonly<Record<NameError, string>> = {
  empty: 'Nama wajib diisi.',
  'too-long': `Nama maksimal ${NAME_MAX_LENGTH} karakter.`,
  'same-as-partner': 'Nama kalian harus beda supaya gampang dibedakan.',
};
