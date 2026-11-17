'use client';

import { useLocale, useTranslations } from 'next-intl';
import { localizedName } from '@/core/auth/types';
import { useFormat } from '@/core/i18n/use-format';
import { absoluteMoney, isNegativeMoney } from '@/core/lib/money';
import { cn } from '@/core/ui/cn';

/** Money from the API (a string) formatted as ৳ with lakh grouping; never turned into a number. */
export function Money({ value, className }: { value: string; className?: string }) {
  const format = useFormat();
  return <span className={cn('tabular-nums', className)}>{format.money(value)}</span>;
}

/** A customer balance: negative is an advance, shown as the positive amount with a label. */
export function Balance({ value }: { value: string }) {
  const t = useTranslations('dealership.customers');
  const format = useFormat();
  if (!isNegativeMoney(value)) return <Money value={value} />;
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span className="tabular-nums">{format.money(absoluteMoney(value))}</span>
      <span className="rounded-full border border-success px-2 py-0.5 text-xs font-medium text-success">
        {t('advance')}
      </span>
    </span>
  );
}

export function StatusBadge({ active }: { active: boolean }) {
  const t = useTranslations('dealership.common');
  return (
    <span className={cn('text-sm font-medium', active ? 'text-success' : 'text-danger')}>
      {active ? t('active') : t('inactive')}
    </span>
  );
}

/** "English name" / "বাংলা নাম" by the current language; falls back to English. */
export function useNameOf() {
  const locale = useLocale();
  return (item: { nameEn: string; nameBn: string | null }) =>
    localizedName({ nameEn: item.nameEn, nameBn: item.nameBn ?? item.nameEn }, locale);
}
