'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/core/api/client';
import { dealershipKeys } from '../master-data/api';
import type { Page } from '../master-data/types';
import type { CommissionEntry, CommissionSummary, EntryInput, EntryPatch } from './types';

const base = (slug: string) => `/b/${encodeURIComponent(slug)}/commission-entries`;
const summaryBase = (slug: string) => `/b/${encodeURIComponent(slug)}/commission-summary`;

/**
 * An entry changes its own list, the yearly total, and the dashboard figures that add commission
 * received (net profit, the commission chart and Key Information).
 */
export const COMMISSION_ENTRY_REFRESH = [
  'commissionEntries',
  'commissionSummary',
  'dashboardFinance',
  'dashboardCommission',
] as const;

function useInvalidate(businessId: string) {
  const queryClient = useQueryClient();
  return (...entities: string[]) =>
    Promise.all(
      entities.map((entity) =>
        queryClient.invalidateQueries({ queryKey: dealershipKeys.entity(businessId, entity) }),
      ),
    );
}

export function useCommissionEntries(slug: string, businessId: string, page: number) {
  return useQuery({
    queryKey: dealershipKeys.list(businessId, 'commissionEntries', { page }),
    queryFn: ({ signal }) =>
      apiFetch<Page<CommissionEntry>>(base(slug), { query: { page }, signal }),
    placeholderData: keepPreviousData,
  });
}

/** `POST commission-entries` with one Idempotency-Key per open form. */
export function useCreateEntry(slug: string, businessId: string) {
  const refresh = useInvalidate(businessId);
  return useMutation({
    mutationFn: ({ input, idempotencyKey }: { input: EntryInput; idempotencyKey: string }) =>
      apiFetch<CommissionEntry>(base(slug), {
        method: 'POST',
        body: input,
        headers: { 'Idempotency-Key': idempotencyKey },
      }),
    onSuccess: () => refresh(...COMMISSION_ENTRY_REFRESH),
  });
}

/** `PATCH commission-entries/:id`: only the fields that changed. */
export function usePatchEntry(slug: string, businessId: string) {
  const refresh = useInvalidate(businessId);
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: EntryPatch }) =>
      apiFetch<CommissionEntry>(`${base(slug)}/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: patch,
      }),
    onSuccess: () => refresh(...COMMISSION_ENTRY_REFRESH),
  });
}

export function useCommissionSummary(slug: string, businessId: string, year: number) {
  return useQuery({
    queryKey: dealershipKeys.list(businessId, 'commissionSummary', { year }),
    queryFn: ({ signal }) =>
      apiFetch<CommissionSummary>(summaryBase(slug), { query: { year }, signal }),
    staleTime: 2 * 60_000,
    placeholderData: keepPreviousData,
  });
}
