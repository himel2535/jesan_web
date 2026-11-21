import { screen, within } from '@testing-library/react';
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
import { expensesReportResponse } from '../reports/fixtures';
import { B, BID, categoryRef, expense, expenseCategory, page } from './fixtures';
import { ExpenseDetail } from './expense-detail';
import { ExpenseForm } from './expense-form';
import { ExpensesList } from './expenses-list';

const nav = vi.hoisted(() => ({
  search: '',
  replace: vi.fn(),
  push: vi.fn(),
  back: vi.fn(),
  prefetch: vi.fn(),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: nav.replace,
    push: nav.push,
    back: nav.back,
    prefetch: nav.prefetch,
    refresh: vi.fn(),
  }),
  usePathname: () => '/b/example-cement/expenses',
  useSearchParams: () => new URLSearchParams(nav.search),
}));
beforeEach(() => {
  nav.search = '';
  nav.replace.mockReset();
  nav.push.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

const meWith = (permissions: string[]): Me => ({
  ...managerMe,
  businesses: [business({ permissions })],
});
const managerP = meWith([...MANAGER_PERMISSIONS, 'change.request', 'change.view.own']);
const ownerP = meWith(OWNER_PERMISSIONS);

const routes = {
  [`GET ${B}/expense-categories`]: () => json(200, { items: [expenseCategory()] }),
  // The methods are the business's own list; no method name lives in the code.
  [`GET ${B}/expense-methods`]: () => json(200, { items: ['cash', 'bkash', 'bank'] }),
};

describe('<ExpenseForm>', () => {
  it('a category and method from the API list, money as a string', async () => {
    const { calls } = mockApi({
      ...routes,
      [`POST ${B}/expenses`]: () => json(201, expense({ id: 'exp9' })),
    });
    const { container } = renderInBusiness(<ExpenseForm slug="example-cement" businessId={BID} />, {
      me: managerP,
    });
    const category = await screen.findByLabelText('Expense type');
    expect(
      within(category)
        .getAllByRole('option')
        .map((o) => (o as HTMLOptionElement).value),
    ).toEqual(['ec1']);
    const method = screen.getByLabelText('Method');
    expect(
      within(method)
        .getAllByRole('option')
        .map((o) => (o as HTMLOptionElement).value),
    ).toEqual(['cash', 'bkash', 'bank']);
    await userEvent.type(screen.getByLabelText('Amount'), '5000.50');
    await userEvent.selectOptions(method, 'bank');
    await userEvent.dblClick(screen.getByRole('button', { name: 'Save' }));
    const posts = calls.filter((c) => c.method === 'POST');
    expect(posts).toHaveLength(1); // double click sends once
    expect(posts[0]!.body).toEqual({
      categoryId: 'ec1',
      method: 'bank',
      amount: '5000.50',
      expenseDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    });
    expect(posts[0]!.headers.get('Idempotency-Key')).toMatch(/^[\w-]{8,64}$/);
    expect(nav.push).toHaveBeenCalledWith('/b/example-cement/expenses/exp9?saved=created');
    await expectNoA11yViolations(container);
  });

  it('refuses zero or malformed money; keeps what was typed', async () => {
    const { calls } = mockApi(routes);
    renderInBusiness(<ExpenseForm slug="example-cement" businessId={BID} />, { me: managerP });
    const amount = await screen.findByLabelText('Amount');
    await userEvent.type(amount, '0');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(
      await screen.findByText('Enter an amount above zero, like 570 or 570.50.'),
    ).toBeInTheDocument();
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(0);
    expect(amount).toHaveValue('0');
  });

  it('a field error from the API lands under its field, in Bengali', async () => {
    mockApi({
      ...routes,
      [`POST ${B}/expenses`]: () => apiError(400, 'EXPENSE_METHOD_UNKNOWN', 'method'),
    });
    const { container } = renderInBusiness(<ExpenseForm slug="example-cement" businessId={BID} />, {
      me: managerP,
      locale: 'bn',
    });
    await userEvent.type(await screen.findByLabelText('টাকা'), '5000');
    await userEvent.click(screen.getByRole('button', { name: 'সংরক্ষণ' }));
    expect(await screen.findByText('দেওয়া পদ্ধতিগুলোর একটা বেছে নিন।')).toBeInTheDocument();
    expect(container).not.toHaveTextContent('English developer text');
  });
});

describe('<ExpensesList>', () => {
  it('rows with category, method and amount; the method filter comes from the API', async () => {
    mockApi({
      ...routes,
      [`GET ${B}/expenses`]: () => json(200, page([expense()])),
    });
    renderInBusiness(<ExpensesList slug="example-cement" businessId={BID} />, { me: managerP });
    const row = (await screen.findByRole('rowheader', { name: 'EXP-0001' })).closest('tr')!;
    expect(row).toHaveTextContent('Cash');
    expect(row).toHaveTextContent('৳5,000.00');
    expect(row).toHaveTextContent(categoryRef.nameEn);
    await userEvent.selectOptions(screen.getByLabelText('Method'), 'bank');
    expect(nav.replace).toHaveBeenLastCalledWith('/b/example-cement/expenses?method=bank', {
      scroll: false,
    });
  });

  it('no "Record an expense" without expense.create; category link needs expense.category.manage', async () => {
    mockApi({ ...routes, [`GET ${B}/expenses`]: () => json(200, page([expense()])) });
    renderInBusiness(<ExpensesList slug="example-cement" businessId={BID} />, {
      me: meWith(['expense.view']),
    });
    await screen.findByRole('rowheader', { name: 'EXP-0001' });
    expect(screen.queryByRole('link', { name: 'Record an expense' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Manage expense types' })).not.toBeInTheDocument();
  });

  it('shows the four KPI cards with totals from the expenses report (report.view)', async () => {
    mockApi({
      ...routes,
      [`GET ${B}/expenses`]: () => json(200, page([expense()])),
      [`GET ${B}/reports/expenses`]: () =>
        json(200, expensesReportResponse({ totalAmount: '19200.00' })),
    });
    renderInBusiness(<ExpensesList slug="example-cement" businessId={BID} />, { me: ownerP });
    await screen.findByRole('rowheader', { name: 'EXP-0001' });
    expect(await screen.findByText('Total Partial Expenses')).toBeInTheDocument();
    expect(screen.getByText("Today's Expenses")).toBeInTheDocument();
    expect(screen.getByText("This Month's Expenses")).toBeInTheDocument();
    expect(screen.getByText("Previous Month's Expenses")).toBeInTheDocument();
    expect(screen.getAllByText('৳19,200.00')).toHaveLength(4);
  });

  it('hides the KPI cards without report.view; the list itself still works', async () => {
    mockApi({
      ...routes,
      [`GET ${B}/expenses`]: () => json(200, page([expense()])),
      [`GET ${B}/reports/expenses`]: () => apiError(403, 'FORBIDDEN'),
    });
    renderInBusiness(<ExpensesList slug="example-cement" businessId={BID} />, { me: managerP });
    await screen.findByRole('rowheader', { name: 'EXP-0001' });
    expect(screen.queryByText('Total Partial Expenses')).not.toBeInTheDocument();
  });

  it('a real failure on the KPI report (not a permission gap) shows an error, not silence', async () => {
    mockApi({
      ...routes,
      [`GET ${B}/expenses`]: () => json(200, page([expense()])),
      [`GET ${B}/reports/expenses`]: () => apiError(500, 'INTERNAL'),
    });
    renderInBusiness(<ExpensesList slug="example-cement" businessId={BID} />, { me: ownerP });
    await screen.findByRole('rowheader', { name: 'EXP-0001' });
    expect(screen.queryByText('Total Partial Expenses')).not.toBeInTheDocument();
    expect(
      await screen.findByText('The server is not reachable right now. Please try again shortly.'),
    ).toBeInTheDocument();
  });
});

describe('<ExpenseDetail>', () => {
  const detailRoutes = (e = expense()) => ({
    ...routes,
    [`GET ${B}/expenses/exp1`]: () => json(200, e),
  });

  it('owner voids with a reason; expenses, the cash book and the KPI report refresh', async () => {
    const { calls } = mockApi({
      ...detailRoutes(),
      [`POST ${B}/expenses/exp1/void`]: () => json(200, expense({ status: 'void' })),
    });
    const { invalidate } = renderInBusiness(
      <ExpenseDetail slug="example-cement" businessId={BID} id="exp1" />,
      { me: ownerP },
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Void' }));
    const dialog = screen.getByRole('dialog');
    await userEvent.type(
      within(dialog).getByLabelText('Reason for the change'),
      'Entered by mistake',
    );
    await userEvent.click(within(dialog).getByRole('button', { name: 'Void the expense' }));
    expect(calls.find((c) => c.path === `${B}/expenses/exp1/void`)!.body).toEqual({
      reason: 'Entered by mistake',
    });
    expect(invalidate.mock.calls.map((c) => JSON.stringify(c[0]?.queryKey))).toEqual([
      JSON.stringify(['dealership', BID, 'expenses']),
      JSON.stringify(['dealership', BID, 'cashBook']),
      JSON.stringify(['dealership', BID, 'reportsExpenses']),
    ]);
  });

  it('owner corrects: only changed fields plus a reason', async () => {
    const { calls } = mockApi({
      ...detailRoutes(),
      [`PATCH ${B}/expenses/exp1`]: () => json(200, expense({ amount: '4500.00' })),
    });
    renderInBusiness(<ExpenseDetail slug="example-cement" businessId={BID} id="exp1" />, {
      me: ownerP,
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Correct' }));
    const dialog = screen.getByRole('dialog');
    const amount = within(dialog).getByLabelText('Amount');
    await userEvent.clear(amount);
    await userEvent.type(amount, '4500');
    await userEvent.type(within(dialog).getByLabelText('Reason for the change'), 'Counted again');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save the correction' }));
    expect(calls.find((c) => c.method === 'PATCH')!.body).toEqual({
      amount: '4500',
      reason: 'Counted again',
    });
  });

  it('a manager who may only ask sees the request dialog, not Void or Correct', async () => {
    mockApi(detailRoutes());
    renderInBusiness(<ExpenseDetail slug="example-cement" businessId={BID} id="exp1" />, {
      me: managerP,
    });
    expect(await screen.findByRole('button', { name: 'Request a correction' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Void' })).not.toBeInTheDocument();
  });
});
