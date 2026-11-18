'use client';

import { useTranslations } from 'next-intl';
import { useCallback } from 'react';
import { apiErrorKind } from './error-kind';
import { messageKeyForCode } from './error-codes';
import { ApiError } from './errors';

/**
 * Field errors of a failed call as `{ field: code }` (first code per field), from the API's
 * `errors[]` (docs/API.md §11). Empty for anything that is not a field error.
 */
export function fieldErrorsOf(error: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!(error instanceof ApiError)) return out;
  for (const { field, code } of error.fieldErrors) out[field] ??= code;
  return out;
}

export interface SplitErrors<F extends string> {
  /** Messages for the form's own fields, shown under each field. */
  fields: Partial<Record<F, string>>;
  /** Everything else (no field, or a field this form does not have): shown above the form. */
  form: string | null;
}

/**
 * Translated messages for API errors, chosen by the stable `code` — never by the English
 * `message`. Unknown codes fall back to the general message for the HTTP status.
 */
export function useErrorMessage() {
  const t = useTranslations('apiErrors');

  const byCode = useCallback(
    (code: string): string | undefined => {
      const key = messageKeyForCode(code);
      return key ? t(key as never) : undefined;
    },
    [t],
  );

  const message = useCallback(
    (error: unknown): string => {
      if (error instanceof ApiError && !error.isServerUnavailable) {
        const first = error.fieldErrors[0];
        const fromCode =
          error.code === 'VALIDATION_FAILED' && first ? byCode(first.code) : byCode(error.code);
        if (fromCode) return fromCode;
        if (error.status === 429) return t('codes.RATE_LIMITED');
      }
      return t(`status.${apiErrorKind(error)}`);
    },
    [byCode, t],
  );

  /** Splits an error into messages for `fields` and one message for the rest. */
  const split = useCallback(
    <F extends string>(error: unknown, fields: readonly F[]): SplitErrors<F> => {
      const found = fieldErrorsOf(error);
      const result: SplitErrors<F> = { fields: {}, form: null };
      let unplaced = false;
      for (const [field, code] of Object.entries(found)) {
        if ((fields as readonly string[]).includes(field)) {
          result.fields[field as F] = byCode(code) ?? t(`status.${apiErrorKind(error)}`);
        } else unplaced = true;
      }
      if (unplaced || Object.keys(found).length === 0) {
        const unplacedCode = Object.entries(found).find(
          ([field]) => !(fields as readonly string[]).includes(field),
        )?.[1];
        result.form = (unplacedCode && byCode(unplacedCode)) || message(error);
      }
      return result;
    },
    [byCode, message, t],
  );

  return { message, split, byCode };
}
