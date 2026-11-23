'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useCan } from '@/core/auth/can';
import { ApiError } from '@/core/api/errors';
import { useFormat } from '@/core/i18n/use-format';
import { useAccountsLedger } from '../accounts/api';
import type { LedgerEntryType } from '../accounts/types';
import { Money, useNameOf } from '../master-data/shared/display';
import { LoadError } from '../master-data/shared/states';
import { useOrders } from '../sales/api';
import type { OrderDeliveryStatus } from '../sales/types';

function isForbidden(error: unknown): boolean {
  return error instanceof ApiError && error.status === 403;
}

interface RecentTransactionRow {
  type: LedgerEntryType | 'sale';
  reference: string;
  party: string;
  date: string;
  amount: string | undefined;
  status?: OrderDeliveryStatus;
}

/**
 * Best-effort client merge of `accounts/ledger` (collections/purchases/expenses/…) and `orders`
 * (sales) — there is no single backend "recent transactions" feed (see DECISIONS.md). Only page 1
 * of each source is read, so the true latest 5 could in rare cases span beyond that; acceptable
 * for a "recent activity" glance panel, not an audit-grade ledger.
 */
export function RecentTransactions({ slug, businessId }: { slug: string; businessId: string }) {
  const t = useTranslations('dealership.dashboard.recentTransactions');
  const tLedgerType = useTranslations('dealership.accounts.ledger.types');
  const tDeliveryStatus = useTranslations('dealership.sales.deliveryStatus');
  const format = useFormat();
  const nameOf = useNameOf();
  const canViewSales = useCan({ anyOf: ['sale.view.all', 'sale.view.own'] });
  const canViewLedger = useCan('ledger.view');

  const ledger = useAccountsLedger(slug, businessId, { page: 1 }, canViewLedger);
  const orders = useOrders(slug, businessId, { page: 1 }, canViewSales);

  const ledgerForbidden = !canViewLedger || isForbidden(ledger.error);
  const ordersForbidden = !canViewSales || isForbidden(orders.error);

  const ledgerError = ledger.error && !ledgerForbidden ? ledger.error : undefined;
  const ordersError = orders.error && !ordersForbidden ? orders.error : undefined;
  const error = ledgerError ?? ordersError;
  const isPending =
    (!ledgerForbidden && ledger.isPending) || (!ordersForbidden && orders.isPending);

  const rows = useMemo<RecentTransactionRow[]>(() => {
    const ledgerRows: RecentTransactionRow[] = ledgerForbidden
      ? []
      : (ledger.data?.items ?? [])
          .filter((item) => item.status === 'active')
          .map((item) => ({
            type: item.type,
            reference: item.referenceId ?? item.id,
            party: item.note ?? '—',
            date: item.entryDate,
            amount: item.amount,
          }));

    const orderRows: RecentTransactionRow[] = ordersForbidden
      ? []
      : (orders.data?.items ?? [])
          .filter((item) => item.status === 'active')
          .map((item) => ({
            type: 'sale' as const,
            reference: item.code,
            party: nameOf(item.customer),
            date: item.orderDate,
            amount: item.totalAmount,
            status: item.deliveryStatus,
          }));

    return [...ledgerRows, ...orderRows].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  }, [ledger.data, ledgerForbidden, orders.data, ordersForbidden, nameOf]);

  if (ledgerForbidden && ordersForbidden) return null;

  return (
    <div className="flex h-full flex-col rounded-card border border-[var(--dash-border)] bg-[var(--dash-surface)] p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-[var(--dash-fg)]">{t('title')}</h2>
        <Link
          href={`/b/${encodeURIComponent(slug)}/sales`}
          prefetch={false}
          className="text-sm font-medium text-[var(--dash-primary)] underline-offset-2 hover:underline"
        >
          {t('viewAll')}
        </Link>
      </div>

      {error ? (
        <LoadError
          error={error}
          onRetry={() => {
            void ledger.refetch();
            void orders.refetch();
          }}
        />
      ) : isPending ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="h-8 animate-pulse rounded bg-[var(--dash-bg)]" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-[var(--dash-fg-muted)]">{t('empty')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--dash-border)] text-left text-xs text-[var(--dash-fg-muted)]">
                <th className="pb-2 font-medium">{t('type')}</th>
                <th className="pb-2 font-medium">{t('reference')}</th>
                <th className="pb-2 font-medium">{t('party')}</th>
                <th className="pb-2 font-medium">{t('date')}</th>
                <th className="pb-2 text-right font-medium">{t('amount')}</th>
                <th className="pb-2 text-right font-medium">{t('status')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr
                  key={`${row.type}-${row.reference}-${index}`}
                  className="border-b border-[var(--dash-border)] last:border-0"
                >
                  <td className="py-2.5 text-[var(--dash-fg)]">
                    {row.type === 'sale' ? t('saleType') : tLedgerType(row.type)}
                  </td>
                  <td className="py-2.5 font-medium text-[var(--dash-fg)]">{row.reference}</td>
                  <td className="py-2.5 text-[var(--dash-fg-muted)]">{row.party}</td>
                  <td className="py-2.5 text-[var(--dash-fg-muted)]">{format.date(row.date)}</td>
                  <td className="py-2.5 text-right text-[var(--dash-fg)]">
                    {row.amount !== undefined ? <Money value={row.amount} /> : '—'}
                  </td>
                  <td className="py-2.5 text-right text-[var(--dash-fg-muted)]">
                    {row.status ? tDeliveryStatus(row.status) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
