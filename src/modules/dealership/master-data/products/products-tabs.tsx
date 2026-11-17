import { getTranslations } from 'next-intl/server';
import { TabNav } from '@/core/ui/tab-nav';

/** "Products | Categories" tabs on the two list pages (server component). */
export async function ProductsTabs({ slug }: { slug: string }) {
  const t = await getTranslations('dealership.products');
  const base = `/b/${encodeURIComponent(slug)}/products`;
  return (
    <TabNav
      label={t('tabsLabel')}
      items={[
        { href: base, label: t('tabProducts') },
        { href: `${base}/categories`, label: t('tabCategories') },
      ]}
      exact
    />
  );
}
