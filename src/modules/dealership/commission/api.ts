'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/core/api/client';
import { dealershipKeys } from '../master-data/api';
import type { Page } from '../master-data/types';
import type {
  CommissionEntry,
  CommissionEntryDetail,
  CommissionReceipt,
  CommissionScheme,
  CommissionSummary,
  EntryInput,
  EntryPatch,
  ReceiptInput,
  ReceiptPatch,
  SchemeInput,
  SuggestionResponse,
} from './types';

const base = (slug: string) => `/b/${encodeURIComponent(slug)}/commission-entries`;
const schemeBase = (slug: string) => `/b/${encodeURIComponent(slug)}/commission-scheme`;
const summaryBase = (slug: string) => `/b/${encodeURIComponent(slug)}/commission-summary`;

/** A scheme change doesn't touch past entries, but it changes what new ones would calculate to. */
export const COMMISSION_REFRESH = ['commissionScheme', 'commissionSummary'] as const;
/** An entry changes its own list and the yearly totals. */
export const COMMISSION_ENTRY_REFRESH = ['commissionEntries', 'commissionSummary'] as const;
/** A receipt changes its entry's received/pending amounts and the yearly totals. */
export const COMMISSION_RECEIPT_REFRESH = ['commissionEntry', 'commissionSummary'] as const;

function useInvalidate(businessId: string) {
  const queryClient = useQueryClient();
  return (...entities: string[]) =>
    Promise.all(
      entities.map((entity) =>
        queryClient.invalidateQueries({ queryKey: dealershipKeys.entity(businessId, entity) }),
      ),
    );
}

// ---- Scheme ----

export function useCommissionScheme(slug: string, businessId: string) {
  return useQuery<CommissionScheme | null>({
    queryKey: dealershipKeys.entity(businessId, 'commissionScheme'),
    queryFn: ({ signal }) =>
      apiFetch<{ scheme: CommissionScheme | null }>(schemeBase(slug), { signal }).then(
        (r) => r.scheme,
      ),
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  });
}

export function useUpsertScheme(slug: string, businessId: string) {
  const refresh = useInvalidate(businessId);
  return useMutation({
    mutationFn: (input: SchemeInput) =>
      apiFetch<CommissionScheme>(schemeBase(slug), { method: 'PUT', body: input }),
    onSuccess: () => refresh(...COMMISSION_REFRESH),
  });
}

// ---- Entries ----

export function useCommissionEntries(slug: string, businessId: string, page: number) {
  return useQuery({
    queryKey: dealershipKeys.list(businessId, 'commissionEntries', { page }),
    queryFn: ({ signal }) =>
      apiFetch<Page<CommissionEntry>>(base(slug), { query: { page }, signal }),
    placeholderData: keepPreviousData,
  });
}

export function useCommissionEntry(slug: string, businessId: string, id: string) {
  return useQuery({
    queryKey: dealershipKeys.detail(businessId, 'commissionEntry', id),
    queryFn: ({ signal }) =>
      apiFetch<CommissionEntryDetail>(`${base(slug)}/${encodeURIComponent(id)}`, { signal }),
  });
}

/** `POST commission-entries` with one Idempotency-Key per open form. */
export function useCreateEntry(slug: string, businessId: string) {
  const refresh = useInvalidate(businessId);
  return useMutation({
    mutationFn: ({ input, idempotencyKey }: { input: EntryInput; idempotencyKey: string }) =>
      apiFetch<CommissionEntryDetail>(base(slug), {
        method: 'POST',
        body: input,
        headers: { 'Idempotency-Key': idempotencyKey },
      }),
    onSuccess: () => refresh(...COMMISSION_ENTRY_REFRESH),
  });
}

export function usePatchEntry(slug: string, businessId: string) {
  const refresh = useInvalidate(businessId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: EntryPatch }) =>
      apiFetch<CommissionEntryDetail>(`${base(slug)}/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: patch,
      }),
    onSuccess: (_, { id }) =>
      Promise.all([
        refresh(...COMMISSION_ENTRY_REFRESH),
        queryClient.invalidateQueries({
          queryKey: dealershipKeys.detail(businessId, 'commissionEntry', id),
        }),
      ]),
  });
}

/** The purchased quantity suggestion for a date range; owner may still type a different number. */
export function useCommissionSuggestion(
  slug: string,
  businessId: string,
  from: string | undefined,
  to: string | undefined,
) {
  return useQuery({
    queryKey: dealershipKeys.list(businessId, 'commissionSuggestion', { from, to }),
    queryFn: ({ signal }) =>
      apiFetch<SuggestionResponse>(`${base(slug)}/suggestion`, { query: { from, to }, signal }),
    enabled: Boolean(from && to && from <= to),
  });
}

// ---- Receipts ----

export function useCreateReceipt(slug: string, businessId: string) {
  const refresh = useInvalidate(businessId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ entryId, input }: { entryId: string; input: ReceiptInput }) =>
      apiFetch<CommissionReceipt>(`${base(slug)}/${encodeURIComponent(entryId)}/receipts`, {
        method: 'POST',
        body: input,
      }),
    onSuccess: (_, { entryId }) =>
      Promise.all([
        refresh(...COMMISSION_RECEIPT_REFRESH),
        queryClient.invalidateQueries({
          queryKey: dealershipKeys.detail(businessId, 'commissionEntry', entryId),
        }),
      ]),
  });
}

export function usePatchReceipt(slug: string, businessId: string) {
  const refresh = useInvalidate(businessId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ entryId, id, patch }: { entryId: string; id: string; patch: ReceiptPatch }) =>
      apiFetch<CommissionReceipt>(
        `${base(slug)}/${encodeURIComponent(entryId)}/receipts/${encodeURIComponent(id)}`,
        { method: 'PATCH', body: patch },
      ),
    onSuccess: (_, { entryId }) =>
      Promise.all([
        refresh(...COMMISSION_RECEIPT_REFRESH),
        queryClient.invalidateQueries({
          queryKey: dealershipKeys.detail(businessId, 'commissionEntry', entryId),
        }),
      ]),
  });
}

// ---- Summary ----

export function useCommissionSummary(slug: string, businessId: string, year: number) {
  return useQuery({
    queryKey: dealershipKeys.list(businessId, 'commissionSummary', { year }),
    queryFn: ({ signal }) =>
      apiFetch<CommissionSummary>(summaryBase(slug), { query: { year }, signal }),
    staleTime: 2 * 60_000,
    placeholderData: keepPreviousData,
  });
}
