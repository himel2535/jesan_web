# Step 6-c2: Report pages + dashboard daily summary

## Context

Step 6-c1 shipped expenses and the cash book; `docs/API.md` §১৩'s report endpoints
(`reports/sales|collections|dues|stock|stock-movements|expenses|daily-summary`) were
explicitly deferred to this step (`DECISIONS.md` line ~487). This step builds those
six read-only report pages under `reports.finance.view`'s sidebar entry (page-level
guard is the real `report.view` permission, per the brief) and adds a daily-summary
block to the business dashboard, which currently only renders `EmptyState`.

**API contract verified against backend** (not just the doc): I cloned
`himel2535/jesan_api` at `db763ee` (the commit `DECISIONS.md` says this repo's
`docs/API.md` was synced from) and diffed `docs/API.md` — **byte-identical**, so no
doc sync is needed. I then read the backend's actual DTOs
(`src/modules/dealership/reports/dto/{requests,responses}.ts`) and service
(`reports.service.ts`) directly, because `docs/API.md`'s §১৩ table is a compact
summary that omits some fields. Two corrections to the task brief's shape sketch,
taken from the real `@Expose()` DTOs:

- **`reports/stock-movements` rows key off `productId`, not `id`** (`StockMovementsReportRow.productId`). Also include `unitKey` (brief omitted it).
- **`reports/stock` rows also carry `isActive: boolean`** (not in the brief's shape, but present in `StockReportRow` and trivial to surface — same `StatusBadge` component already used by every other master-data list).
- `reports/sales` and `reports/collections` responses also echo `from`, `to`, `groupBy` at the top level (harmless extras, not required for rendering).
- `reports/expenses` has **no pagination fields at all** (`ExpensesReportResponse` doesn't extend the DTOs' `PageInfo` class) — confirmed, matches the brief.
- `reports/dues` `nameBn` is nullable; `reports/stock` / `reports/stock-movements` `nameBn` is not.
- **Label semantics by groupBy** (read straight from `reports.service.ts`), which drives how each report renders its group key:
  - `sales`/`collections` **groupBy=`date`**: `key`/`label` is a raw unlocalized `YYYY-MM-DD` string — the page must format it with `useBusinessDay()`, like the cash book does.
  - `sales` groupBy=`customer`/`product`: `label` is a backend-built `"CODE NameEn"` string (English name only, no `nameBn`).
  - `sales` groupBy=`category`, `expenses` groupBy=`category`: `label` is the category's `nameEn` only.
  - `expenses` groupBy=`month`: `label` is a plain `"YYYY-MM"` string, not localized.
  - `collections` groupBy=`method`: **no `label` field at all** — `key` is the raw method string; render via `useMethodLabel()`.
  - For every non-`date` grouping, the page just prints `label`/`key` verbatim — no extra lookup, no "fixing" the English-only names client-side (that would need extra requests, which the 1-request-per-page budget forbids). This is a backend limitation, not something this step changes; worth one `DECISIONS.md` line.
- Stock movement `kind` is a **closed, backend-defined set** (Prisma schema comment): `purchase`, `purchase_edit`, `purchase_void`, `adjustment`, `delivery`, `delivery_edit`, `delivery_void`. Unlike collection/expense methods (business-configurable, no closed set), this is fixed in code — real translations are added for all seven, via the same `useDynamicT` fallback-to-raw-key pattern for forward safety if the backend ever adds one before the frontend ships a translation.
- `report.view` permission matrix (`docs/API.md` line 2140): **manager ✓, accountant ✓, salesman ✗, not owner-only** (owner's explicit permission list must still include it). All 7 `reports/*` endpoints require it; `daily-summary`'s `cash` field is additionally gated server-side by `@VisibleWith('cashbook.view')` (omitted entirely when absent — never hidden client-side).

## Routes and permissions

| Route                              | Guard                                                           | Notes                                                               |
| ---------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------- |
| `b/[slug]/reports`                 | `dealershipPage(slug, 'report.view')`                           | Index: links to the 6 reports, from `dealership.reports.nav.*`      |
| `b/[slug]/reports/sales`           | `report.view`                                                   | groupBy `date\|customer\|product\|category`, `from`/`to`, paginated |
| `b/[slug]/reports/collections`     | `report.view`                                                   | groupBy `date\|method`, `from`/`to`, paginated                      |
| `b/[slug]/reports/dues`            | `report.view`                                                   | no groupBy/date filter, paginated, 3 aging columns                  |
| `b/[slug]/reports/stock`           | `report.view`                                                   | no filter, paginated                                                |
| `b/[slug]/reports/stock-movements` | `report.view`                                                   | `from`/`to`, paginated                                              |
| `b/[slug]/reports/expenses`        | `report.view`                                                   | groupBy `category\|month`, `from`/`to`, **not** paginated           |
| `b/[slug]` (dashboard)             | server-side `can(permissions, 'report.view')` check (see below) | renders `DashboardView` or existing `EmptyState`                    |

**Manifest is untouched**, per the brief: the sidebar's existing `reports` nav entry
stays on `permission: 'reports.finance.view'` (owner/finance-only visibility — a
stub pre-declared for a future profit/commission page per its own comment). Managers
and accountants hold `report.view` but not `reports.finance.view`, so they won't see
"Reports" in the sidebar, yet can open any `/reports/*` URL directly and it will
render (page guard checks the real `report.view`, same "nav is a hint, not
security" rule the whole app already follows). **One-line `DECISIONS.md` note**:
this is a known nav-visibility gap for manager/accountant, intentionally not fixed
here since the brief says not to touch the manifest.

**Dashboard page** (`src/app/(app)/b/[slug]/page.tsx`) stays a server component; it
currently calls `lookupBusiness(slug)` directly (it is the _generic_ per-business
dashboard, not dealership-only). It will compute
`const canSeeReports = lookup.business.type === dealershipManifest.type && can(lookup.business.permissions, 'report.view')`
and render `<DashboardView slug={slug} businessId={lookup.business.id} />` when
true, else the current `<EmptyState>` — covering "no permission" and "future
non-dealership business type" in one check, matching the brief exactly ("permission
না থাকলে EmptyState থাকুক").

## Request budget (performance checklist §1)

- Reports index page: **0** requests (static links, server-guarded).
- Each of the 6 report pages: **1** request (its own `reports/*` call).
- Dashboard: **1** request (`reports/daily-summary`; `cash` arrives inline, no second call).
- `keepPreviousData` on every filtered report query (sales, collections, dues, stock, stock-movements, expenses) so groupBy/date/page changes don't flash a skeleton; not needed for `daily-summary` (no filters, single query key).
- No `listPrefetch` added anywhere for this feature (matches the brief: reports default to "current month" server-side, so a prefetched key can never match what the page will actually request — same reasoning already documented for `cashbook`).

## New module: `src/modules/dealership/reports/`

Following `expenses/` exactly:

- **`types.ts`** — one interface per response (`SalesReportRow/Response`,
  `CollectionsReportRow/Response`, `DuesAging`, `DuesReportRow/Response`,
  `StockReportRow`, `StockReportResponse = Page<StockReportRow>`,
  `StockMovementKind`, `StockMovementsRow` (`productId`, not `id`),
  `StockMovementsResponse`, `ExpensesReportRow`, `ExpensesReportResponse` (no
  `Page<T>` — no pagination), `DailySummaryStat`, `DailySummaryCash`,
  `DailySummaryResponse` (`cash?:`, optional)), plus one `*Filters` type per report
  and the three groupBy unions. Reuses `Page<T>` from `../master-data/types`.
- **`api.ts`** — `'use client'`; imports `dealershipKeys` from `'../master-data/api'`
  (does **not** call `createModuleKeys` again). One `useQuery` per report:
  `useSalesReport`, `useCollectionsReport`, `useDuesReport`, `useStockReport`,
  `useStockMovementsReport`, `useExpensesReport`, `useDailySummary`. Query-key
  entities: `reportsSales`, `reportsCollections`, `reportsDues`, `reportsStock`,
  `reportsStockMovements`, `reportsExpenses`, `dailySummary` (camelCase, no
  hyphens, matching the existing convention). All read-only — no mutations, no
  invalidation logic.
- **`skeletons.tsx`** — trivial re-export of `ListSkeleton` from `@/core/ui/skeleton`, same as `expenses/skeletons.tsx`.
- **`shared.tsx`** — re-exports `dateParam`, `useBusinessDay`, `useSetFilters` from
  `'../expenses/shared'` (same thing `cash-book-view.tsx` already does — no
  duplication). Adds two things with no existing precedent:
  - `groupByParam<T extends string>(params, key, allowed: readonly T[], fallback: T): T` — reads a validated groupBy value from the URL.
  - `useKindLabel()` — `useDynamicT()`-backed label for the 7 closed `stock-movements` kinds, keyed `dealership.reports.stockMovements.kind.*`, fallback to the raw kind.
  - Collections' method label is **not** redefined here — the collections report imports `useMethodLabel` from `'../sales/shared'` (keyed `dealership.sales.collections.methodNames.*`), because it labels `Collection.method`, the same field the sales/collections module already labels. (Expenses' own `useMethodLabel` in `expenses/shared.tsx`, keyed differently, is unrelated and not used here.)
- **`fixtures.ts`** — re-exports `WHOLE_UNIT`/`DECIMAL_UNIT` from `'../sales/fixtures'`
  (for the stock/stock-movements report tests, one whole-number unit + one decimal
  unit); builder functions `salesReportResponse()`, `collectionsReportResponse()`,
  `duesReportResponse()`, `stockReportResponse()`, `stockMovementsResponse()`,
  `expensesReportResponse()`, `dailySummaryResponse()`, each with sane defaults
  (Bengali names included, fixed dates), following `expenses/fixtures.ts`'s
  `page()`-builder style.

### View components (read-only — no create/edit/void anywhere)

All six follow `cash-book-view.tsx`'s shape (not `expenses-list.tsx`'s — that one
has a desktop/mobile card split for an actionable list; reports are plain read-only
tables like the cash book, so just one `overflow-x-auto` table, no media-query
split):

- **`sales-report.tsx`** — groupBy `<select>` (date/customer/product/category) + `from`/`to` date inputs via `useSetFilters`; table columns (label, quantity, amount); `date` groupBy renders `useBusinessDay()(key)` instead of the raw `label`; `totalQuantity`/`totalAmount` footer row; `<Pagination>`.
- **`collections-report.tsx`** — groupBy `<select>` (date/method); `date` → `useBusinessDay()(key)`, `method` → `useMethodLabel()(key)` from `../sales/shared`; count + amount columns; `totalAmount` footer; `<Pagination>`.
- **`dues-report.tsx`** — no groupBy/date filter; columns: code, name (`useNameOf()`), current balance, due, advance, and three aging columns (`d0To7`/`d8To30`/`d30Plus`); `totalDue`/`totalAdvance` footer; `<Pagination>`.
- **`stock-report.tsx`** — no filter; columns: code, name, unit (`useUnitInfo().nameOf`), current stock (`format.quantity(value, decimalsOf(unitKey))`), status (`StatusBadge` for `isActive`); `<Pagination>`.
- **`stock-movements-report.tsx`** — `from`/`to` filter; columns: code, name, unit, net quantity; a compact muted-text breakdown of `byKind` under each row (`kindLabel: quantity`, comma-joined — no expandable disclosure, keeps scope minimal); `<Pagination>`.
- **`expenses-report.tsx`** — groupBy `<select>` (category/month) + `from`/`to`; columns: label, count, amount; `totalAmount` footer; **no** `<Pagination>` (API has none).

Shared conventions across all six: `ListSkeleton` while `isPending`; `LoadError`
(from `../master-data/shared/states`) on error; `EmptyState` when `items.length === 0`; `opacity-60` + `aria-busy` wrapper while `isPlaceholderData`/`isFetching`, exactly like `cash-book-view.tsx`.

### Route pages

`src/app/(app)/b/[slug]/reports/{page.tsx, sales/page.tsx, collections/page.tsx, dues/page.tsx, stock/page.tsx, stock-movements/page.tsx, expenses/page.tsx}` — each a thin async server component: `dealershipPage(slug, 'report.view')` guard, `PageHeader`, then the matching client view. Index page lists the six as plain `<Link>`s (no special prefetch config — this is page-navigation, not data-prefetch).

### Dashboard

New `src/modules/dealership/dashboard/dashboard-view.tsx` (`'use client'`):
`useDailySummary(slug, businessId)` → `ListSkeleton` while pending, `LoadError` on
error, else a `<dl>` stat grid (orders/deliveries/collections/expenses, each
count + `<Money>`) — a second `<dl>` row with opening/closing/net only when
`data.cash` is present (API already omits the field server-side without
`cashbook.view`; the page only checks for its presence, never re-checks the
permission). `src/app/(app)/b/[slug]/page.tsx` is edited as described above to
render it conditionally.

## Small config changes (to log in `DECISIONS.md`, not asking first — all directly required to make `report.view` exist/testable)

- `test/fixtures/me.ts`: add `'report.view'` to `OWNER_PERMISSIONS` and `MANAGER_PERMISSIONS` (alphabetical slot, next to `reports.finance.view`/`purchase.view`). Accountant's inline permission list is **not** touched — it already omits `cashbook.view`/`expense.view` despite the matrix granting them, a pre-existing gap from 6-c1, out of scope here.
- `e2e/mock-api.mjs`: add `'report.view'` to the `MANAGER` permission array (OWNER inherits via `...MANAGER`); add a `reportsCompute*`-style set of aggregation functions plus the 7 new `rest === 'reports/...'` dispatch branches, placed right after the existing `cash-book` block, reusing the same in-memory `expenses`/`collections`/`purchases`/`customers`/`products` arrays `cashBookCompute` already reads.
- `test/settings-utils.tsx`: add `['report.view', 'dealership', false]` to the `ALL` permissions array (not owner-only), placed next to `cashbook.view`/`reports.finance.view` to match `docs/API.md`'s own ordering.
- `messages/en.json` / `bn.json`: add `permissions.items.report_view` (English/Bengali label, next to `cashbook_view`/`reports_finance_view`).

## Translation keys

New `dealership.reports` namespace (sibling of `dealership.expenses`/`dealership.cashBook`; already covered by the client-messages `dealership` namespace, no `client-messages.ts` change needed). `dealership.nav.reports` already exists ("Reports") and is untouched.

```json
"dealership": {
  "reports": {
    "title": "Reports",
    "nav": { "sales": "Sales", "collections": "Collections", "dues": "Dues", "stock": "Stock", "stockMovements": "Stock movements", "expenses": "Expenses" },
    "common": { "from": "From", "to": "To", "groupBy": "Group by", "total": "Total", "emptyTitle": "Nothing in this range", "emptyDescription": "..." },
    "sales": { "title": "Sales report", "groupBy": { "date": "Date", "customer": "Customer", "product": "Product", "category": "Category" }, "columns": { "label": "...", "quantity": "Quantity", "amount": "Amount" }, "totalQuantity": "Total quantity", "totalAmount": "Total amount" },
    "collections": { "title": "Collections report", "groupBy": { "date": "Date", "method": "Method" }, "columns": { "count": "Count", "amount": "Amount" } },
    "dues": { "title": "Dues report", "columns": { "code": "Code", "name": "Name", "currentBalance": "Balance", "dueAmount": "Due", "advanceAmount": "Advance" }, "aging": { "title": "Aging", "d0To7": "0–7 days", "d8To30": "8–30 days", "d30Plus": "30+ days" }, "totalDue": "Total due", "totalAdvance": "Total advance" },
    "stock": { "title": "Stock report", "columns": { "code": "Code", "name": "Name", "unit": "Unit", "currentStock": "Current stock", "status": "Status" } },
    "stockMovements": { "title": "Stock movements", "columns": { "net": "Net" }, "kind": { "purchase": "Purchase", "purchase_edit": "Purchase correction", "purchase_void": "Purchase void", "adjustment": "Adjustment", "delivery": "Delivery", "delivery_edit": "Delivery correction", "delivery_void": "Delivery void" } },
    "expenses": { "title": "Expenses report", "groupBy": { "category": "Category", "month": "Month" } },
    "dailySummary": { "title": "Today", "orders": "Orders", "deliveries": "Deliveries", "collections": "Collections", "expenses": "Expenses", "cash": { "openingBalance": "Opening balance", "closingBalance": "Closing balance", "net": "Net" } }
  }
}
```

Both `en.json` and `bn.json` get every key (tested by the existing key-parity test).

## Tests

**Unit** (`src/modules/dealership/reports/reports.test.tsx`):

- `SalesReport`: groupBy toggle updates the URL and refetches; date filters; pagination; `date` groupBy shows a localized day, not the raw string.
- `DuesReport`: three aging columns render; `totalDue`/`totalAdvance` footer.
- Permission gating smoke test (page renders for `report.view`, 403 page without it — via the existing `dealershipPage`/`Forbidden` pattern, consistent with other module tests).

**Dashboard test** (likely alongside, or a small `dashboard-view.test.tsx` in the new `dashboard/` folder): `report.view` present → stat cards render; `cashbook.view` also present → 3 cash cards appear; `report.view` absent → `EmptyState` (current behavior unchanged).

**e2e** (`e2e/reports.spec.ts`):

- `mock-api.mjs` gets the 7 new endpoints (sales/collections/dues/stock/stock-movements/expenses/daily-summary), gated by `report.view`.
- Owner opens the sales report, switches groupBy, sees the table update.
- Owner opens the dues report, sees aging columns.
- Owner visits the dashboard, sees the daily-summary cards (including cash, since owner has `cashbook.view`).

## Verification

```
npm run dev          # manual check: /b/example-cement/reports/* and the dashboard, both themes + both locales
npm run lint
npm run type-check
npm test
npm run build
npm run test:e2e
npm run format
```

All must pass before the WIP commit / PR, per the project's standing rule.
