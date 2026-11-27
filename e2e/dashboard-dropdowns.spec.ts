import { expect, test, type Page } from '@playwright/test';

/** Test-only account of e2e/mock-api.mjs (no real password). */
const OWNER = ['owner@example.com', 'e2e-owner-pass'] as const;

const TEXT = {
  en: {
    cookie: 'en',
    emailLabel: 'Email or phone',
    passwordLabel: 'Password',
    signIn: 'Sign in',
    collection: 'Total Collection',
    todayCollection: "Today's Collection",
    summary: 'Financial Summary',
    month: (title: string) => `Choose month for ${title}`,
    year: (title: string) => `Choose year for ${title}`,
    period: (title: string) => `Period for ${title}`,
    yesterday: 'Yesterday',
  },
  bn: {
    cookie: 'bn',
    emailLabel: 'ইমেইল বা ফোন',
    passwordLabel: 'পাসওয়ার্ড',
    signIn: 'লগইন',
    collection: 'মোট আদায়',
    todayCollection: 'আজকের আদায়',
    summary: 'আর্থিক সারসংক্ষেপ',
    month: (title: string) => `${title}-এর মাস বাছুন`,
    year: (title: string) => `${title}-এর বছর বাছুন`,
    period: (title: string) => `${title}-এর সময়কাল`,
    yesterday: 'গতকাল',
  },
} as const;

async function openDashboard(page: Page, lang: 'en' | 'bn', theme: 'light' | 'dark') {
  const text = TEXT[lang];
  await page.context().addCookies([
    { name: 'NEXT_LOCALE', value: text.cookie, url: 'http://localhost:3000' },
    { name: 'theme', value: theme, url: 'http://localhost:3000' },
  ]);
  await page.goto('/login?next=%2Fb%2Fexample-cement');
  await page.getByLabel(text.emailLabel).fill(OWNER[0]);
  await page.getByLabel(text.passwordLabel, { exact: true }).fill(OWNER[1]);
  await page.getByRole('button', { name: text.signIn }).click();
  await page.waitForURL((url) => url.pathname === '/b/example-cement');
  await expect(page.getByRole('main').getByRole('link').first()).toBeVisible();
}

/** Where `DD_SHOT_DIR` is set, keep a picture of each open list so it can be looked at. */
async function shoot(page: Page, name: string) {
  const dir = process.env['DD_SHOT_DIR'];
  if (dir) await page.screenshot({ path: `${dir}/${name}.png` });
}

