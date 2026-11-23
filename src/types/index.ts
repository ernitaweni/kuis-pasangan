/**
 * Tipe data Kuis Pasangan (docs/02-system-design.md §5).
 * Tipe berakhiran `Doc` = bentuk data persis di Firebase Realtime Database.
 */

// ═════════════════════════════════════════════
// 1. Bank soal (data/questions.json)
// ═════════════════════════════════════════════
export type CategoryId = 'santai' | 'deep-talk' | 'kebiasaan';
export type OptionId = 'a' | 'b' | 'c' | 'd';
/** Format `${CategoryId}-${2 digit}`, contoh "santai-03". */
export type QuestionId = string;

export interface QuestionOption {
  id: OptionId;
  text: string;
}

export interface Question {
  id: QuestionId;
  /**
   * Template teks soal. Token:
   * - `{subjek}` → "kamu" | nama pasangan
   * - `{milik}`  → "mu" (menempel) | " " + nama pasangan
   */
  text: string;
  /** Tepat 4 opsi berurutan a–d (dijaga parseQuestionBank). */
  options: readonly QuestionOption[];
}

export interface Category {
  id: CategoryId;
  name: string;
  description: string;
  // Ikon ditentukan di UI (CATEGORY_ICONS), bukan di data.
  questions: readonly Question[];
}

export interface QuestionBank {
  version: number;
  categories: readonly Category[];
}

// ═════════════════════════════════════════════
// 2. Mode & peran
// ═════════════════════════════════════════════
/** 'guess' = Tebak Aku, 'match' = Kita Mirip? */
export type GameMode = 'guess' | 'match';
export type PlayerRole = 'host' | 'guest';
/** Sudut pandang teks soal: 'self' → "kamu", 'partner' → nama pasangan. */
export type Perspective = 'self' | 'partner';

// ═════════════════════════════════════════════
// 3. Realtime Database: rooms/{code}/…
// ═════════════════════════════════════════════
export type Uid = string;
/** 6 karakter dari ROOM_CODE_ALPHABET. */
export type RoomCode = string;
/** "r1", "r2", … */
export type RoundId = `r${number}`;
export type RoomStatus = 'lobby' | 'playing' | 'closed';
export type ClosedReason = 'host-left' | 'player-left';

export interface RoomMetaDoc {
  hostUid: Uid;
  hostName: string;
  /** Tidak ada sampai Tamu bergabung (RTDB tidak menyimpan null). */
  guestUid?: Uid;
  /** Server timestamp (ms). */
  createdAt: number;
  schemaVersion: 1;
}

export interface RoomSettingsDoc {
  categoryId: CategoryId;
  mode: GameMode;
  /** Yang Ditebak (dipakai pada mode 'guess'). Default: hostUid. */
  targetUid: Uid;
}

export interface RoomStateDoc {
  status: RoomStatus;
  /** Dimulai dari 1, naik setiap Main Lagi. */
  round: number;
  /** Diisi saat Host menekan Mulai (10 item). */
  questionIds?: QuestionId[];
  /** Server timestamp untuk hitung mundur serentak. */
  startedAt?: number;
  closedReason?: ClosedReason;
}

export interface PlayerDoc {
  name: string;
  role: PlayerRole;
  joinedAt: number;
}

export interface PresenceDoc {
  online: boolean;
  lastSeen: number;
}

export interface ProgressDoc {
  /** Jumlah soal yang sudah dijawab (jawaban terkunci sejak dikirim), 0–10. */
  answered: number;
  /**
   * Indeks soal yang sudah siap dibuka pemain ini (0 di awal ronde). Naik 1 setiap menekan
   * "Siap" setelah sebuah soal terbuka. Soal yang tampil = min(ready kedua pemain).
   */
  ready: number;
}

/** answers/{roundId}/{uid} → { [questionId]: optionId } */
export type AnswerMap = Partial<Record<QuestionId, OptionId>>;

export interface RoomDoc {
  meta: RoomMetaDoc;
  settings: RoomSettingsDoc;
  state: RoomStateDoc;
  players?: Record<Uid, PlayerDoc>;
  presence?: Record<Uid, PresenceDoc>;
  progress?: Record<RoundId, Record<Uid, ProgressDoc>>;
  answers?: Record<RoundId, Record<Uid, AnswerMap>>;
}

