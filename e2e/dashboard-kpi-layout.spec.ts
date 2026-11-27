import { expect, test, type Page } from '@playwright/test';

/** Test-only account of e2e/mock-api.mjs (no real password). */
const OWNER = ['owner@example.com', 'e2e-owner-pass'] as const;

async function openDashboard(page: Page) {
  await page
    .context()
    .addCookies([{ name: 'NEXT_LOCALE', value: 'en', url: 'http://localhost:3000' }]);
  await page.goto('/login?next=%2Fb%2Fexample-cement');
  await page.getByLabel('Email or phone').fill(OWNER[0]);
  await page.getByLabel('Password', { exact: true }).fill(OWNER[1]);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL((url) => url.pathname === '/b/example-cement');
  await expect(page.getByRole('main').getByRole('link').first()).toBeVisible();
}

async function shoot(page: Page, name: string) {
  const dir = process.env['DD_SHOT_DIR'];
  if (dir) await page.screenshot({ path: `${dir}/${name}.png` });
}

const box = async (locator: ReturnType<Page['locator']>) => {
  const rect = await locator.boundingBox();
  if (!rect) throw new Error('not visible');
  return rect;
};

test('desktop: title and figure are centred, and the filter row fills the card with no gap', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openDashboard(page);
  await shoot(page, 'kpi-desktop');
  const card = page.getByRole('main').locator('article', { hasText: 'Total Collection' }).first();
  const cardBox = await box(card);
  const centre = cardBox.x + cardBox.width / 2;

  // Title and amount sit in the middle of the card.
  const title = card.getByText('Total Collection', { exact: true });
  const titleBox = await box(title);
  expect(Math.abs(titleBox.x + titleBox.width / 2 - centre)).toBeLessThan(3);
  const amount = card.locator('p.tabular-nums').first();
  const amountBox = await box(amount);
  expect(Math.abs(amountBox.x + amountBox.width / 2 - centre)).toBeLessThan(3);
  // ... and the amount is vertically between the title row and the filter row.
  const month = card.getByRole('combobox').first();
  const year = card.getByRole('combobox').nth(1);
  const allTime = card.getByRole('button', { name: 'All Time' });
  const [m, y, a] = [await box(month), await box(year), await box(allTime)];
  expect(amountBox.y).toBeGreaterThan(titleBox.y + titleBox.height);
  expect(amountBox.y + amountBox.height).toBeLessThanOrEqual(m.y + 1);

  // The three controls share the whole row: flush with both card paddings, tiny gaps between.
  const pad = 14;
  expect(m.x - cardBox.x).toBeLessThanOrEqual(pad);
  expect(cardBox.x + cardBox.width - (a.x + a.width)).toBeLessThanOrEqual(pad);
  expect(y.x - (m.x + m.width)).toBeLessThanOrEqual(6);
  expect(a.x - (y.x + y.width)).toBeLessThanOrEqual(6);
  expect(Math.abs(m.width - y.width)).toBeLessThan(2);

  // Less round than a pill: a few pixels, not half the height.
  const radius = await month.evaluate((el) => parseFloat(getComputedStyle(el).borderTopLeftRadius));
  expect(radius).toBeGreaterThan(0);
  expect(radius).toBeLessThanOrEqual(8);
  const allRadius = await allTime.evaluate((el) =>
    parseFloat(getComputedStyle(el).borderTopLeftRadius),
  );
  expect(allRadius).toBeLessThanOrEqual(8);
});

test('mobile: the filters keep their compact row and the page does not scroll sideways', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openDashboard(page);
  await shoot(page, 'kpi-mobile');
  const card = page.getByRole('main').locator('article', { hasText: 'Total Collection' }).first();
  const cardBox = await box(card);
  const title = await box(card.getByText('Total Collection', { exact: true }));
  expect(Math.abs(title.x + title.width / 2 - (cardBox.x + cardBox.width / 2))).toBeLessThan(3);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  for (const control of [
    card.getByRole('combobox').first(),
    card.getByRole('combobox').nth(1),
    card.getByRole('button', { name: 'All Time' }),
  ]) {
    const rect = await box(control);
    expect(rect.x).toBeGreaterThanOrEqual(cardBox.x);
    expect(rect.x + rect.width).toBeLessThanOrEqual(cardBox.x + cardBox.width + 1);
  }
});
