import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { Me } from '@/core/auth/types';
import { MANAGER_PERMISSIONS, business, managerMe } from '../../../../test/fixtures/me';
import { json, mockApi, renderInBusiness } from '../../../../test/settings-utils';
import { expectNoA11yViolations } from '../../../../test/utils';
import { B, BID, expenseCategory } from './fixtures';
import { ExpenseCategoriesPanel } from './categories/expense-categories-panel';

const meWith = (permissions: string[]): Me => ({
  ...managerMe,
  businesses: [business({ permissions })],
});
const managerP = meWith([...MANAGER_PERMISSIONS, 'change.request']);

describe('<ExpenseCategoriesPanel>', () => {
  it('lists types, creates a new one, and deactivates with a reason', async () => {
    const { calls } = mockApi({
      [`GET ${B}/expense-categories`]: () => json(200, { items: [expenseCategory()] }),
      [`POST ${B}/expense-categories`]: () =>
        json(201, expenseCategory({ id: 'ec2', nameEn: 'Utilities', nameBn: 'বিদ্যুৎ' })),
      [`PATCH ${B}/expense-categories/ec1`]: () => json(200, expenseCategory({ isActive: false })),
    });
    const { container } = renderInBusiness(
      <ExpenseCategoriesPanel slug="example-cement" businessId={BID} />,
      { me: managerP },
    );
    expect(await screen.findByText('Salaries')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'New type' }));
    const dialog = screen.getByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Name (English)'), 'Utilities');
    await userEvent.type(within(dialog).getByLabelText('Name (Bangla)'), 'বিদ্যুৎ');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create' }));
    expect(calls.find((c) => c.method === 'POST')!.body).toEqual({
      nameEn: 'Utilities',
      nameBn: 'বিদ্যুৎ',
    });

    await userEvent.click(screen.getByRole('button', { name: 'Actions for Salaries' }));
    await userEvent.click(screen.getByRole('button', { name: 'Deactivate' }));
    const confirm = screen.getByRole('dialog');
    await userEvent.type(within(confirm).getByLabelText('Reason for the change'), 'No longer used');
    await userEvent.click(within(confirm).getByRole('button', { name: 'Deactivate' }));
    expect(calls.find((c) => c.method === 'PATCH')!.body).toEqual({
      isActive: false,
      reason: 'No longer used',
    });
    await expectNoA11yViolations(container);
  });

  it('no New type button or edit action without expense.category.manage', async () => {
    mockApi({ [`GET ${B}/expense-categories`]: () => json(200, { items: [expenseCategory()] }) });
    renderInBusiness(<ExpenseCategoriesPanel slug="example-cement" businessId={BID} />, {
      me: meWith(['expense.view']),
    });
    await screen.findByText('Salaries');
    expect(screen.queryByRole('button', { name: 'New type' })).not.toBeInTheDocument();
  });
});
