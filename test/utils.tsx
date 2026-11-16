import { render, type RenderOptions } from '@testing-library/react';
import axe from 'axe-core';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactElement } from 'react';
import { expect } from 'vitest';
import bn from '../messages/bn.json';
import en from '../messages/en.json';
import type { Locale } from '@/core/i18n/config';

const messages = { bn, en };

export function renderWithIntl(
  ui: ReactElement,
  { locale = 'en', ...options }: { locale?: Locale } & RenderOptions = {},
) {
  return render(
    <NextIntlClientProvider locale={locale} messages={messages[locale]} timeZone="Asia/Dhaka">
      {ui}
    </NextIntlClientProvider>,
    options,
  );
}

/**
 * Basic accessibility check with axe-core. Colour contrast is skipped here because jsdom does
 * not compute styles; it is covered by src/core/theme/contrast.test.ts on the real tokens.
 */
export async function expectNoA11yViolations(container: Element) {
  const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
  const summary = results.violations.map((v) => `${v.id}: ${v.help}`);
  expect(summary).toEqual([]);
}
