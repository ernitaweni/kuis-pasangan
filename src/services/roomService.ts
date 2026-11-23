/**
 * Akses data room di Firebase Realtime Database. Satu-satunya modul yang menyentuh SDK database.
 * Menerima instance `Database` (dependency injection), sehingga bisa diuji dengan dua pemain
 * sungguhan di Firebase Emulator (tests/integration).
 */
import {
  type Database,
  type DatabaseReference,
  type Unsubscribe,
  get,
  onDisconnect,
  onValue,
  ref,
  serverTimestamp,
  set,
  update,
} from 'firebase/database';
import type {
  AnswerMap,
  CategoryId,
  ClosedReason,
  CreateRoomError,
  GameMode,
  JoinError,
  OptionId,
  PlayerDoc,
  PlayerRole,
  PresenceDoc,
  ProgressDoc,
  QuestionId,
  Result,
  RoomCode,
  RoomMetaDoc,
  RoomSettingsDoc,
  RoomStateDoc,
  RoundId,
  Uid,
} from '@/types';
import { CREATE_ROOM_MAX_RETRY, OPTION_IDS } from '@/utils/constants';
import { isOneOf } from '@/utils/guards';
import { assessJoin, roundIdOf } from '@/utils/phase';
import { generateRoomCode, isValidRoomCode } from '@/utils/roomCode';
import {
  parseAnswerMap,
  parseMeta,
  parsePlayers,
  parsePresenceMap,
  parseProgressMap,
  parseSettings,
  parseState,
} from '@/utils/roomParse';
import type { RoomData } from '@/utils/roomSnapshot';
import { normalizeName } from '@/utils/validation';

export type RoomSubscriptionState =
  { status: 'loading' } | { status: 'missing' } | { status: 'ready'; data: RoomData };

export interface RoomInfo {
  meta: RoomMetaDoc;
  settings: RoomSettingsDoc;
  state: RoomStateDoc;
}

const ok = <T>(value: T) => ({ ok: true, value }) as const;
const err = <E extends string>(error: E) => ({ ok: false, error }) as const;

/** Penolakan dari Security Rules. Pesan SDK: "PERMISSION_DENIED: Permission denied". */
export function isPermissionDenied(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const pattern = /permission[_ ]denied/i;
  const code = (error as { code?: unknown }).code;
  return pattern.test(error.message) || (typeof code === 'string' && pattern.test(code));
}

/** Kode dipakai sebagai segmen path database, jadi formatnya wajib divalidasi dulu. */
function assertCode(code: string): void {
  if (!isValidRoomCode(code)) throw new Error(`Kode room tidak valid: "${code}"`);
}

