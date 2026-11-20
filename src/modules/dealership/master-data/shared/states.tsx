'use client';

import { SearchX } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { apiErrorKind } from '@/core/api/error-kind';
import { Button } from '@/core/ui/button';
import { EmptyState } from '@/core/ui/empty-state';

/**
 * The page-shaped skeletons live in core so every page loads with the same shape; re-exported
 * here because the dealership pages import their states from this file.
 */
export { DetailSkeleton, FormSkeleton, ListSkeleton } from '@/core/ui/skeleton';

/** Load failure: a message by status (403 = no permission) and a retry button. */
export function LoadError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const t = useTranslations('dealership.common');
  const kind = apiErrorKind(error);
  return (
    <div role="alert" className="space-y-3 rounded-card border border-border p-6 text-center">
      <p className="text-fg">{kind === 'unknown' ? t('loadError') : t(`error.${kind}`)}</p>
      {kind === 'noPermission' || kind === 'notFound' ? null : (
        <Button variant="secondary" onClick={onRetry}>
          {t('retry')}
        </Button>
      )}
    </div>
  );
}

/** "Nothing yet" vs "nothing matches your search" are different situations. */
export function ListEmpty({
  filtered,
  title,
  description,
  icon,
  onClear,
}: {
  filtered: boolean;
  title: string;
  description: string;
  icon: Parameters<typeof EmptyState>[0]['icon'];
  onClear: () => void;
}) {
  const t = useTranslations('dealership.common');
  return filtered ? (
    <EmptyState
      icon={SearchX}
      title={t('noResultsTitle')}
      description={t('noResultsDescription')}
      action={
        <Button variant="secondary" onClick={onClear}>
          {t('clearFilters')}
        </Button>
      }
    />
  ) : (
    <EmptyState icon={icon} title={title} description={description} />
  );
}

export function Notice({ children }: { children: ReactNode }) {
  return (
    <div role="status" aria-live="polite">
      {children ? (
        <p className="rounded-lg border border-success px-3 py-2 text-sm font-medium text-success">
          {children}
        </p>
      ) : null}
    </div>
  );
}

export function FormError({ message }: { message: string | null }) {
  return (
    <div role="alert">
      {message ? (
        <p className="rounded-lg border border-danger px-3 py-2 text-sm font-medium text-danger">
          {message}
        </p>
      ) : null}
    </div>
  );
}
