/**
 * Integration test: roomService + Security Rules di Firebase Emulator, dengan beberapa pemain
 * anonim sungguhan (masing-masing punya koneksi sendiri). Jalankan: npm run test:integration
 */
import { readFile } from 'node:fs/promises';
import { type FirebaseApp, deleteApp, initializeApp } from 'firebase/app';
import {
  type User,
  connectAuthEmulator,
  getAuth,
  signInAnonymously,
  updateCurrentUser,
} from 'firebase/auth';
import {
  type Database,
  connectDatabaseEmulator,
  get,
  getDatabase,
  goOffline,
  ref,
  set,
  update,
} from 'firebase/database';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  type RoomService,
  type RoomSubscriptionState,
  createRoomService,
} from '@/services/roomService';
import type { OptionId, RoomCode } from '@/types';
import { roundIdOf } from '@/utils/phase';
import type { RoomData } from '@/utils/roomSnapshot';
import { buildResult, getAnswerOrder } from '@/utils/scoring';

const PROJECT_ID = 'demo-kuis-pasangan';
const NAMESPACE = `${PROJECT_ID}-default-rtdb`;
const HOST = '127.0.0.1';
const QUESTION_IDS = Array.from(
  { length: 10 },
  (_, i) => `santai-${String(i + 1).padStart(2, '0')}`,
);
const R1 = roundIdOf(1);

interface Player {
  uid: string;
  user: User;
  app: FirebaseApp;
  db: Database;
  rooms: RoomService;
}

const players: Player[] = [];
let counter = 0;

/** Akses admin ke emulator (melewati Rules), hanya untuk menyiapkan dan memeriksa data. */
async function admin(path: string, method: 'GET' | 'PUT', body?: string): Promise<unknown> {
  const response = await fetch(`http://${HOST}:9000/${path}.json?ns=${NAMESPACE}`, {
    method,
    body,
    headers: { Authorization: 'Bearer owner' },
  });
  if (!response.ok)
    throw new Error(`${method} ${path}: ${response.status} ${await response.text()}`);
  return response.json();
}

/** Koneksi baru. Tanpa `asUser`: pengguna anonim baru. Dengan `asUser`: pengguna yang sama
 *  di koneksi baru tanpa cache, seperti HP yang di-refresh. */
async function connect(asUser?: User): Promise<Player> {
  counter += 1;
  const app = initializeApp(
    {
      apiKey: 'demo-api-key',
      projectId: PROJECT_ID,
      databaseURL: `https://${NAMESPACE}.firebaseio.com`,
    },
    `pemain-${counter}`,
  );
  const auth = getAuth(app);
  connectAuthEmulator(auth, `http://${HOST}:9099`, { disableWarnings: true });
  const db = getDatabase(app);
  connectDatabaseEmulator(db, HOST, 9000);
  let user: User;
  if (asUser) {
    await updateCurrentUser(auth, asUser);
    user = asUser;
  } else {
    user = (await signInAnonymously(auth)).user;
  }
  const player: Player = { uid: user.uid, user, app, db, rooms: createRoomService(db) };
  players.push(player);
  return player;
}

const newPlayer = () => connect();

const expectDenied = (promise: Promise<unknown>) =>
  expect(promise).rejects.toThrow(/permission[_ ]denied/i);

async function createRoom(host: Player): Promise<RoomCode> {
  const result = await host.rooms.createRoom({
    uid: host.uid,
    name: 'Sari',
    categoryId: 'santai',
    mode: 'guess',
  });
  if (!result.ok) throw new Error(`createRoom gagal: ${result.error}`);
  return result.value;
}

async function setupPair() {
  const host = await newPlayer();
  const guest = await newPlayer();
  const code = await createRoom(host);
  const joined = await guest.rooms.joinRoom({ code, uid: guest.uid, name: 'Bima' });
  expect(joined).toEqual({ ok: true, value: 'guest' });
  return { host, guest, code };
}

async function answer(player: Player, code: RoomCode, index: number, optionId: OptionId) {
  await player.rooms.submitAnswer({
    code,
    roundId: R1,
    uid: player.uid,
    questionId: QUESTION_IDS[index] ?? '',
    optionId,
    answered: index + 1,
  });
}

