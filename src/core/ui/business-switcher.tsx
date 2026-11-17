'use client';

import { Building2, Check, ChevronDown, LayoutGrid } from 'lucide-react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useCurrentBusiness, useSession } from '@/core/auth/session-context';
import { localizedName } from '@/core/auth/types';
import { businessBasePath } from '@/core/module-system/business-nav';
import { cn } from './cn';
import { Dropdown } from './dropdown';

/** Topbar menu to jump between the businesses the user can open (from GET /auth/me). */
export function BusinessSwitcher() {
  const t = useTranslations('business');
  const locale = useLocale();
  const { businesses } = useSession();
  const current = useCurrentBusiness();
  const currentName = current ? localizedName(current, locale) : t('allBusinesses');

  return (
    <Dropdown
      label={t('switcherLabel')}
      align="start"
      triggerClassName="max-w-[min(18rem,50vw)] px-3"
      trigger={
        <>
          <Building2 aria-hidden className="size-5 shrink-0" />
          <span className="truncate text-sm font-semibold">{currentName}</span>
          <ChevronDown aria-hidden className="size-4 shrink-0 text-fg-muted" />
        </>
      }
    >
      {(close) => (
        <ul className="flex flex-col gap-1">
          <li>
            <Link
              href="/"
              prefetch={false}
              onClick={close}
              className="flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm hover:bg-surface-muted"
            >
              <LayoutGrid aria-hidden className="size-4 text-fg-muted" />
              {t('allBusinesses')}
            </Link>
          </li>
          {businesses.map((business) => {
            const isCurrent = business.slug === current?.slug;
            return (
              <li key={business.id}>
                <Link
                  href={businessBasePath(business.slug)}
                  prefetch={false}
                  onClick={close}
                  aria-current={isCurrent ? 'page' : undefined}
                  className={cn(
                    'flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm hover:bg-surface-muted',
                    isCurrent && 'font-semibold',
                  )}
                >
                  <Building2 aria-hidden className="size-4 text-fg-muted" />
                  <span className="flex-1 truncate">{localizedName(business, locale)}</span>
                  {isCurrent ? <Check aria-hidden className="size-4" /> : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Dropdown>
  );
}
