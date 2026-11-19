'use client';

import { useTranslations } from 'next-intl';
import { ApiError } from '@/core/api/errors';
import { useFormat } from '@/core/i18n/use-format';

/**
 * 409 STOCK_INSUFFICIENT carries `details.available` (docs/API.md §10): say how much there is.
 * Returns null for any other error, so the caller falls back to the code's general message.
 */
export function useStockInsufficientMessage() {
  const t = useTranslations('dealership.purchases');
  const format = useFormat();
  return (error: unknown): string | null => {
    if (!(error instanceof ApiError) || error.code !== 'STOCK_INSUFFICIENT') return null;
    const details = error.body?.details as { available?: unknown } | undefined;
    const available = typeof details?.available === 'string' ? details.available : null;
    return available !== null
      ? t('stockInsufficient', { available: format.quantity(available) })
      : null;
  };
}
