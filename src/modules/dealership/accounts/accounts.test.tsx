import { screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Me } from '@/core/auth/types';
import { OWNER_PERMISSIONS, business, managerMe } from '../../../../test/fixtures/me';
import { json, mockApi, renderInBusiness } from '../../../../test/settings-utils';
import { expectNoA11yViolations } from '../../../../test/utils';
import { AccountsView } from './accounts-view';
import { LEDGER_RESPONSE, NEGATIVE_SUMMARY, SUMMARY } from './fixtures';

const B = '/b/example-cement';
const BID = 'b1';

const nav = vi.hoisted(() => ({
  search: '',
  replace: vi.fn(),
}));
vi.mock('next/navigation', () => ({
  usePathname: () => '/b/example-cement/accounts',
  useSearchParams: () => new URLSearchParams(nav.search),
  useRouter: () => ({ replace: nav.replace }),
}));
beforeEach(() => {
  nav.search = '';
  nav.replace.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

const meWith = (permissions: string[]): Me => ({
  ...managerMe,
  businesses: [business({ permissions })],
});

function setupRoutes(overrides: Record<string, () => Response> = {}) {
  return mockApi({
    [`GET ${B}/accounts/summary`]: () => json(200, SUMMARY),
    [`GET ${B}/accounts/ledger`]: () => json(200, LEDGER_RESPONSE),
    ...overrides,
  });
}

describe('Summary cards', () => {
  it('shows 5 KPI cards with correct money values', async () => {
    setupRoutes();
    const { container } = renderInBusiness(
      <AccountsView slug="example-cement" businessId={BID} />,
      { me: meWith(OWNER_PERMISSIONS) },
    );
    expect(await screen.findByText('৳2,50,000.00')).toBeInTheDocument();
    expect(screen.getByText('৳1,80,000.00')).toBeInTheDocument();
    expect(screen.getByText('৳70,000.00')).toBeInTheDocument();
    expect(screen.getByText('৳45,000.00')).toBeInTheDocument();
    expect(screen.getByText('৳12,000.00')).toBeInTheDocument();
    expect(screen.queryByText('+ Manual Entry')).not.toBeInTheDocument();
    expect(screen.queryByText('+ Supplier Payment')).not.toBeInTheDocument();
    await expectNoA11yViolations(container);
  });

  it('shows a negative net with a minus sign, not an advance badge', async () => {
    setupRoutes({
      [`GET ${B}/accounts/summary`]: () => json(200, NEGATIVE_SUMMARY),
    });
    renderInBusiness(<AccountsView slug="example-cement" businessId={BID} />, {
      me: meWith(OWNER_PERMISSIONS),
    });
    expect(await screen.findByText('-৳5,000.00')).toBeInTheDocument();
    expect(screen.queryByText('Advance')).not.toBeInTheDocument();
  });
});

describe('Ledger table', () => {
  it('renders ledger rows from the API', async () => {
    setupRoutes();
    const { container } = renderInBusiness(
      <AccountsView slug="example-cement" businessId={BID} />,
      { me: meWith(OWNER_PERMISSIONS) },
    );
    expect(await screen.findByText('Monthly collection')).toBeInTheDocument();
    expect(screen.getByText('৳50,000.00')).toBeInTheDocument();
    expect(screen.getByText('৳10,000.00')).toBeInTheDocument();
    await expectNoA11yViolations(container);
  });

  it('void rows have line-through styling', async () => {
    setupRoutes();
    renderInBusiness(<AccountsView slug="example-cement" businessId={BID} />, {
      me: meWith(OWNER_PERMISSIONS),
    });
    expect(await screen.findByText('Misc income')).toBeInTheDocument();
    const voidRow = screen.getByText('Misc income').closest('tr')!;
    expect(voidRow.className).toMatch(/line-through/);
  });
});
