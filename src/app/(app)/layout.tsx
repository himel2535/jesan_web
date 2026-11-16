import { cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { buildCoreNav } from '@/core/navigation/core-nav';
import { SIDEBAR_COOKIE, THEME_COOKIE, resolveTheme } from '@/core/theme/config';
import { AppShell } from '@/core/ui/app-shell';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const [cookieStore, t] = await Promise.all([cookies(), getTranslations('nav')]);

  return (
    <AppShell
      navItems={buildCoreNav((key) => t(key))}
      initialCollapsed={cookieStore.get(SIDEBAR_COOKIE)?.value === 'collapsed'}
      theme={resolveTheme(cookieStore.get(THEME_COOKIE)?.value)}
    >
      {children}
    </AppShell>
  );
}
