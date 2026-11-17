import type { ReactNode } from 'react';

export const inputClass =
  'block min-h-11 w-full rounded-lg border border-border bg-surface px-3 text-base text-fg placeholder:text-fg-muted aria-[invalid=true]:border-danger';

/**
 * Label + control + hint + error, wired for screen readers: the control gets
 * aria-describedby (hint and error) and aria-invalid from the caller.
 */
export function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-fg">
        {label}
      </label>
      {children}
      {hint ? (
        <p id={`${id}-hint`} className="text-sm text-fg-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** ids for aria-describedby: hint first, then the error when there is one. */
export function describedBy(id: string, { hint, error }: { hint?: boolean; error?: boolean }) {
  return [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined;
}
