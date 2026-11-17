'use client';

import { useTranslations } from 'next-intl';
import { PageHeader } from '@/core/ui/page-header';
import { useProduct } from '../api';
import { useNameOf } from '../shared/display';
import { ListSkeleton, LoadError } from '../shared/states';
import { ProductForm } from './product-form';

export function ProductEdit({
  slug,
  businessId,
  id,
}: {
  slug: string;
  businessId: string;
  id: string;
}) {
  const t = useTranslations('dealership.products');
  const nameOf = useNameOf();
  const query = useProduct(slug, businessId, id);
  if (query.isPending) return <ListSkeleton rows={6} />;
  if (query.isError) return <LoadError error={query.error} onRetry={() => void query.refetch()} />;
  return (
    <>
      <PageHeader
        title={t('editTitle', { name: nameOf(query.data) })}
        description={query.data.code}
      />
      {/* key: a fresh form when the saved product changes */}
      <ProductForm
        key={query.data.updatedAt}
        slug={slug}
        businessId={businessId}
        product={query.data}
      />
    </>
  );
}
