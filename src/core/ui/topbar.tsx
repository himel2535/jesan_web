'use client';

import { Menu } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { Theme } from '@/core/theme/config';
import { BusinessSwitcher } from './business-switcher';
import { NotificationBell } from './notification-bell';
import { TopbarDate } from './topbar-date';
import { UserMenu } from './user-menu';

/**
 * Top bar: menu button (phones), business switcher, current month, the pending-approvals bell and the user menu (language, theme, password,
 * sign out). No blur here: blur is limited to cards, the sidebar and modals (DECISIONS.md).
 */
export function Topbar({ theme, onOpenMenu }: { theme: Theme; onOpenMenu: () => void }) {
  const t = useTranslations();

  return (
    <header className="sticky top-0 z-20 flex min-h-16 items-center gap-2 border-b border-border bg-surface/95 px-4">
      <button
        type="button"
        onClick={onOpenMenu}
        aria-label={t('shell.openMenu')}
        className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg text-fg hover:bg-surface-muted md:hidden"
      >
        <Menu aria-hidden className="size-5" />
      </button>
      <BusinessSwitcher />
      <div className="ml-auto flex items-center gap-2">
        <TopbarDate />
        <NotificationBell />
        <UserMenu theme={theme} />
      </div>
    </header>
  );
}
