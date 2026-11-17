import { getTranslations } from 'next-intl/server';
import { CustomerForm } from '@/modules/dealership/master-data/customers/customer-form';
import { dealershipPage } from '@/modules/dealership/master-data/guard';
import { PageHeader } from '@/core/ui/page-header';

export default async function NewCustomerPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const gate = await dealershipPage(slug, 'customer.manage');
  if (!gate.ok) return gate.element;
  const t = await getTranslations('dealership.customers');
  return (
    <>
      <PageHeader title={t('newTitle')} />
      <CustomerForm slug={slug} businessId={gate.business.id} />
    </>
  );
}
