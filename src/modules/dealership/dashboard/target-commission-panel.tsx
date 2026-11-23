'use client';

import { useMemo } from 'react';
import { Target } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCan } from '@/core/auth/can';
import { businessToday } from '@/core/i18n/format';
import { useFormat } from '@/core/i18n/use-format';
import { EmptyState } from '@/core/ui/empty-state';
import { usePurchaseCounters, useCommissionScheme } from '../commission/api';
import { useDefaultUnit } from '../commission/shared';
import { Money } from '../master-data/shared/display';
import { LoadError } from '../master-data/shared/states';
import { achievedQtyForMonth, commissionProgress, formatAchievementPct } from './shared';

/**
 * Target & Commission Progress: this month's purchased bags (from Akij) vs the commission
 * scheme's bonus threshold, owner-only (`commission.view`, same gate as the Commission KPI card).
 */
export function TargetCommissionPanel({ slug, businessId }: { slug: string; businessId: string }) {
  const t = useTranslations('dealership.dashboard.targetProgress');
  const format = useFormat();
  const canView = useCan('commission.view');
  const today = businessToday();
  const year = Number(today.slice(0, 4));
  const currentMonth = today.slice(0, 7);

  const unit = useDefaultUnit(slug, businessId);
  const scheme = useCommissionScheme(slug, businessId);
  const counters = usePurchaseCounters(slug, businessId, year, canView);

  const achievedQty = useMemo(
    () => achievedQtyForMonth(counters.data?.months, currentMonth),
    [counters.data, currentMonth],
  );

  const progress = useMemo(
    () => commissionProgress(scheme.data, achievedQty),
    [scheme.data, achievedQty],
  );

  if (!canView) return null;

  const error = scheme.error ?? counters.error;
  const isPending = scheme.isPending || counters.isPending || unit.isPending;

  return (
    <div className="flex flex-col rounded-card border border-[var(--dash-border)] bg-[var(--dash-surface)] p-3">
      <h2 className="mb-2 text-base font-semibold text-[var(--dash-fg)]">{t('title')}</h2>

      {error ? (
        <LoadError
          error={error}
          onRetry={() => {
            void scheme.refetch();
            void counters.refetch();
          }}
        />
      ) : isPending ? (
        <div className="space-y-3">
          <div className="h-4 w-32 animate-pulse rounded bg-[var(--dash-bg)]" />
          <div className="h-4 w-40 animate-pulse rounded bg-[var(--dash-bg)]" />
          <div className="h-2 w-full animate-pulse rounded-full bg-[var(--dash-bg)]" />
        </div>
      ) : !progress ? (
        <EmptyState icon={Target} title={t('notConfigured')} />
      ) : (
        <div className="flex flex-col gap-2">
          <dl className="space-y-1.5 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-[var(--dash-fg-muted)]">{t('target')}</dt>
              <dd className="font-medium text-[var(--dash-fg)]">
                {t('qty', { value: format.quantity(progress.targetQty), unit: unit.name })}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-[var(--dash-fg-muted)]">{t('achieved')}</dt>
              <dd className="font-medium text-[var(--dash-fg)]">
                {t('qty', { value: format.quantity(progress.achievedQty), unit: unit.name })}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-[var(--dash-fg-muted)]">{t('remaining')}</dt>
              <dd className="font-medium text-[var(--dash-fg)]">
                {t('qty', { value: format.quantity(progress.remainingQty), unit: unit.name })}
              </dd>
            </div>
          </dl>

          <div>
            <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-[var(--dash-fg-muted)]">
              {t('achievementPct', { pct: formatAchievementPct(progress.achievementPct) })}
              {progress.achievementPct > 100 && (
                <span className="rounded-full bg-[var(--dash-success)]/15 px-1.5 py-0.5 text-[10px] font-semibold text-[var(--dash-success)]">
                  {t('targetExceeded')}
                </span>
              )}
            </p>
            <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--dash-border)]">
              <div
                className="h-full rounded-full bg-[var(--dash-indigo-icon-bg)]"
                style={{ width: `${Math.min(progress.achievementPct, 100)}%` }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-[var(--dash-border)] pt-2 text-sm">
            <span className="text-[var(--dash-fg-muted)]">{t('estimatedCommission')}</span>
            <span className="font-semibold text-[var(--dash-success)]">
              <Money value={progress.estimatedCommission.toFixed(2)} />
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
