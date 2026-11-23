'use client';

import { ReactNode, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  CheckCircle2,
  Clock,
  Landmark,
  Package,
  Percent,
  Receipt,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCan } from '@/core/auth/can';
import { ApiError } from '@/core/api/errors';
import { businessToday } from '@/core/i18n/format';
import { useFormat } from '@/core/i18n/use-format';
import { KPICard, type KPIVariant } from '@/core/ui/kpi-card';
import { LoadError } from '../master-data/shared/states';
import { Money } from '../master-data/shared/display';
import { useDailySummary, salesReportQuery, collectionsReportQuery } from '../reports/api';
import { useAccountsSummary, useAccountsSummaryRanges } from '../accounts/api';
import { useSalesSummaryAmounts } from '../sales/api';
import { usePurchaseSummaryRanges } from '../purchases/shared';
import { usePurchasesSummary } from '../purchases/api';
import { useCollectionsSummaryAmounts } from '../sales/api';
import { useExpensesSummary } from '../expenses/api';
import { useCommissionSummary } from '../commission/api';
import { useDashboardRanges, monthOverMonthChange } from './shared';

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

export function KPICardsSection({ slug, businessId }: { slug: string; businessId: string }) {
  const t = useTranslations('dealership.dashboard.kpi');
  const vsLastMonth = t('vsLastMonth');
  const format = useFormat();
  const canViewCashbook = useCan('cashbook.view');
  const canViewCommission = useCan('commission.view');
  const canViewPurchaseCost = useCan('product.cost.view');
  const year = Number(businessToday().slice(0, 4));

  const dashRanges = useDashboardRanges();
  const purchaseRanges = usePurchaseSummaryRanges();

  // ---- Cash (reports/daily-summary → cash) ----
  const dailySummary = useDailySummary(slug, businessId);
  const cash = canViewCashbook ? dailySummary.data?.cash : undefined;

  // ---- Accounts: Income / Expense / Net / Due / Advance ----
  const accounts = useAccountsSummaryRanges(slug, businessId, dashRanges);
  const accountsPreviousMonth = useAccountsSummary(slug, businessId, dashRanges.previousMonth);
  const accountsError = [accounts.total, accounts.today, accounts.thisMonth].find(
    (q) => q.error && !isForbidden(q.error),
  )?.error;
  const accountsForbidden = isForbidden(accounts.total.error);

  // ---- Sales ----
  const sales = useSalesSummaryAmounts(slug, businessId, dashRanges);
  const salesPreviousMonth = useQuery(
    salesReportQuery(slug, businessId, { groupBy: 'date', ...dashRanges.previousMonth, page: 1 }),
  );
  const salesError = [sales.total, sales.today, sales.thisMonth].find(
    (q) => q.error && !isForbidden(q.error),
  )?.error;
  const salesForbidden = isForbidden(sales.total.error);

  // ---- Purchases ----
  const purchases = usePurchasesSummary(slug, businessId, purchaseRanges);
  const purchasesError = [purchases.total, purchases.today, purchases.thisMonth].find(
    (q) => q.error && !isForbidden(q.error),
  )?.error;
  const purchasesForbidden = isForbidden(purchases.total.error);

  // ---- Collections ----
  const collections = useCollectionsSummaryAmounts(slug, businessId, dashRanges);
  const collectionsPreviousMonth = useQuery(
    collectionsReportQuery(slug, businessId, {
      groupBy: 'date',
      ...dashRanges.previousMonth,
      page: 1,
    }),
  );
  const collectionsError = [collections.total, collections.today, collections.thisMonth].find(
    (q) => q.error && !isForbidden(q.error),
  )?.error;
  const collectionsForbidden = isForbidden(collections.total.error);

  // ---- Partial expenses ----
  const expenses = useExpensesSummary(slug, businessId, dashRanges);
  const expensesError = [
    expenses.total,
    expenses.today,
    expenses.thisMonth,
    expenses.previousMonth,
  ].find((q) => q.error && !isForbidden(q.error))?.error;
  const expensesForbidden = isForbidden(expenses.total.error);

  // ---- Commission (owner-only; the permission itself is the gate) ----
  const commission = useCommissionSummary(slug, businessId, year);

  const incomeChange = useMemo(
    () =>
      accounts.thisMonth.data && accountsPreviousMonth.data
        ? monthOverMonthChange(accounts.thisMonth.data.totalIn, accountsPreviousMonth.data.totalIn)
        : null,
    [accounts.thisMonth.data, accountsPreviousMonth.data],
  );
  const expenseChange = useMemo(
    () =>
      accounts.thisMonth.data && accountsPreviousMonth.data
        ? monthOverMonthChange(
            accounts.thisMonth.data.totalOut,
            accountsPreviousMonth.data.totalOut,
          )
        : null,
    [accounts.thisMonth.data, accountsPreviousMonth.data],
  );
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
  const expensePartialChange = useMemo(
    () =>
      expenses.thisMonth.data && expenses.previousMonth.data
        ? monthOverMonthChange(
            expenses.thisMonth.data.totalAmount,
            expenses.previousMonth.data.totalAmount,
          )
        : null,
    [expenses.thisMonth.data, expenses.previousMonth.data],
  );

  const changeOf = (value: number | null): { value: number; label: string } | undefined =>
    value === null ? undefined : { value, label: vsLastMonth };

  const cashCards: CardSpec[] = cash
    ? [
        {
          id: 'cash-opening',
          variant: 'blue',
          icon: <Wallet aria-hidden className="size-5" />,
          label: t('openingBalance'),
          value: <Money value={cash.openingBalance} />,
          loading: dailySummary.isPending,
        },
        {
          id: 'cash-closing',
          variant: 'green',
          icon: <Landmark aria-hidden className="size-5" />,
          label: t('closingBalance'),
          value: <Money value={cash.closingBalance} />,
          loading: dailySummary.isPending,
        },
        {
          id: 'cash-net',
          variant: 'purple',
          icon: <Activity aria-hidden className="size-5" />,
          label: t('netCash'),
          value: <Money value={cash.net} />,
          loading: dailySummary.isPending,
        },
      ]
    : [];

  const accountsPending =
    accounts.total.isPending || accounts.today.isPending || accounts.thisMonth.isPending;
  const accountsCards: CardSpec[] = accountsForbidden
    ? []
    : [
        {
          id: 'income-total',
          variant: 'green',
          icon: <TrendingUp aria-hidden className="size-5" />,
          label: t('totalIncome'),
          value: accounts.total.data ? <Money value={accounts.total.data.totalIn} /> : '',
          change: changeOf(incomeChange),
          loading: accountsPending || !accounts.total.data,
        },
        {
          id: 'income-today',
          variant: 'green',
          icon: <TrendingUp aria-hidden className="size-5" />,
          label: t('todayIncome'),
          value: accounts.today.data ? <Money value={accounts.today.data.totalIn} /> : '',
          loading: accountsPending || !accounts.today.data,
        },
        {
          id: 'income-month',
          variant: 'green',
          icon: <TrendingUp aria-hidden className="size-5" />,
          label: t('thisMonthIncome'),
          value: accounts.thisMonth.data ? <Money value={accounts.thisMonth.data.totalIn} /> : '',
          loading: accountsPending || !accounts.thisMonth.data,
        },
        {
          id: 'expense-total',
          variant: 'pink',
          icon: <TrendingDown aria-hidden className="size-5" />,
          label: t('totalExpense'),
          value: accounts.total.data ? <Money value={accounts.total.data.totalOut} /> : '',
          change: changeOf(expenseChange),
          loading: accountsPending || !accounts.total.data,
        },
        {
          id: 'expense-today',
          variant: 'pink',
          icon: <TrendingDown aria-hidden className="size-5" />,
          label: t('todayExpense'),
          value: accounts.today.data ? <Money value={accounts.today.data.totalOut} /> : '',
          loading: accountsPending || !accounts.today.data,
        },
        {
          id: 'expense-month',
          variant: 'pink',
          icon: <TrendingDown aria-hidden className="size-5" />,
          label: t('thisMonthExpense'),
          value: accounts.thisMonth.data ? <Money value={accounts.thisMonth.data.totalOut} /> : '',
          loading: accountsPending || !accounts.thisMonth.data,
        },
        {
          id: 'net-total',
          variant: 'purple',
          icon: <Activity aria-hidden className="size-5" />,
          label: t('totalNet'),
          value: accounts.total.data ? <Money value={accounts.total.data.net} /> : '',
          change: changeOf(netChange),
          loading: accountsPending || !accounts.total.data,
        },
        {
          id: 'net-today',
          variant: 'purple',
          icon: <Activity aria-hidden className="size-5" />,
          label: t('todayNet'),
          value: accounts.today.data ? <Money value={accounts.today.data.net} /> : '',
          loading: accountsPending || !accounts.today.data,
        },
        {
          id: 'net-month',
          variant: 'purple',
          icon: <Activity aria-hidden className="size-5" />,
          label: t('thisMonthNet'),
          value: accounts.thisMonth.data ? <Money value={accounts.thisMonth.data.net} /> : '',
          loading: accountsPending || !accounts.thisMonth.data,
        },
        {
          id: 'due-total',
          variant: 'orange',
          icon: <Receipt aria-hidden className="size-5" />,
          label: t('totalDue'),
          value: accounts.total.data ? <Money value={accounts.total.data.totalDue} /> : '',
          loading: accountsPending || !accounts.total.data,
        },
        {
          id: 'advance-total',
          variant: 'aqua',
          icon: <Percent aria-hidden className="size-5" />,
          label: t('totalAdvance'),
          value: accounts.total.data ? <Money value={accounts.total.data.totalAdvance} /> : '',
          loading: accountsPending || !accounts.total.data,
        },
      ];

  const salesPending = sales.total.isPending || sales.today.isPending || sales.thisMonth.isPending;
  const salesCards: CardSpec[] = salesForbidden
    ? []
    : [
        {
          id: 'sales-today',
          variant: 'blue',
          icon: <ShoppingCart aria-hidden className="size-5" />,
          label: t('todaySales'),
          value: sales.today.data ? <Money value={sales.today.data.totalAmount} /> : '',
          loading: salesPending || !sales.today.data,
        },
        {
          id: 'sales-month',
          variant: 'blue',
          icon: <ShoppingCart aria-hidden className="size-5" />,
          label: t('thisMonthSales'),
          value: sales.thisMonth.data ? <Money value={sales.thisMonth.data.totalAmount} /> : '',
          loading: salesPending || !sales.thisMonth.data,
        },
        {
          id: 'sales-total',
          variant: 'green',
          icon: <ShoppingCart aria-hidden className="size-5" />,
          label: t('totalSales'),
          value: sales.total.data ? <Money value={sales.total.data.totalAmount} /> : '',
          change: changeOf(salesChange),
          loading: salesPending || !sales.total.data,
        },
      ];

  const purchasesPending =
    purchases.total.isPending || purchases.today.isPending || purchases.thisMonth.isPending;
  const purchasesCards: CardSpec[] = purchasesForbidden
    ? []
    : [
        {
          id: 'purchase-quantity',
          variant: 'aqua',
          icon: <Package aria-hidden className="size-5" />,
          label: t('totalQuantity'),
          value: purchases.total.data ? format.quantity(purchases.total.data.totalQuantity) : '',
          loading: purchasesPending || !purchases.total.data,
        },
        ...(canViewPurchaseCost
          ? ([
              {
                id: 'purchase-total',
                variant: 'orange',
                icon: <ShoppingCart aria-hidden className="size-5" />,
                label: t('totalPurchase'),
                value: purchases.total.data?.totalAmount ? (
                  <Money value={purchases.total.data.totalAmount} />
                ) : (
                  ''
                ),
                loading: purchasesPending || !purchases.total.data,
              },
              {
                id: 'purchase-today',
                variant: 'orange',
                icon: <ShoppingCart aria-hidden className="size-5" />,
                label: t('todayPurchase'),
                value: purchases.today.data?.totalAmount ? (
                  <Money value={purchases.today.data.totalAmount} />
                ) : (
                  ''
                ),
                loading: purchasesPending || !purchases.today.data,
              },
              {
                id: 'purchase-month',
                variant: 'orange',
                icon: <ShoppingCart aria-hidden className="size-5" />,
                label: t('thisMonthPurchase'),
                value: purchases.thisMonth.data?.totalAmount ? (
                  <Money value={purchases.thisMonth.data.totalAmount} />
                ) : (
                  ''
                ),
                loading: purchasesPending || !purchases.thisMonth.data,
              },
              {
                id: 'purchase-year',
                variant: 'orange',
                icon: <ShoppingCart aria-hidden className="size-5" />,
                label: t('thisYearPurchase'),
                value: purchases.thisYear.data?.totalAmount ? (
                  <Money value={purchases.thisYear.data.totalAmount} />
                ) : (
                  ''
                ),
                loading: purchases.thisYear.isPending || !purchases.thisYear.data,
              },
            ] satisfies CardSpec[])
          : []),
      ];

  const collectionsPending =
    collections.total.isPending || collections.today.isPending || collections.thisMonth.isPending;
  const collectionsCards: CardSpec[] = collectionsForbidden
    ? []
    : [
        {
          id: 'collection-total',
          variant: 'purple',
          icon: <Wallet aria-hidden className="size-5" />,
          label: t('totalCollection'),
          value: collections.total.data ? <Money value={collections.total.data.totalAmount} /> : '',
          change: changeOf(collectionsChange),
          loading: collectionsPending || !collections.total.data,
        },
        {
          id: 'collection-today',
          variant: 'purple',
          icon: <Wallet aria-hidden className="size-5" />,
          label: t('todayCollection'),
          value: collections.today.data ? <Money value={collections.today.data.totalAmount} /> : '',
          loading: collectionsPending || !collections.today.data,
        },
        {
          id: 'collection-month',
          variant: 'purple',
          icon: <Wallet aria-hidden className="size-5" />,
          label: t('thisMonthCollection'),
          value: collections.thisMonth.data ? (
            <Money value={collections.thisMonth.data.totalAmount} />
          ) : (
            ''
          ),
          loading: collectionsPending || !collections.thisMonth.data,
        },
      ];

  const expensesPending =
    expenses.total.isPending || expenses.today.isPending || expenses.thisMonth.isPending;
  const expensesCards: CardSpec[] = expensesForbidden
    ? []
    : [
        {
          id: 'partial-expense-total',
          variant: 'pink',
          icon: <Receipt aria-hidden className="size-5" />,
          label: t('totalPartialExpenses'),
          value: expenses.total.data ? <Money value={expenses.total.data.totalAmount} /> : '',
          change: changeOf(expensePartialChange),
          loading: expensesPending || !expenses.total.data,
        },
        {
          id: 'partial-expense-today',
          variant: 'pink',
          icon: <Receipt aria-hidden className="size-5" />,
          label: t('todayPartialExpenses'),
          value: expenses.today.data ? <Money value={expenses.today.data.totalAmount} /> : '',
          loading: expensesPending || !expenses.today.data,
        },
        {
          id: 'partial-expense-month',
          variant: 'pink',
          icon: <Receipt aria-hidden className="size-5" />,
          label: t('thisMonthPartialExpenses'),
          value: expenses.thisMonth.data ? (
            <Money value={expenses.thisMonth.data.totalAmount} />
          ) : (
            ''
          ),
          loading: expensesPending || !expenses.thisMonth.data,
        },
        {
          id: 'partial-expense-previous',
          variant: 'pink',
          icon: <Receipt aria-hidden className="size-5" />,
          label: t('previousMonthPartialExpenses'),
          value: expenses.previousMonth.data ? (
            <Money value={expenses.previousMonth.data.totalAmount} />
          ) : (
            ''
          ),
          loading: expenses.previousMonth.isPending || !expenses.previousMonth.data,
        },
      ];

  const commissionCards: CardSpec[] = !canViewCommission
    ? []
    : [
        {
          id: 'commission-calculated',
          variant: 'blue',
          icon: <Percent aria-hidden className="size-5" />,
          label: t('commissionCalculated'),
          value: commission.data ? <Money value={commission.data.totalCalculated} /> : '',
          loading: commission.isPending || !commission.data,
        },
        {
          id: 'commission-received',
          variant: 'green',
          icon: <CheckCircle2 aria-hidden className="size-5" />,
          label: t('commissionReceived'),
          value: commission.data ? <Money value={commission.data.totalReceived} /> : '',
          loading: commission.isPending || !commission.data,
        },
        {
          id: 'commission-pending',
          variant: 'orange',
          icon: <Clock aria-hidden className="size-5" />,
          label: t('commissionPending'),
          value: commission.data ? <Money value={commission.data.totalPending} /> : '',
          loading: commission.isPending || !commission.data,
        },
      ];

  const allCards = [
    ...cashCards,
    ...accountsCards,
    ...salesCards,
    ...purchasesCards,
    ...collectionsCards,
    ...expensesCards,
    ...commissionCards,
  ];

  const groupErrors: { key: string; error: unknown; retry: () => void }[] = [];
  if (accountsError) {
    groupErrors.push({
      key: 'accounts',
      error: accountsError,
      retry: () => {
        void accounts.total.refetch();
        void accounts.today.refetch();
        void accounts.thisMonth.refetch();
      },
    });
  }
  if (salesError) {
    groupErrors.push({
      key: 'sales',
      error: salesError,
      retry: () => {
        void sales.total.refetch();
        void sales.today.refetch();
        void sales.thisMonth.refetch();
      },
    });
  }
  if (purchasesError) {
    groupErrors.push({
      key: 'purchases',
      error: purchasesError,
      retry: () => {
        void purchases.total.refetch();
        void purchases.today.refetch();
        void purchases.thisMonth.refetch();
      },
    });
  }
  if (collectionsError) {
    groupErrors.push({
      key: 'collections',
      error: collectionsError,
      retry: () => {
        void collections.total.refetch();
        void collections.today.refetch();
        void collections.thisMonth.refetch();
      },
    });
  }
  if (expensesError) {
    groupErrors.push({
      key: 'expenses',
      error: expensesError,
      retry: () => {
        void expenses.total.refetch();
        void expenses.today.refetch();
        void expenses.thisMonth.refetch();
      },
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

  return (
    <div className="space-y-4">
      {groupErrors.map(({ key, error, retry }) => (
        <LoadError key={key} error={error} onRetry={retry} />
      ))}
      <Grid cards={allCards} />
    </div>
  );
}