// ═════════════════════════════════════════════
// 4. State di klien
// ═════════════════════════════════════════════
export interface PlayerView {
  uid: Uid;
  name: string;
  role: PlayerRole;
  online: boolean;
  answered: number;
  /** Lihat ProgressDoc.ready. */
  ready: number;
}

/** Gabungan semua langganan untuk satu room, sudah dinormalisasi oleh useRoom(). */
export interface RoomSnapshot {
  code: RoomCode;
  meta: RoomMetaDoc;
  settings: RoomSettingsDoc;
  state: RoomStateDoc;
  me: PlayerView;
  /** null jika Tamu belum bergabung. */
  partner: PlayerView | null;
  /** Jawaban saya di ronde aktif. */
  myAnswers: AnswerMap;
  /** Hanya soal yang sudah terbuka (keduanya menjawab); sisanya dikunci Security Rules. */
  partnerAnswers: AnswerMap;
}

/** Fase room. DITURUNKAN dari RoomSnapshot + waktu server, tidak disimpan. */
export type RoomPhase = 'lobby' | 'countdown' | 'answering' | 'result' | 'closed' | 'expired';

/**
 * Langkah di dalam satu soal (dibuka per soal):
 * menjawab → menunggu jawaban pasangan → terbuka → menunggu pasangan siap → soal berikutnya.
 */
export type QuestionStep =
  | { kind: 'answering'; index: number; partnerAnswered: boolean }
  | { kind: 'waiting-answer'; index: number }
  | { kind: 'revealed'; index: number }
  | { kind: 'waiting-ready'; index: number };

/** Layar tingkat atas. Isi layar 'room' ditentukan RoomPhase. */
export type AppView =
  | { name: 'home' }
  | { name: 'create' }
  | { name: 'join'; code?: RoomCode }
  | { name: 'connecting'; code: RoomCode }
  | { name: 'room'; code: RoomCode };

// ═════════════════════════════════════════════
// 5. Hasil
// ═════════════════════════════════════════════
export interface ComparisonRow {
  questionId: QuestionId;
  /** Mode guess: jawaban Yang Ditebak · mode match: jawaban Host. */
  first?: OptionId;
  /** Mode guess: tebakan Penebak · mode match: jawaban Tamu. */
  second?: OptionId;
  isMatch: boolean;
}

export interface ScoreSummary {
  matches: number;
  total: number;
  /** 0–100, bilangan bulat. */
  percent: number;
}

/** 4 = tertinggi. */
export type TierLevel = 1 | 2 | 3 | 4;

export interface ResultTier {
  level: TierLevel;
  /** Batas bawah persentase (inklusif). */
  minPercent: number;
  title: string;
  description: string;
}

export interface GameResult extends ScoreSummary {
  rows: ComparisonRow[];
  tier: ResultTier;
  /** Maksimal 3 soal yang tidak cocok, untuk "Ngobrolin ini, yuk". */
  talkingPoints: ComparisonRow[];
}

// ═════════════════════════════════════════════
// 6. Penyimpanan lokal
// ═════════════════════════════════════════════
export interface Versioned<T> {
  v: 1;
  data: T;
}

export interface ActiveRoomRef {
  code: RoomCode;
  savedAt: number;
}

export interface HistoryEntry {
  /** `${RoomCode}-${RoundId}`, agar penyimpanan idempoten. */
  id: string;
  playedAt: number;
  myName: string;
  partnerName: string;
  categoryId: CategoryId;
  mode: GameMode;
  percent: number;
  tierTitle: string;
}

// ═════════════════════════════════════════════
// 7. Error & hasil operasi
// ═════════════════════════════════════════════
export type NameError = 'empty' | 'too-long' | 'same-as-partner';

export type JoinError =
  'invalid-code' | 'not-found' | 'expired' | 'full' | 'already-started' | 'closed' | 'network';

export type CreateRoomError = 'code-exhausted' | 'network';

export type Result<T, E extends string> = { ok: true; value: T } | { ok: false; error: E };
