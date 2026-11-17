import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { buildCoreNav } from '@/core/navigation/core-nav';
import { getShellPrefs } from '@/core/theme/server';
import { AppShell } from '@/core/ui/app-shell';

/** Shell outside any business: Enterprise Dashboard, account pages, dev pages. */
export default async function EnterpriseLayout({ children }: { children: ReactNode }) {
  const [prefs, t] = await Promise.all([getShellPrefs(), getTranslations()]);
  return (
    <AppShell
      title={t('common.appName')}
      navItems={buildCoreNav((key) => t(`nav.${key}`))}
      initialCollapsed={prefs.sidebarCollapsed}
      theme={prefs.theme}
    >
      {children}
    </AppShell>
  );
}
