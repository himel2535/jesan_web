import { getTranslations } from 'next-intl/server';
import { dealershipPage } from '@/modules/dealership/master-data/guard';
import { ProductForm } from '@/modules/dealership/master-data/products/product-form';
import { PageHeader } from '@/core/ui/page-header';

export default async function NewProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const gate = await dealershipPage(slug, 'product.manage');
  if (!gate.ok) return gate.element;
  const t = await getTranslations('dealership.products');
  return (
    <>
      <PageHeader title={t('newTitle')} />
      <ProductForm slug={slug} businessId={gate.business.id} />
    </>
  );
}
