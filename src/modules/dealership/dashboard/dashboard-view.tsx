'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Bell, CalendarDays } from 'lucide-react';
import { useCan } from '@/core/auth/can';
import { usePendingCount } from '@/core/approvals/api';
import { businessToday } from '@/core/i18n/format';
import { useFormat } from '@/core/i18n/use-format';
import { CashFlowSnapshot } from './cash-flow-snapshot';
import { KeyInformation } from './key-information';
import { KpiSections } from './kpi-sections';
import { FinancialSummary } from './financial-summary';
import { MonthlyDailySummary } from './monthly-daily-summary';
import { useDashboardFinanceSummary } from './api';
import { monthPeriods } from './periods';

/** Stands in for a chart panel while its code (recharts) loads. */
function PanelSkeleton() {
  return (
    <div className="h-full min-h-[220px] animate-pulse rounded-card border border-[var(--dash-border)] bg-[var(--dash-surface)] lg:min-h-0" />
  );
}

// recharts is the heaviest part of this page. It loads after the first paint, so the KPI cards and
// summaries show without waiting for it (proposal §9.6).
const SalesCollectionChart = dynamic(
  () => import('./sales-collection-chart').then((m) => m.SalesCollectionChart),
  { ssr: false, loading: PanelSkeleton },
);
const CommissionPanel = dynamic(() => import('./commission-panel').then((m) => m.CommissionPanel), {
  ssr: false,
  loading: PanelSkeleton,
});

/**
 * The business dashboard, laid out as in the reference: a compact header, the
 * two KPI rows in one panel, then the charts beside Key Information, then the
 * financial panels. On laptop and desktop it fills the viewport (`100dvh` less
 * the topbar and page padding) and each row takes its share through `min-h-0`,
 * so the page itself never scrolls; a panel that runs out of room scrolls
 * inside itself rather than shrinking its text.
 */
export function DashboardView({ slug, businessId }: { slug: string; businessId: string }) {
  const t = useTranslations('dealership.dashboard');
  const format = useFormat();
  const today = businessToday();
  const month = monthPeriods(today, 'thisMonth').current;
  const canCommission = useCan('commission.view');
  const canCost = useCan('product.cost.view');
  const pending = usePendingCount(slug);
  const pendingCount = pending.data ?? 0;

  // One call feeds the header's month, Key Information and the Cash Flow
  // panel, so every one of them names the same customer due.
  const summary = useDashboardFinanceSummary(slug, businessId, month);
  const monthLabel = format.date(`${month.from}T00:00:00.000Z`, {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="dash-scope flex flex-col gap-[5px] lg:grid lg:h-[calc(100dvh-7rem)] lg:min-h-0 lg:grid-rows-[auto_auto_minmax(0,1fr)_minmax(0,1.05fr)]">
      <header className="flex min-w-0 items-center justify-end gap-3">
        <h1 className="sr-only">{t('title')}</h1>
        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden items-center gap-1.5 rounded-full border border-[var(--dash-border)] bg-[var(--dash-surface)] px-3 py-2 text-xs font-semibold text-[var(--dash-fg)] sm:inline-flex">
            <CalendarDays aria-hidden className="size-4 text-[var(--dash-primary)]" />
            {monthLabel}
          </span>
          <Link
            href={`/b/${encodeURIComponent(slug)}/approvals`}
            aria-label={t('notifications', { count: pendingCount })}
            className="relative inline-flex size-10 items-center justify-center rounded-full border border-[var(--dash-border)] bg-[var(--dash-surface)] text-[var(--dash-fg)] focus-visible:outline-2 focus-visible:outline-[var(--focus)]"
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
        </div>
      </header>

      <KpiSections slug={slug} businessId={businessId} today={today} />

      <div className="grid min-h-0 gap-[5px] lg:grid-cols-12 lg:overflow-hidden">
        <div
          className={`min-h-[220px] min-w-0 lg:min-h-0 ${canCommission ? 'lg:col-span-5' : 'lg:col-span-9'}`}
        >
          <SalesCollectionChart slug={slug} businessId={businessId} today={today} />
        </div>
        {canCommission && (
          <div className="min-h-[220px] min-w-0 lg:col-span-4 lg:min-h-0">
            <CommissionPanel slug={slug} businessId={businessId} today={today} />
          </div>
        )}
        <div className="min-h-[220px] min-w-0 lg:col-span-3 lg:min-h-0">
          <KeyInformation
            slug={slug}
            businessId={businessId}
            today={today}
            customerDue={summary.data?.customerDue}
            canSeeCommission={canCommission}
          />
        </div>
      </div>

      <div className="grid min-h-0 min-w-0 gap-[5px] lg:grid-cols-12 lg:overflow-hidden">
        <div className="min-w-0 lg:col-span-5">
          <FinancialSummary slug={slug} businessId={businessId} today={today} />
        </div>
        <div className="min-w-0 lg:col-span-4">
          <MonthlyDailySummary
            slug={slug}
            businessId={businessId}
            today={today}
            canSeePurchaseCost={canCost}
          />
        </div>
        <div className="min-w-0 lg:col-span-3">
          <CashFlowSnapshot
            slug={slug}
            businessId={businessId}
            range={month}
            customerDue={summary.data?.customerDue}
          />
        </div>
      </div>
    </div>
  );
}
