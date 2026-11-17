import { getTranslations } from 'next-intl/server';
import { CustomersList } from '@/modules/dealership/master-data/customers/customers-list';
import { dealershipPage } from '@/modules/dealership/master-data/guard';
import { PageHeader } from '@/core/ui/page-header';

export default async function CustomersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const gate = await dealershipPage(slug, 'customer.view');
  if (!gate.ok) return gate.element;
  const t = await getTranslations('dealership.customers');
  return (
    <>
      <PageHeader title={t('title')} description={t('description', { business: gate.name })} />
      <CustomersList slug={slug} businessId={gate.business.id} />
    </>
  );
}
