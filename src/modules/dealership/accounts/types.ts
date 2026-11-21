export type LedgerEntryType =
  'collection' | 'expense' | 'purchase' | 'commission_receipt' | 'manual' | 'supplier_payment';

export const LEDGER_ENTRY_TYPES: LedgerEntryType[] = [
  'collection',
  'expense',
  'purchase',
  'commission_receipt',
  'manual',
  'supplier_payment',
];

export type LedgerDirection = 'in' | 'out';
export type LedgerStatus = 'active' | 'void';

export interface ByTypeItem {
  type: LedgerEntryType;
  in: string;
  out: string;
}

export interface AccountsSummary {
  from: string;
  to: string;
  totalIn: string;
  totalOut: string;
  net: string;
  totalDue: string;
  totalAdvance: string;
  byType: ByTypeItem[];
}

export interface LedgerItem {
  id: string;
  type: LedgerEntryType;
  direction: LedgerDirection;
  amount: string;
  method: string | null;
  referenceType: string | null;
  referenceId: string | null;
  entryDate: string;
  note: string | null;
  status: LedgerStatus;
  createdBy: { id: string; name: string };
  createdAt: string;
}

export interface LedgerResponse {
  items: LedgerItem[];
  page: number;
  pageSize: number;
  total: number;
}

export interface LedgerFilters {
  from?: string;
  to?: string;
  type?: string;
  page: number;
}

export interface ManualEntryInput {
  direction: LedgerDirection;
  amount: string;
  method?: string;
  entryDate: string;
  note?: string;
}

export interface SupplierPaymentInput {
  amount: string;
  method: string;
  paymentDate: string;
  note?: string;
}

export const ACCOUNTS_LIMITS = {
  note: 500,
} as const;
