import { ChevronLeft } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ThreadLink } from '@/components/thread/ThreadLink';
import { Button, IconButton } from '@/components/ui/Button';
import { Lede, ScreenLayout, ScreenTitle } from '@/components/ui/ScreenLayout';
import { TextField } from '@/components/ui/TextField';
import { QUESTION_BANK } from '@/data/questionBank';
import { useLockedAction } from '@/hooks/useLockedAction';
import { getBackend } from '@/services/backend';
import type { RoomInfo } from '@/services/roomService';
import { getAppStorage } from '@/services/storage';
import type { JoinError, RoomCode } from '@/types';
import { withTimeout } from '@/utils/async';
import { MODE_LABELS, NAME_MAX_LENGTH } from '@/utils/constants';
import { CONNECTION_ERROR, JOIN_ERROR_MESSAGES } from '@/utils/messages';
import { assessJoin } from '@/utils/phase';
import { getCategory } from '@/utils/questionBank';
import { isValidRoomCode, normalizeRoomCode } from '@/utils/roomCode';
import { NAME_ERROR_MESSAGES, initialOf, normalizeName, validateName } from '@/utils/validation';

const TIMEOUT_MS = 15_000;

/**
 * Gabung ke room. Dari link undangan: kode sudah terisi dan undangan Host ditampilkan.
 * Dari Beranda: isi kode secara manual.
 */
export function JoinScreen({
  initialCode,
  initialError,
  onBack,
  onJoined,
}: {
  initialCode: RoomCode | null;
  initialError: JoinError | null;
  onBack: () => void;
  onJoined: (code: RoomCode) => void;
}) {
  const storage = getAppStorage();
  const [code, setCode] = useState(initialCode ?? '');
  const [name, setName] = useState(() => storage.loadLastName());
  const [invite, setInvite] = useState<RoomInfo | null>(null);
  const [joinError, setJoinError] = useState<string | null>(
    initialError ? JOIN_ERROR_MESSAGES[initialError] : null,
  );
  const [submitted, setSubmitted] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  // Dari link: tampilkan siapa yang mengundang dan pengaturannya.
  useEffect(() => {
    if (!initialCode || initialError) return;
    let active = true;
    withTimeout(getBackend(), TIMEOUT_MS)
      .then((backend) => backend.rooms.getRoomInfo(initialCode))
      .then((info) => {
        if (active) setInvite(info);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [initialCode, initialError]);

  const normalizedCode = normalizeRoomCode(code);
  const codeError =
    submitted && !isValidRoomCode(normalizedCode) ? JOIN_ERROR_MESSAGES['invalid-code'] : null;
  const nameProblem = submitted ? validateName(name, invite?.meta.hostName) : null;

  const [join, joining] = useLockedAction(async () => {
    setSubmitted(true);
    setJoinError(null);
    if (!isValidRoomCode(normalizedCode)) {
      codeRef.current?.focus();
      return;
    }
    if (validateName(name, invite?.meta.hostName)) {
      nameRef.current?.focus();
      return;
    }
    try {
      const backend = await withTimeout(getBackend(), TIMEOUT_MS);
      // Kode diketik manual: ambil data room dulu untuk memeriksa nama Host.
      const info =
        invite ?? (await withTimeout(backend.rooms.getRoomInfo(normalizedCode), TIMEOUT_MS));
      if (info) {
        setInvite(info);
        const assessment = assessJoin(
          info.meta,
          info.state,
          backend.uid,
          backend.rooms.serverNow(),
        );
        if (assessment.kind !== 'member' && validateName(name, info.meta.hostName)) {
          nameRef.current?.focus();
          return;
        }
      }
      const result = await withTimeout(
        backend.rooms.joinRoom({ code: normalizedCode, uid: backend.uid, name }),
        TIMEOUT_MS,
      );
      if (!result.ok) {
        setJoinError(JOIN_ERROR_MESSAGES[result.error]);
        if (result.error === 'invalid-code' || result.error === 'not-found')
          codeRef.current?.focus();
        return;
      }
      storage.saveLastName(normalizeName(name));
      storage.saveActiveRoom(normalizedCode);
      onJoined(normalizedCode);
    } catch {
      setJoinError(CONNECTION_ERROR);
    }
  });

  const host = invite?.meta.hostName;
  const category = invite ? getCategory(QUESTION_BANK, invite.settings.categoryId) : null;

  return (
    <ScreenLayout
      top={
        <IconButton label="Kembali ke beranda" onClick={onBack}>
          <ChevronLeft aria-hidden strokeWidth={1.75} className="size-6" />
        </IconButton>
      }
      actions={
        <Button type="submit" form="gabung-room" fullWidth loading={joining}>
          Gabung
        </Button>
      }
    >
      {invite && host ? (
        <>
          <ThreadLink
            connected={false}
            intro
            waiting
            left={{ name: host, sub: 'mengundang', present: true, initial: initialOf(host) }}
            right={{ name: 'Kamu', present: false }}
          />
          <ScreenTitle className="mt-5">{host} ngajak kamu main.</ScreenTitle>
          <Lede>
            Kategori {category?.name}, mode {MODE_LABELS[invite.settings.mode]}.
          </Lede>
        </>
      ) : (
        <>
          <ScreenTitle>Gabung ke room</ScreenTitle>
          <Lede>Masukkan 6 karakter kode dari pasanganmu.</Lede>
        </>
      )}

      <form
        id="gabung-room"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          join();
        }}
      >
        {initialCode && invite ? null : (
          <TextField
            className="mt-5"
            label="Kode room"
            value={code}
            onChange={(value) => setCode(value.toUpperCase())}
            maxLength={8}
            autoComplete="off"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            inputRef={codeRef}
            placeholder="K7M2QX"
            error={codeError}
            inputClassName="font-bold tracking-[0.2em] uppercase"
          />
        )}
        <TextField
          className={initialCode && invite ? 'mt-5' : 'mt-4'}
          label="Nama panggilanmu"
          value={name}
          onChange={setName}
          maxLength={NAME_MAX_LENGTH}
          showCount
          autoComplete="nickname"
          autoCapitalize="words"
          enterKeyHint="go"
          inputRef={nameRef}
          error={
            nameProblem === 'same-as-partner' && host
              ? `${host} sudah pakai nama ini. Pakai nama lain, ya.`
              : nameProblem
                ? NAME_ERROR_MESSAGES[nameProblem]
                : null
          }
        />
        {joinError ? (
          <p role="alert" className="mt-4 font-medium text-bahaya">
            {joinError}
          </p>
        ) : null}
      </form>
    </ScreenLayout>
  );
}