for (const lang of ['en', 'bn'] as const) {
  for (const theme of ['light', 'dark'] as const) {
    test(`dashboard filters open, pick and request the right window (${lang}, ${theme})`, async ({
      page,
    }) => {
      const text = TEXT[lang];
      const kpiRequests: URL[] = [];
      const summaryRequests: URL[] = [];
      page.on('request', (request) => {
        const url = new URL(request.url());
        if (url.pathname.endsWith('/dashboard/kpis')) kpiRequests.push(url);
        if (url.pathname.endsWith('/dashboard/finance-summary')) summaryRequests.push(url);
      });
      await openDashboard(page, lang, theme);
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      const main = page.getByRole('main');
      const card = main.getByRole('link', {
        name: lang === 'en' ? 'Total Collection: open page' : /মোট আদায়/,
      });

      // KPI card, month: a plain click shows a real list; picking an option changes the card.
      const month = main.getByRole('combobox', { name: text.month(text.collection) });
      await expect(month).toHaveAttribute('aria-expanded', 'false');
      const hrefBefore = await card.first().getAttribute('href');
      await month.click();
      const monthList = page.getByRole('listbox', { name: text.month(text.collection) });
      await expect(monthList).toBeVisible();
      await expect(monthList.getByRole('option')).toHaveCount(12);
      await shoot(page, `kpi-month-${lang}-${theme}`);
      await monthList.getByRole('option').first().click();
      await expect(monthList).toBeHidden();
      await expect(card.first()).not.toHaveAttribute('href', hrefBefore ?? '');
      await expect(card.first()).toHaveAttribute('href', /from=\d{4}-01-01&to=\d{4}-01-31/);
      await expect(page).toHaveURL(/\/b\/example-cement$/);

      // KPI card, year.
      const year = main.getByRole('combobox', { name: text.year(text.collection) });
      await year.click();
      const yearList = page.getByRole('listbox', { name: text.year(text.collection) });
      await expect(yearList.getByRole('option')).toHaveCount(4);
      await yearList.getByRole('option').first().click();
      await expect(yearList).toBeHidden();
      await expect(card.first()).toHaveAttribute('href', /from=\d{4}-01-01/);

      // KPI day card: Today / Yesterday.
      const dayCard = main.getByRole('link', {
        name: lang === 'en' ? "Today's Collection: open page" : /আজকের আদায়/,
      });
      const day = main.getByRole('combobox', { name: text.period(text.todayCollection) });
      const dayBefore = await dayCard.first().getAttribute('href');
      await day.click();
      const dayList = page.getByRole('listbox', { name: text.period(text.todayCollection) });
      await expect(dayList.getByRole('option')).toHaveCount(2);
      await dayList.getByRole('option', { name: text.yesterday }).click();
      await expect(day).toHaveText(text.yesterday);
      await expect(dayCard.first()).not.toHaveAttribute('href', dayBefore ?? '');

      // No KPI request ever carries a comparison window, and the list never made the page navigate.
      expect(kpiRequests.length).toBeGreaterThan(2);
      for (const url of kpiRequests) {
        expect(url.searchParams.has('prevFrom')).toBe(false);
        expect(url.searchParams.has('prevTo')).toBe(false);
      }
      const monthRequest = kpiRequests.find((url) =>
        url.searchParams.get('from')?.endsWith('-01-01'),
      );
      expect(monthRequest?.searchParams.get('to')).toMatch(/-01-31$/);

      // Financial Summary: its list sits inside a scrolling panel but must not be clipped by it.
      const summaryMonth = main.getByRole('combobox', { name: text.month(text.summary) });
      await summaryMonth.click();
      const summaryList = page.getByRole('listbox', { name: text.month(text.summary) });
      await expect(summaryList).toBeVisible();
      await expect(summaryList).toBeInViewport({ ratio: 1 });
      await shoot(page, `summary-month-${lang}-${theme}`);
      // The last option is reachable by a real click, not hidden under another panel.
      await summaryList.getByRole('option').first().click();
      await expect(summaryList).toBeHidden();
      await expect
        .poll(() => summaryRequests.some((url) => url.searchParams.get('from')?.endsWith('-01-01')))
        .toBe(true);
    });
  }
}

test('a list closes on Escape and on a click elsewhere, without picking anything', async ({
  page,
}) => {
  await openDashboard(page, 'en', 'light');
  const main = page.getByRole('main');
  const month = main.getByRole('combobox', { name: TEXT.en.month(TEXT.en.collection) });
  const list = page.getByRole('listbox', { name: TEXT.en.month(TEXT.en.collection) });
  const card = main.getByRole('link', { name: 'Total Collection: open page' });
  const href = await card.getAttribute('href');

  await month.click();
  await expect(list).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(list).toBeHidden();
  await expect(month).toBeFocused();

  await month.click();
  await expect(list).toBeVisible();
  await main.getByRole('heading', { name: 'This Month' }).click();
  await expect(list).toBeHidden();
  await expect(card).toHaveAttribute('href', href ?? '');
});

test('a list also opens and picks from the keyboard', async ({ page }) => {
  await openDashboard(page, 'en', 'light');
  const main = page.getByRole('main');
  const month = main.getByRole('combobox', { name: TEXT.en.month(TEXT.en.collection) });
  const card = main.getByRole('link', { name: 'Total Collection: open page' });
  await month.focus();
  await page.keyboard.press('ArrowDown');
  const list = page.getByRole('listbox', { name: TEXT.en.month(TEXT.en.collection) });
  await expect(list).toBeVisible();
  await page.keyboard.press('Home');
  await page.keyboard.press('Enter');
  await expect(list).toBeHidden();
  await expect(card).toHaveAttribute('href', /from=\d{4}-01-01/);
});
