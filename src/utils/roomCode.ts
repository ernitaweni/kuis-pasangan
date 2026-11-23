import type { RoomCode } from '@/types';
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from './constants';

const CODE_PATTERN = new RegExp(`^[${ROOM_CODE_ALPHABET}]{${ROOM_CODE_LENGTH}}$`);

/** Angka acak [0, 1) dari Web Crypto, agar kode room sulit ditebak. */
export function secureRandom(): number {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return (buffer[0] ?? 0) / 2 ** 32;
}

export function generateRoomCode(random: () => number = secureRandom): RoomCode {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i += 1) {
    const index = Math.min(
      Math.floor(random() * ROOM_CODE_ALPHABET.length),
      ROOM_CODE_ALPHABET.length - 1,
    );
    code += ROOM_CODE_ALPHABET.charAt(Math.max(index, 0));
  }
  return code;
}

/** "k7m 2qx" → "K7M2QX". Karakter selain huruf/angka dibuang. */
export function normalizeRoomCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function isValidRoomCode(code: string): boolean {
  return CODE_PATTERN.test(code);
}

/** Kode room dari query string, misalnya "?room=K7M2QX". null jika tidak ada atau tidak valid. */
export function readRoomCodeFromSearch(search: string): RoomCode | null {
  const raw = new URLSearchParams(search).get('room');
  if (raw === null) return null;
  const code = normalizeRoomCode(raw);
  return isValidRoomCode(code) ? code : null;
}

export function buildInviteUrl(origin: string, code: RoomCode): string {
  return `${origin.replace(/\/+$/, '')}/?room=${code}`;
}
