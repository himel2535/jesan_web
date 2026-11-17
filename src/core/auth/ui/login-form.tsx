'use client';

import { navigateTo } from '@/core/lib/navigation';
import { useTranslations } from 'next-intl';
import { useId, useRef, useState, type FormEvent } from 'react';
import { apiFetch } from '@/core/api/client';
import { ApiError } from '@/core/api/errors';
import { Button } from '@/core/ui/button';
import { PasswordInput } from '@/core/ui/password-input';
import { Field, describedBy, inputClass } from '@/core/ui/text-field';
import { safeNextPath } from '../next-path';

type FormError =
  | { kind: 'invalid' }
  | { kind: 'tooMany'; seconds?: number }
  | { kind: 'unavailable' }
  | { kind: 'unknown' };

/** Maps a login failure to the one message the user should see (docs/API.md §7 and §9). */
export function loginErrorFor(error: unknown): FormError {
  if (!(error instanceof ApiError)) return { kind: 'unknown' };
  // Wrong password, unknown user, inactive and locked all return the same 401 on purpose.
  if (error.status === 401) return { kind: 'invalid' };
  if (error.status === 429) return { kind: 'tooMany', seconds: error.retryAfterSeconds };
  if (error.isServerUnavailable) return { kind: 'unavailable' };
  return { kind: 'unknown' };
}

export function LoginForm({ next }: { next: string }) {
  const t = useTranslations('auth');
  const id = useId();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [missing, setMissing] = useState<{ identifier?: boolean; password?: boolean }>({});
  const [error, setError] = useState<FormError | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // A ref, not state: two quick clicks happen before React re-renders the disabled button.
  const inFlight = useRef(false);
  const identifierRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (inFlight.current) return;

    const nowMissing = { identifier: !identifier.trim(), password: !password };
    setMissing(nowMissing);
    if (nowMissing.identifier || nowMissing.password) {
      (nowMissing.identifier ? identifierRef : passwordRef).current?.focus();
      return;
    }

    inFlight.current = true;
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch('/auth/login', {
        method: 'POST',
        body: { identifier: identifier.trim(), password },
        skipAuthRefresh: true,
      });
      // Full navigation: the server reads the new cookies and renders the protected page.
      navigateTo(safeNextPath(next));
      return;
    } catch (cause) {
      setError(loginErrorFor(cause));
      setPassword('');
      inFlight.current = false;
      setSubmitting(false);
      passwordRef.current?.focus();
    }
  };

  const message =
    error === null
      ? null
      : error.kind === 'tooMany'
        ? error.seconds
          ? t('tooManyWithSeconds', { seconds: error.seconds })
          : t('tooMany')
        : t(error.kind);

  const identifierId = `${id}-identifier`;
  const passwordId = `${id}-password`;
  const errorId = `${id}-form-error`;
  const credentialsInvalid = error?.kind === 'invalid';

  return (
    <form
      noValidate
      onSubmit={onSubmit}
      aria-describedby={message ? errorId : undefined}
      className="space-y-5"
    >
      <div id={errorId} role="alert" aria-live="assertive">
        {message ? (
          <p className="rounded-lg border border-danger px-3 py-2 text-sm font-medium text-danger">
            {message}
          </p>
        ) : null}
      </div>

      <Field
        id={identifierId}
        label={t('identifier')}
        hint={t('identifierHint')}
        error={missing.identifier ? t('required') : undefined}
      >
        <input
          ref={identifierRef}
          id={identifierId}
          name="identifier"
          type="text"
          inputMode="email"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
          aria-invalid={missing.identifier || credentialsInvalid || undefined}
          aria-describedby={describedBy(identifierId, { hint: true, error: missing.identifier })}
          className={inputClass}
        />
      </Field>

      <Field
        id={passwordId}
        label={t('password')}
        error={missing.password ? t('required') : undefined}
      >
        <PasswordInput
          ref={passwordRef}
          id={passwordId}
          name="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          aria-invalid={missing.password || credentialsInvalid || undefined}
          aria-describedby={describedBy(passwordId, { error: missing.password })}
        />
      </Field>

      <Button
        type="submit"
        size="lg"
        disabled={submitting}
        aria-busy={submitting}
        className="w-full"
      >
        {submitting ? t('submitting') : t('submit')}
      </Button>
    </form>
  );
}
