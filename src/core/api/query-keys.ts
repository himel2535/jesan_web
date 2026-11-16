/**
 * Query-key rules (proposal §9.2, rule 1):
 * - Every key starts with the module name, then the businessId: [module, businessId, entity, …].
 * - After a mutation, invalidate only the keys it directly affects (e.g. a sale: sales list,
 *   that customer's balance, today's dashboard summary, stock). Never products/settings.
 * - Calling invalidateQueries()/refetchQueries()/resetQueries() without a filter is blocked by ESLint.
 */
export type ListParams = Record<string, string | number | boolean | null | undefined>;

export function createModuleKeys<const M extends string>(module: M) {
  return {
    /** Everything of this module, across businesses. Use sparingly. */
    all: [module] as const,
    business: (businessId: string) => [module, businessId] as const,
    entity: <const E extends string>(businessId: string, entity: E) =>
      [module, businessId, entity] as const,
    list: <const E extends string>(businessId: string, entity: E, params: ListParams = {}) =>
      [module, businessId, entity, 'list', params] as const,
    detail: <const E extends string>(businessId: string, entity: E, id: string) =>
      [module, businessId, entity, 'detail', id] as const,
  };
}

/** Keys owned by core (not tied to a business module). */
export const coreKeys = {
  health: ['core', 'health'] as const,
};
