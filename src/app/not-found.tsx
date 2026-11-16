import { SearchX } from 'lucide-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { EmptyState } from '@/core/ui/empty-state';

export default async function NotFound() {
  const t = await getTranslations();

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <EmptyState
        icon={SearchX}
        title={t('errors.notFoundTitle')}
        description={t('errors.notFoundDescription')}
        action={
          <Link
            href="/"
            className="inline-flex min-h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-fg"
          >
            {t('common.goHome')}
          </Link>
        }
      />
    </main>
  );
}
