'use client';

import { CircleCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, useRef, useState, type FormEvent } from 'react';
import { apiFetch } from '@/core/api/client';
import { ApiError } from '@/core/api/errors';
import { Button } from '@/core/ui/button';
import { PasswordInput } from '@/core/ui/password-input';
import { Field, describedBy } from '@/core/ui/text-field';
import {
  passwordRuleError,
  type PasswordIdentity,
  type PasswordRuleError,
} from '../password-rules';
import { useSession } from '../session-context';

export { PASSWORD_MAX, PASSWORD_MIN } from '../password-rules';

type FieldName = 'current' | 'new' | 'confirm';
type FieldError = PasswordRuleError | 'mismatch';

/** The API's password rules (docs/API.md §7), checked before sending; the API checks again. */
export function validatePasswords(
  values: Record<FieldName, string>,
  identity: PasswordIdentity,
): Partial<Record<FieldName, FieldError>> {
  const errors: Partial<Record<FieldName, FieldError>> = {};
  if (!values.current) errors.current = 'required';
  const newError = passwordRuleError(values.new, identity);
  if (newError) errors.new = newError;
  if (!values.confirm) errors.confirm = 'required';
  else if (values.confirm !== values.new) errors.confirm = 'mismatch';
  return errors;
}

type Result = 'success' | 'currentWrong' | 'unavailable' | 'unknown';

export function ChangePasswordForm() {
  const t = useTranslations('account');
  const id = useId();
  const { user } = useSession();
  const [values, setValues] = useState<Record<FieldName, string>>({
    current: '',
    new: '',
    confirm: '',
  });
  const [errors, setErrors] = useState<Partial<Record<FieldName, FieldError>>>({});
  const [result, setResult] = useState<Result | null>(null);
  const [saving, setSaving] = useState(false);
  const inFlight = useRef(false);
  const refs = {
    current: useRef<HTMLInputElement>(null),
    new: useRef<HTMLInputElement>(null),
    confirm: useRef<HTMLInputElement>(null),
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (inFlight.current) return;
    const found = validatePasswords(values, user);
    setErrors(found);
    setResult(null);
    const first = (['current', 'new', 'confirm'] as const).find((name) => found[name]);
    if (first) {
      refs[first].current?.focus();
      return;
    }

    inFlight.current = true;
    setSaving(true);
    try {
      await apiFetch('/auth/change-password', {
        method: 'POST',
        body: { currentPassword: values.current, newPassword: values.new },
      });
      setValues({ current: '', new: '', confirm: '' });
      setResult('success');
    } catch (cause) {
      // Rules were checked above, so a 400 here means the current password was wrong.
      if (cause instanceof ApiError && cause.status === 400) {
        setResult('currentWrong');
        refs.current.current?.focus();
      } else if (cause instanceof ApiError && cause.isServerUnavailable) setResult('unavailable');
      else setResult('unknown');
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  };

  const field = (name: FieldName, label: string, autoComplete: string, hint?: string) => {
    const fieldId = `${id}-${name}`;
    const error = errors[name];
    return (
      <Field id={fieldId} label={label} hint={hint} error={error ? t(error) : undefined}>
        <PasswordInput
          ref={refs[name]}
          id={fieldId}
          autoComplete={autoComplete}
          value={values[name]}
          onChange={(event) => setValues((v) => ({ ...v, [name]: event.target.value }))}
          aria-invalid={
            Boolean(error) || (name === 'current' && result === 'currentWrong') || undefined
          }
          aria-describedby={describedBy(fieldId, { hint: Boolean(hint), error: Boolean(error) })}
        />
      </Field>
    );
  };

  return (
    <form noValidate onSubmit={onSubmit} className="max-w-md space-y-5">
      <div role="status" aria-live="polite">
        {result === 'success' ? (
          <p className="flex items-center gap-2 rounded-lg border border-success px-3 py-2 text-sm font-medium text-success">
            <CircleCheck aria-hidden className="size-4 shrink-0" />
            {t('success')}
          </p>
        ) : null}
      </div>
      <div role="alert">
        {result && result !== 'success' ? (
          <p className="rounded-lg border border-danger px-3 py-2 text-sm font-medium text-danger">
            {t(result)}
          </p>
        ) : null}
      </div>
      {field('current', t('current'), 'current-password')}
      {field('new', t('new'), 'new-password', t('rules'))}
      {field('confirm', t('confirm'), 'new-password')}
      <Button type="submit" size="lg" disabled={saving} aria-busy={saving}>
        {saving ? t('saving') : t('submit')}
      </Button>
    </form>
  );
}