export function createRoomService(db: Database) {
  const roomRef = (code: RoomCode, path?: string): DatabaseReference => {
    assertCode(code);
    return ref(db, path ? `rooms/${code}/${path}` : `rooms/${code}`);
  };

  // Selisih jam perangkat dan server, agar "sekarang" sama di kedua HP (ADR-8).
  let serverOffset = 0;
  const stopOffset = onValue(ref(db, '.info/serverTimeOffset'), (snap) => {
    const value: unknown = snap.val();
    serverOffset = typeof value === 'number' ? value : 0;
  });
  const serverNow = () => Date.now() + serverOffset;

  async function getRoomInfo(code: RoomCode): Promise<RoomInfo | null> {
    const [metaSnap, settingsSnap, stateSnap] = await Promise.all([
      get(roomRef(code, 'meta')),
      get(roomRef(code, 'settings')),
      get(roomRef(code, 'state')),
    ]);
    const meta = parseMeta(metaSnap.val());
    const settings = parseSettings(settingsSnap.val());
    const state = parseState(stateSnap.val());
    return meta && settings && state ? { meta, settings, state } : null;
  }

  /** Semua jawaban milik sendiri di satu ronde (jawaban pasangan hanya bisa dibaca per soal). */
  async function getAnswers(code: RoomCode, roundId: RoundId, uid: Uid): Promise<AnswerMap> {
    return parseAnswerMap((await get(roomRef(code, `answers/${roundId}/${uid}`))).val());
  }

  /**
   * Satu jawaban. Untuk jawaban pasangan, Rules baru mengizinkan setelah KEDUANYA menjawab soal
   * ini. null jika belum ada.
   */
  async function getAnswer(
    code: RoomCode,
    roundId: RoundId,
    uid: Uid,
    questionId: QuestionId,
  ): Promise<OptionId | null> {
    const value: unknown = (
      await get(roomRef(code, `answers/${roundId}/${uid}/${questionId}`))
    ).val();
    return isOneOf(value, OPTION_IDS) ? value : null;
  }

  return {
    serverNow,
    /** Selisih jam server − jam perangkat (ms). */
    serverOffset: () => serverOffset,

    /** Membuat room. Jika kode bentrok, Rules menolak dan kode baru dicoba (ADR-7). */
    async createRoom(input: {
      uid: Uid;
      name: string;
      categoryId: CategoryId;
      mode: GameMode;
      random?: () => number;
    }): Promise<Result<RoomCode, CreateRoomError>> {
      const name = normalizeName(input.name);
      for (let attempt = 0; attempt < CREATE_ROOM_MAX_RETRY; attempt += 1) {
        const code = generateRoomCode(input.random);
        try {
          await set(roomRef(code), {
            meta: {
              hostUid: input.uid,
              hostName: name,
              createdAt: serverTimestamp(),
              schemaVersion: 1,
            },
            settings: { categoryId: input.categoryId, mode: input.mode, targetUid: input.uid },
            state: { status: 'lobby', round: 1 },
            players: { [input.uid]: { name, role: 'host', joinedAt: serverTimestamp() } },
          });
          return ok(code);
        } catch (error) {
          if (!isPermissionDenied(error)) return err('network');
        }
      }
      return err('code-exhausted');
    },

    getRoomInfo,

    /**
     * Bergabung sebagai Tamu. Anggota lama langsung diterima kembali (misalnya setelah refresh).
     * Klaim slot dan data pemain ditulis dalam satu update atomik; jika dua orang berebut,
     * Rules hanya meloloskan yang pertama.
     */
    async joinRoom(input: {
      code: string;
      uid: Uid;
      name: string;
    }): Promise<Result<PlayerRole, JoinError>> {
      if (!isValidRoomCode(input.code)) return err('invalid-code');
      const code = input.code;
      try {
        const info = await getRoomInfo(code);
        const assessment = assessJoin(
          info?.meta ?? null,
          info?.state ?? null,
          input.uid,
          serverNow(),
        );
        if (assessment.kind === 'member') return ok(assessment.role);
        if (assessment.kind === 'blocked') return err(assessment.error);

        try {
          await update(roomRef(code), {
            'meta/guestUid': input.uid,
            [`players/${input.uid}`]: {
              name: normalizeName(input.name),
              role: 'guest',
              joinedAt: serverTimestamp(),
            },
          });
          return ok('guest');
        } catch (error) {
          if (!isPermissionDenied(error)) throw error;
          // Kalah cepat atau status berubah: nilai ulang dengan data terbaru.
          const fresh = await getRoomInfo(code);
          const again = assessJoin(
            fresh?.meta ?? null,
            fresh?.state ?? null,
            input.uid,
            serverNow(),
          );
          if (again.kind === 'member') return ok(again.role);
          // Masih bisa dimasuki tapi ditolak = data tidak valid (mis. nama). UI sudah memvalidasi
          // sebelumnya, jadi ini kasus langka: laporkan sebagai gangguan umum.
          return err(again.kind === 'blocked' ? again.error : 'network');
        }
      } catch {
        return err('network');
      }
    },

    /** Keluar dari lobby. Host menutup room; Tamu melepas slotnya agar bisa diisi lagi. */
    async leaveLobby(input: { code: RoomCode; uid: Uid; role: PlayerRole }): Promise<void> {
      if (input.role === 'host') {
        await update(roomRef(input.code, 'state'), { status: 'closed', closedReason: 'host-left' });
        return;
      }
      await update(roomRef(input.code), {
        'meta/guestUid': null,
        [`players/${input.uid}`]: null,
        [`presence/${input.uid}`]: null,
      });
    },

    /** Host mengubah kategori, mode, atau Yang Ditebak (hanya di lobby). */
    async updateSettings(code: RoomCode, patch: Partial<RoomSettingsDoc>): Promise<void> {
      await update(roomRef(code, 'settings'), patch);
    },

    /** Host memulai ronde dengan daftar soal yang sudah diacak. */
    async startRound(code: RoomCode, questionIds: readonly QuestionId[]): Promise<void> {
      await update(roomRef(code, 'state'), {
        status: 'playing',
        questionIds: [...questionIds],
        startedAt: serverTimestamp(),
      });
    },

    /**
     * Simpan satu jawaban dan jumlah yang sudah dijawab, dalam satu update atomik.
     * Jawaban terkunci sejak dikirim (Rules menolak penulisan ulang).
     */
    async submitAnswer(input: {
      code: RoomCode;
      roundId: RoundId;
      uid: Uid;
      questionId: QuestionId;
      optionId: OptionId;
      answered: number;
    }): Promise<void> {
      await update(roomRef(input.code), {
        [`answers/${input.roundId}/${input.uid}/${input.questionId}`]: input.optionId,
        [`progress/${input.roundId}/${input.uid}/answered`]: input.answered,
      });
    },

    /**
     * Siap ke soal berikutnya setelah sebuah soal terbuka. Soal berikutnya baru muncul saat
     * KEDUA pemain siap (pindah soal bersamaan). `ready` = indeks soal berikutnya (1–10).
     */
    async markReady(input: {
      code: RoomCode;
      roundId: RoundId;
      uid: Uid;
      ready: number;
    }): Promise<void> {
      await set(roomRef(input.code, `progress/${input.roundId}/${input.uid}/ready`), input.ready);
    },

    getAnswers,
    getAnswer,

    /** Host: kembali ke lobby untuk ronde berikutnya, dengan peran ditukar. */
    async playAgain(input: {
      code: RoomCode;
      currentRound: number;
      nextTargetUid: Uid;
    }): Promise<void> {
      await update(roomRef(input.code, 'state'), {
        status: 'lobby',
        round: input.currentRound + 1,
        questionIds: null,
        startedAt: null,
      });
      // Settings hanya boleh diubah saat lobby, jadi ditulis setelah status berubah.
      await update(roomRef(input.code, 'settings'), { targetUid: input.nextTargetUid });
    },

    /** Menutup room (pemain keluar di tengah permainan, atau Host keluar). */
    async closeRoom(code: RoomCode, reason: ClosedReason): Promise<void> {
      await update(roomRef(code, 'state'), { status: 'closed', closedReason: reason });
    },

    /**
     * Status online. `onDisconnect` dicatat di server, sehingga tetap berjalan saat tab ditutup
     * atau sinyal hilang mendadak (FR-19).
     */
    startPresence(code: RoomCode, uid: Uid): Unsubscribe {
      const presenceRef = roomRef(code, `presence/${uid}`);
      const offline: Record<keyof PresenceDoc, unknown> = {
        online: false,
        lastSeen: serverTimestamp(),
      };
      const stop = onValue(ref(db, '.info/connected'), (snap) => {
        if (snap.val() !== true) return;
        onDisconnect(presenceRef)
          .set(offline)
          .then(() => set(presenceRef, { online: true, lastSeen: serverTimestamp() }))
          .catch(() => {
            // Presence bersifat best-effort; kegagalan tidak boleh mengganggu permainan.
          });
      });
      return () => {
        stop();
        void onDisconnect(presenceRef)
          .cancel()
          .catch(() => undefined);
        void set(presenceRef, offline).catch(() => undefined);
      };
    },

    /** Status koneksi perangkat ini ke server (banner offline, FR-20). */
    watchConnection(callback: (connected: boolean) => void): Unsubscribe {
      return onValue(ref(db, '.info/connected'), (snap) => callback(snap.val() === true));
    },

    /**
     * Berlangganan semua data room yang dibutuhkan layar. Hanya dipanggil setelah menjadi anggota.
     * Langganan per ronde (progress, jawaban sendiri) diperbarui otomatis saat ronde berganti, dan
     * jawaban pasangan diambil per soal, begitu soal itu dijawab keduanya.
     */
    subscribeRoom(
      code: RoomCode,
      uid: Uid,
      listener: {
        onChange: (state: RoomSubscriptionState) => void;
        onError: (error: unknown) => void;
      },
    ): Unsubscribe {
      let meta: RoomMetaDoc | null = null;
      let settings: RoomSettingsDoc | null = null;
      let state: RoomStateDoc | null = null;
      let players: Record<Uid, PlayerDoc> = {};
      let presence: Record<Uid, PresenceDoc> = {};
      let progress: Record<Uid, ProgressDoc> = {};
      let myAnswers: AnswerMap = {};
      let partnerAnswers: AnswerMap = {};
      const loaded = { meta: false, settings: false, state: false, players: false };
      // Data ronde aktif (progres + jawaban sendiri). Direset setiap ronde berganti.
      const roundLoaded = { progress: false, answers: false };

      let activeRound: number | null = null;
      let roundSubs: Unsubscribe[] = [];
      const inFlight = new Set<QuestionId>();
      let retryTimer: ReturnType<typeof setTimeout> | null = null;
      let stopped = false;

      const emit = () => {
        if (stopped) return;
        const coreLoaded = loaded.meta && loaded.settings && loaded.state;
        if (coreLoaded && (!meta || !settings || !state)) {
          listener.onChange({ status: 'missing' });
        } else if (
          !coreLoaded ||
          !loaded.players ||
          !roundLoaded.progress ||
          !roundLoaded.answers ||
          !meta ||
          !settings ||
          !state
        ) {
          // Tunggu juga data pemain dan data ronde aktif, agar frame pertama sudah lengkap:
          // fase (menjawab/menunggu) dan posisi soal setelah refresh dihitung dari data utuh.
          listener.onChange({ status: 'loading' });
        } else {
          listener.onChange({
            status: 'ready',
            data: {
              code,
              meta,
              settings,
              state,
              players,
              presence,
              progress,
              myAnswers,
              partnerAnswers,
            },
          });
        }
      };

      const fail = (error: unknown) => {
        if (!stopped) listener.onError(error);
      };

      /**
       * Ambil jawaban pasangan untuk setiap soal yang sudah dijawab keduanya (berurutan, karena
       * soal dijawab satu per satu). Jawaban tidak bisa berubah, jadi cukup diambil sekali.
       */
      const maybeFetchPartnerAnswers = () => {
        if (!meta || !state || activeRound === null) return;
        const partnerUid = uid === meta.hostUid ? meta.guestUid : meta.hostUid;
        if (partnerUid === undefined) return;
        const round = activeRound;
        const roundId = roundIdOf(round);
        const partnerCount = progress[partnerUid]?.answered ?? 0;
        (state.questionIds ?? []).forEach((questionId, index) => {
          if (index >= partnerCount || myAnswers[questionId] === undefined) return;
          if (partnerAnswers[questionId] !== undefined || inFlight.has(questionId)) return;
          inFlight.add(questionId);
          getAnswer(code, roundId, partnerUid, questionId)
            .then((optionId) => {
              inFlight.delete(questionId);
              if (stopped || activeRound !== round || optionId === null) return;
              partnerAnswers = { ...partnerAnswers, [questionId]: optionId };
              emit();
            })
            .catch(() => {
              // Biasanya karena jawaban sendiri belum sampai di server (masih dikirim):
              // Rules belum membuka soal ini. Coba lagi sebentar lagi.
              inFlight.delete(questionId);
              if (!stopped && retryTimer === null) {
                retryTimer = setTimeout(() => {
                  retryTimer = null;
                  maybeFetchPartnerAnswers();
                }, 500);
              }
            });
        });
      };

      const watchRound = (round: number) => {
        roundSubs.forEach((unsubscribe) => unsubscribe());
        progress = {};
        myAnswers = {};
        partnerAnswers = {};
        inFlight.clear();
        roundLoaded.progress = false;
        roundLoaded.answers = false;
        const roundId = roundIdOf(round);
        roundSubs = [
          onValue(
            roomRef(code, `progress/${roundId}`),
            (snap) => {
              progress = parseProgressMap(snap.val());
              roundLoaded.progress = true;
              maybeFetchPartnerAnswers();
              emit();
            },
            fail,
          ),
          onValue(
            roomRef(code, `answers/${roundId}/${uid}`),
            (snap) => {
              myAnswers = parseAnswerMap(snap.val());
              roundLoaded.answers = true;
              maybeFetchPartnerAnswers();
              emit();
            },
            fail,
          ),
        ];
      };

      const subs: Unsubscribe[] = [
        onValue(
          roomRef(code, 'meta'),
          (snap) => {
            meta = parseMeta(snap.val());
            loaded.meta = true;
            maybeFetchPartnerAnswers();
            emit();
          },
          fail,
        ),
        onValue(
          roomRef(code, 'settings'),
          (snap) => {
            settings = parseSettings(snap.val());
            loaded.settings = true;
            emit();
          },
          fail,
        ),
        onValue(
          roomRef(code, 'state'),
          (snap) => {
            state = parseState(snap.val());
            loaded.state = true;
            if (state && state.round !== activeRound) {
              activeRound = state.round;
              watchRound(state.round);
            }
            emit();
          },
          fail,
        ),
        onValue(
          roomRef(code, 'players'),
          (snap) => {
            players = parsePlayers(snap.val());
            loaded.players = true;
            emit();
          },
          fail,
        ),
        onValue(
          roomRef(code, 'presence'),
          (snap) => {
            presence = parsePresenceMap(snap.val());
            emit();
          },
          fail,
        ),
      ];

      return () => {
        stopped = true;
        if (retryTimer !== null) clearTimeout(retryTimer);
        subs.forEach((unsubscribe) => unsubscribe());
        roundSubs.forEach((unsubscribe) => unsubscribe());
      };
    },

    /** Melepas listener internal (dipakai saat aplikasi atau tes selesai). */
    dispose(): void {
      stopOffset();
    },
  };
}

export type RoomService = ReturnType<typeof createRoomService>;
