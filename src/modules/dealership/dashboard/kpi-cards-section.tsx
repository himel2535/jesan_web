'use client';

import { useMemo } from 'react';
import {
  CreditCard,
  Package,
  ShoppingCart,
  TrendingUp,
  Users,
  Wallet,
  Receipt,
  Boxes,
  Percent,
  ChartColumn,
  CheckCircle,
  Truck,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCan } from '@/core/auth/can';
import { businessToday } from '@/core/i18n/format';
import { useFormat } from '@/core/i18n/use-format';
import { KPICard } from '@/core/ui/kpi-card';
import { LoadError } from '../master-data/shared/states';
import { Money } from '../master-data/shared/display';
import { useDailySummary } from '../reports/api';
import { useAccountsDashboardRanges } from '../accounts/shared';
import { useAccountsSummaryRanges } from '../accounts/api';
import { useSalesSummaryRanges } from '../sales/shared';
import { useSalesSummaryAmounts, useOrderCounts, useDeliveryCounts } from '../sales/api';
import { usePurchaseSummaryRanges } from '../purchases/shared';
import { usePurchasesSummary } from '../purchases/api';
import { useExpenseSummaryRanges } from '../expenses/shared';
import { useExpensesSummary } from '../expenses/api';
import { useStock } from '../stock/api';
import type { StockRow } from '../stock/types';
import { useCommissionSummary } from '../commission/api';

