import { type ReactNode, useEffect, useId, useRef } from 'react';
import { Button } from './Button';

/** Elemen <dialog> bawaan: fokus terkunci di dalam, Esc menutup, fokus kembali ke pemicu. */
function useModal(open: boolean) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return ref;
}

/** Dialog naik pelan dan latarnya meredup setiap kali dibuka (animasi diputar ulang oleh showModal). */
const DIALOG_CLASS =
  'm-auto w-[min(420px,calc(100%-2rem))] animate-dialog rounded-dialog bg-kertas p-6 text-tinta backdrop:animate-fade backdrop:bg-tinta/40';

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Batal',
  tone = 'danger',
  loading = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useModal(open);
  const id = useId();
  return (
    <dialog
      ref={ref}
      aria-labelledby={`${id}-judul`}
      aria-describedby={`${id}-pesan`}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      className={DIALOG_CLASS}
    >
      <h2 id={`${id}-judul`} className="font-serif text-[1.375rem] leading-tight font-medium">
        {title}
      </h2>
      <p id={`${id}-pesan`} className="mt-2 text-tinta-pudar">
        {message}
      </p>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button variant={tone} loading={loading} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}

/** Cadangan terakhir saat share dan clipboard tidak tersedia: teks yang bisa disalin manual. */
export function CopyTextDialog({ text, onClose }: { text: string | null; onClose: () => void }) {
  const ref = useModal(text !== null);
  const id = useId();
  return (
    <dialog
      ref={ref}
      aria-labelledby={`${id}-judul`}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className={DIALOG_CLASS}
    >
      <h2 id={`${id}-judul`} className="font-serif text-[1.375rem] leading-tight font-medium">
        Salin teks ini
      </h2>
      <p className="mt-2 text-tinta-pudar">Tekan lama atau pilih semua, lalu salin.</p>
      <textarea
        readOnly
        aria-label="Teks untuk dibagikan"
        value={text ?? ''}
        onFocus={(event) => event.currentTarget.select()}
        rows={5}
        className="mt-4 w-full resize-none rounded-option bg-kabut p-3 text-tinta outline-none focus:shadow-[inset_0_0_0_2px_var(--color-tinta)]"
      />
      <div className="mt-5 flex justify-end">
        <Button onClick={onClose}>Tutup</Button>
      </div>
    </dialog>
  );
}
