'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/core/api/client';
import { ApiError } from '@/core/api/errors';
import { createModuleKeys } from '@/core/api/query-keys';
import type { CreateUserInput, RoleUpdateResult, RolesMatrix, UsersPage } from './types';

/**
 * Query keys: ['settings', businessId, entity, …] (CLAUDE.md). A change invalidates only its own
 * entity of its own business — never the whole cache.
 */
export const settingsKeys = createModuleKeys('settings');

const base = (slug: string) => `/b/${encodeURIComponent(slug)}`;

export function useRolesMatrix(slug: string, businessId: string) {
  return useQuery({
    queryKey: settingsKeys.entity(businessId, 'roles'),
    queryFn: ({ signal }) => apiFetch<RolesMatrix>(`${base(slug)}/roles/permissions`, { signal }),
  });
}

export function saveRolePermissions(slug: string, roleKey: string, permissions: string[]) {
  return apiFetch<RoleUpdateResult>(
    `${base(slug)}/roles/${encodeURIComponent(roleKey)}/permissions`,
    { method: 'PUT', body: { permissions } },
  );
}

export function useUsers(slug: string, businessId: string, page: number) {
  return useQuery({
    queryKey: settingsKeys.list(businessId, 'users', { page }),
    queryFn: ({ signal }) =>
      apiFetch<UsersPage>(`${base(slug)}/users`, { query: { page }, signal }),
    // Keep the current page on screen while the next one loads.
    placeholderData: keepPreviousData,
  });
}

/**
 * User changes refresh only this business's user list (all its pages). A 404 ("user not found")
 * also refreshes it, since the list on screen is out of date.
 */
function useUsersMutation<TInput, TResult>(
  slug: string,
  businessId: string,
  run: (base: string, input: TInput) => Promise<TResult>,
  { invalidate = true }: { invalidate?: boolean } = {},
) {
  const queryClient = useQueryClient();
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: settingsKeys.entity(businessId, 'users') });
  return useMutation({
    mutationFn: (input: TInput) => run(base(slug), input),
    onSuccess: () => (invalidate ? refresh() : undefined),
    onError: (error) => (error instanceof ApiError && error.status === 404 ? refresh() : undefined),
  });
}

export function useCreateUser(slug: string, businessId: string) {
  return useUsersMutation(slug, businessId, (b, input: CreateUserInput) =>
    apiFetch<{ id: string; role: string }>(`${b}/users`, { method: 'POST', body: input }),
  );
}

export function useChangeRole(slug: string, businessId: string) {
  return useUsersMutation(slug, businessId, (b, input: { userId: string; roleKey: string }) =>
    apiFetch(`${b}/users/${encodeURIComponent(input.userId)}/role`, {
      method: 'PATCH',
      body: { roleKey: input.roleKey },
    }),
  );
}

export function useRemoveAccess(slug: string, businessId: string) {
  return useUsersMutation(slug, businessId, (b, input: { userId: string }) =>
    apiFetch(`${b}/users/${encodeURIComponent(input.userId)}/access`, { method: 'DELETE' }),
  );
}

export function useSetUserStatus(slug: string, businessId: string) {
  return useUsersMutation(slug, businessId, (b, input: { userId: string; isActive: boolean }) =>
    apiFetch(`${b}/users/${encodeURIComponent(input.userId)}/status`, {
      method: 'PATCH',
      body: { isActive: input.isActive },
    }),
  );
}

/** Nothing in the list changes on a reset, so no refetch. */
export function useResetPassword(slug: string, businessId: string) {
  return useUsersMutation(
    slug,
    businessId,
    (b, input: { userId: string; newPassword: string }) =>
      apiFetch(`${b}/users/${encodeURIComponent(input.userId)}/reset-password`, {
        method: 'POST',
        body: { newPassword: input.newPassword },
      }),
    { invalidate: false },
  );
}
