'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { CalendarDays, CalendarRange, Sun } from 'lucide-react';
import { useFormat } from '@/core/i18n/use-format';
import { cn } from '@/core/ui/cn';
import { useDashboardFinanceSummary } from './api';
import { dayPeriods, monthPeriods } from './periods';
import { PillSelect } from './pill-select';
import type { DayRange } from './periods';

type Scope = 'thisMonth' | 'today';

/** One block: a heading with its date, then the three figures side by side. */
function Block({
  icon,
  tone,
  badge,
  heading,
  slug,
  businessId,
  range,
  canSeePurchaseCost,
}: {
  icon: React.ReactNode;
  tone: string;
  badge: string;
  heading: string;
  slug: string;
  businessId: string;
  range: DayRange;
  canSeePurchaseCost: boolean;
}) {
  const t = useTranslations('dealership.dashboard');
  const format = useFormat();
  const summary = useDashboardFinanceSummary(slug, businessId, range);
  const data = summary.data;

  const figures = [
    { key: 'collection', label: t('summary.collection'), value: data?.collection },
    { key: 'sales', label: t('summary.sales'), value: data?.sales },
    ...(canSeePurchaseCost
      ? [{ key: 'purchase', label: t('summary.purchase'), value: data?.totalPurchase }]
      : []),
  ];

  return (
    <div className={cn('flex min-w-0 items-start gap-2 rounded-lg p-2', tone)}>
      <span
        aria-hidden
        className={cn('inline-flex size-8 shrink-0 items-center justify-center rounded-lg', badge)}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-bold text-[var(--dash-fg)]">{heading}</p>
        <dl className="mt-0.5 flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-0.5 text-xs">
          {figures.map((figure) => (
            <div key={figure.key} className="flex min-w-0 items-baseline gap-1">
              <dt className="text-[var(--dash-fg-muted)]">{figure.label}:</dt>
              <dd className="font-semibold text-[var(--dash-fg)] tabular-nums">
                {figure.value === undefined ? '—' : format.moneyRounded(figure.value)}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

/**
 * The reference's Monthly / Daily Summary: the running month and today, each
 * with its collection, sales and purchase. The pills pick which one leads;
 * both are always shown, as in the reference.
 */
export function MonthlyDailySummary({
  slug,
  businessId,
  today,
  canSeePurchaseCost,
}: {
  slug: string;
  businessId: string;
  today: string;
  canSeePurchaseCost: boolean;
}) {
  const t = useTranslations('dealership.dashboard');
  const format = useFormat();
  const [scope, setScope] = useState<Scope>('thisMonth');
  const month = monthPeriods(today, 'thisMonth').current;
  const day = dayPeriods(today, 'today').current;

  const monthLabel = format.date(`${month.from}T00:00:00.000Z`, {
    month: 'long',
    year: 'numeric',
  });
  const dayLabel = format.date(`${today}T00:00:00.000Z`, { dateStyle: 'long' });

  const monthBlock = (
    <Block
      icon={<CalendarDays aria-hidden className="size-4" />}
      tone="bg-[var(--dash-blue-card-bg)]"
      badge="bg-[var(--dash-blue-icon-bg)] text-[var(--dash-blue-accent)]"
      heading={t('summary.runningMonth', { month: monthLabel })}
      slug={slug}
      businessId={businessId}
      range={month}
      canSeePurchaseCost={canSeePurchaseCost}
    />
  );
  const dayBlock = (
    <Block
      icon={<Sun aria-hidden className="size-4" />}
      tone="bg-[var(--dash-orange-card-bg)]"
      badge="bg-[var(--dash-orange-icon-bg)] text-[var(--dash-orange-accent)]"
      heading={t('summary.todayOn', { date: dayLabel })}
      slug={slug}
      businessId={businessId}
      range={day}
      canSeePurchaseCost={canSeePurchaseCost}
    />
  );

  return (
    <section
      aria-labelledby="dash-monthly-daily"
      className="flex min-h-0 min-w-0 flex-col gap-2 overflow-y-auto rounded-card border border-[var(--dash-border)] bg-[var(--dash-surface)] p-3 shadow-[var(--dash-shadow)] lg:h-full"
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2
          id="dash-monthly-daily"
          className="flex items-center gap-1.5 text-sm font-bold text-[var(--dash-fg)]"
        >
          <CalendarRange aria-hidden className="size-4 text-[var(--dash-primary)]" />
          {t('summary.monthlyDailyTitle')}
        </h2>
        <PillSelect
          label={t('summary.monthlyDailyFilter')}
          value={scope}
          tone="panel"
          options={[
            { value: 'thisMonth' as const, label: t('period.thisMonth') },
            { value: 'today' as const, label: t('period.today') },
          ]}
          onChange={setScope}
        />
      </header>
      <div className="flex flex-col gap-[5px]">
        {scope === 'thisMonth' ? (
          <>
            {monthBlock}
            {dayBlock}
          </>
        ) : (
          <>
            {dayBlock}
            {monthBlock}
          </>
        )}
      </div>
    </section>
  );
}
