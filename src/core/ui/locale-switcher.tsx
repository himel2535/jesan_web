'use client';

import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { LOCALE_COOKIE, locales, type Locale } from '@/core/i18n/config';
import { setPreferenceCookie } from '@/core/lib/cookies';
import { cn } from './cn';

/** One click switches language: save the cookie, then re-render on the server (no URL prefix). */
export function LocaleSwitcher() {
  const t = useTranslations('locale');
  const current = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const choose = (next: Locale) => {
    if (next === current) return;
    setPreferenceCookie(LOCALE_COOKIE, next);
    startTransition(() => router.refresh());
  };

  return (
    <div
      role="group"
      aria-label={t('label')}
      aria-busy={pending}
      className="flex items-center rounded-lg border border-border p-0.5"
    >
      {locales.map((value) => (
        <button
          key={value}
          type="button"
          lang={value}
          onClick={() => choose(value)}
          aria-pressed={current === value}
          disabled={pending}
          className={cn(
            'inline-flex min-h-9 items-center rounded-md px-3 text-sm font-medium',
            current === value ? 'bg-primary text-primary-fg' : 'text-fg hover:bg-surface-muted',
          )}
        >
          {t(value)}
        </button>
      ))}
    </div>
  );
}
