import { renderHook } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import bn from '../../../messages/bn.json';
import en from '../../../messages/en.json';
import { ERROR_CODES, FIELD_PROBLEMS, messageKeyForCode } from './error-codes';
import { ApiError, apiErrorFromResponse } from './errors';
import { fieldErrorsOf, useErrorMessage } from './field-errors';

const wrap = (locale: 'en' | 'bn') => {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <NextIntlClientProvider locale={locale} messages={locale === 'en' ? en : bn}>
        {children}
      </NextIntlClientProvider>
    );
  }
  return Wrapper;
};

const body = (status: number, code: string, field?: string, errors?: unknown[]) =>
  apiErrorFromResponse(status, {
    statusCode: status,
    message: 'English text that must not be shown',
    code,
    ...(field ? { field } : {}),
    ...(errors ? { errors } : {}),
  });

describe('error codes (docs/API.md §11)', () => {
  it('every listed code and field problem has a message in both languages', () => {
    for (const messages of [en, bn]) {
      const codes = messages.apiErrors.codes as Record<string, string>;
      const problems = messages.apiErrors.problems as Record<string, string>;
      for (const code of ERROR_CODES) expect(codes[code], code).toBeTruthy();
      for (const p of FIELD_PROBLEMS) expect(problems[p], p).toBeTruthy();
      // Nothing translated that the list does not know (keeps the list the single source).
      expect(Object.keys(codes).sort()).toEqual([...ERROR_CODES].sort());
    }
  });

  it('own message first, then the problem suffix, else nothing', () => {
    expect(messageKeyForCode('PHONE_DUPLICATE')).toBe('codes.PHONE_DUPLICATE');
    expect(messageKeyForCode('ADDRESS_TOO_LONG')).toBe('problems.TOO_LONG');
    expect(messageKeyForCode('SOMETHING_NEW')).toBeUndefined();
  });
});

describe('fieldErrorsOf', () => {
  it('reads errors[] (first code per field), or field + code; nothing for other errors', () => {
    const validation = body(400, 'VALIDATION_FAILED', undefined, [
      { field: 'nameEn', code: 'NAME_EN_REQUIRED', message: 'x' },
      { field: 'phone', code: 'PHONE_INVALID', message: 'x' },
      { field: 'phone', code: 'PHONE_TOO_LONG', message: 'x' },
      { nonsense: true },
    ]);
    expect(fieldErrorsOf(validation)).toEqual({
      nameEn: 'NAME_EN_REQUIRED',
      phone: 'PHONE_INVALID',
    });
    expect(fieldErrorsOf(body(409, 'PHONE_DUPLICATE', 'phone'))).toEqual({
      phone: 'PHONE_DUPLICATE',
    });
    expect(fieldErrorsOf(body(403, 'ACCESS_DENIED'))).toEqual({});
    expect(fieldErrorsOf(new Error('x'))).toEqual({});
  });
});

describe('useErrorMessage', () => {
  it('chooses by code, never the English message; unknown code → status message', () => {
    const { result } = renderHook(() => useErrorMessage(), { wrapper: wrap('en') });
    expect(result.current.message(body(403, 'ACCESS_DENIED'))).toBe(
      'You do not have permission for this.',
    );
    expect(result.current.message(body(409, 'BRAND_NEW_CODE'))).toBe('This already exists.');
    expect(result.current.message(body(429, 'SOMETHING'))).toMatch(/Too many attempts/);
    expect(
      result.current.message(
        new ApiError({ kind: 'network', status: 0, code: 'NETWORK', message: 'x' }),
      ),
    ).toMatch(/not available/);
  });

  it('splits field errors from the rest; fields the form lacks go above the form', () => {
    const { result } = renderHook(() => useErrorMessage(), { wrapper: wrap('bn') });
    const dup = result.current.split(body(409, 'PHONE_DUPLICATE', 'phone'), ['phone', 'nameEn']);
    expect(dup).toEqual({ fields: { phone: 'এই ফোন নম্বরের গ্রাহক আগে থেকেই আছে।' }, form: null });

    const mixed = result.current.split(
      body(400, 'VALIDATION_FAILED', undefined, [
        { field: 'nameEn', code: 'NAME_EN_TOO_LONG' },
        { field: 'secret', code: 'SECRET_NOT_ALLOWED' },
      ]),
      ['nameEn'],
    );
    expect(mixed.fields.nameEn).toBe('ইংরেজি নাম সর্বোচ্চ ১২০ অক্ষরের হতে পারে।');
    expect(mixed.form).toBe('এই ঘর এখানে পাঠানো যায় না।');

    expect(result.current.split(body(403, 'ACCESS_DENIED'), ['nameEn'])).toEqual({
      fields: {},
      form: 'এই কাজের অনুমতি আপনার নেই।',
    });
  });
});
