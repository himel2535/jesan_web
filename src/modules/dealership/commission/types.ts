/**
 * Shapes of `/b/:slug/commission-*` (docs/API.md §10, Akij Cement, owner-only). Money and
 * quantities are always strings.
 */

export interface CommissionScheme {
  rateBase: string;
  targetQty: string;
  bonusRate: string;
  updatedAt: string;
}

export interface CommissionEntry {
  id: string;
  fromDate: string;
  toDate: string;
  quantity: string;
  calculatedAmount: string;
  receivedAmount: string;
  pendingAmount: string;
  note: string | null;
  createdAt: string;
}

export interface CommissionReceipt {
  id: string;
  amount: string;
  receivedDate: string;
  reference: string | null;
  note: string | null;
}

export interface CommissionEntryDetail extends CommissionEntry {
  receipts: CommissionReceipt[];
}

export interface CommissionSummary {
  year: number;
  totalCalculated: string;
  totalReceived: string;
  totalPending: string;
  entryCount: number;
  receiptCount: number;
}

export interface SuggestionResponse {
  from: string;
  to: string;
  quantity: string;
}

export interface SchemeInput {
  rateBase: string;
  targetQty: string;
  bonusRate: string;
}

export interface EntryInput {
  fromDate: string;
  toDate: string;
  quantity: string;
  note?: string;
}

export interface EntryPatch {
  fromDate?: string;
  toDate?: string;
  quantity?: string;
  note?: string;
}

export interface ReceiptInput {
  amount: string;
  receivedDate: string;
  reference?: string;
  note?: string;
}

export interface ReceiptPatch {
  amount?: string;
  receivedDate?: string;
  reference?: string;
  note?: string;
}

/** `note` (entries and receipts) is `VarChar(500)`; `reference` (receipts) is `VarChar(100)`. */
export const COMMISSION_LIMITS = { note: 500, reference: 100 } as const;
