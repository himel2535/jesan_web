import { focusManager, QueryClient } from '@tanstack/react-query';
import { act, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Me } from '@/core/auth/types';
import {
  MANAGER_PERMISSIONS,
  OWNER_PERMISSIONS,
  business,
  managerMe,
} from '../../../test/fixtures/me';
import { json, mockApi, renderInBusiness } from '../../../test/settings-utils';
import { PENDING_COUNT_INTERVAL_MS, refreshAfterChange } from './api';
import { withApprovalsEntry } from './nav';
import { PendingApprovalsBadge } from './pending-badge';

const meWith = (permissions: string[]): Me => ({
  ...managerMe,
  businesses: [business({ permissions })],
});
const COUNT = 'GET /b/example-cement/change-requests/pending-count';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  act(() => focusManager.setFocused(undefined));
});

describe('sidebar entry', () => {
  const items = [
    { key: 'products', label: 'Products', href: '/b/x/products', icon: 'package' as const },
    { key: 'settings', label: 'Settings', href: '/b/x/settings', icon: 'settings' as const },
  ];
  it('goes before Settings with change.view.own or change.view.all; absent otherwise', () => {
    const own = withApprovalsEntry(items, { slug: 'x', permissions: ['change.view.own'] }, 'A');
    expect(own.map((i) => i.key)).toEqual(['products', 'approvals', 'settings']);
    expect(own[1]).toMatchObject({ href: '/b/x/approvals', badge: 'pendingApprovals' });
    expect(
      withApprovalsEntry(items, { slug: 'x', permissions: ['change.view.all'] }, 'A'),
    ).toHaveLength(3);
    expect(withApprovalsEntry(items, { slug: 'x', permissions: ['product.view'] }, 'A')).toBe(
      items,
    );
  });
});

describe('refreshAfterChange', () => {
  const keys = {
    all: ['dealership', 'b1', 'change-requests'],
    entity: (e: string) => ['dealership', 'b1', e],
  } as unknown as Parameters<typeof refreshAfterChange>[1];
  const entities = {
    product: { path: 'products/:id', invalidate: ['products'] },
    product_category: { path: 'products/categories/:id', invalidate: ['categories', 'products'] },
  };

  it('only the requests, plus the changed record’s entities after an approval', async () => {
    const client = new QueryClient();
    const spy = vi.spyOn(client, 'invalidateQueries');
    await refreshAfterChange(client, keys, entities, null);
    expect(spy.mock.calls.map(([f]) => f?.queryKey)).toEqual([
      ['dealership', 'b1', 'change-requests'],
    ]);
    spy.mockClear();
    await refreshAfterChange(client, keys, entities, 'product_category');
    expect(spy.mock.calls.map(([f]) => f?.queryKey)).toEqual([
      ['dealership', 'b1', 'change-requests'],
      ['dealership', 'b1', 'categories'],
      ['dealership', 'b1', 'products'],
    ]);
  });
});

describe('<PendingApprovalsBadge>', () => {
  it('owner: shows the count, refetches every 60 s, not while the tab is hidden, at once when shown', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let count = 3;
    const { calls } = mockApi({ [COUNT]: () => json(200, { count }) });
    renderInBusiness(<PendingApprovalsBadge />, { me: meWith(OWNER_PERMISSIONS) });
    expect(await screen.findByText('3 pending requests')).toBeInTheDocument();
    expect(calls).toHaveLength(1);

    count = 4;
    await act(() => vi.advanceTimersByTimeAsync(PENDING_COUNT_INTERVAL_MS));
    expect(await screen.findByText('4 pending requests')).toBeInTheDocument();
    expect(calls).toHaveLength(2);

    act(() => focusManager.setFocused(false));
    await act(() => vi.advanceTimersByTimeAsync(PENDING_COUNT_INTERVAL_MS * 3));
    expect(calls).toHaveLength(2);

    count = 5;
    act(() => focusManager.setFocused(true));
    expect(await screen.findByText('5 pending requests')).toBeInTheDocument();
    expect(calls).toHaveLength(3);
  });

  it('nothing without change.view.all (no request at all), and nothing at zero', async () => {
    const { calls } = mockApi({ [COUNT]: () => json(200, { count: 0 }) });
    const { container, unmount } = renderInBusiness(<PendingApprovalsBadge />, {
      me: meWith([...MANAGER_PERMISSIONS, 'change.request', 'change.view.own']),
    });
    await act(() => Promise.resolve());
    expect(container).toBeEmptyDOMElement();
    expect(calls).toHaveLength(0);
    unmount();

    renderInBusiness(<PendingApprovalsBadge />, { me: meWith(OWNER_PERMISSIONS) });
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    expect(screen.queryByText(/pending requests/)).not.toBeInTheDocument();
  });
});
