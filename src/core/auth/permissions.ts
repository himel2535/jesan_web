/**
 * Permission checks for SHOWING or HIDING UI only.
 *
 * This is a convenience, not security: the real check is on the server. jesan-api answers 403
 * when a permission is missing and never sends protected fields (commission, profit, cost price).
 * Hiding a menu or button here only spares the user a page that would be refused anyway.
 */
export type PermissionRule = string | { anyOf: readonly string[] } | { allOf: readonly string[] };

export function can(permissions: readonly string[], rule: PermissionRule | undefined): boolean {
  if (rule === undefined) return true;
  if (typeof rule === 'string') return permissions.includes(rule);
  if ('anyOf' in rule) return rule.anyOf.some((p) => permissions.includes(p));
  return rule.allOf.every((p) => permissions.includes(p));
}
