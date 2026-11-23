import { ChevronLeft } from 'lucide-react';
import { useRef, useState } from 'react';
import { CATEGORY_ICONS } from '@/components/categoryIcons';
import { Button, IconButton } from '@/components/ui/Button';
import { ChoiceGroup, ChoiceTile, Segment } from '@/components/ui/Choices';
import { Lede, ScreenLayout, ScreenTitle } from '@/components/ui/ScreenLayout';
import { TextField } from '@/components/ui/TextField';
import { QUESTION_BANK } from '@/data/questionBank';
import { useLockedAction } from '@/hooks/useLockedAction';
import { radioItemProps } from '@/hooks/useRadioKeys';
import { getBackend } from '@/services/backend';
import { getAppStorage } from '@/services/storage';
import type { CategoryId, GameMode, RoomCode } from '@/types';
import { withTimeout } from '@/utils/async';
import { CATEGORY_IDS, GAME_MODES, MODE_LABELS, NAME_MAX_LENGTH } from '@/utils/constants';
import { CONNECTION_ERROR, CREATE_ERROR_MESSAGES, MODE_DESCRIPTIONS } from '@/utils/messages';
import { getCategory } from '@/utils/questionBank';
import { NAME_ERROR_MESSAGES, normalizeName, validateName } from '@/utils/validation';

const TIMEOUT_MS = 15_000;

export function CreateRoomScreen({
  onBack,
  onCreated,
}: {
  onBack: () => void;
  onCreated: (code: RoomCode) => void;
}) {
  const storage = getAppStorage();
  const [name, setName] = useState(() => storage.loadLastName());
  const [categoryId, setCategoryId] = useState<CategoryId | null>(null);
  const [mode, setMode] = useState<GameMode>('guess');
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const categoryRef = useRef<HTMLDivElement>(null);

  const nameError = submitted ? validateName(name) : null;
  const categoryError = submitted && categoryId === null ? 'Pilih satu kategori dulu.' : null;

  const [create, creating] = useLockedAction(async () => {
    setSubmitted(true);
    setServerError(null);
    if (validateName(name)) {
      nameRef.current?.focus();
      return;
    }
    if (categoryId === null) {
      categoryRef.current?.querySelector<HTMLElement>('[role="radio"]')?.focus();
      return;
    }
    try {
      const backend = await withTimeout(getBackend(), TIMEOUT_MS);
      const result = await withTimeout(
        backend.rooms.createRoom({ uid: backend.uid, name, categoryId, mode }),
        TIMEOUT_MS,
      );
      if (!result.ok) {
        setServerError(CREATE_ERROR_MESSAGES[result.error]);
        return;
      }
      storage.saveLastName(normalizeName(name));
      storage.saveActiveRoom(result.value);
      onCreated(result.value);
    } catch {
      setServerError(CONNECTION_ERROR);
    }
  });

  return (
    <ScreenLayout
      top={
        <IconButton label="Kembali ke beranda" onClick={onBack}>
          <ChevronLeft aria-hidden strokeWidth={1.75} className="size-6" />
        </IconButton>
      }
      actions={
        <Button type="submit" form="buat-room" fullWidth loading={creating}>
          Buat room
        </Button>
      }
    >
      <ScreenTitle>Buat room</ScreenTitle>
      <Lede>Setelah ini kamu dapat link untuk dikirim ke pasanganmu.</Lede>

      <form
        id="buat-room"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          create();
        }}
      >
        <TextField
          className="mt-5"
          label="Nama panggilanmu"
          value={name}
          onChange={setName}
          maxLength={NAME_MAX_LENGTH}
          showCount
          autoComplete="nickname"
          autoCapitalize="words"
          enterKeyHint="done"
          inputRef={nameRef}
          error={nameError ? NAME_ERROR_MESSAGES[nameError] : null}
        />

        <ChoiceGroup
          legend="Kategori"
          layout="tiles"
          error={categoryError}
          hint={
            categoryId
              ? getCategory(QUESTION_BANK, categoryId).description
              : 'Soal diacak dari kategori yang kamu pilih.'
          }
          groupRef={categoryRef}
        >
          {CATEGORY_IDS.map((id) => (
            <ChoiceTile
              key={id}
              icon={CATEGORY_ICONS[id]}
              title={getCategory(QUESTION_BANK, id).name}
              radio={radioItemProps(CATEGORY_IDS, categoryId, setCategoryId, id)}
            />
          ))}
        </ChoiceGroup>

        <ChoiceGroup legend="Mode" layout="segmented" hint={MODE_DESCRIPTIONS[mode]}>
          {GAME_MODES.map((value) => (
            <Segment
              key={value}
              label={MODE_LABELS[value]}
              radio={radioItemProps(GAME_MODES, mode, setMode, value)}
            />
          ))}
        </ChoiceGroup>

        {serverError ? (
          <p role="alert" className="mt-4 font-medium text-bahaya">
            {serverError}
          </p>
        ) : null}
      </form>
    </ScreenLayout>
  );
}
