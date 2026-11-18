'use client';

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { useCallback } from 'react';
import { useCan } from '@/core/auth/can';
import { useCurrentBusiness } from '@/core/auth/session-context';
import { apiFetch } from '@/core/api/client';
import { ApiError } from '@/core/api/errors';
import { createModuleKeys } from '@/core/api/query-keys';
import type { ChangeEntityConfig } from '@/core/module-system/types';
import { useChangeEntities } from './context';
import type {
  ChangeListFilters,
  ChangePreview,
  ChangeRequest,
  ChangeRequestInput,
  ChangeRequestPage,
} from './types';

export const ENTITY = 'change-requests';
/** Badge refresh: every 60 s while the tab is visible (never in the background). */
export const PENDING_COUNT_INTERVAL_MS = 60_000;

const base = (slug: string) => `/b/${encodeURIComponent(slug)}/change-requests`;

/**
 * Keys under the business module: [type, businessId, 'change-requests', …] (CLAUDE.md), so a
 * business's requests live next to the records they change.
 */
export function useApprovalKeys() {
  const business = useCurrentBusiness();
  const type = business?.type ?? 'core';
  const businessId = business?.id ?? '';
  const keys = createModuleKeys(type);
  return {
    businessId,
    all: keys.entity(businessId, ENTITY),
    list: (scope: 'mine' | 'all', filters: ChangeListFilters) =>
      keys.list(businessId, ENTITY, { scope, ...filters }),
    detail: (id: string) => keys.detail(businessId, ENTITY, id),
    count: [...keys.entity(businessId, ENTITY), 'count'] as const,
    entity: (entity: string) => keys.entity(businessId, entity),
  };
}

type Keys = ReturnType<typeof useApprovalKeys>;

/** After a decision or a new request: the requests (lists, details, badge) and, on approval, the changed record's entities. */
export function refreshAfterChange(
  queryClient: QueryClient,
  keys: Keys,
  entities: Readonly<Record<string, ChangeEntityConfig>>,
  entityType: string | null,
) {
  const jobs = [queryClient.invalidateQueries({ queryKey: keys.all })];
  for (const entity of (entityType && entities[entityType]?.invalidate) || []) {
    jobs.push(queryClient.invalidateQueries({ queryKey: keys.entity(entity) }));
  }
  return Promise.all(jobs);
}

export function useChangeRequests(slug: string, scope: 'mine' | 'all', filters: ChangeListFilters) {
  const keys = useApprovalKeys();
  return useQuery({
    queryKey: keys.list(scope, filters),
    queryFn: ({ signal }) =>
      apiFetch<ChangeRequestPage>(scope === 'mine' ? `${base(slug)}/mine` : base(slug), {
        query: {
          status: filters.status,
          entityType: scope === 'all' ? filters.entityType : undefined,
          entityId: scope === 'all' ? filters.entityId : undefined,
          page: filters.page,
        },
        signal,
      }),
    placeholderData: keepPreviousData,
  });
}

export function useChangeRequest(slug: string, id: string) {
  const keys = useApprovalKeys();
  return useQuery({
    queryKey: keys.detail(id),
    queryFn: ({ signal }) =>
      apiFetch<ChangeRequest>(`${base(slug)}/${encodeURIComponent(id)}`, { signal }),
  });
}

/**
 * The sidebar badge (only with `change.view.all`). A deliberate exception to "the sidebar fetches
 * nothing" (DECISIONS.md): one small number, every 60 s while the tab is visible, at once when it
 * becomes visible again, and after any decision or new request (they invalidate this key).
 */
export function usePendingCount(slug: string) {
  const keys = useApprovalKeys();
  const enabled = useCan('change.view.all');
  return useQuery({
    queryKey: keys.count,
    queryFn: ({ signal }) => apiFetch<{ count: number }>(`${base(slug)}/pending-count`, { signal }),
    enabled,
    staleTime: 0,
    refetchInterval: PENDING_COUNT_INTERVAL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: 'always',
    select: (data) => data.count,
  });
}

/** `POST preview`: the effect before sending; writes nothing, so nothing to refresh. */
export function usePreviewChange(slug: string) {
  return useMutation({
    mutationFn: (input: Omit<ChangeRequestInput, 'reason'>) =>
      apiFetch<ChangePreview>(`${base(slug)}/preview`, { method: 'POST', body: input }),
  });
}

/**
 * `POST /` with an `Idempotency-Key` made once per open form: a repeat (double click, retry after
 * a network error) returns the same request instead of a second one.
 */
export function useSubmitChange(slug: string) {
  const queryClient = useQueryClient();
  const keys = useApprovalKeys();
  const entities = useChangeEntities();
  return useMutation({
    mutationFn: ({
      input,
      idempotencyKey,
    }: {
      input: ChangeRequestInput;
      idempotencyKey: string;
    }) =>
      apiFetch<ChangeRequest>(base(slug), {
        method: 'POST',
        body: input,
        headers: { 'Idempotency-Key': idempotencyKey },
      }),
    onSuccess: () => refreshAfterChange(queryClient, keys, entities, null),
  });
}

export type Decision = 'approve' | 'reject' | 'cancel';

/**
 * Approve / reject / cancel. Afterwards only the requests refresh — plus, after an approval, the
 * changed record's entities. A 409 (already decided or stale) also refreshes the request.
 */
export function useDecide(slug: string) {
  const queryClient = useQueryClient();
  const keys = useApprovalKeys();
  const entities = useChangeEntities();
  const refresh = useCallback(
    (entityType: string | null) => refreshAfterChange(queryClient, keys, entities, entityType),
    [queryClient, keys, entities],
  );
  return useMutation({
    mutationFn: ({
      request,
      decision,
      note,
    }: {
      request: ChangeRequest;
      decision: Decision;
      note?: string;
    }) =>
      apiFetch<ChangeRequest>(`${base(slug)}/${encodeURIComponent(request.id)}/${decision}`, {
        method: 'POST',
        body: decision === 'cancel' ? {} : note ? { note } : {},
      }),
    onSuccess: (_data, { request, decision }) =>
      refresh(decision === 'approve' ? request.entityType : null),
    onError: (error) =>
      error instanceof ApiError && (error.status === 409 || error.status === 404)
        ? refresh(null)
        : undefined,
  });
}

/** A fresh Idempotency-Key (8–64 of A-Z a-z 0-9 _ -); a UUID fits. */
export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}
