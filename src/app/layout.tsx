import type { Metadata } from 'next';
import { Inter, Noto_Sans_Bengali } from 'next/font/google';
import { cookies } from 'next/headers';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages, getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { QueryProvider } from '@/core/api/query-provider';
import { pickClientMessages } from '@/core/i18n/client-messages';
import { THEME_COOKIE, resolveTheme } from '@/core/theme/config';
import './globals.css';

// Variable fonts: no weight list needed. Each loads only its own script subset.
const latin = Inter({ subsets: ['latin'], variable: '--font-latin', display: 'swap' });
const bengali = Noto_Sans_Bengali({
  subsets: ['bengali'],
  variable: '--font-bengali',
  display: 'swap',
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('common');
  return { title: t('appName') };
}

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const [locale, messages, cookieStore] = await Promise.all([
    getLocale(),
    getMessages(),
    cookies(),
  ]);
  // Theme decided on the server from the cookie: no flash of the wrong theme on load.
  const theme = resolveTheme(cookieStore.get(THEME_COOKIE)?.value);

  return (
    <html lang={locale} data-theme={theme} className={`${latin.variable} ${bengali.variable}`}>
      {/* suppressHydrationWarning: browser extensions (e.g. Grammarly) add attributes to <body>. */}
      <body suppressHydrationWarning className="min-h-dvh bg-bg font-sans text-fg antialiased">
        <NextIntlClientProvider messages={pickClientMessages(messages)}>
          <QueryProvider>{children}</QueryProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
