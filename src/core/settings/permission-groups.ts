import type { PermissionDef, RoleDef } from './types';

export interface PermissionGroup {
  /** Subject = the key's first part: `sale` for `sale.view.all`. */
  subject: string;
  items: PermissionDef[];
}

export interface ModuleGroup {
  module: string;
  groups: PermissionGroup[];
}

/** Groups by module, then subject, keeping the API's order (first appearance wins). */
export function groupPermissions(permissions: readonly PermissionDef[]): ModuleGroup[] {
  const modules: ModuleGroup[] = [];
  for (const permission of permissions) {
    let moduleGroup = modules.find((m) => m.module === permission.module);
    if (!moduleGroup) {
      moduleGroup = { module: permission.module, groups: [] };
      modules.push(moduleGroup);
    }
    const subject = permission.key.split('.')[0] ?? permission.key;
    let group = moduleGroup.groups.find((g) => g.subject === subject);
    if (!group) {
      group = { subject, items: [] };
      moduleGroup.groups.push(group);
    }
    group.items.push(permission);
  }
  return modules;
}

/** Translation keys; dots in permission keys become underscores (dots nest in next-intl). */
export const permissionLabelKey = (key: string) => `permissions.items.${key.replaceAll('.', '_')}`;
export const subjectLabelKey = (subject: string) => `permissions.subjects.${subject}`;
export const moduleLabelKey = (module: string) => `permissions.modules.${module}`;

export interface RoleChange {
  role: RoleDef;
  /** The full list to PUT (the API replaces, it does not add or subtract). */
  permissions: string[];
  added: string[];
  removed: string[];
}

/**
 * Pending changes per role, in column order. `edits` holds only roles the user touched; a role
 * whose edit ends up equal to the server's list is not a change.
 */
export function pendingChanges(
  roles: readonly RoleDef[],
  edits: Readonly<Record<string, readonly string[]>>,
  order: readonly string[],
): RoleChange[] {
  const rank = (key: string) => {
    const index = order.indexOf(key);
    return index === -1 ? Number.MAX_SAFE_INTEGER : index;
  };
  const changes: RoleChange[] = [];
  for (const role of roles) {
    const edit = edits[role.key];
    if (!edit || role.locked) continue;
    const before = new Set(role.permissions);
    const after = new Set(edit);
    const added = [...after].filter((p) => !before.has(p)).sort((a, b) => rank(a) - rank(b));
    const removed = [...before].filter((p) => !after.has(p)).sort((a, b) => rank(a) - rank(b));
    if (added.length || removed.length) {
      changes.push({
        role,
        permissions: [...after].sort((a, b) => rank(a) - rank(b)),
        added,
        removed,
      });
    }
  }
  return changes;
}

/** Whether a cell can be ticked: never for the locked owner role, never for owner-only rows. */
export function isCellEditable(role: RoleDef, permission: PermissionDef): boolean {
  return !role.locked && !permission.ownerOnly;
}
