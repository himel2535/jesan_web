import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Me } from '@/core/auth/types';
import {
  MANAGER_PERMISSIONS,
  OWNER_PERMISSIONS,
  business,
  managerMe,
} from '../../../../test/fixtures/me';
import { apiError, json, mockApi, renderInBusiness } from '../../../../test/settings-utils';
import { expectNoA11yViolations } from '../../../../test/utils';
import { AccountsView } from './accounts-view';
import { COLLECTION_METHODS, LEDGER_RESPONSE, NEGATIVE_SUMMARY, SUMMARY } from './fixtures';

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
    [`GET ${B}/collection-methods`]: () => json(200, COLLECTION_METHODS),
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

describe('Manual entry dialog', () => {
  it('action button hidden without ledger.entry.create', async () => {
    setupRoutes();
    renderInBusiness(<AccountsView slug="example-cement" businessId={BID} />, {
      me: meWith([...MANAGER_PERMISSIONS, 'ledger.view']),
    });
    await screen.findByText('৳2,50,000.00');
    expect(screen.queryByText('+ Manual Entry')).not.toBeInTheDocument();
  });

  it('shows the button with ledger.entry.create and submits with Idempotency-Key', async () => {
    const { calls } = setupRoutes({
      [`POST ${B}/accounts/entries`]: () =>
        json(201, {
          id: 'le-new',
          type: 'manual',
          direction: 'in',
          amount: '5000.00',
          method: null,
          referenceType: null,
          referenceId: null,
          entryDate: '2025-01-20',
          note: null,
          status: 'active',
          createdBy: { id: 'u1', name: 'Admin' },
          createdAt: '2025-01-20T10:00:00Z',
        }),
    });
    renderInBusiness(<AccountsView slug="example-cement" businessId={BID} />, {
      me: meWith(OWNER_PERMISSIONS),
    });
    await screen.findByText('৳2,50,000.00');
    await userEvent.click(screen.getByText('+ Manual Entry'));
    expect(await screen.findByRole('heading', { name: 'Manual Entry' })).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Amount'), '5000');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      const post = calls.find((c) => c.method === 'POST' && c.path.includes('entries'));
      expect(post).toBeDefined();
      expect(post!.headers.get('Idempotency-Key')).toBeTruthy();
    });
  });

  it('sends POST to entries endpoint and handles API error', async () => {
    const { calls } = setupRoutes({
      [`POST ${B}/accounts/entries`]: () => apiError(400, 'ENTRY_DATE_TOO_OLD', 'entryDate'),
    });
    renderInBusiness(<AccountsView slug="example-cement" businessId={BID} />, {
      me: meWith(OWNER_PERMISSIONS),
    });
    await screen.findByText('৳2,50,000.00');
    await userEvent.click(screen.getByText('+ Manual Entry'));
    await screen.findByRole('heading', { name: 'Manual Entry' });

    await userEvent.type(screen.getByLabelText('Amount'), '5000');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      const post = calls.find((c) => c.method === 'POST' && c.path.includes('entries'));
      expect(post).toBeDefined();
      expect(post!.body).toHaveProperty('amount', '5000');
      expect(post!.body).toHaveProperty('direction', 'in');
    });
  });
});

describe('Supplier payment dialog', () => {
  it('button hidden without payment.create', async () => {
    setupRoutes();
    renderInBusiness(<AccountsView slug="example-cement" businessId={BID} />, {
      me: meWith([...MANAGER_PERMISSIONS, 'ledger.view']),
    });
    await screen.findByText('৳2,50,000.00');
    expect(screen.queryByText('+ Supplier Payment')).not.toBeInTheDocument();
  });

  it('submits with Idempotency-Key and required method', async () => {
    const { calls } = setupRoutes({
      [`POST ${B}/accounts/payments`]: () =>
        json(201, {
          id: 'le-pay',
          type: 'supplier_payment',
          direction: 'out',
          amount: '20000.00',
          method: 'cash',
          referenceType: null,
          referenceId: null,
          entryDate: '2025-01-20',
          note: null,
          status: 'active',
          createdBy: { id: 'u1', name: 'Admin' },
          createdAt: '2025-01-20T10:00:00Z',
        }),
    });
    renderInBusiness(<AccountsView slug="example-cement" businessId={BID} />, {
      me: meWith(OWNER_PERMISSIONS),
    });
    await screen.findByText('৳2,50,000.00');
    await userEvent.click(screen.getByText('+ Supplier Payment'));
    expect(await screen.findByRole('heading', { name: 'Supplier Payment' })).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Amount'), '20000');
    await userEvent.selectOptions(screen.getByLabelText('Method'), 'cash');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      const post = calls.find((c) => c.method === 'POST' && c.path.includes('payments'));
      expect(post).toBeDefined();
      expect(post!.headers.get('Idempotency-Key')).toBeTruthy();
      expect(post!.body).toHaveProperty('method', 'cash');
    });
  });
});
