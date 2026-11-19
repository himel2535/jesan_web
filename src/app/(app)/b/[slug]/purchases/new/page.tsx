import { getTranslations } from 'next-intl/server';
import { dealershipPage } from '@/modules/dealership/master-data/guard';
import { PurchaseForm } from '@/modules/dealership/purchases/purchase-form';
import { PageHeader } from '@/core/ui/page-header';

/** Entering a purchase needs the price permission too (prices are typed in). */
export default async function NewPurchasePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const gate = await dealershipPage(slug, { allOf: ['purchase.create', 'product.cost.view'] });
  if (!gate.ok) return gate.element;
  const t = await getTranslations('dealership.purchases');
  return (
    <>
      <PageHeader title={t('newTitle')} />
      <PurchaseForm slug={slug} businessId={gate.business.id} />
    </>
  );
}