export function KPICardsSection({ slug, businessId }: { slug: string; businessId: string }) {
  const t = useTranslations('dealership.dashboard');
  const format = useFormat();
  const canViewCashbook = useCan('cashbook.view');
  const canViewCommission = useCan('commission.view');
  const year = Number(businessToday().slice(0, 4));

  // Fetch all metrics
  const dailySummary = useDailySummary(slug, businessId);
  const salesRanges = useSalesSummaryRanges();
  const sales = useSalesSummaryAmounts(slug, businessId, salesRanges);
  const orders = useOrderCounts(slug, businessId, salesRanges);
  const deliveries = useDeliveryCounts(slug, businessId, salesRanges);

  const purchaseRanges = usePurchaseSummaryRanges();
  const purchases = usePurchasesSummary(slug, businessId, purchaseRanges);

  const accountsRanges = useAccountsDashboardRanges();
  const accounts = useAccountsSummaryRanges(slug, businessId, accountsRanges);

  const expenseRanges = useExpenseSummaryRanges();
  const expensesQuery = useExpensesSummary(slug, businessId, expenseRanges);
  const stockQuery = useStock(slug, businessId, { page: 1 });
  const commissionQuery = useCommissionSummary(slug, businessId, year);

  // Calculate total product (sum of all stock quantities) - must be before early returns
  const totalProduct = useMemo(() => {
    if (!stockQuery.data?.items) return 0;
    return stockQuery.data.items.reduce(
      (sum: number, item: StockRow) => sum + parseFloat(item.currentStock || '0'),
      0,
    );
  }, [stockQuery.data]);

  // Check loading states
  const isLoading =
    dailySummary.isPending ||
    sales.total.isPending ||
    orders.total.isPending ||
    deliveries.total.isPending ||
    purchases.total.isPending ||
    accounts.total.isPending ||
    expensesQuery.total.isPending ||
    stockQuery.isPending ||
    commissionQuery.isPending;

  const hasError =
    dailySummary.isError ||
    sales.total.isError ||
    orders.total.isError ||
    deliveries.total.isError ||
    purchases.total.isError ||
    accounts.total.isError ||
    expensesQuery.total.isError ||
    stockQuery.isError ||
    commissionQuery.isError;

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 20 }, (_, i) => (
          <div
            key={i}
            className="h-32 animate-pulse rounded-card border border-border bg-surface-muted"
          />
        ))}
      </div>
    );
  }

  if (hasError) {
    return (
      <LoadError
        error={dailySummary.error || sales.total.error}
        onRetry={() => {
          void dailySummary.refetch();
          void sales.total.refetch();
        }}
      />
    );
  }

  // Extract data
  const cashData = canViewCashbook ? dailySummary.data?.cash : null;
  const salesData = {
    total: sales.total.data?.totalAmount || '0',
    thisMonth: sales.thisMonth.data?.totalAmount || '0',
  };
  const ordersData = {
    total: orders.total.data?.total || 0,
    thisMonth: orders.thisMonth.data?.total || 0,
  };
  const deliveriesData = {
    total: deliveries.total.data?.total || 0,
    thisMonth: deliveries.thisMonth.data?.total || 0,
  };
  const purchasesData = {
    total: purchases.total.data?.totalAmount || '0',
    thisMonth: purchases.thisMonth.data?.totalAmount || '0',
  };
  const accountsData = {
    totalDue: accounts.total.data?.totalDue || '0',
    totalAdvance: accounts.total.data?.totalAdvance || '0',
  };

  const cards = [
    // Row 1: Cash & Accounts
    {
      id: 'cash-balance',
      icon: <CreditCard className="size-5" />,
      label: t('kpi.cashBalance'),
      value: cashData ? <Money value={cashData.openingBalance} /> : 'N/A',
      color: 'bg-blue-500 text-white',
      hidden: !cashData,
    },
    {
      id: 'closing-balance',
      icon: <Wallet className="size-5" />,
      label: t('kpi.closingBalance'),
      value: cashData ? <Money value={cashData.closingBalance} /> : 'N/A',
      color: 'bg-green-500 text-white',
      hidden: !cashData,
    },
    {
      id: 'net',
      icon: <ChartColumn className="size-5" />,
      label: t('kpi.net'),
      value: cashData ? <Money value={cashData.net} /> : 'N/A',
      color: 'bg-purple-500 text-white',
      hidden: !cashData,
    },
    {
      id: 'total-income',
      icon: <TrendingUp className="size-5" />,
      label: t('kpi.totalIncome'),
      value: dailySummary.data ? 'N/A' : 'N/A',
      color: 'bg-orange-500 text-white',
    },
    {
      id: 'total-expense',
      icon: <ShoppingCart className="size-5" />,
      label: t('kpi.totalExpense'),
      value: expensesQuery.total.data ? (
        <Money value={expensesQuery.total.data.totalAmount} />
      ) : (
        'N/A'
      ),
      color: 'bg-pink-500 text-white',
    },

    // Row 2: Payables & Receivables
    {
      id: 'total-due',
      icon: <Receipt className="size-5" />,
      label: t('kpi.totalDue'),
      value: <Money value={accountsData.totalDue} />,
      color: 'bg-cyan-500 text-white',
    },
    {
      id: 'total-advance',
      icon: <Percent className="size-5" />,
      label: t('kpi.totalAdvance'),
      value: <Money value={accountsData.totalAdvance} />,
      color: 'bg-indigo-500 text-white',
    },
    {
      id: 'total-sales',
      icon: <Boxes className="size-5" />,
      label: t('kpi.totalSales'),
      value: <Money value={salesData.total} />,
      color: 'bg-green-500 text-white',
    },
    {
      id: 'total-orders',
      icon: <Package className="size-5" />,
      label: t('kpi.totalOrders'),
      value: format.number(ordersData.total),
      color: 'bg-purple-500 text-white',
    },
    {
      id: 'total-deliveries',
      icon: <Truck className="size-5" />,
      label: t('kpi.totalDeliveries'),
      value: format.number(deliveriesData.total),
      color: 'bg-orange-500 text-white',
    },

    // Row 3: Inventory & Purchases
    {
      id: 'total-purchase',
      icon: <ShoppingCart className="size-5" />,
      label: t('kpi.totalPurchase'),
      value: <Money value={purchasesData.total} />,
      color: 'bg-green-500 text-white',
    },
    {
      id: 'total-customers',
      icon: <Users className="size-5" />,
      label: t('kpi.totalCustomers'),
      value: 'N/A',
      color: 'bg-purple-500 text-white',
    },
    {
      id: 'total-stock',
      icon: <Boxes className="size-5" />,
      label: t('kpi.totalStock'),
      value: stockQuery.data ? format.number(stockQuery.data.total) : 'N/A',
      color: 'bg-cyan-500 text-white',
    },
    {
      id: 'total-commission',
      icon: <Percent className="size-5" />,
      label: t('kpi.totalCommission'),
      value:
        canViewCommission && commissionQuery.data ? (
          <Money value={commissionQuery.data.totalCalculated} />
        ) : (
          'N/A'
        ),
      color: 'bg-blue-500 text-white',
      hidden: !canViewCommission,
    },
    {
      id: 'total-partial-expenses',
      icon: <ChartColumn className="size-5" />,
      label: t('kpi.totalPartialExpenses'),
      value: 'N/A',
      color: 'bg-green-500 text-white',
    },

    // Row 4: Monthly Metrics
    {
      id: 'this-month-collection',
      icon: <Wallet className="size-5" />,
      label: t('kpi.thisMonthCollection'),
      value: 'N/A',
      color: 'bg-purple-500 text-white',
    },
    {
      id: 'this-month-sales',
      icon: <TrendingUp className="size-5" />,
      label: t('kpi.thisMonthSales'),
      value: <Money value={salesData.thisMonth} />,
      color: 'bg-green-500 text-white',
    },
    {
      id: 'this-month-purchase',
      icon: <ShoppingCart className="size-5" />,
      label: t('kpi.thisMonthPurchase'),
      value: <Money value={purchasesData.thisMonth} />,
      color: 'bg-blue-500 text-white',
    },
    {
      id: 'this-month-commission',
      icon: <CheckCircle className="size-5" />,
      label: t('kpi.thisMonthCommission'),
      value:
        canViewCommission && commissionQuery.data ? (
          <Money value={commissionQuery.data.totalCalculated} />
        ) : (
          'N/A'
        ),
      color: 'bg-yellow-500 text-white',
      hidden: !canViewCommission,
    },
    {
      id: 'total-product',
      icon: <Package className="size-5" />,
      label: t('kpi.totalProduct'),
      value: format.number(totalProduct),
      color: 'bg-orange-500 text-white',
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards
        .filter((card) => !card.hidden)
        .map((card) => (
          <KPICard
            key={card.id}
            icon={card.icon}
            label={card.label}
            value={card.value}
            iconColor={card.color}
          />
        ))}
    </div>
  );
}
