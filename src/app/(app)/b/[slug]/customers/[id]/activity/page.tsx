import { getTranslations } from 'next-intl/server';
import { dealershipPage } from '@/modules/dealership/master-data/guard';
import { CustomerActivity } from '@/modules/dealership/sales/customer/customer-activity';
import { CustomerTabs } from '@/modules/dealership/sales/customer/customer-tabs';
import { PageHeader } from '@/core/ui/page-header';

export default async function CustomerActivityPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const gate = await dealershipPage(slug, {
    anyOf: ['sale.view.all', 'sale.view.own', 'delivery.view'],
  });
  if (!gate.ok) return gate.element;
  const t = await getTranslations('dealership.sales.ledger');
  return (
    <>
      <PageHeader title={t('tabActivity')} />
      <CustomerTabs slug={slug} customerId={id} business={gate.business} />
      <CustomerActivity slug={slug} businessId={gate.business.id} customerId={id} />
    </>
  );
}
