'use client';

import { navigateTo } from '@/core/lib/navigation';
import { KeyRound, LogOut, UserRound } from 'lucide-react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { apiFetch } from '@/core/api/client';
import { LOGIN_PATH } from '@/core/auth/constants';
import { useCurrentBusiness, useSession } from '@/core/auth/session-context';
import { localizedName } from '@/core/auth/types';
import type { Theme } from '@/core/theme/config';
import { Dropdown } from './dropdown';
import { LocaleSwitcher } from './locale-switcher';
import { ThemeToggle } from './theme-toggle';

const itemClass =
  'flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm hover:bg-surface-muted disabled:opacity-50';

/** Topbar user menu: who is signed in, language, theme, change password, sign out. */
export function UserMenu({ theme }: { theme: Theme }) {
  const t = useTranslations();
  const locale = useLocale();
  const { user } = useSession();
  const business = useCurrentBusiness();
  const [loggingOut, setLoggingOut] = useState(false);

  const roleLabel = business
    ? localizedName(business.role, locale)
    : user.isPlatformOwner
      ? t('userMenu.platformOwner')
      : null;

  const logout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      // 204 even when already signed out; the API clears both cookies.
      await apiFetch('/auth/logout', { method: 'POST', skipAuthRefresh: true });
    } catch {
      // Ignore: going to /login is still right, and logout is safe to repeat.
    }
    navigateTo(LOGIN_PATH);
  };

  return (
    <Dropdown
      label={t('shell.userMenu')}
      triggerClassName="size-10 justify-center rounded-full border border-border"
      trigger={<UserRound aria-hidden className="size-5" />}
    >
      {(close) => (
        <div className="flex flex-col gap-2">
          <div className="border-b border-border px-3 pt-1 pb-3">
            <p className="truncate font-semibold">{user.name}</p>
            {roleLabel ? <p className="text-sm text-fg-muted">{roleLabel}</p> : null}
          </div>
          <div className="flex items-center justify-between gap-2 px-3">
            <span className="text-sm text-fg-muted">{t('userMenu.language')}</span>
            <LocaleSwitcher />
          </div>
          <div className="flex items-center justify-between gap-2 px-3">
            <span className="text-sm text-fg-muted">{t('userMenu.theme')}</span>
            <ThemeToggle initialTheme={theme} />
          </div>
          <div className="flex flex-col gap-1 border-t border-border pt-2">
            <Link href="/account/password" prefetch={false} onClick={close} className={itemClass}>
              <KeyRound aria-hidden className="size-4 text-fg-muted" />
              {t('userMenu.changePassword')}
            </Link>
            <button type="button" onClick={logout} disabled={loggingOut} className={itemClass}>
              <LogOut aria-hidden className="size-4 text-fg-muted" />
              {loggingOut ? t('userMenu.loggingOut') : t('userMenu.logout')}
            </button>
          </div>
        </div>
      )}
    </Dropdown>
  );
}
