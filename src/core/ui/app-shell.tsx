'use client';

import { useTranslations } from 'next-intl';
import { useState, type ReactNode } from 'react';
import { setPreferenceCookie } from '@/core/lib/cookies';
import type { NavItem } from '@/core/navigation/types';
import { SIDEBAR_COOKIE, type Theme } from '@/core/theme/config';
import { MobileDrawer } from './mobile-drawer';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';
import { WakingNotice } from './waking-notice';

export interface AppShellProps {
  navItems: NavItem[];
  initialCollapsed: boolean;
  theme: Theme;
  /** Sidebar heading: the business name inside a business, otherwise the app name. */
  title: string;
  children: ReactNode;
}

export function AppShell({ navItems, initialCollapsed, theme, title, children }: AppShellProps) {
  const t = useTranslations('shell');
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const toggleSidebar = () => {
    const next = !collapsed;
    setCollapsed(next);
    setPreferenceCookie(SIDEBAR_COOKIE, next ? 'collapsed' : 'expanded');
  };

  return (
    <div className="flex min-h-dvh">
      <a
        href="#main"
        className="sr-only z-50 rounded-lg bg-primary px-4 py-2 text-primary-fg focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        {t('skipToContent')}
      </a>
      <Sidebar title={title} items={navItems} collapsed={collapsed} onToggle={toggleSidebar} />
      <MobileDrawer
        title={title}
        items={navItems}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar theme={theme} onOpenMenu={() => setDrawerOpen(true)} />
        {/* One place for "the server is waking up", so no page carries its own copy. */}
        <WakingNotice />
        <main id="main" tabIndex={-1} className="flex-1 p-2 md:p-3">
          {children}
        </main>
      </div>
    </div>
  );
}
