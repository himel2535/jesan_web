import { getTranslations } from 'next-intl/server';
import { dealershipPage } from '@/modules/dealership/master-data/guard';
import { SuppliersList } from '@/modules/dealership/master-data/suppliers/suppliers';
import { PageHeader } from '@/core/ui/page-header';

export default async function SuppliersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const gate = await dealershipPage(slug, 'supplier.view');
  if (!gate.ok) return gate.element;
  const t = await getTranslations('dealership.suppliers');
  return (
    <>
      <PageHeader title={t('title')} description={t('description', { business: gate.name })} />
      <SuppliersList slug={slug} businessId={gate.business.id} />
    </>
  );
}
