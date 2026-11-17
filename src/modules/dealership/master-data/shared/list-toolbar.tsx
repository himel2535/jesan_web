'use client';

import { Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { inputClass } from '@/core/ui/text-field';
import { LIMITS, type ActiveFilter } from '../types';
import { useListParams, useSetListParams } from './list-params';

export const SEARCH_DEBOUNCE_MS = 300;

/**
 * Search box (debounced 300 ms, proposal §9.5), status filter and optional extra filters.
 * Everything is written to the URL; the list reads it from there.
 */
export function ListToolbar({
  searchPlaceholder,
  children,
}: {
  /** Leave out when the API has no `search` for this list (e.g. suppliers). */
  searchPlaceholder?: string;
  children?: ReactNode;
}) {
  const t = useTranslations('dealership.common');
  const id = useId();
  const { search, active } = useListParams();
  const setParams = useSetListParams();
  const [text, setText] = useState(search ?? '');
  const lastSent = useRef(search ?? '');

  // Follow outside changes (back button, "clear filters").
  useEffect(() => {
    if ((search ?? '') !== lastSent.current) {
      lastSent.current = search ?? '';
      setText(search ?? '');
    }
  }, [search]);

  useEffect(() => {
    const value = text.trim();
    if (value === lastSent.current) return;
    const timer = setTimeout(() => {
      lastSent.current = value;
      setParams({ search: value || undefined });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text, setParams]);

  return (
    <div role="search" className="flex flex-wrap items-end gap-3">
      {searchPlaceholder !== undefined ? (
        <div className="min-w-56 flex-1">
          <label htmlFor={`${id}-search`} className="mb-1.5 block text-sm font-medium text-fg">
            {t('searchLabel')}
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
              maxLength={LIMITS.search}
              placeholder={searchPlaceholder}
              onChange={(e) => setText(e.target.value)}
              className={`${inputClass} pl-9`}
            />
          </div>
        </div>
      ) : null}
      {children}
      <div>
        <label htmlFor={`${id}-active`} className="mb-1.5 block text-sm font-medium text-fg">
          {t('statusFilter')}
        </label>
        <select
          id={`${id}-active`}
          value={active}
          onChange={(e) =>
            setParams({
              active: e.target.value === 'true' ? undefined : (e.target.value as ActiveFilter),
            })
          }
          className={inputClass}
        >
          <option value="true">{t('active')}</option>
          <option value="false">{t('inactive')}</option>
          <option value="all">{t('all')}</option>
        </select>
      </div>
    </div>
  );
}
