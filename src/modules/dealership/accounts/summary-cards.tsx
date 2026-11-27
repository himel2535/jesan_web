'use client';

import { ArrowDownLeft, ArrowUpRight, Scale, AlertTriangle, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { isNegativeMoney } from '@/core/lib/money';
import { Money } from '../master-data/shared/display';
import { SummaryTile, SummaryTileGrid } from '../dashboard/summary-tile';
import type { AccountsSummary } from './types';

export function SummaryCardsSkeleton() {
  return (
    <SummaryTileGrid className="sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {Array.from({ length: 5 }, (_, i) => (
        <SummaryTile
          key={i}
          hue="blue"
          icon={<Scale aria-hidden className="size-3.5" />}
          label=""
          value={null}
          loading
        />
      ))}
    </SummaryTileGrid>
  );
}

export function SummaryCards({ summary }: { summary: AccountsSummary }) {
  const t = useTranslations('dealership.accounts.summary');
  return (
    <SummaryTileGrid className="sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      <SummaryTile
        hue="green"
        icon={<ArrowDownLeft aria-hidden className="size-3.5" />}
        label={t('totalIn')}
        value={<Money value={summary.totalIn} />}
      />
      <SummaryTile
        hue="orange"
        icon={<ArrowUpRight aria-hidden className="size-3.5" />}
        label={t('totalOut')}
        value={<Money value={summary.totalOut} />}
      />
      <SummaryTile
        hue={isNegativeMoney(summary.net) ? 'orange' : 'blue'}
        icon={<Scale aria-hidden className="size-3.5" />}
        label={t('net')}
        value={<Money value={summary.net} />}
        highlighted
      />
      <SummaryTile
        hue="orange"
        icon={<AlertTriangle aria-hidden className="size-3.5" />}
        label={t('totalDue')}
        value={<Money value={summary.totalDue} />}
        note={t('totalDueNote')}
      />
      <SummaryTile
        hue="purple"
        icon={<Sparkles aria-hidden className="size-3.5" />}
        label={t('totalAdvance')}
        value={<Money value={summary.totalAdvance} />}
        note={t('totalAdvanceNote')}
      />
    </SummaryTileGrid>
  );
}
