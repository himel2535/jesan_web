/** Shapes of the Settings API (docs/API.md §8). */
export interface PermissionDef {
  key: string;
  module: string;
  /** Platform-owner only: cannot be given to any role. */
  ownerOnly: boolean;
}

export interface RoleDef {
  key: string;
  nameEn: string;
  nameBn: string;
  /** The `owner` role: its permissions cannot be changed. */
  locked: boolean;
  permissions: string[];
}

export interface RolesMatrix {
  /** In declaration order: the row order of the matrix. */
  permissions: PermissionDef[];
  /** In column order. */
  roles: RoleDef[];
}

export interface RoleUpdateResult {
  role: string;
  added: string[];
  removed: string[];
}

export interface SettingsUser {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  isActive: boolean;
  /** Documented in §8; the UI shows the column only when the API actually sends the field. */
  lastLoginAt?: string | null;
  /** Role key in this business. */
  role: string;
}

export interface UsersPage {
  items: SettingsUser[];
  page: number;
  pageSize: number;
  total: number;
}

export interface CreateUserInput {
  name: string;
  email?: string;
  phone?: string;
  password: string;
  roleKey: string;
}

/**
 * Roles offered when creating a user or changing a role. Fixed from docs/API.md §10 because users
 * with only `users.view` cannot read the roles endpoint. `owner` is left out on purpose: the API
 * does not say it may be assigned (DECISIONS.md, API gap 4).
 */
export const ASSIGNABLE_ROLE_KEYS = ['manager', 'accountant', 'salesman'] as const;
