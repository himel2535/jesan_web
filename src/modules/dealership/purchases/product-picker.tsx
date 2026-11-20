'use client';

import { Plus, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useId, useState } from 'react';
import { cn } from '@/core/ui/cn';
import { inputClass } from '@/core/ui/text-field';
import { useProducts } from '../master-data/api';
import { useNameOf } from '../master-data/shared/display';
import type { Product } from '../master-data/types';

/**
 * The first list `ProductPicker` asks for, started by the page above it (see
 * `useWarmCustomerPicker`): one wave instead of two. Only active products, as the picker does.
 */
export function useWarmProductPicker(slug: string, businessId: string) {
  useProducts(slug, businessId, { active: 'true' });
}

/**
 * Search active products (name or code, 300 ms debounce) and pick one. Results are plain buttons
 * (Tab/Enter work); products already chosen are shown but disabled.
 */
export function ProductPicker({
  slug,
  businessId,
  label,
  excludeIds = [],
  onPick,
}: {
  slug: string;
  businessId: string;
  label: string;
  excludeIds?: readonly string[];
  onPick: (product: Product) => void;
}) {
  const t = useTranslations('dealership.purchases.form');
  const id = useId();
  const nameOf = useNameOf();
  const [text, setText] = useState('');
  const [search, setSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setSearch(text.trim()), 300);
    return () => clearTimeout(timer);
  }, [text]);
  const query = useProducts(slug, businessId, { search: search || undefined, active: 'true' });
  const items = query.data?.items ?? [];

  return (
    <div className="space-y-2">
      <label htmlFor={`${id}-search`} className="block text-sm font-medium text-fg">
        {label}
      </label>
      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-muted"
        />
        <input
          id={`${id}-search`}
          type="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('searchProducts')}
          aria-describedby={`${id}-hint`}
          autoComplete="off"
          className={cn(inputClass, 'pl-9')}
        />
      </div>
      <p id={`${id}-hint`} className="text-sm text-fg-muted">
        {t('searchHint')}
      </p>
      <ul
        aria-label={label}
        aria-busy={query.isFetching}
        className="max-h-64 space-y-1 overflow-y-auto rounded-card border border-border bg-surface p-1"
      >
        {query.isSuccess && items.length === 0 ? (
          <li className="px-3 py-2 text-sm text-fg-muted">{t('noProducts')}</li>
        ) : null}
        {items.map((p) => {
          const taken = excludeIds.includes(p.id);
          return (
            <li key={p.id}>
              <button
                type="button"
                disabled={taken}
                onClick={() => onPick(p)}
                className="flex min-h-10 w-full items-center justify-between gap-3 rounded-lg px-3 text-left text-sm hover:bg-surface-muted disabled:cursor-not-allowed disabled:text-fg-muted"
              >
                <span>
                  <span className="font-mono text-xs text-fg-muted">{p.code}</span>{' '}
                  <span className="font-medium">{nameOf(p)}</span>
                </span>
                {taken ? (
                  <span className="text-xs">{t('alreadyAdded')}</span>
                ) : (
                  <Plus aria-hidden className="size-4 shrink-0" />
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
