'use client';

import { useTranslations } from 'next-intl';
import { useCan } from '@/core/auth/can';
import { TabNav } from '@/core/ui/tab-nav';

/** "All requests" (change.view.all) and "My requests" (change.view.own); only those allowed. */
export function ApprovalsTabs({ slug }: { slug: string }) {
  const t = useTranslations('approvals.tabs');
  const base = `/b/${encodeURIComponent(slug)}/approvals`;
  const items = [
    ...(useCan('change.view.all') ? [{ href: `${base}/all`, label: t('all') }] : []),
    ...(useCan('change.view.own') ? [{ href: `${base}/mine`, label: t('mine') }] : []),
  ];
  return <TabNav label={t('label')} items={items} />;
}