const ready = (player: Player, code: RoomCode, value: number) =>
  player.rooms.markReady({ code, roundId: R1, uid: player.uid, ready: value });

/** Satu soal: keduanya menjawab (terbuka), lalu keduanya menekan Siap. */
async function playQuestion(
  host: Player,
  guest: Player,
  code: RoomCode,
  index: number,
  picks: { host: OptionId; guest: OptionId },
) {
  await answer(host, code, index, picks.host);
  await answer(guest, code, index, picks.guest);
  await ready(host, code, index + 1);
  await ready(guest, code, index + 1);
}

/** Satu ronde penuh. `guestPick` menentukan tebakan Tamu per soal; Host selalu "a". */
async function playAll(
  host: Player,
  guest: Player,
  code: RoomCode,
  guestPick: (index: number) => OptionId = () => 'a',
) {
  for (const index of QUESTION_IDS.keys()) {
    await playQuestion(host, guest, code, index, { host: 'a', guest: guestPick(index) });
  }
}

/** Menunggu sampai langganan room memenuhi syarat tertentu. */
function waitForRoom(
  player: Player,
  code: RoomCode,
  predicate: (data: RoomData) => boolean,
  timeoutMs = 8000,
): Promise<RoomData> {
  return new Promise((resolve, reject) => {
    let done = false;
    let unsubscribe: (() => void) | null = null;
    const finish = (fn: () => void) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      unsubscribe?.();
      fn();
    };
    const timer = setTimeout(
      () => finish(() => reject(new Error('Timeout menunggu data room'))),
      timeoutMs,
    );
    unsubscribe = player.rooms.subscribeRoom(code, player.uid, {
      onChange: (state: RoomSubscriptionState) => {
        if (state.status === 'ready' && predicate(state.data)) finish(() => resolve(state.data));
      },
      onError: (error) =>
        finish(() => reject(error instanceof Error ? error : new Error(String(error)))),
    });
    if (done) unsubscribe();
  });
}

beforeAll(async () => {
  const rules = await readFile(new URL('../../database.rules.json', import.meta.url), 'utf8');
  await admin('.settings/rules', 'PUT', rules);
});

beforeEach(async () => {
  await admin('', 'PUT', 'null');
});

afterEach(async () => {
  const current = players.splice(0);
  for (const player of current) player.rooms.dispose();
  await Promise.all(current.map((player) => deleteApp(player.app)));
});

