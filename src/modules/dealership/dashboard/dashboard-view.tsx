'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Bell } from 'lucide-react';
import { useCan } from '@/core/auth/can';
import { useSession } from '@/core/auth/session-context';
import { usePendingCount } from '@/core/approvals/api';
import { businessToday } from '@/core/i18n/format';
import { useFormat } from '@/core/i18n/use-format';
import { CashbookPanel } from './cashbook-panel';
import { CommissionPanel } from './commission-panel';
import { DailyKpiSection, MonthlyKpiSection } from './kpi-sections';
import { FinancialSummary } from './financial-summary';
import { MonthlyDailySummary } from './monthly-daily-summary';
import { SalesCollectionChart } from './sales-collection-chart';
import { monthPeriods } from './periods';

/**
 * The business dashboard, laid out as in the reference: header, This Month and Today KPI rows,
 * then the charts and the financial panels. On laptop-and-up screens it fills the viewport
 * (`100dvh` minus the topbar and page padding) and each row takes its share through `min-h-0`,
 * so nothing scrolls. Every number comes from the backend; this file only arranges them.
 */
export function DashboardView({ slug, businessId }: { slug: string; businessId: string }) {
  const t = useTranslations('dealership.dashboard');
  const format = useFormat();
  const session = useSession();
  const today = businessToday();
  const canCommission = useCan('commission.view');
  const canCashbook = useCan('cashbook.view');
  const canCost = useCan('product.cost.view');
  const pending = usePendingCount(slug);
  const monthLabel = format.date(monthPeriods(today, 'thisMonth').current.from, {
    month: 'long',
    year: 'numeric',
  });
  const pendingCount = pending.data ?? 0;

  return (
    <div className="dash-scope flex flex-col gap-[5px] lg:grid lg:h-[calc(100dvh-7rem)] lg:min-h-0 lg:grid-rows-[auto_auto_auto_minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <header className="flex min-w-0 items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold text-[var(--dash-fg)]">
            {t('welcome', { name: session.user.name })}
          </h1>
          <p className="max-h-[760px]:hidden truncate text-xs text-[var(--dash-fg-muted)]">
            {t('subtitle', { month: monthLabel })}
          </p>
        </div>
        <Link
          href={`/b/${encodeURIComponent(slug)}/approvals`}
          aria-label={t('notifications', { count: pendingCount })}
          className="relative inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-[var(--dash-border)] bg-[var(--dash-surface)] text-[var(--dash-fg)] focus-visible:outline-2 focus-visible:outline-[var(--focus)]"
        >
          <Bell aria-hidden className="size-5" />
          {pendingCount > 0 && (
            <span
              aria-hidden
              className="absolute -top-0.5 -right-0.5 min-w-5 rounded-full bg-[var(--dash-danger)] px-1 text-center text-[10px] leading-5 font-semibold text-white"
            >
              {format.number(pendingCount)}
            </span>
          )}
        </Link>
      </header>

      <MonthlyKpiSection slug={slug} businessId={businessId} today={today} />
      <DailyKpiSection slug={slug} businessId={businessId} today={today} />

      <div className="grid min-h-0 gap-[5px] lg:grid-cols-12 lg:overflow-hidden">
        <div className="min-h-[240px] min-w-0 lg:col-span-6 lg:min-h-0">
          <SalesCollectionChart slug={slug} businessId={businessId} today={today} />
        </div>
        {canCommission && (
          <div className="min-h-[240px] min-w-0 lg:col-span-4 lg:min-h-0">
            <CommissionPanel slug={slug} businessId={businessId} today={today} />
          </div>
        )}
        {canCashbook && (
          <div className="min-h-[240px] min-w-0 lg:col-span-2 lg:min-h-0">
            <CashbookPanel
              slug={slug}
              businessId={businessId}
              range={monthPeriods(today, 'thisMonth').current}
            />
          </div>
        )}
      </div>

      <div className="grid min-h-0 min-w-0 gap-[5px] lg:grid-cols-2 lg:overflow-hidden">
        <FinancialSummary slug={slug} businessId={businessId} today={today} />
        <MonthlyDailySummary
          slug={slug}
          businessId={businessId}
          today={today}
          canSeePurchaseCost={canCost}
        />
      </div>
    </div>
  );
}
