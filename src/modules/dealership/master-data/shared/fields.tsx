'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { cn } from '@/core/ui/cn';
import { Field, describedBy, inputClass } from '@/core/ui/text-field';
import { LIMITS } from '../types';

interface TextInputProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  maxLength?: number;
  type?: 'text' | 'tel';
  inputMode?: 'text' | 'tel' | 'decimal' | 'numeric';
  required?: boolean;
  readOnly?: boolean;
  autoComplete?: string;
}

/** Label + input + hint + error, wired with aria-invalid and aria-describedby. */
export function TextInput({
  id,
  label,
  value,
  onChange,
  error,
  hint,
  maxLength,
  type = 'text',
  inputMode,
  required,
  readOnly,
  autoComplete = 'off',
}: TextInputProps) {
  return (
    <Field id={id} label={label} hint={hint} error={error}>
      <input
        id={id}
        type={type}
        inputMode={inputMode}
        value={value}
        maxLength={maxLength}
        required={required}
        readOnly={readOnly}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={describedBy(id, { hint: Boolean(hint), error: Boolean(error) })}
        className={cn(inputClass, readOnly && 'bg-surface-muted text-fg-muted')}
      />
    </Field>
  );
}

/** Money input: text (not number) so the exact string reaches the API. */
export function MoneyInput(props: Omit<TextInputProps, 'inputMode' | 'type' | 'maxLength'>) {
  return <TextInput {...props} inputMode="decimal" maxLength={16} />;
}

/** Required reason for owner-level corrections (3–500 characters; saved in the audit log). */
export function ReasonInput({
  id,
  value,
  onChange,
  error,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  const t = useTranslations('dealership.common');
  return (
    <Field id={id} label={t('reason')} hint={t('reasonHint')} error={error}>
      <textarea
        id={id}
        value={value}
        rows={3}
        maxLength={LIMITS.reasonMax}
        required
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={describedBy(id, { hint: true, error: Boolean(error) })}
        className={cn(inputClass, 'py-2')}
      />
    </Field>
  );
}

/** A reason is valid when trimmed length is 3–500 (jesan-api WithReason DTO). */
export function reasonError(value: string): boolean {
  const length = value.trim().length;
  return length < LIMITS.reasonMin || length > LIMITS.reasonMax;
}

/**
 * Prices, opening due, credit limit: owner-level after creation. Editable only with the
 * matching permission (then a reason is required); otherwise shown read-only.
 *
 * `requestSlot` is reserved for the "request a correction" button of the approval system
 * (Step 4b). Nothing is rendered there until that exists — no dead button.
 */
export function SensitiveSection({
  editable,
  children,
  requestSlot,
}: {
  editable: boolean;
  children: ReactNode;
  requestSlot?: ReactNode;
}) {
  const t = useTranslations('dealership.common');
  return (
    <fieldset className="space-y-4 rounded-card border border-border p-4">
      <legend className="px-1 text-sm font-semibold">{t('sensitiveTitle')}</legend>
      <p className="text-sm text-fg-muted">
        {editable ? t('sensitiveHint') : t('sensitiveReadOnly')}
      </p>
      {children}
      {requestSlot}
    </fieldset>
  );
}
