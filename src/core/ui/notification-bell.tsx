'use client';

import { Bell } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { usePendingCount } from '@/core/approvals/api';
import { useCurrentBusiness } from '@/core/auth/session-context';
import { useFormat } from '@/core/i18n/use-format';

/** Pending-approvals bell for the topbar; only inside a business (the count is per business). */
export function NotificationBell() {
  const business = useCurrentBusiness();
  if (!business) return null;
  return <BellLink slug={business.slug} />;
}

function BellLink({ slug }: { slug: string }) {
  const t = useTranslations('shell');
  const format = useFormat();
  const pendingCount = usePendingCount(slug).data ?? 0;

  return (
    <Link
      href={`/b/${encodeURIComponent(slug)}/approvals`}
      aria-label={t('notifications', { count: pendingCount })}
      className="relative inline-flex size-10 items-center justify-center rounded-full border border-border bg-surface text-fg"
    >
      <Bell aria-hidden className="size-5" />
      {pendingCount > 0 && (
        <span
          aria-hidden
          className="absolute -top-0.5 -right-0.5 min-w-5 rounded-full bg-danger px-1 text-center text-[10px] leading-5 font-semibold text-danger-fg"
        >
          {format.number(pendingCount)}
        </span>
      )}
    </Link>
  );
}
