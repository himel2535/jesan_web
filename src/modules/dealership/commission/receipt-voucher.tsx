'use client';

import { useTranslations } from 'next-intl';
import { useLocale } from 'next-intl';
import { useFormat } from '@/core/i18n/use-format';
import { useCurrentBusiness } from '@/core/auth/session-context';
import { localizedName } from '@/core/auth/types';
import { Button } from '@/core/ui/button';
import { Modal } from '@/core/ui/modal';
import type { CommissionEntryDetail, CommissionReceipt } from './types';

/** Last 8 chars of UUID, uppercased — used as a short human-readable voucher number. */
function shortId(id: string): string {
  return id.replace(/-/g, '').slice(-8).toUpperCase();
}

/**
 * Printable commission receipt voucher.
 * Rendered inside a Modal for preview; `window.print()` triggers `@media print` CSS
 * which hides everything except `.print-voucher`.
 */
export function ReceiptVoucher({
  entry,
  receipt,
  supplierName,
  onClose,
}: {
  entry: CommissionEntryDetail;
  receipt: CommissionReceipt;
  supplierName: string;
  onClose: () => void;
}) {
  const t = useTranslations('dealership.commission.receipt.voucher');
  const tc = useTranslations('dealership.commission.receipt');
  const format = useFormat();
  const locale = useLocale();
  const business = useCurrentBusiness();
  const businessName = business ? localizedName(business, locale) : 'Jesan Group';

  const when = (iso: string) => format.date(`${iso}T00:00:00+06:00`);
  const voucherNo = `RCV-${shortId(receipt.id)}`;

  return (
    <Modal open onClose={onClose} title={t('title')}>
      {/* Screen-only controls */}
      <div className="mb-4 flex justify-end gap-2 print:hidden">
        <Button variant="secondary" onClick={onClose}>
          {t('closeBtn')}
        </Button>
        <Button onClick={() => window.print()}>{t('printBtn')}</Button>
      </div>

      {/*
       * .print-voucher is what @media print shows.
       * The global print CSS in globals.css hides body > * except .print-voucher.
       * Since this renders inside a Modal (portal), we use a fixed overlay approach:
       * the voucher div itself carries `print-voucher` and the CSS makes it the only
       * visible element.
       */}
      <div className="print-voucher rounded-lg border-2 border-border p-6 font-sans text-sm text-fg">
        {/* Header */}
        <div className="mb-5 border-b border-border pb-4 text-center">
          <h1 className="text-xl font-bold">{businessName}</h1>
          <p className="mt-1 text-base font-semibold">{t('title')}</p>
        </div>

        {/* Voucher details */}
        <table className="w-full border-collapse text-left">
          <tbody>
            <VoucherRow label={t('voucherNo')} value={voucherNo} bold />
            <VoucherRow label={t('supplier')} value={supplierName} />
            <VoucherRow
              label={t('period')}
              value={`${when(entry.fromDate)} – ${when(entry.toDate)}`}
            />
            <VoucherRow label={t('date')} value={when(receipt.receivedDate)} />
            <VoucherRow label={t('amount')} value={format.money(receipt.amount)} bold />
            {receipt.reference ? (
              <VoucherRow label={t('reference')} value={receipt.reference} />
            ) : null}
            {receipt.note ? <VoucherRow label={t('note')} value={receipt.note} /> : null}
          </tbody>
        </table>

        {/* Signature lines */}
        <div className="mt-10 grid grid-cols-2 gap-8">
          <div className="text-center">
            <div className="mb-1 border-b border-fg" />
            <p className="text-xs">{t('receivedBy')}</p>
            <p className="text-xs text-fg-muted">{t('signature')}</p>
          </div>
          <div className="text-center">
            <div className="mb-1 border-b border-fg" />
            <p className="text-xs">{t('authorizedBy')}</p>
            <p className="text-xs text-fg-muted">{t('signature')}</p>
          </div>
        </div>

        {/* Footer */}
        <p className="mt-4 text-center text-xs text-fg-muted">
          {tc('print')} · {voucherNo}
        </p>
      </div>
    </Modal>
  );
}

function VoucherRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <tr className="border-b border-border last:border-0">
      <th
        scope="row"
        className="w-2/5 py-2 pr-3 text-left align-top text-xs font-medium text-fg-muted"
      >
        {label}
      </th>
      <td className={`py-2 ${bold ? 'font-semibold' : ''}`}>{value}</td>
    </tr>
  );
}
