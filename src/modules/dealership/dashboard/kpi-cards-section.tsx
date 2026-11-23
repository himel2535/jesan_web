'use client';

import { ReactNode, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Award, Banknote, Receipt, ShoppingCart, Target, TrendingUp, Wallet } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCan } from '@/core/auth/can';
import { ApiError } from '@/core/api/errors';
import { businessToday } from '@/core/i18n/format';
import { KPICard, type KPIVariant } from '@/core/ui/kpi-card';
import { LoadError } from '../master-data/shared/states';
import { Money } from '../master-data/shared/display';
import { useDailySummary, salesReportQuery, collectionsReportQuery } from '../reports/api';
import { useAccountsSummary, useAccountsSummaryRanges } from '../accounts/api';
import { useSalesSummaryAmounts } from '../sales/api';
import { purchaseTotalsQuery } from '../purchases/api';
import { useCollectionsSummaryAmounts } from '../sales/api';
import { useCommissionScheme, useCommissionSummary, usePurchaseCounters } from '../commission/api';
import {
  achievedQtyForMonth,
  commissionProgress,
  useDashboardRanges,
  monthOverMonthChange,
} from './shared';

function isForbidden(error: unknown): boolean {
  return error instanceof ApiError && error.status === 403;
}

interface CardSpec {
  id: string;
  variant: KPIVariant;
  icon: ReactNode;
  label: string;
  value: ReactNode;
  change?: { value: number; label: string };
  loading: boolean;
}

function Grid({ cards }: { cards: CardSpec[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <KPICard
          key={card.id}
          variant={card.variant}
          icon={card.icon}
          label={card.label}
          value={card.loading ? '' : card.value}
          change={card.loading ? undefined : card.change}
          loading={card.loading}
        />
      ))}
    </div>
  );
}

/**
 * The 8 KPI cards shown on the business dashboard (reference design): Total Sales, Total
 * Purchase, Total Collection, Customer Due, Cash & Bank, Commission, Net Profit, Commission
 * Target Progress. "Net Profit" is the Accounts module's cash-basis `net` (income − expense)
 * relabeled — there is no cost-based profit endpoint yet (see DECISIONS.md). "Commission Target
 * Progress" is purchase-based (bags bought from Akij), not a sales target — the backend has no
 * sales-target concept; it reuses the commission scheme's bonus threshold instead (see
 * DECISIONS.md "Commission Target Progress").
 */
