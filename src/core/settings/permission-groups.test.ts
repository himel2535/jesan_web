import { describe, expect, it } from 'vitest';
import bn from '../../../messages/bn.json';
import en from '../../../messages/en.json';
import { ALL_PERMISSION_KEYS, rolesMatrix } from '../../../test/settings-utils';
import { MANAGER_PERMISSIONS, OWNER_PERMISSIONS } from '../../../test/fixtures/me';
import { settingsSections } from './access';
import { groupPermissions, isCellEditable, pendingChanges } from './permission-groups';

const matrix = rolesMatrix();
const order = matrix.permissions.map((p) => p.key);

describe('groupPermissions', () => {
  it('groups by module, then subject, in API order', () => {
    const modules = groupPermissions(matrix.permissions);
    expect(modules.map((m) => m.module)).toEqual(['core', 'dealership']);
    expect(modules[0]!.groups.map((g) => g.subject)).toEqual([
      'settings',
      'users',
      'roles',
      'audit',
    ]);
    const sale = modules[1]!.groups.find((g) => g.subject === 'sale')!;
    expect(sale.items.map((p) => p.key)).toEqual([
      'sale.create',
      'sale.view.all',
      'sale.view.own',
      'sale.void',
    ]);
  });
});

describe('pendingChanges', () => {
  const manager = matrix.roles[1]!;

  it('lists added and removed per role, full list in API order', () => {
    const edits = {
      manager: [...manager.permissions.filter((p) => p !== 'users.view'), 'sale.void'],
    };
    const [change] = pendingChanges(matrix.roles, edits, order);
    expect(change).toMatchObject({ added: ['sale.void'], removed: ['users.view'] });
    expect(change!.role.key).toBe('manager');
    expect(change!.permissions.indexOf('settings.view')).toBeLessThan(
      change!.permissions.indexOf('sale.void'),
    );
  });

  it('ignores edits that end equal to the server, and the locked owner role', () => {
    expect(
      pendingChanges(matrix.roles, { manager: [...manager.permissions].reverse() }, order),
    ).toEqual([]);
    expect(pendingChanges(matrix.roles, { owner: [] }, order)).toEqual([]);
  });

  it('cells: owner role locked, owner-only rows never editable', () => {
    const commission = matrix.permissions.find((p) => p.key === 'commission.view')!;
    const product = matrix.permissions.find((p) => p.key === 'product.view')!;
    expect(isCellEditable(matrix.roles[0]!, product)).toBe(false);
    expect(isCellEditable(manager, commission)).toBe(false);
    expect(isCellEditable(manager, product)).toBe(true);
  });
});

describe('settings sections by permission (UI only)', () => {
  it('owner sees everything; manager sees users only; accountant sees nothing; salesman no settings', () => {
    expect(settingsSections(OWNER_PERMISSIONS)).toEqual({ any: true, users: true, roles: true });
    expect(settingsSections(MANAGER_PERMISSIONS)).toEqual({ any: true, users: true, roles: false });
    expect(settingsSections(['settings.view'])).toEqual({ any: true, users: false, roles: false });
    expect(settingsSections(['sale.create'])).toEqual({ any: false, users: false, roles: false });
  });
});

describe('permission labels', () => {
  it.each([
    ['en', en],
    ['bn', bn],
  ] as const)(
    '%s has a label for every permission in docs/API.md and every subject',
    (_l, messages) => {
      const items = messages.permissions.items as Record<string, string>;
      const subjects = messages.permissions.subjects as Record<string, string>;
      for (const key of ALL_PERMISSION_KEYS) {
        expect(items[key.replaceAll('.', '_')], key).toBeTruthy();
        expect(subjects[key.split('.')[0]!], key).toBeTruthy();
      }
      expect(Object.keys(messages.permissions.modules)).toEqual(['core', 'dealership']);
    },
  );
});
