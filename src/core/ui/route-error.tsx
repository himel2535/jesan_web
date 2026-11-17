'use client';

import { TriangleAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { Button } from '@/core/ui/button';
import { EmptyState } from '@/core/ui/empty-state';

/** Shared body of route `error.tsx` files: a message and a retry button. */
export function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <EmptyState
      icon={TriangleAlert}
      title={t('errors.title')}
      description={t('errors.description')}
      action={<Button onClick={reset}>{t('common.retry')}</Button>}
    />
  );
}
