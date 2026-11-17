import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { BusinessProvider } from '@/core/auth/session-context';
import { lookupBusiness, moduleTranslator } from '@/core/module-system/business-context';
import { buildBusinessNav } from '@/core/module-system/business-nav';
import { buildCoreNav } from '@/core/navigation/core-nav';
import type { NavItem } from '@/core/navigation/types';
import { getShellPrefs } from '@/core/theme/server';
import { AppShell } from '@/core/ui/app-shell';
import { Forbidden } from '@/core/ui/forbidden';
import { getModuleManifest } from '@/modules/registry';

/**
 * Inside one business: its name heads the sidebar, its module's menu fills it (only entries the
 * user's permissions allow), and the topbar switcher shows it as current. Names come from data.
 */
export default async function BusinessLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [lookup, prefs, t] = await Promise.all([
    lookupBusiness(slug),
    getShellPrefs(),
    getTranslations(),
  ]);

  if (lookup.status === 'unavailable') return null; // the parent layout shows "server unavailable"
  if (lookup.status === 'notFound') notFound();
  if (lookup.status === 'forbidden') {
    return (
      <AppShell
        title={t('common.appName')}
        navItems={buildCoreNav((key) => t(`nav.${key}`))}
        initialCollapsed={prefs.sidebarCollapsed}
        theme={prefs.theme}
      >
        <Forbidden />
      </AppShell>
    );
  }

  const manifest = getModuleManifest(lookup.business.type);
  let navItems: NavItem[] = [];
  if (manifest) {
    const tm = await moduleTranslator(manifest);
    navItems = buildBusinessNav(manifest, lookup.business, (key) => tm(`nav.${key}`));
  }

  return (
    <BusinessProvider business={lookup.business}>
      <AppShell
        title={lookup.name}
        navItems={navItems}
        initialCollapsed={prefs.sidebarCollapsed}
        theme={prefs.theme}
      >
        {children}
      </AppShell>
    </BusinessProvider>
  );
}
