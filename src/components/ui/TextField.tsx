import { type InputHTMLAttributes, type Ref, useId } from 'react';

interface TextFieldProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'onChange' | 'value' | 'id'
> {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  hint?: string;
  /** Tampilkan penghitung karakter, misalnya "5/20". */
  showCount?: boolean;
  inputRef?: Ref<HTMLInputElement>;
  inputClassName?: string;
}

export function TextField({
  label,
  value,
  onChange,
  error,
  hint,
  showCount = false,
  maxLength,
  inputRef,
  className = '',
  inputClassName = '',
  ...rest
}: TextFieldProps) {
  const id = useId();
  const messageId = `${id}-pesan`;
  const message = error ?? hint;

  return (
    <div className={className}>
      <label htmlFor={id} className="font-semibold text-tinta-pudar">
        {label}
      </label>
      <div className="relative mt-1.5">
        <input
          ref={inputRef}
          id={id}
          value={value}
          maxLength={maxLength}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={message ? messageId : undefined}
          className={`h-11 w-full rounded-option bg-kertas pl-4 font-medium text-tinta shadow-[inset_0_0_0_1px_var(--color-bingkai)] transition-shadow duration-150 ease-out outline-none placeholder:text-tinta-pudar/70 focus:shadow-[inset_0_0_0_2px_var(--color-tinta)] aria-invalid:shadow-[inset_0_0_0_2px_var(--color-bahaya)] ${showCount ? 'pr-16' : 'pr-4'} ${inputClassName}`}
          {...rest}
        />
        {showCount && maxLength ? (
          <span
            aria-hidden
            className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-tinta-pudar tabular-nums"
          >
            {value.length}/{maxLength}
          </span>
        ) : null}
      </div>
      {message ? (
        <p
          // Ganti kunci saat error muncul atau berganti, agar pesannya naik dan terlihat.
          key={error ? `error-${error}` : 'hint'}
          id={messageId}
          className={`mt-1.5 ${error ? 'animate-rise font-medium text-bahaya' : 'text-tinta-pudar'}`}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
