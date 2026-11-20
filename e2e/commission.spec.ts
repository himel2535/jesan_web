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

// Akij commission is owner-only (docs/API.md §10): set a scheme, create an entry, add a receipt,
// and check the yearly summary reflects it.
test('owner sets a scheme, creates an entry, adds a receipt, and sees the summary update', async ({
  browser,
}) => {
  const owner = await as(browser, 'owner', '/b/example-cement/commission');
  await expect(owner.getByText('No scheme has been set yet')).toBeVisible();
  await owner.getByRole('button', { name: 'Set the scheme' }).click();
  const scheme = owner.getByRole('dialog', { name: 'Set the commission scheme' });
  await scheme.getByLabel('Base rate (BDT/Bag)').fill('10');
  await scheme.getByLabel('Target quantity (Bag)').fill('100');
  await scheme.getByLabel('Bonus rate (BDT/Bag, above target)').fill('1');
  await scheme.getByRole('button', { name: 'Save' }).click();
  await expect(owner.getByText('Saved.')).toBeVisible();
  await expect(owner.getByText('Base rate: ৳10.00/Bag')).toBeVisible();

  await owner.getByRole('button', { name: 'New entry' }).click();
  const entry = owner.getByRole('dialog', { name: 'New commission entry' });
  await entry.getByLabel('From date').fill('2024-01-01');
  await entry.getByLabel('To date').fill('2024-01-31');
  await entry.getByLabel('Quantity (Bag)').fill('150');
  // base = 150 × ৳10 = ৳1,500; bonus = (150 − 100) × ৳1 = ৳50; total = ৳1,550.
  await expect(entry.getByText('Total: ৳1,550.00')).toBeVisible();
  await entry.getByRole('button', { name: 'Create' }).click();
  await expect(owner.getByText('Created.')).toBeVisible();

  await owner.getByRole('link', { name: /1 Jan 2024/ }).click();
  await expect(owner.getByText('৳1,550.00').first()).toBeVisible();
  await owner.getByRole('button', { name: 'Add a receipt' }).click();
  const receipt = owner.getByRole('dialog', { name: 'New receipt' });
  await receipt.getByLabel('Amount (BDT)').fill('500');
  await receipt.getByLabel('Date received').fill('2024-01-25');
  await receipt.getByLabel('Reference number').fill('AK-E2E');
  await receipt.getByRole('button', { name: 'Create' }).click();
  await expect(owner.getByText('Created.')).toBeVisible();
  await expect(owner.getByText('AK-E2E')).toBeVisible();

  await owner.goto('/b/example-cement/commission?year=2024');
  await expect(owner.getByText('৳1,550.00').first()).toBeVisible();
  await expect(owner.getByText('1 entries')).toBeVisible();
  await expect(owner.getByText('৳500.00').first()).toBeVisible();
  await expect(owner.getByText('1 receipts')).toBeVisible();
  await expect(owner.getByText('৳1,050.00').first()).toBeVisible();
});
