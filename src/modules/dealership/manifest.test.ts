import { describe, expect, it } from 'vitest';
import { can } from '@/core/auth/permissions';
import { dealershipManifest } from './manifest';
import { getModuleManifest } from '@/modules/registry';
import {
  MANAGER_PERMISSIONS,
  OWNER_PERMISSIONS,
  SALESMAN_PERMISSIONS,
  business,
} from '../../../test/fixtures/me';
import { buildBusinessNav, findNavEntry } from '@/core/module-system/business-nav';

const keys = (permissions: string[]) =>
  buildBusinessNav(dealershipManifest, business({ permissions }), (key) => key).map((i) => i.key);

describe('can (UI hint only)', () => {
  it('handles single, anyOf and allOf rules', () => {
    expect(can(['a'], 'a')).toBe(true);
    expect(can(['a'], 'b')).toBe(false);
    expect(can(['b'], { anyOf: ['a', 'b'] })).toBe(true);
    expect(can(['a'], { allOf: ['a', 'b'] })).toBe(false);
    expect(can([], undefined)).toBe(true);
  });
});

describe('dealership sidebar by permission', () => {
  it('manager: no commission, no reports (owner-only / finance permissions)', () => {
    expect(keys(MANAGER_PERMISSIONS)).toEqual([
      'dashboard',
      'products',
      'customers',
      'suppliers',
      'purchases',
      'sales',
      'stock',
      'settings',
    ]);
  });

  it('platform owner: everything, in the proposal order', () => {
    expect(keys(OWNER_PERMISSIONS)).toEqual([
      'dashboard',
      'products',
      'customers',
      'suppliers',
      'purchases',
      'sales',
      'stock',
      'accounts',
      'commission',
      'reports',
      'settings',
    ]);
  });

  it('salesman sees Sales through sale.view.own; no permissions → only the dashboard', () => {
    expect(keys(SALESMAN_PERMISSIONS)).toEqual([
      'dashboard',
      'products',
      'customers',
      'sales',
      'stock',
    ]);
    expect(keys([])).toEqual(['dashboard']);
  });

  it('builds /b/[slug] links; only the dashboard is matched exactly', () => {
    const nav = buildBusinessNav(
      dealershipManifest,
      business({ permissions: OWNER_PERMISSIONS }),
      (k) => `L:${k}`,
    );
    expect(nav[0]).toMatchObject({ href: '/b/example-cement', exact: true, label: 'L:dashboard' });
    expect(nav.find((i) => i.key === 'sales')).toMatchObject({
      href: '/b/example-cement/sales',
      exact: false,
    });
  });

  it('finds feature entries by path; unknown paths and the dashboard are not features', () => {
    expect(findNavEntry(dealershipManifest, ['sales'])?.key).toBe('sales');
    expect(findNavEntry(dealershipManifest, ['nope'])).toBeUndefined();
    expect(findNavEntry(dealershipManifest, [])).toBeUndefined();
  });

  it('the registry maps business types to modules', () => {
    expect(getModuleManifest('dealership')).toBe(dealershipManifest);
    expect(getModuleManifest('manufacturing')).toBeUndefined();
  });
});
