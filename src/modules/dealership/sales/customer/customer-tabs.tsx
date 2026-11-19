import { getTranslations } from 'next-intl/server';
import { can } from '@/core/auth/permissions';
import type { MeBusiness } from '@/core/auth/types';
import { TabNav } from '@/core/ui/tab-nav';

/**
 * "Details | Ledger | Orders & deliveries" on a customer's pages (server component). A tab the
 * user may not open is not there, and with fewer than two tabs the bar does not show at all.
 */
export async function CustomerTabs({
  slug,
  customerId,
  business,
}: {
  slug: string;
  customerId: string;
  business: MeBusiness;
}) {
  const t = await getTranslations('dealership.sales.ledger');
  const base = `/b/${encodeURIComponent(slug)}/customers/${encodeURIComponent(customerId)}`;
  const items = [{ href: base, label: t('tabDetails') }];
  if (can(business.permissions, 'customer.due.view'))
    items.push({ href: `${base}/ledger`, label: t('tabLedger') });
  if (can(business.permissions, { anyOf: ['sale.view.all', 'sale.view.own', 'delivery.view'] }))
    items.push({ href: `${base}/activity`, label: t('tabActivity') });
  return <TabNav label={t('tabsLabel')} items={items} exact />;
}
