import { getLocale, getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { formatDate, formatMoney, formatNumber, formatQuantity } from '@/core/i18n/format';
import { Button } from '@/core/ui/button';
import { Card } from '@/core/ui/card';
import { EmptyState } from '@/core/ui/empty-state';
import { PageHeader } from '@/core/ui/page-header';
import { Skeleton, SkeletonText } from '@/core/ui/skeleton';
import { DemoModal, DemoTable } from './demo-client';

// Development only: `*.dev.tsx` pages are not built in production (next.config.ts), so this
// route is a real 404 there and its code never reaches the production bundle.
export default async function UiDemoPage() {
  const [t, locale] = await Promise.all([getTranslations('demo'), getLocale()]);

  const section = (title: string, children: ReactNode) => (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );

  const preview = (theme: 'light' | 'dark', label: string) => (
    <div data-theme={theme} className="space-y-8 rounded-card bg-bg p-5 text-fg">
      <p className="text-sm font-semibold tracking-wide text-fg-muted uppercase">{label}</p>

      {section(
        t('buttons'),
        <div className="flex flex-wrap gap-2">
          <Button>{t('primary')}</Button>
          <Button variant="secondary">{t('secondary')}</Button>
          <Button variant="ghost">{t('ghost')}</Button>
          <Button variant="danger">{t('danger')}</Button>
          <Button disabled>{t('disabled')}</Button>
          <Button size="lg">{t('primary')}</Button>
          <DemoModal />
        </div>,
      )}

      {section(
        t('card'),
        <Card>
          <p className="text-sm text-fg-muted">{t('cardBody')}</p>
        </Card>,
      )}

      {section(
        t('formats'),
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
          <dt className="text-fg-muted">{t('number')}</dt>
          <dd className="tabular-nums">{formatNumber(1234567, locale)}</dd>
          <dt className="text-fg-muted">{t('money')}</dt>
          <dd className="tabular-nums">{formatMoney('1234567.5', locale)}</dd>
          <dt className="text-fg-muted">{t('quantity')}</dt>
          <dd className="tabular-nums">{formatQuantity('40000', locale)}</dd>
          <dt className="text-fg-muted">{t('date')}</dt>
          <dd>{formatDate(new Date('2026-11-16T10:00:00+06:00'), locale)}</dd>
        </dl>,
      )}

      {section(
        t('status'),
        <div className="flex flex-wrap gap-4 text-sm font-medium">
          <span className="text-success">{t('success')}</span>
          <span className="text-warning">{t('warning')}</span>
          <span className="text-danger">{t('danger')}</span>
        </div>,
      )}

      {section(
        t('emptyTitle'),
        <EmptyState title={t('emptyTitle')} description={t('emptyDescription')} />,
      )}

      {section(
        t('skeleton'),
        <div className="space-y-3">
          <Skeleton className="h-8 w-48" />
          <SkeletonText lines={3} />
        </div>,
      )}
    </div>
  );

  return (
    <>
      <PageHeader title={t('title')} description={t('description')} />
      <div className="grid gap-6 xl:grid-cols-2">
        {preview('light', t('lightTheme'))}
        {preview('dark', t('darkTheme'))}
      </div>
      <div className="mt-8">{section(t('table'), <DemoTable />)}</div>
    </>
  );
}
