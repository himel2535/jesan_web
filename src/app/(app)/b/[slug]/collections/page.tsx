import { getTranslations } from 'next-intl/server';
import { dealershipPage } from '@/modules/dealership/master-data/guard';
import { CollectionsList } from '@/modules/dealership/sales/collections/collections-list';
import { PageHeader } from '@/core/ui/page-header';

export default async function CollectionsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const gate = await dealershipPage(slug, 'collection.view');
  if (!gate.ok) return gate.element;
  const t = await getTranslations('dealership.sales.collections');
  return (
    <>
      <PageHeader title={t('title')} description={t('description', { business: gate.name })} />
      <CollectionsList slug={slug} businessId={gate.business.id} />
    </>
  );
}
