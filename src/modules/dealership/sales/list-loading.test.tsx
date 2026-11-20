import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { json, mockApi } from '../../../../test/settings-utils';
import { B, BID, orderSummary, page } from './fixtures';
import { useOrders } from './api';

vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }));

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

/**
 * Changing a filter or a page must never blank the list: `keepPreviousData` keeps the rows that
 * are already on screen and the component only dims them (`isPlaceholderData` → `opacity-60`),
 * so the user never sees a skeleton a second time on the same page.
 */
describe('list queries keep the previous rows', () => {
  it('serves the old page while the new one loads, then swaps', async () => {
    let answer: () => Response | Promise<Response> = () =>
      json(200, page([orderSummary({ id: 'o1', code: 'ORD-0001' })]));
    mockApi({ [`GET ${B}/orders`]: () => answer() });

    const { result, rerender } = renderHook(
      ({ pageNumber }: { pageNumber: number }) =>
        useOrders('example-cement', BID, { page: pageNumber }),
      { wrapper, initialProps: { pageNumber: 1 } },
    );
    await waitFor(() => expect(result.current.data?.items[0]?.code).toBe('ORD-0001'));
    expect(result.current.isPlaceholderData).toBe(false);

    // Page 2 is a different key, and its request has not answered yet.
    let release: (value: Response) => void = () => {};
    answer = () => new Promise<Response>((resolve) => (release = resolve));
    rerender({ pageNumber: 2 });

    await waitFor(() => expect(result.current.isPlaceholderData).toBe(true));
    // The rows did not disappear, and there is nothing to show a skeleton for.
    expect(result.current.data?.items[0]?.code).toBe('ORD-0001');
    expect(result.current.isPending).toBe(false);
    expect(result.current.isFetching).toBe(true);

    release(json(200, page([orderSummary({ id: 'o2', code: 'ORD-0002' })])));
    await waitFor(() => expect(result.current.data?.items[0]?.code).toBe('ORD-0002'));
    expect(result.current.isPlaceholderData).toBe(false);
  });
});
