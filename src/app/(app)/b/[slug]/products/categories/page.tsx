import { getTranslations } from 'next-intl/server';
import { CategoriesPanel } from '@/modules/dealership/master-data/categories/categories-panel';
import { dealershipPage } from '@/modules/dealership/master-data/guard';
import { ProductsTabs } from '@/modules/dealership/master-data/products/products-tabs';
import { PageHeader } from '@/core/ui/page-header';

export default async function CategoriesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const gate = await dealershipPage(slug, 'product.view');
  if (!gate.ok) return gate.element;
  const t = await getTranslations('dealership.products');
  return (
    <>
      <PageHeader title={t('title')} description={t('description', { business: gate.name })} />
      <ProductsTabs slug={slug} />
      <CategoriesPanel slug={slug} businessId={gate.business.id} />
    </>
  );
}