export function KPICardsSection({ slug, businessId }: { slug: string; businessId: string }) {
  const t = useTranslations('dealership.dashboard.kpi');
  const vsLastMonth = t('vsLastMonth');
  const canViewCashbook = useCan('cashbook.view');
  const canViewCommission = useCan('commission.view');
  const canViewPurchaseCost = useCan('product.cost.view');
  const year = Number(businessToday().slice(0, 4));

  const dashRanges = useDashboardRanges();

  // ---- Cash & Bank (reports/daily-summary → cash.closingBalance) ----
  const dailySummary = useDailySummary(slug, businessId);
  const cash = canViewCashbook ? dailySummary.data?.cash : undefined;

  // ---- Accounts: Customer Due, Net Profit ----
  const accounts = useAccountsSummaryRanges(slug, businessId, dashRanges);
  const accountsPreviousMonth = useAccountsSummary(slug, businessId, dashRanges.previousMonth);
  const accountsError =
    accounts.total.error && !isForbidden(accounts.total.error) ? accounts.total.error : undefined;
  const accountsForbidden = isForbidden(accounts.total.error);

  // ---- Sales ----
  const sales = useSalesSummaryAmounts(slug, businessId, dashRanges);
  const salesPreviousMonth = useQuery(
    salesReportQuery(slug, businessId, { groupBy: 'date', ...dashRanges.previousMonth, page: 1 }),
  );
  const salesError =
    sales.total.error && !isForbidden(sales.total.error) ? sales.total.error : undefined;
  const salesForbidden = isForbidden(sales.total.error);

  // ---- Purchases (total only; canViewPurchaseCost gates the amount entirely) ----
  const purchasesTotal = useQuery({
    ...purchaseTotalsQuery(slug, businessId, dashRanges.total),
    enabled: canViewPurchaseCost,
  });
  const purchasesError =
    purchasesTotal.error && !isForbidden(purchasesTotal.error) ? purchasesTotal.error : undefined;
  const purchasesForbidden = isForbidden(purchasesTotal.error);

  // ---- Collections ----
  const collections = useCollectionsSummaryAmounts(slug, businessId, dashRanges);
  const collectionsPreviousMonth = useQuery(
    collectionsReportQuery(slug, businessId, {
      groupBy: 'date',
      ...dashRanges.previousMonth,
      page: 1,
    }),
  );
  const collectionsError =
    collections.total.error && !isForbidden(collections.total.error)
      ? collections.total.error
      : undefined;
  const collectionsForbidden = isForbidden(collections.total.error);

  // ---- Commission (owner-only; the permission itself is the gate) ----
  const commission = useCommissionSummary(slug, businessId, year);

  // ---- Commission Target Progress (owner-only; purchase-based, see shared.tsx) ----
  const commissionScheme = useCommissionScheme(slug, businessId);
  const purchaseCounters = usePurchaseCounters(slug, businessId, year, canViewCommission);
  const currentMonth = businessToday().slice(0, 7);
  const achievedQty = achievedQtyForMonth(purchaseCounters.data?.months, currentMonth);
  const targetProgress = commissionProgress(commissionScheme.data, achievedQty);

  const netChange = useMemo(
    () =>
      accounts.thisMonth.data && accountsPreviousMonth.data
        ? monthOverMonthChange(accounts.thisMonth.data.net, accountsPreviousMonth.data.net)
        : null,
    [accounts.thisMonth.data, accountsPreviousMonth.data],
  );
  const salesChange = useMemo(
    () =>
      sales.thisMonth.data && salesPreviousMonth.data
        ? monthOverMonthChange(
            sales.thisMonth.data.totalAmount,
            salesPreviousMonth.data.totalAmount,
          )
        : null,
    [sales.thisMonth.data, salesPreviousMonth.data],
  );
  const collectionsChange = useMemo(
    () =>
      collections.thisMonth.data && collectionsPreviousMonth.data
        ? monthOverMonthChange(
            collections.thisMonth.data.totalAmount,
            collectionsPreviousMonth.data.totalAmount,
          )
        : null,
    [collections.thisMonth.data, collectionsPreviousMonth.data],
  );

  const changeOf = (value: number | null): { value: number; label: string } | undefined =>
    value === null ? undefined : { value, label: vsLastMonth };

  const salesPending = sales.total.isPending;
  const purchasesPending = purchasesTotal.isPending;
  const collectionsPending = collections.total.isPending;
  const accountsPending = accounts.total.isPending;
  const cashPending = dailySummary.isPending;
  const commissionPending = commission.isPending;

  const allCards: CardSpec[] = [
    ...(salesForbidden
      ? []
      : [
          {
            id: 'total-sales',
            variant: 'blue' as KPIVariant,
            icon: <ShoppingCart aria-hidden className="size-5" />,
            label: t('totalSales'),
            value: sales.total.data ? <Money value={sales.total.data.totalAmount} /> : '',
            change: changeOf(salesChange),
            loading: salesPending || !sales.total.data,
          },
        ]),
    ...(!canViewPurchaseCost || purchasesForbidden
      ? []
      : [
          {
            id: 'total-purchase',
            variant: 'green' as KPIVariant,
            icon: <Receipt aria-hidden className="size-5" />,
            label: t('totalPurchase'),
            value: purchasesTotal.data?.totalAmount ? (
              <Money value={purchasesTotal.data.totalAmount} />
            ) : (
              ''
            ),
            loading: purchasesPending || !purchasesTotal.data,
          },
        ]),
    ...(collectionsForbidden
      ? []
      : [
          {
            id: 'total-collection',
            variant: 'purple' as KPIVariant,
            icon: <Wallet aria-hidden className="size-5" />,
            label: t('totalCollection'),
            value: collections.total.data ? (
              <Money value={collections.total.data.totalAmount} />
            ) : (
              ''
            ),
            change: changeOf(collectionsChange),
            loading: collectionsPending || !collections.total.data,
          },
        ]),
    ...(accountsForbidden
      ? []
      : [
          {
            id: 'customer-due',
            variant: 'orange' as KPIVariant,
            icon: <Banknote aria-hidden className="size-5" />,
            label: t('customerDue'),
            value: accounts.total.data ? <Money value={accounts.total.data.totalDue} /> : '',
            loading: accountsPending || !accounts.total.data,
          },
        ]),
    ...(!canViewCashbook || !cash
      ? []
      : [
          {
            id: 'cash-and-bank',
            variant: 'pink' as KPIVariant,
            icon: <Wallet aria-hidden className="size-5" />,
            label: t('cashAndBank'),
            value: <Money value={cash.closingBalance} />,
            loading: cashPending,
          },
        ]),
    ...(!canViewCommission
      ? []
      : [
          {
            id: 'commission',
            variant: 'aqua' as KPIVariant,
            icon: <Award aria-hidden className="size-5" />,
            label: t('commission'),
            value: commission.data ? <Money value={commission.data.totalCalculated} /> : '',
            loading: commissionPending || !commission.data,
          },
        ]),
    ...(accountsForbidden
      ? []
      : [
          {
            id: 'net-profit',
            variant: 'green' as KPIVariant,
            icon: <TrendingUp aria-hidden className="size-5" />,
            label: t('netProfit'),
            value: accounts.total.data ? <Money value={accounts.total.data.net} /> : '',
            change: changeOf(netChange),
            loading: accountsPending || !accounts.total.data,
          },
        ]),
    ...(!canViewCommission
      ? []
      : [
          {
            id: 'commission-target',
            variant: 'indigo' as KPIVariant,
            icon: <Target aria-hidden className="size-5" />,
            label: t('commissionTarget'),
            value:
              commissionScheme.data === undefined
                ? ''
                : !targetProgress
                  ? t('notConfigured')
                  : `${targetProgress.achievementPct.toFixed(0)}%`,
            loading: commissionScheme.isPending || purchaseCounters.isPending,
          },
        ]),
  ];

  const groupErrors: { key: string; error: unknown; retry: () => void }[] = [];
  if (accountsError) {
    groupErrors.push({
      key: 'accounts',
      error: accountsError,
      retry: () => void accounts.total.refetch(),
    });
  }
  if (salesError) {
    groupErrors.push({ key: 'sales', error: salesError, retry: () => void sales.total.refetch() });
  }
  if (purchasesError) {
    groupErrors.push({
      key: 'purchases',
      error: purchasesError,
      retry: () => void purchasesTotal.refetch(),
    });
  }
  if (collectionsError) {
    groupErrors.push({
      key: 'collections',
      error: collectionsError,
      retry: () => void collections.total.refetch(),
    });
  }
  if (dailySummary.isError && !isForbidden(dailySummary.error)) {
    groupErrors.push({
      key: 'cash',
      error: dailySummary.error,
      retry: () => void dailySummary.refetch(),
    });
  }
  if (commission.isError && canViewCommission && !isForbidden(commission.error)) {
    groupErrors.push({
      key: 'commission',
      error: commission.error,
      retry: () => void commission.refetch(),
    });
  }
  if (
    canViewCommission &&
    ((commissionScheme.isError && !isForbidden(commissionScheme.error)) ||
      (purchaseCounters.isError && !isForbidden(purchaseCounters.error)))
  ) {
    groupErrors.push({
      key: 'commission-target',
      error: commissionScheme.error ?? purchaseCounters.error,
      retry: () => {
        void commissionScheme.refetch();
        void purchaseCounters.refetch();
      },
    });
  }

  return (
    <div className="space-y-4">
      {groupErrors.map(({ key, error, retry }) => (
        <LoadError key={key} error={error} onRetry={retry} />
      ))}
      <Grid cards={allCards} />
    </div>
  );
}
