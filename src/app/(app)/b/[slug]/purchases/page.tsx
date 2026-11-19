import { getTranslations } from 'next-intl/server';
import { dealershipPage } from '@/modules/dealership/master-data/guard';
import { PurchasesList } from '@/modules/dealership/purchases/purchases-list';
import { PageHeader } from '@/core/ui/page-header';

export default async function PurchasesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const gate = await dealershipPage(slug, 'purchase.view');
  if (!gate.ok) return gate.element;
  const t = await getTranslations('dealership.purchases');
  return (
    <>
      <PageHeader title={t('title')} description={t('description', { business: gate.name })} />
      <PurchasesList slug={slug} businessId={gate.business.id} />
    </>
  );
}
