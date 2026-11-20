import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';
import en from '../../../messages/en.json';
import { ApiError } from '../api/errors';
import { shouldRetry } from '../api/query-client';
import { WakingNotice } from './waking-notice';

/** A client with the real retry policy, but no waiting, so the test does not sleep. */
function client() {
  return new QueryClient({
    defaultOptions: { queries: { retry: shouldRetry, retryDelay: 0, staleTime: 0 } },
  });
}

function Probe({ queryFn }: { queryFn: () => Promise<string> }) {
  useQuery({ queryKey: ['probe'], queryFn });
  return null;
}

function renderWith(queryClient: QueryClient, queryFn: () => Promise<string>) {
  return render(
    <QueryClientProvider client={queryClient}>
      <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Dhaka">
        <WakingNotice />
        <Probe queryFn={queryFn} />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

const waking = () => new ApiError({ kind: 'network', status: 0, code: 'NETWORK', message: '' });
const flush = () => act(async () => void (await new Promise((r) => setTimeout(r, 0))));

describe('<WakingNotice>', () => {
  it('says nothing while a page simply loads for the first time', async () => {
    renderWith(client(), () => Promise.resolve('ok'));
    await flush();
    expect(screen.queryByText(/waking up/)).toBeNull();
    // The live region itself is always mounted, so its first message is announced.
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('explains the wait once the first attempt failed and the next is running', async () => {
    let attempts = 0;
    let release: (value: string) => void = () => {};
    renderWith(client(), () => {
      attempts += 1;
      if (attempts === 1) return Promise.reject(waking());
      return new Promise<string>((resolve) => (release = resolve));
    });

    await flush();
    expect(attempts).toBe(2);
    expect(screen.getByRole('status')).toHaveTextContent('The server is waking up');

    await act(async () => release('ok'));
    expect(screen.queryByText(/waking up/)).toBeNull();
  });

  it('says nothing for a 4xx, which is never retried', async () => {
    renderWith(client(), () =>
      Promise.reject(
        new ApiError({ kind: 'http', status: 403, code: 'ACCESS_DENIED', message: '' }),
      ),
    );
    await flush();
    expect(screen.queryByText(/waking up/)).toBeNull();
  });
});
