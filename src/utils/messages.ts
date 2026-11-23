/** Teks antarmuka yang dipakai lebih dari satu layar (docs/02-system-design.md §6.5). */
import type { CreateRoomError, GameMode, JoinError } from '@/types';

export const JOIN_ERROR_MESSAGES: Readonly<Record<JoinError, string>> = {
  'invalid-code': 'Kode terdiri dari 6 huruf dan angka.',
  'not-found': 'Kode ini tidak ditemukan. Cek lagi 6 karakternya.',
  expired: 'Room ini sudah lewat 24 jam. Minta pasanganmu membuat room baru.',
  full: 'Room ini sudah berisi dua orang.',
  'already-started': 'Kuis di room ini sudah dimulai.',
  closed: 'Room ini sudah ditutup.',
  network: 'Koneksi bermasalah. Coba lagi sebentar lagi.',
};

export const CREATE_ERROR_MESSAGES: Readonly<Record<CreateRoomError, string>> = {
  'code-exhausted': 'Belum bisa membuat kode room. Coba sekali lagi.',
  network: 'Koneksi bermasalah. Coba lagi sebentar lagi.',
};

export const CONNECTION_ERROR = 'Belum bisa tersambung ke server. Cek internetmu, lalu coba lagi.';

export const MODE_DESCRIPTIONS: Readonly<Record<GameMode, string>> = {
  guess: 'Satu orang menjawab tentang dirinya, satu lagi menebak. Gantian di ronde berikutnya.',
  match: 'Kalian berdua menjawab tentang diri sendiri, lalu jawabannya dibandingkan.',
};
