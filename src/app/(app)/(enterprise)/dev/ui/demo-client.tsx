'use client';

import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useFormat } from '@/core/i18n/use-format';
import { Button } from '@/core/ui/button';
import { Modal } from '@/core/ui/modal';
import { Pagination } from '@/core/ui/pagination';
import { PAGE_SIZE, parsePageParam, totalPages } from '@/core/ui/pagination-logic';

export function DemoModal() {
  const t = useTranslations('demo');
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        {t('openModal')}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={t('modalTitle')}>
        <p className="text-sm text-fg-muted">{t('modalBody')}</p>
      </Modal>
    </>
  );
}

const DEMO_TOTAL = 53;

/** Plain table (no blur) + the shared 10-row pagination, driven by ?page= in the URL. */
export function DemoTable() {
  const t = useTranslations('demo');
  const format = useFormat();
  const searchParams = useSearchParams();
  const page = Math.min(
    parsePageParam(searchParams.get('page')),
    totalPages(DEMO_TOTAL, PAGE_SIZE),
  );
  const first = (page - 1) * PAGE_SIZE + 1;
  const rows = Array.from(
    { length: Math.max(0, Math.min(PAGE_SIZE, DEMO_TOTAL - first + 1)) },
    (_, i) => first + i,
  );

  return (
    <div>
      <div className="overflow-x-auto rounded-card border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-fg-muted">
            <tr>
              <th scope="col" className="px-4 py-2 font-medium">
                {t('column')}
              </th>
              <th scope="col" className="px-4 py-2 text-right font-medium">
                {t('value')}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((n) => (
              <tr key={n} className="border-b border-border last:border-0">
                <td className="px-4 py-2">{t('row', { n: format.number(n) })}</td>
                <td className="px-4 py-2 text-right tabular-nums">{format.money(n * 570)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination totalItems={DEMO_TOTAL} />
    </div>
  );
}
