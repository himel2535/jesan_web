/** Shapes of `/b/:slug/change-requests` (docs/API.md §10). Example-free; no business names. */

export type ChangeStatus = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'stale';
export const CHANGE_STATUSES = ['pending', 'approved', 'rejected', 'cancelled', 'stale'] as const;
export type ChangeKind = 'edit' | 'void';

export interface PersonRef {
  id: string;
  name: string;
}

/** A list row: only a summary (no reason, snapshot or impact). */
export interface ChangeRequestSummary {
  id: string;
  entityType: string;
  entityId: string;
  entityLabel: string;
  kind: ChangeKind;
  /** Built for the viewer: fields they may not see carry no values. */
  summary: string;
  status: ChangeStatus;
  requestedBy: PersonRef;
  requestedAt: string;
  decidedBy: PersonRef | null;
  decidedAt: string | null;
}

/** One line of the effect of a change; lines the viewer may not see are never sent. */
export interface ImpactLine {
  /** Stable, e.g. `product.purchasePrice`: translated by key, `label` is the English fallback. */
  key: string;
  label: string;
  before?: string | number | boolean | null;
  after?: string | number | boolean | null;
  /** Signed, e.g. "+500.00". */
  delta?: string;
  unit?: string;
  note?: string;
}

export interface ChangeRequest extends ChangeRequestSummary {
  reason: string;
  /** Values when requested, only of the proposed fields the viewer may see. */
  snapshot: Record<string, unknown> | null;
  /** Proposed values (null for `void`); hidden fields left out. */
  proposedChange: Record<string, unknown> | null;
  /** Only while pending, from the CURRENT values; null otherwise. */
  impact: ImpactLine[] | null;
  isStale: boolean;
  decisionNote: string | null;
  appliedAt: string | null;
}

export interface ChangePreview {
  entityLabel: string;
  impact: ImpactLine[];
}

export interface ChangeRequestInput {
  entityType: string;
  entityId: string;
  kind: ChangeKind;
  reason: string;
  proposedChange?: Record<string, unknown>;
}

export interface ChangeRequestPage {
  items: ChangeRequestSummary[];
  page: number;
  pageSize: number;
  total: number;
}

export interface ChangeListFilters {
  status?: ChangeStatus;
  entityType?: string;
  entityId?: string;
  page: number;
}
