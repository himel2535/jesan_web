import { getTranslations } from 'next-intl/server';
import { checkBackendHealth } from '@/core/api/health';
import { cn } from '@/core/ui/cn';
import { Card } from '@/core/ui/card';
import { PageHeader } from '@/core/ui/page-header';

// Check the backend on every request, not once at build time.
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const [t, isUp] = await Promise.all([getTranslations('home'), checkBackendHealth()]);

  return (
    <>
      <PageHeader title={t('title')} description={t('description')} />
      <Card className="max-w-md">
        <p role="status" className="flex items-center gap-3 text-base font-medium">
          <span
            aria-hidden
            className={cn('size-3 rounded-full', isUp ? 'bg-success' : 'bg-danger')}
          />
          {isUp ? t('backendUp') : t('backendDown')}
        </p>
      </Card>
    </>
  );
}
