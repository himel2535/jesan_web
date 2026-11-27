/**
 * Shapes of `/b/:slug/commission-*` (docs/API.md §10, Akij Cement, owner-only). Commission is
 * just money received plus the reason: no scheme, target or calculation. Money is a string.
 */

export interface CommissionEntry {
  id: string;
  amount: string;
  receivedDate: string;
  /** Required for new entries; older rows may have none. */
  note: string | null;
  createdAt: string;
}

export interface CommissionSummary {
  year: number;
  totalReceived: string;
  entryCount: number;
}

export interface EntryInput {
  amount: string;
  receivedDate: string;
  note: string;
}

export interface EntryPatch {
  amount?: string;
  receivedDate?: string;
  note?: string;
}

/** `note` is `VarChar(500)`. */
export const COMMISSION_LIMITS = { note: 500 } as const;
