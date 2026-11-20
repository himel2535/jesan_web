import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { dealershipPage } from '@/modules/dealership/master-data/guard';
import { PageHeader } from '@/core/ui/page-header';

export default async function ReportsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const gate = await dealershipPage(slug, 'report.view');
  if (!gate.ok) return gate.element;
  const t = await getTranslations('dealership.reports');
  const base = `/b/${encodeURIComponent(slug)}/reports`;
  const reports = [
    { path: 'sales', label: t('nav.sales') },
    { path: 'collections', label: t('nav.collections') },
    { path: 'dues', label: t('nav.dues') },
    { path: 'stock', label: t('nav.stock') },
    { path: 'stock-movements', label: t('nav.stockMovements') },
    { path: 'expenses', label: t('nav.expenses') },
  ] as const;

  return (
    <>
      <PageHeader title={t('title')} description={t('description', { business: gate.name })} />
      <nav aria-label={t('title')} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {reports.map((r) => (
          <Link
            key={r.path}
            href={`${base}/${r.path}`}
            className="rounded-card border border-border bg-surface p-4 font-medium text-fg hover:bg-surface-muted"
          >
            {r.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
