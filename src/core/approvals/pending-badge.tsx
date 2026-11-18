'use client';

import { useTranslations } from 'next-intl';
import { useCurrentBusiness } from '@/core/auth/session-context';
import { useFormat } from '@/core/i18n/use-format';
import { cn } from '@/core/ui/cn';
import { usePendingCount } from './api';

/** Pending-request count for the sidebar; nothing without `change.view.all` or when zero. */
export function PendingApprovalsBadge({ collapsed = false }: { collapsed?: boolean }) {
  const business = useCurrentBusiness();
  const t = useTranslations('approvals');
  const format = useFormat();
  const query = usePendingCount(business?.slug ?? '');
  const count = query.data ?? 0;
  if (!business || count <= 0) return null;
  const label = t('badge', { count: format.number(count) });
  return (
    <span
      className={cn(
        'ml-auto inline-flex min-w-6 items-center justify-center rounded-full bg-danger px-1.5 text-xs font-semibold text-danger-fg tabular-nums',
        collapsed && 'absolute top-0.5 right-0.5 ml-0 min-w-5 px-1',
      )}
    >
      <span aria-hidden>{format.number(count)}</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}