describe('membuat & bergabung ke room', () => {
  it('Host membuat room dengan data awal sesuai skema', async () => {
    const host = await newPlayer();
    const code = await createRoom(host);
    const room = (await admin(`rooms/${code}`, 'GET')) as Record<string, Record<string, unknown>>;
    expect(room.meta).toMatchObject({ hostUid: host.uid, hostName: 'Sari', schemaVersion: 1 });
    expect(room.settings).toEqual({ categoryId: 'santai', mode: 'guess', targetUid: host.uid });
    expect(room.state).toEqual({ status: 'lobby', round: 1 });
    expect(room.players?.[host.uid]).toMatchObject({ name: 'Sari', role: 'host' });
  });

  it('kode bentrok ditolak Rules, lalu kode lain dicoba', async () => {
    const host = await newPlayer();
    const first = await host.rooms.createRoom({
      uid: host.uid,
      name: 'Sari',
      categoryId: 'santai',
      mode: 'guess',
      random: () => 0,
    });
    expect(first).toEqual({ ok: true, value: 'AAAAAA' });
    const values = [0, 0, 0, 0, 0, 0, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
    let i = 0;
    const second = await host.rooms.createRoom({
      uid: host.uid,
      name: 'Sari',
      categoryId: 'santai',
      mode: 'guess',
      random: () => values[i++] ?? 0.5,
    });
    expect(second.ok && second.value).not.toBe('AAAAAA');
    expect(second.ok).toBe(true);
  });

  it('room yang sudah ada tidak bisa ditimpa orang lain', async () => {
    const host = await newPlayer();
    const intruder = await newPlayer();
    const code = await createRoom(host);
    await expectDenied(
      set(ref(intruder.db, `rooms/${code}`), {
        meta: { hostUid: intruder.uid, hostName: 'X', createdAt: Date.now(), schemaVersion: 1 },
        settings: { categoryId: 'santai', mode: 'guess', targetUid: intruder.uid },
        state: { status: 'lobby', round: 1 },
      }),
    );
  });

  it('Tamu bergabung, dan kedua anggota bisa melihat data pemain', async () => {
    const { host, guest, code } = await setupPair();
    const fromHost = (await get(ref(host.db, `rooms/${code}/players`))).val() as Record<
      string,
      unknown
    >;
    expect(Object.keys(fromHost).sort()).toEqual([host.uid, guest.uid].sort());
    await expect(get(ref(guest.db, `rooms/${code}/players`))).resolves.toBeTruthy();
  });

  it('orang ketiga ditolak (penuh) dan tidak bisa membaca data pemain', async () => {
    const { code } = await setupPair();
    const third = await newPlayer();
    expect(await third.rooms.joinRoom({ code, uid: third.uid, name: 'Rani' })).toEqual({
      ok: false,
      error: 'full',
    });
    await expectDenied(get(ref(third.db, `rooms/${code}/players`)));
    await expectDenied(get(ref(third.db, `rooms/${code}/progress`)));
  });

  it('kode tidak ditemukan atau formatnya salah', async () => {
    const guest = await newPlayer();
    expect(await guest.rooms.joinRoom({ code: 'ZZZZZZ', uid: guest.uid, name: 'Bima' })).toEqual({
      ok: false,
      error: 'not-found',
    });
    expect(await guest.rooms.joinRoom({ code: 'abc', uid: guest.uid, name: 'Bima' })).toEqual({
      ok: false,
      error: 'invalid-code',
    });
  });

  it('anggota yang masuk ulang (refresh) dikenali, termasuk Host lewat link sendiri', async () => {
    const { host, guest, code } = await setupPair();
    expect(await guest.rooms.joinRoom({ code, uid: guest.uid, name: 'Bima' })).toEqual({
      ok: true,
      value: 'guest',
    });
    expect(await host.rooms.joinRoom({ code, uid: host.uid, name: 'Sari' })).toEqual({
      ok: true,
      value: 'host',
    });
  });

  it('nama yang melanggar Rules (lebih dari 20 karakter) ditolak', async () => {
    const host = await newPlayer();
    const guest = await newPlayer();
    const code = await createRoom(host);
    const result = await guest.rooms.joinRoom({ code, uid: guest.uid, name: 'x'.repeat(25) });
    expect(result.ok).toBe(false);
    expect(await admin(`rooms/${code}/meta/guestUid`, 'GET')).toBeNull();
  });
});

describe('lobby & memulai', () => {
  it('hanya Host yang bisa mengubah pengaturan dan memulai', async () => {
    const { host, guest, code } = await setupPair();
    await expectDenied(guest.rooms.updateSettings(code, { mode: 'match' }));
    await expectDenied(guest.rooms.startRound(code, QUESTION_IDS));
    await host.rooms.updateSettings(code, { mode: 'match', targetUid: guest.uid });
    await host.rooms.startRound(code, QUESTION_IDS);
    const state = (await admin(`rooms/${code}/state`, 'GET')) as Record<string, unknown>;
    expect(state).toMatchObject({ status: 'playing', round: 1, questionIds: QUESTION_IDS });
    expect(typeof state.startedAt).toBe('number');
  });

  it('nilai pengaturan di luar pilihan ditolak', async () => {
    const { host, code } = await setupPair();
    await expectDenied(host.rooms.updateSettings(code, { mode: 'acak' as never }));
    await expectDenied(host.rooms.updateSettings(code, { targetUid: 'orang-lain' }));
  });

  it('tidak bisa mulai sebelum Tamu bergabung, atau dengan jumlah soal yang salah', async () => {
    const host = await newPlayer();
    const code = await createRoom(host);
    await expectDenied(host.rooms.startRound(code, QUESTION_IDS));
    const guest = await newPlayer();
    await guest.rooms.joinRoom({ code, uid: guest.uid, name: 'Bima' });
    await expectDenied(host.rooms.startRound(code, QUESTION_IDS.slice(0, 9)));
  });

  it('pengaturan terkunci setelah permainan dimulai', async () => {
    const { host, code } = await setupPair();
    await host.rooms.startRound(code, QUESTION_IDS);
    await expectDenied(host.rooms.updateSettings(code, { categoryId: 'deep-talk' }));
  });

  it('Tamu keluar dari lobby: slot kosong lagi dan bisa diisi orang lain', async () => {
    const { host, guest, code } = await setupPair();
    await guest.rooms.leaveLobby({ code, uid: guest.uid, role: 'guest' });
    expect(await admin(`rooms/${code}/meta/guestUid`, 'GET')).toBeNull();
    const other = await newPlayer();
    expect(await other.rooms.joinRoom({ code, uid: other.uid, name: 'Rani' })).toEqual({
      ok: true,
      value: 'guest',
    });
    expect(host.uid).not.toBe(other.uid);
  });

  it('Host keluar dari lobby: room ditutup dan tidak bisa dimasuki', async () => {
    const { host, code } = await setupPair();
    await host.rooms.leaveLobby({ code, uid: host.uid, role: 'host' });
    expect(await admin(`rooms/${code}/state`, 'GET')).toEqual({
      status: 'closed',
      round: 1,
      closedReason: 'host-left',
    });
    const other = await newPlayer();
    expect(await other.rooms.joinRoom({ code, uid: other.uid, name: 'Rani' })).toEqual({
      ok: false,
      error: 'closed',
    });
  });

  it('tidak bisa bergabung setelah permainan dimulai', async () => {
    const { host, code } = await setupPair();
    await host.rooms.startRound(code, QUESTION_IDS);
    const other = await newPlayer();
    expect(await other.rooms.joinRoom({ code, uid: other.uid, name: 'Rani' })).toEqual({
      ok: false,
      error: 'full',
    });
  });
});

describe('anti-intip per soal, kunci jawaban & skor', () => {
  it('jawaban satu soal baru terbuka setelah KEDUANYA menjawab soal itu', async () => {
    const { host, guest, code } = await setupPair();
    await host.rooms.startRound(code, QUESTION_IDS);
    const q1 = QUESTION_IDS[0] ?? '';
    const q2 = QUESTION_IDS[1] ?? '';

    await answer(host, code, 0, 'b');
    // Baru Host yang menjawab: tertutup untuk keduanya.
    await expectDenied(guest.rooms.getAnswer(code, R1, host.uid, q1));
    await expectDenied(host.rooms.getAnswer(code, R1, guest.uid, q1));

    await answer(guest, code, 0, 'c');
    // Keduanya menjawab soal 1: terbuka.
    await expect(guest.rooms.getAnswer(code, R1, host.uid, q1)).resolves.toBe('b');
    await expect(host.rooms.getAnswer(code, R1, guest.uid, q1)).resolves.toBe('c');

    // Soal 2 dijawab Host lebih dulu: tetap tertutup bagi Tamu.
    await answer(host, code, 1, 'd');
    await expectDenied(guest.rooms.getAnswer(code, R1, host.uid, q2));
    // Seluruh jawaban pasangan tidak bisa dibaca sekaligus.
    await expectDenied(guest.rooms.getAnswers(code, R1, host.uid));
  });

  it('jawaban terkunci sejak dikirim, bahkan sebelum terbuka', async () => {
    const { host, code } = await setupPair();
    await host.rooms.startRound(code, QUESTION_IDS);
    await answer(host, code, 0, 'a');
    await expectDenied(answer(host, code, 0, 'b'));
    expect(await admin(`rooms/${code}/answers/${R1}/${host.uid}/${QUESTION_IDS[0]}`, 'GET')).toBe(
      'a',
    );
  });

  it('Siap hanya setelah menjawab, dan naik satu per satu', async () => {
    const { host, code } = await setupPair();
    await host.rooms.startRound(code, QUESTION_IDS);
    await expectDenied(ready(host, code, 1)); // belum menjawab
    await answer(host, code, 0, 'a');
    await ready(host, code, 1);
    await answer(host, code, 1, 'a');
    await answer(host, code, 2, 'a');
    await expectDenied(ready(host, code, 3)); // melompat dari 1 ke 3
    await expectDenied(ready(host, code, 0)); // mundur
    await ready(host, code, 2);
  });

  it('tidak bisa menulis jawaban milik pasangan, atau jawaban di luar a–d', async () => {
    const { host, guest, code } = await setupPair();
    await host.rooms.startRound(code, QUESTION_IDS);
    await expectDenied(
      set(ref(guest.db, `rooms/${code}/answers/${R1}/${host.uid}/santai-01`), 'a'),
    );
    await expectDenied(
      set(ref(guest.db, `rooms/${code}/answers/${R1}/${guest.uid}/santai-01`), 'z'),
    );
    await expectDenied(
      set(ref(guest.db, `rooms/${code}/answers/${R1}/${guest.uid}/soal-aneh`), 'a'),
    );
  });

  it('tidak bisa menjawab saat masih di lobby', async () => {
    const { guest, code } = await setupPair();
    await expectDenied(answer(guest, code, 0, 'a'));
  });

  it('satu ronde penuh: skor dari jawaban per soal identik di kedua HP', async () => {
    const { host, guest, code } = await setupPair();
    await host.rooms.startRound(code, QUESTION_IDS);
    // Tunggu sampai 10 soal terbuka DAN keduanya menekan Siap di soal terakhir.
    const roundDone = (d: RoomData) =>
      Object.keys(d.partnerAnswers).length === 10 &&
      d.progress[host.uid]?.ready === 10 &&
      d.progress[guest.uid]?.ready === 10;
    const watchHost = waitForRoom(host, code, roundDone);
    const watchGuest = waitForRoom(guest, code, roundDone);
    await playAll(host, guest, code, (i) => (i < 8 ? 'a' : 'b'));
    const [onHost, onGuest] = await Promise.all([watchHost, watchGuest]);

    const order = getAnswerOrder(onHost.settings, onHost.meta);
    expect(order).toEqual({ firstUid: host.uid, secondUid: guest.uid });
    const resultOnHost = buildResult({
      questionIds: QUESTION_IDS,
      first: onHost.myAnswers,
      second: onHost.partnerAnswers,
      mode: 'guess',
    });
    const resultOnGuest = buildResult({
      questionIds: QUESTION_IDS,
      first: onGuest.partnerAnswers,
      second: onGuest.myAnswers,
      mode: 'guess',
    });
    expect(resultOnHost).toEqual(resultOnGuest);
    expect(resultOnHost).toMatchObject({ matches: 8, total: 10, percent: 80 });
    expect(onHost.progress[host.uid]).toEqual({ answered: 10, ready: 10 });
    expect(onHost.progress[guest.uid]).toEqual({ answered: 10, ready: 10 });
  });
});

describe('main lagi & menutup room', () => {
  it('Main Lagi: ronde 2, peran ditukar, soal dikosongkan', async () => {
    const { host, guest, code } = await setupPair();
    await host.rooms.startRound(code, QUESTION_IDS);
    await playAll(host, guest, code);

    await expectDenied(guest.rooms.playAgain({ code, currentRound: 1, nextTargetUid: guest.uid }));
    await host.rooms.playAgain({ code, currentRound: 1, nextTargetUid: guest.uid });

    expect(await admin(`rooms/${code}/state`, 'GET')).toEqual({ status: 'lobby', round: 2 });
    expect(await admin(`rooms/${code}/settings/targetUid`, 'GET')).toBe(guest.uid);

    await host.rooms.startRound(code, [...QUESTION_IDS].reverse());
    expect(await admin(`rooms/${code}/progress/r2`, 'GET')).toBeNull();
  });

  it('ronde tidak bisa melompat (misalnya dari 1 ke 3)', async () => {
    const { host, code } = await setupPair();
    await host.rooms.startRound(code, QUESTION_IDS);
    await expectDenied(host.rooms.playAgain({ code, currentRound: 2, nextTargetUid: host.uid }));
  });

  it('Tamu keluar di tengah permainan: room tertutup untuk keduanya', async () => {
    const { host, guest, code } = await setupPair();
    await host.rooms.startRound(code, QUESTION_IDS);
    await guest.rooms.closeRoom(code, 'player-left');
    expect(await admin(`rooms/${code}/state`, 'GET')).toMatchObject({
      status: 'closed',
      closedReason: 'player-left',
    });
    await expectDenied(host.rooms.playAgain({ code, currentRound: 1, nextTargetUid: guest.uid }));
    await expectDenied(host.rooms.updateSettings(code, { mode: 'match' }));
  });

  it('room berumur lebih dari 24 jam: tidak bisa dimasuki maupun diubah', async () => {
    const host = await newPlayer();
    const code: RoomCode = 'KKKKKK';
    await admin(
      `rooms/${code}`,
      'PUT',
      JSON.stringify({
        meta: {
          hostUid: host.uid,
          hostName: 'Sari',
          createdAt: Date.now() - 25 * 60 * 60 * 1000,
          schemaVersion: 1,
        },
        settings: { categoryId: 'santai', mode: 'guess', targetUid: host.uid },
        state: { status: 'lobby', round: 1 },
        players: { [host.uid]: { name: 'Sari', role: 'host', joinedAt: 0 } },
      }),
    );
    const guest = await newPlayer();
    expect(await guest.rooms.joinRoom({ code, uid: guest.uid, name: 'Bima' })).toEqual({
      ok: false,
      error: 'expired',
    });
    await expectDenied(update(ref(guest.db, `rooms/${code}/meta`), { guestUid: guest.uid }));
    await expectDenied(host.rooms.updateSettings(code, { mode: 'match' }));
  });
});

describe('langganan real-time & presence', () => {
  it('Host melihat Tamu masuk, progresnya, lalu jawaban Tamu per soal begitu terbuka', async () => {
    const host = await newPlayer();
    const guest = await newPlayer();
    const code = await createRoom(host);

    const joined = waitForRoom(host, code, (d) => d.players[guest.uid]?.name === 'Bima');
    await guest.rooms.joinRoom({ code, uid: guest.uid, name: 'Bima' });
    await joined;

    await host.rooms.startRound(code, QUESTION_IDS);
    const q1 = QUESTION_IDS[0] ?? '';

    // Tamu menjawab duluan: Host melihat progresnya, tapi belum jawabannya.
    const progressSeen = waitForRoom(
      host,
      code,
      (d) => (d.progress[guest.uid]?.answered ?? 0) === 1,
    );
    await answer(guest, code, 0, 'c');
    const before = await progressSeen;
    expect(before.partnerAnswers).toEqual({});

    // Host menjawab: soal 1 terbuka di langganan Host.
    const revealed = waitForRoom(host, code, (d) => d.partnerAnswers[q1] !== undefined);
    await answer(host, code, 0, 'a');
    expect((await revealed).partnerAnswers).toEqual({ [q1]: 'c' });
  });

  it('presence: online saat terhubung, offline otomatis saat koneksi putus', async () => {
    const { host, guest, code } = await setupPair();
    const online = waitForRoom(host, code, (d) => d.presence[guest.uid]?.online === true);
    guest.rooms.startPresence(code, guest.uid);
    await online;

    const offline = waitForRoom(host, code, (d) => d.presence[guest.uid]?.online === false);
    goOffline(guest.db);
    await offline;
  });

  it('bukan anggota tidak bisa berlangganan data room', async () => {
    const { code } = await setupPair();
    const outsider = await newPlayer();
    await expect(waitForRoom(outsider, code, () => true, 4000)).rejects.toThrow(
      /permission[_ ]denied/i,
    );
  });

  it('setelah refresh, frame "siap" pertama sudah memuat progres & jawaban sendiri', async () => {
    // Regresi: dulu "siap" dikirim sebelum data ronde tiba, sehingga kuis mulai dari soal 1.
    const { host, guest, code } = await setupPair();
    await host.rooms.startRound(code, QUESTION_IDS);
    for (const index of [0, 1, 2]) await answer(guest, code, index, 'c');
    const reopened = await connect(guest.user);
    expect(reopened.uid).toBe(guest.uid);
    const first = await waitForRoom(reopened, code, () => true);
    expect(Object.keys(first.myAnswers)).toHaveLength(3);
    expect(first.progress[guest.uid]?.answered).toBe(3);
  });
});
