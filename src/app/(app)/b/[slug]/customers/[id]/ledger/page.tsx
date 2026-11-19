import { getTranslations } from 'next-intl/server';
import { dealershipPage } from '@/modules/dealership/master-data/guard';
import { CustomerLedger } from '@/modules/dealership/sales/customer/ledger';
import { CustomerTabs } from '@/modules/dealership/sales/customer/customer-tabs';
import { PageHeader } from '@/core/ui/page-header';

export default async function CustomerLedgerPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const gate = await dealershipPage(slug, 'customer.due.view');
  if (!gate.ok) return gate.element;
  const t = await getTranslations('dealership.sales.ledger');
  return (
    <>
      <PageHeader title={t('title')} />
      <CustomerTabs slug={slug} customerId={id} business={gate.business} />
      <CustomerLedger slug={slug} businessId={gate.business.id} customerId={id} />
    </>
  );
}
