'use client';

import { Menu, UserRound } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { Theme } from '@/core/theme/config';
import { LocaleSwitcher } from './locale-switcher';
import { ThemeToggle } from './theme-toggle';

/**
 * Top bar: menu button (phones), language, theme and a placeholder for the user menu.
 * No blur here: blur is limited to cards, the sidebar and modals (DECISIONS.md).
 */
export function Topbar({ theme, onOpenMenu }: { theme: Theme; onOpenMenu: () => void }) {
  const t = useTranslations();

  return (
    <header className="sticky top-0 z-10 flex min-h-16 items-center gap-3 border-b border-border bg-surface/95 px-4">
      <button
        type="button"
        onClick={onOpenMenu}
        aria-label={t('shell.openMenu')}
        className="inline-flex size-10 items-center justify-center rounded-lg text-fg hover:bg-surface-muted md:hidden"
      >
        <Menu aria-hidden className="size-5" />
      </button>
      <span className="truncate text-base font-semibold text-fg md:hidden">
        {t('common.appName')}
      </span>
      <div className="ml-auto flex items-center gap-2">
        <LocaleSwitcher />
        <ThemeToggle initialTheme={theme} />
        {/* User menu arrives with login. */}
        <button
          type="button"
          disabled
          aria-label={t('shell.userMenu')}
          title={t('shell.userMenu')}
          className="inline-flex size-10 items-center justify-center rounded-full border border-border text-fg-muted"
        >
          <UserRound aria-hidden className="size-5" />
        </button>
      </div>
    </header>
  );
}
