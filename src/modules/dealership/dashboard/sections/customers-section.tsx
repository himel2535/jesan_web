'use client';

import { useTranslations } from 'next-intl';
import { ApiError } from '@/core/api/errors';
import { useFormat } from '@/core/i18n/use-format';
import { useCustomers } from '../../master-data/api';

function isForbidden(error: unknown) {
  return error instanceof ApiError && error.status === 403;
}

/** Total customer count (`customer.view`), via the same query the Customers list page uses. */
export function CustomersSection({ slug, businessId }: { slug: string; businessId: string }) {
  const t = useTranslations('dealership');
  const format = useFormat();
  const query = useCustomers(slug, businessId, { page: 1 });

  if (isForbidden(query.error)) return null;

  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold text-fg">{t('nav.customers')}</h2>
      <dl className="rounded-card border border-border bg-surface p-4">
        <div>
          <dt className="text-sm text-fg-muted">{t('customers.totalCount')}</dt>
          <dd className="font-semibold">
            {query.isPending ? (
              <div className="h-6 w-16 animate-pulse rounded bg-surface-muted" />
            ) : query.data ? (
              format.number(query.data.total)
            ) : null}
          </dd>
        </div>
      </dl>
    </section>
  );
}
