import { expect, test, type Browser, type Page } from '@playwright/test';

/** Test-only accounts of e2e/mock-api.mjs (no real passwords). */
const ACCOUNTS = {
  owner: ['owner@example.com', 'e2e-owner-pass'],
} as const;

async function as(browser: Browser, who: keyof typeof ACCOUNTS, next: string): Promise<Page> {
  const context = await browser.newContext();
  await context.addCookies([{ name: 'NEXT_LOCALE', value: 'en', url: 'http://localhost:3000' }]);
  const page = await context.newPage();
  const [email, password] = ACCOUNTS[who];
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel('Email or phone').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL((url) => url.pathname === next.split('?')[0]);
  return page;
}

// Akij commission is owner-only (docs/API.md §10): just the amount received and the reason. No
// scheme, no target, no calculation. The yearly total reflects each entry.
test('owner records commission received with a reason and sees the year total', async ({
  browser,
}) => {
  const owner = await as(browser, 'owner', '/b/example-cement/commission?year=2024');
  await expect(owner.getByText('No commission recorded yet')).toBeVisible();
  await expect(owner.getByText('scheme', { exact: false })).toHaveCount(0);

  await owner.getByRole('button', { name: 'Add commission' }).first().click();
  const dialog = owner.getByRole('dialog', { name: 'Add commission received' });
  // The reason is required.
  await dialog.getByLabel('Amount received (BDT)').fill('25000');
  await dialog.getByLabel('Date received').fill('2024-01-25');
  await dialog.getByRole('button', { name: 'Create' }).click();
  await expect(dialog.getByText('Write the reason for this commission.')).toBeVisible();
  await dialog.getByLabel('Reason').fill('Monthly target bonus');
  await dialog.getByRole('button', { name: 'Create' }).click();
  await expect(owner.getByText('Created.')).toBeVisible();
  await expect(owner.getByText('Monthly target bonus')).toBeVisible();
  await expect(owner.getByText('৳25,000.00').first()).toBeVisible();
  await expect(owner.getByText('1 entry')).toBeVisible();

  // Correct it: only the amount changes.
  await owner
    .getByRole('button', { name: /Edit commission of/ })
    .first()
    .click();
  const edit = owner.getByRole('dialog', { name: 'Edit commission' });
  await edit.getByLabel('Amount received (BDT)').fill('30000');
  await edit.getByRole('button', { name: 'Save' }).click();
  await expect(owner.getByText('Saved.')).toBeVisible();
  await expect(owner.getByText('৳30,000.00').first()).toBeVisible();
});
