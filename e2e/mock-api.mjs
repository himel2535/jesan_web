// Mock jesan-api for Playwright (follows docs/API.md: cookies, refresh, Origin check, hidden
// fields by permission, 409s). Example data and TEST-ONLY passwords; nothing real.
import http from 'node:http';

const PORT = Number(process.env.MOCK_API_PORT ?? 4000);
const ORIGINS = ['http://localhost:3000'];

const MANAGER = [
  'cashbook.view',
  'report.view',
  'collection.create',
  'collection.view',
  'delivery.create',
  'delivery.view',
  'customer.due.view',
  'customer.manage',
  'customer.view',
  'expense.category.manage',
  'expense.create',
  'expense.view',
  'product.cost.view',
  'product.manage',
  'product.view',
  'purchase.create',
  'purchase.view',
  'sale.create',
  'sale.view.all',
  'settings.view',
  'stock.adjust',
  'stock.view',
  'supplier.view',
  'users.view',
  'change.request',
  'change.view.own',
];
const SALESMAN = [
  'customer.manage',
  'customer.view',
  'product.view',
  'sale.create',
  'sale.view.own',
  'stock.view',
  'change.request',
  'change.view.own',
];
const OWNER = [
  ...MANAGER,
  'product.deactivate',
  'customer.balance.edit',
  'customer.deactivate',
  'settings.manage',
  'users.manage',
  'roles.manage',
  'audit.view',
  'commission.view',
  'commission.manage',
  'profit.view',
  'purchase.void',
  'purchase.edit',
  'sale.edit',
  'sale.void',
  'delivery.edit',
  'delivery.void',
  'delivery.credit.override',
  'collection.edit',
  'collection.void',
  'expense.edit',
  'expense.void',
  'stock.adjust.large',
  'ledger.view',
  'ledger.entry.create',
  'payment.create',
  'change.view.all',
  'change.approve',
];

const role = (key, nameEn, nameBn) => ({ id: `r-${key}`, key, nameEn, nameBn });
const business = (r, permissions) => ({
  id: 'b1',
  slug: 'example-cement',
  nameEn: 'Example Cement',
  nameBn: 'উদাহরণ সিমেন্ট',
  type: 'dealership',
  role: r,
  permissions: [...permissions].sort(),
});
const USERS = {
  'owner@example.com': {
    password: 'e2e-owner-pass',
    user: {
      id: 'u1',
      name: 'Example Owner',
      email: 'owner@example.com',
      phone: null,
      isActive: true,
      isPlatformOwner: true,
    },
    businesses: [business(role('owner', 'Owner', 'মালিক'), OWNER)],
  },
  'manager@example.com': {
    password: 'e2e-manager-pass',
    user: {
      id: 'u2',
      name: 'Example Manager',
      email: 'manager@example.com',
      phone: null,
      isActive: true,
      isPlatformOwner: false,
    },
    businesses: [business(role('manager', 'Manager', 'ম্যানেজার'), MANAGER)],
  },
  'salesman@example.com': {
    password: 'e2e-salesman-pass',
    user: {
      id: 'u3',
      name: 'Example Salesman',
      email: 'salesman@example.com',
      phone: null,
      isActive: true,
      isPlatformOwner: false,
    },
    businesses: [business(role('salesman', 'Salesman', 'বিক্রয়কর্মী'), SALESMAN)],
  },
};

const now = '2026-11-17T08:38:04.236Z';
const categories = [
  {
    id: 'c1',
    nameEn: 'OPC',
    nameBn: 'ওপিসি',
    sortOrder: 1,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'c2',
    nameEn: 'PCC',
    nameBn: 'পিসিসি',
    sortOrder: 2,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  },
];
const products = Array.from({ length: 12 }, (_, i) => {
  const n = i + 1;
  const cat = categories[n % 2];
  return {
    id: `p${n}`,
    code: `P-${String(n).padStart(4, '0')}`,
    category: { id: cat.id, nameEn: cat.nameEn, nameBn: cat.nameBn },
    nameEn: `Sample ${cat.nameEn} ${String(n).padStart(2, '0')}`,
    nameBn: `নমুনা ${cat.nameBn} ${n}`,
    unitKey: 'bag',
    // Read-only, from purchases: the first few were bought, the rest not yet (null).
    lastPurchasePrice: n <= 6 ? `${500 + n}.00` : null,
    lastPurchasedAt: n <= 6 ? '2026-11-16T10:00:00.000Z' : null,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };
});
const customers = [
  {
    id: 'cu1',
    code: 'C-00001',
    nameEn: 'Sample Store One',
    nameBn: 'নমুনা স্টোর এক',
    phone: '+8801000000001',
    address: null,
    area: 'Sample Bazar',
    openingBalance: '12500.00',
    currentBalance: '1250000.00',
    creditLimit: null,
    pendingDeliveryQuantity: '0',
    deliveredAmount: '0.00',
    collectedAmount: '0.00',
    isActive: true,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'cu2',
    code: 'C-00002',
    nameEn: 'Advance Shop',
    nameBn: null,
    phone: '+8801000000002',
    address: null,
    area: null,
    openingBalance: '-200.50',
    currentBalance: '-200.50',
    creditLimit: '50000.00',
    pendingDeliveryQuantity: '0',
    deliveredAmount: '0.00',
    collectedAmount: '0.00',
    isActive: true,
    createdAt: now,
    updatedAt: now,
  },
];
const suppliers = [
  {
    id: 's1',
    code: 'S-001',
    nameEn: 'Example Supplier',
    nameBn: 'উদাহরণ সরবরাহকারী',
    phone: null,
    address: null,
    isPrincipal: true,
    isActive: true,
  },
];

const access = new Map();
const refresh = new Map();
let seq = 0;
const cookiesOf = (req) =>
  Object.fromEntries(
    (req.headers.cookie ?? '')
      .split(';')
      .map((c) => c.trim().split('='))
      .filter((p) => p[0]),
  );
function issue(res, email) {
  seq += 1;
  access.set(`at${seq}`, email);
  refresh.set(`rt${seq}`, email);
  res.setHeader('Set-Cookie', [
    `jesan_at=at${seq}; Max-Age=900; Path=/; HttpOnly; SameSite=Lax`,
    `jesan_rt=rt${seq}; Max-Age=2592000; Path=/api/v1/auth; HttpOnly; SameSite=Lax`,
  ]);
}
/**
 * Test-only latency, so a spec can watch the loading states instead of racing them. A spec turns
 * it on with `POST /__test/delay { ms, paths }` straight to this server and off again afterwards.
 * It has to be here rather than in a cookie, because the server-rendered part of a page sends
 * only the access cookie (`serverApiGet`), so GET /auth/me could not otherwise be slowed down —
 * and that is exactly the request a route's `loading.tsx` waits for.
 *
 * `currentDelay` is set per request below and read here, which is safe because every handler
 * calls `send` synchronously within its own request.
 */
const MAX_DELAY_MS = 3000;
let delay = { ms: 0, paths: null };
let currentDelay = 0;
const send = (res, status, body, headers = {}) => {
  const write = () => {
    res.writeHead(status, { 'Content-Type': 'application/json', ...headers });
    res.end(body === undefined ? '' : JSON.stringify(body));
  };
  if (currentDelay > 0) setTimeout(write, currentDelay);
  else write();
};
// Errors in the docs/API.md §11 shape: stable `code`, and `field` + `errors[]` for one field.
const CODE_BY_STATUS = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHENTICATED',
  403: 'ACCESS_DENIED',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
};
const err = (res, status, message, code = CODE_BY_STATUS[status], field) =>
  send(res, status, {
    message,
    statusCode: status,
    code,
    ...(field ? { field, errors: [{ field, code, message }] } : {}),
  });
/** 400 VALIDATION_FAILED with one entry per field. */
const invalid = (res, list) =>
  send(res, 400, {
    message: list.map((e) => e.message),
    statusCode: 400,
    code: 'VALIDATION_FAILED',
    errors: list,
  });

/**
 * Change requests (docs/API.md §10), in memory. Fields per type: who may SEE them, and which
 * direct permission applies them. Values hidden from a viewer are left out of every answer.
 */
const changeRequests = [];
const COST_FIELDS = ['lastPurchasePrice', 'lastPurchasedAt'];
const idempotency = new Map();
const CHANGE_FIELDS = {
  product: {
    isActive: { see: null, apply: 'product.deactivate', label: 'Active' },
  },
  customer: {
    openingBalance: {
      see: 'customer.due.view',
      apply: 'customer.balance.edit',
      label: 'Opening balance',
    },
    creditLimit: {
      see: 'customer.due.view',
      apply: 'customer.balance.edit',
      label: 'Credit limit',
    },
    isActive: { see: null, apply: 'customer.deactivate', label: 'Active' },
  },
  product_category: { isActive: { see: null, apply: 'product.deactivate', label: 'Active' } },
};
const money = (v) => {
  if (v === null) return null;
  const [a, b = ''] = String(v).split('.');
  return `${a}.${(b + '00').slice(0, 2)}`;
};
const INACTIVE_NOTE = 'While inactive it cannot be chosen for new entries; existing records stay.';

// ---- Purchases and stock (docs/API.md §10), in memory ----
const purchases = [];
const movements = [];
const stockOf = new Map(); // productId → current stock (integer bags, as a number internally)
const seededLast = new Map(); // productId → seeded last purchase (kept when no purchase remains)
const adjustedToday = new Map(); // `${email}:${productId}` → absolute bags adjusted today
const purchaseIdempotency = new Map();
const ADJUST_LIMIT = 10;

// ---- Commission: amount received + reason (docs/API.md §10, Akij, owner-only) ----
const commissionEntries = [];
const commissionIdempotency = new Map();
const commissionEntryView = (e) => ({
  id: e.id,
  amount: e.amount,
  receivedDate: e.receivedDate,
  note: e.note,
  createdAt: e.createdAt,
});
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka' }).format(new Date());
const qtyString = (n) => String(n);
const lineTotal = (q, price) => (Math.round(Number(q) * Number(price) * 100) / 100).toFixed(2);
const sumMoneyStr = (list) =>
  (list.reduce((a, v) => a + Math.round(Number(v) * 100), 0) / 100).toFixed(2);
const productRef = (p) => ({
  id: p.id,
  code: p.code,
  nameEn: p.nameEn,
  nameBn: p.nameBn,
  unitKey: p.unitKey,
});
const supplierRef = (s) => ({ id: s.id, code: s.code, nameEn: s.nameEn, nameBn: s.nameBn });

/** Change stock (no negative stock: returns the STOCK_INSUFFICIENT details instead). */
function moveStock(product, delta, kind, source, reason, user) {
  const current = stockOf.get(product.id) ?? 0;
  if (current + delta < 0)
    return { productId: product.id, available: qtyString(current), required: qtyString(-delta) };
  stockOf.set(product.id, current + delta);
  movements.unshift({
    id: `mv${movements.length + 1}`,
    productId: product.id,
    kind,
    quantity: qtyString(delta),
    balanceAfter: qtyString(current + delta),
    movementDate: today(),
    source,
    reason: reason ?? null,
    createdBy: { id: user.id, name: user.name },
    createdAt: new Date().toISOString(),
  });
  return null;
}

/** The last valid purchase sets a product's last purchase price; else the seeded value. */
function recomputeLast(productId) {
  const p = products.find((x) => x.id === productId);
  const latest = purchases
    .filter((pu) => pu.status === 'active' && pu.items.some((i) => i.productId === productId))
    .sort((a, b) => (a.purchaseDate < b.purchaseDate ? 1 : -1))[0];
  if (latest) {
    p.lastPurchasePrice = latest.items.find((i) => i.productId === productId).unitPrice;
    p.lastPurchasedAt = `${latest.purchaseDate}T00:00:00.000+06:00`;
  } else {
    const seed = seededLast.get(productId);
    p.lastPurchasePrice = seed.price;
    p.lastPurchasedAt = seed.at;
  }
}

function purchaseSummary(pu, perms) {
  const out = {
    id: pu.id,
    code: pu.code,
    purchaseDate: pu.purchaseDate,
    supplier: supplierRef(suppliers.find((x) => x.id === pu.supplierId)),
    paymentMethod: 'cash',
    itemCount: pu.items.length,
    totalQuantity: qtyString(pu.items.reduce((a, i) => a + Number(i.quantity), 0)),
    totalAmount: sumMoneyStr(pu.items.map((i) => lineTotal(i.quantity, i.unitPrice))),
    status: pu.status,
    supplierReference: pu.supplierReference,
    createdBy: pu.createdBy,
    createdAt: pu.createdAt,
  };
  if (!perms.includes('product.cost.view')) delete out.totalAmount;
  return out;
}

function purchaseView(pu, perms) {
  const cost = perms.includes('product.cost.view');
  return {
    ...purchaseSummary(pu, perms),
    note: pu.note,
    version: pu.version,
    items: pu.items.map((i) => {
      const item = {
        id: i.id,
        product: productRef(products.find((x) => x.id === i.productId)),
        quantity: i.quantity,
      };
      if (cost) {
        item.unitPrice = i.unitPrice;
        item.lineTotal = lineTotal(i.quantity, i.unitPrice);
      }
      return item;
    }),
    voidedAt: pu.voidedAt,
    voidReason: pu.voidReason,
    voidedBy: pu.voidedBy,
    updatedAt: pu.updatedAt,
  };
}

function stockRow(p, perms) {
  const row = {
    id: p.id,
    code: p.code,
    nameEn: p.nameEn,
    nameBn: p.nameBn,
    unitKey: p.unitKey,
    category: p.category,
    currentStock: qtyString(stockOf.get(p.id) ?? 0),
    isActive: p.isActive,
    lastPurchasePrice: p.lastPurchasePrice,
    lastPurchasedAt: p.lastPurchasedAt,
  };
  return hide(perms, row, ['lastPurchasePrice', 'lastPurchasedAt'], 'product.cost.view');
}

/** Void a purchase: stock back down (fails without stock), counters/last price recomputed. */
function voidPurchase(pu, reason, user) {
  for (const i of pu.items) {
    const p = products.find((x) => x.id === i.productId);
    if ((stockOf.get(p.id) ?? 0) < Number(i.quantity))
      return {
        productId: p.id,
        available: qtyString(stockOf.get(p.id) ?? 0),
        required: i.quantity,
      };
  }
  for (const i of pu.items) {
    const p = products.find((x) => x.id === i.productId);
    moveStock(
      p,
      -Number(i.quantity),
      'purchase_void',
      { type: 'purchase', id: pu.id, code: pu.code },
      reason,
      user,
    );
  }
  pu.status = 'void';
  pu.voidedAt = new Date().toISOString();
  pu.voidReason = reason;
  pu.voidedBy = { id: user.id, name: user.name };
  pu.updatedAt = pu.voidedAt;
  for (const i of pu.items) recomputeLast(i.productId);
  return null;
}
for (const p of products)
  seededLast.set(p.id, { price: p.lastPurchasePrice, at: p.lastPurchasedAt });

// ---- Orders, deliveries, collections and the customer ledger (docs/API.md §11) ----
const orders = [];
const deliveries = [];
const collections = [];
const ledger = []; // append-only; newest first
const salesIdempotency = new Map();
const COLLECTION_METHODS = ['cash', 'bkash', 'nagad', 'bank', 'cheque'];
const CREDIT_LIMIT_MODE = 'warn';

// ---- Expenses and the cash book (docs/API.md §13) ----
const expenses = [];
const expenseIdempotency = new Map();
let expenseCategories = [
  { id: 'ec1', nameEn: 'Salaries', nameBn: 'বেতন', sortOrder: 1, isActive: true, version: 1 },
  { id: 'ec2', nameEn: 'Rent', nameBn: 'ভাড়া', sortOrder: 2, isActive: true, version: 1 },
  { id: 'ec3', nameEn: 'Utilities', nameBn: 'বিদ্যুৎ', sortOrder: 3, isActive: true, version: 1 },
];
// `expenseMethods` falls back to `collectionMethods` when not set separately (docs/API.md §13).
const EXPENSE_METHODS = COLLECTION_METHODS;
const CASH_METHOD_KEYS = ['cash'];

const expenseCategoryView = (c) => ({
  ...c,
  createdAt: c.createdAt ?? now,
  updatedAt: c.updatedAt ?? now,
});

function expenseView(e) {
  const cat = expenseCategories.find((c) => c.id === e.categoryId);
  return {
    id: e.id,
    code: e.code,
    expenseDate: e.expenseDate,
    category: { id: cat.id, nameEn: cat.nameEn, nameBn: cat.nameBn },
    method: e.method,
    amount: e.amount,
    note: e.note,
    proofNote: e.proofNote,
    status: e.status,
    version: e.version,
    createdBy: e.createdBy,
    createdAt: e.createdAt,
    voidedAt: e.voidedAt,
    voidReason: e.voidReason,
    voidedBy: e.voidedBy,
    updatedAt: e.updatedAt,
  };
}

/** Every number counted live from the active collections, expenses and purchases (no table). */
function cashBookCompute(from, to) {
  const activeC = collections.filter((c) => c.status === 'active');
  const activeE = expenses.filter((e) => e.status === 'active');
  const activeP = purchases.filter((p) => p.status === 'active');
  const purchaseTotal = (p) =>
    Number(sumMoneyStr(p.items.map((i) => lineTotal(i.quantity, i.unitPrice))));

  const dayOf = (dateStr, kind) => {
    let collectionsIn = 0;
    let expensesOut = 0;
    let purchasesOut = 0;
    for (const c of activeC) if (c.collectionDate === dateStr) collectionsIn += Number(c.amount);
    for (const e of activeE) if (e.expenseDate === dateStr) expensesOut += Number(e.amount);
    for (const p of activeP) if (p.purchaseDate === dateStr) purchasesOut += purchaseTotal(p);
    const inAmt = collectionsIn;
    const outAmt = expensesOut + purchasesOut;
    return kind === 'in'
      ? inAmt
      : kind === 'out'
        ? outAmt
        : { collectionsIn, expensesOut, purchasesOut };
  };

  const net = (dateTest) => {
    let sum = 0;
    for (const c of activeC) if (dateTest(c.collectionDate)) sum += Number(c.amount);
    for (const e of activeE) if (dateTest(e.expenseDate)) sum -= Number(e.amount);
    for (const p of activeP) if (dateTest(p.purchaseDate)) sum -= purchaseTotal(p);
    return sum;
  };

  const openingBalance = net((d) => d < from);
  const allDates = new Set([
    ...activeC.map((c) => c.collectionDate),
    ...activeE.map((e) => e.expenseDate),
    ...activeP.map((p) => p.purchaseDate),
  ]);
  const inRangeDates = [...allDates].filter((d) => d >= from && d <= to).sort();

  let running = openingBalance;
  const days = inRangeDates.map((date) => {
    const { collectionsIn, expensesOut, purchasesOut } = dayOf(date, 'split');
    const opening = running;
    const inAmt = collectionsIn;
    const outAmt = expensesOut + purchasesOut;
    running = opening + inAmt - outAmt;
    return {
      date,
      opening: fixed(opening),
      collections: fixed(collectionsIn),
      expenses: fixed(expensesOut),
      purchases: fixed(purchasesOut),
      in: fixed(inAmt),
      out: fixed(outAmt),
      closing: fixed(running),
    };
  });

  const totalCollections = inRangeDates.reduce((s, d) => s + dayOf(d, 'split').collectionsIn, 0);
  const totalExpenses = inRangeDates.reduce((s, d) => s + dayOf(d, 'split').expensesOut, 0);
  const totalPurchases = inRangeDates.reduce((s, d) => s + dayOf(d, 'split').purchasesOut, 0);
  const byMethod = EXPENSE_METHODS.map((method) => {
    let inAmt = 0;
    let outAmt = 0;
    for (const c of activeC)
      if (c.method === method && c.collectionDate >= from && c.collectionDate <= to)
        inAmt += Number(c.amount);
    for (const e of activeE)
      if (e.method === method && e.expenseDate >= from && e.expenseDate <= to)
        outAmt += Number(e.amount);
    if (method === 'cash')
      for (const p of activeP)
        if (p.purchaseDate >= from && p.purchaseDate <= to) outAmt += purchaseTotal(p);
    return {
      method,
      isCash: CASH_METHOD_KEYS.includes(method),
      in: fixed(inAmt),
      out: fixed(outAmt),
      net: fixed(inAmt - outAmt),
    };
  });

  const closingBalance = running;
  return {
    from,
    to,
    openingBalance: fixed(openingBalance),
    closingBalance: fixed(closingBalance),
    totals: {
      collections: fixed(totalCollections),
      expenses: fixed(totalExpenses),
      purchases: fixed(totalPurchases),
      in: fixed(totalCollections),
      out: fixed(totalExpenses + totalPurchases),
      net: fixed(totalCollections - totalExpenses - totalPurchases),
      cashIn: byMethod.find((m) => m.method === 'cash')?.in ?? '0.00',
      cashOut: byMethod.find((m) => m.method === 'cash')?.out ?? '0.00',
      cashNet: byMethod.find((m) => m.method === 'cash')?.net ?? '0.00',
    },
    byMethod,
    days,
  };
}
const customerRef = (c) => ({ id: c.id, code: c.code, nameEn: c.nameEn, nameBn: c.nameBn });
const addMoney = (a, b) => (Math.round(Number(a) * 100) + Math.round(Number(b) * 100)) / 100;
const fixed = (n) => n.toFixed(2);

/** The customer's balance and counters, always recomputed from the active documents. */
function refreshCustomer(customer) {
  const delivered = deliveries
    .filter((d) => d.status === 'active' && d.customerId === customer.id)
    .flatMap((d) => d.items.map((i) => lineTotal(i.quantity, i.unitPrice)));
  const collected = collections
    .filter((c) => c.status === 'active' && c.customerId === customer.id)
    .map((c) => c.amount);
  customer.deliveredAmount = sumMoneyStr(delivered);
  customer.collectedAmount = sumMoneyStr(collected);
  customer.currentBalance = fixed(
    addMoney(
      addMoney(customer.openingBalance, customer.deliveredAmount),
      -customer.collectedAmount,
    ),
  );
  customer.pendingDeliveryQuantity = qtyString(
    orders
      .filter((o) => o.status === 'active' && o.customerId === customer.id)
      .reduce(
        (a, o) =>
          a + o.items.reduce((b, i) => b + (Number(i.quantity) - Number(i.deliveredQuantity)), 0),
        0,
      ),
  );
}

function ledgerAdd(customer, kind, amount, source, reason, user) {
  ledger.unshift({
    id: `le${ledger.length + 1}`,
    customerId: customer.id,
    kind,
    amount,
    entryDate: today(),
    source,
    reason: reason ?? null,
    createdBy: { id: user.id, name: user.name },
    createdAt: new Date().toISOString(),
  });
  refreshCustomer(customer);
}

const orderStatusOf = (o) => {
  const delivered = o.items.reduce((a, i) => a + Number(i.deliveredQuantity), 0);
  const total = o.items.reduce((a, i) => a + Number(i.quantity), 0);
  return delivered === 0 ? 'pending' : delivered < total ? 'partial' : 'delivered';
};

function orderSummaryView(o, perms) {
  const customer = customers.find((c) => c.id === o.customerId);
  const out = {
    id: o.id,
    code: o.code,
    customer: customerRef(customer),
    orderDate: o.orderDate,
    deliveryWindow: o.deliveryWindow,
    deliverBy: o.deliverBy,
    totalQuantity: qtyString(o.items.reduce((a, i) => a + Number(i.quantity), 0)),
    deliveredQuantity: qtyString(o.items.reduce((a, i) => a + Number(i.deliveredQuantity), 0)),
    remainingQuantity: qtyString(
      o.items.reduce((a, i) => a + Number(i.quantity) - Number(i.deliveredQuantity), 0),
    ),
    totalAmount: sumMoneyStr(o.items.map((i) => lineTotal(i.quantity, i.unitPrice))),
    status: o.status,
    deliveryStatus: o.status === 'void' ? 'pending' : orderStatusOf(o),
    createdBy: o.createdBy,
    createdAt: o.createdAt,
  };
  void perms;
  return out;
}

function orderView(o, perms) {
  return {
    ...orderSummaryView(o, perms),
    note: o.note,
    version: o.version,
    items: o.items.map((i) => ({
      id: i.id,
      product: productRef(products.find((p) => p.id === i.productId)),
      quantity: i.quantity,
      deliveredQuantity: i.deliveredQuantity,
      remainingQuantity: qtyString(Number(i.quantity) - Number(i.deliveredQuantity)),
      unitPrice: i.unitPrice,
      lineTotal: lineTotal(i.quantity, i.unitPrice),
    })),
    deliveries: deliveries
      .filter((d) => d.orderId === o.id)
      .map((d) => ({
        id: d.id,
        code: d.code,
        deliveryDate: d.deliveryDate,
        totalQuantity: qtyString(d.items.reduce((a, i) => a + Number(i.quantity), 0)),
        totalAmount: sumMoneyStr(d.items.map((i) => lineTotal(i.quantity, i.unitPrice))),
        status: d.status,
      })),
    voidedAt: o.voidedAt,
    voidReason: o.voidReason,
    voidedBy: o.voidedBy,
    updatedAt: o.updatedAt,
  };
}

function deliveryView(d, perms, full) {
  const order = orders.find((o) => o.id === d.orderId);
  const customer = customers.find((c) => c.id === d.customerId);
  const out = {
    id: d.id,
    code: d.code,
    order: { id: order.id, code: order.code },
    customer: customerRef(customer),
    deliveryDate: d.deliveryDate,
    transportReference: d.transportReference,
    totalQuantity: qtyString(d.items.reduce((a, i) => a + Number(i.quantity), 0)),
    totalAmount: sumMoneyStr(d.items.map((i) => lineTotal(i.quantity, i.unitPrice))),
    status: d.status,
    createdBy: d.createdBy,
    createdAt: d.createdAt,
  };
  // The flag is money-sensitive: only for someone who may see the due.
  if (perms.includes('customer.due.view')) out.creditLimitExceeded = d.creditLimitExceeded;
  if (!full) return out;
  return {
    ...out,
    note: d.note,
    version: d.version,
    items: d.items.map((i) => ({
      id: i.id,
      orderItemId: i.orderItemId,
      product: productRef(products.find((p) => p.id === i.productId)),
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      lineTotal: lineTotal(i.quantity, i.unitPrice),
    })),
    voidedAt: d.voidedAt,
    voidReason: d.voidReason,
    voidedBy: d.voidedBy,
    updatedAt: d.updatedAt,
  };
}

function collectionView(c) {
  const customer = customers.find((x) => x.id === c.customerId);
  const order = c.orderId ? orders.find((o) => o.id === c.orderId) : null;
  return {
    id: c.id,
    code: c.code,
    customer: customerRef(customer),
    order: order ? { id: order.id, code: order.code } : null,
    collectionDate: c.collectionDate,
    method: c.method,
    amount: c.amount,
    reference: c.reference,
    note: c.note,
    status: c.status,
    version: c.version,
    createdBy: c.createdBy,
    createdAt: c.createdAt,
    voidedAt: c.voidedAt,
    voidReason: c.voidReason,
    voidedBy: c.voidedBy,
    updatedAt: c.updatedAt,
  };
}

/** Void a delivery: stock back up, the order's delivered count down, a reversing ledger line. */
function voidDelivery(d, reason, user) {
  const customer = customers.find((c) => c.id === d.customerId);
  const order = orders.find((o) => o.id === d.orderId);
  for (const i of d.items) {
    moveStock(
      products.find((p) => p.id === i.productId),
      Number(i.quantity),
      'delivery_void',
      { type: 'delivery', id: d.id, code: d.code },
      reason,
      user,
    );
    const line = order.items.find((x) => x.id === i.orderItemId);
    line.deliveredQuantity = qtyString(Number(line.deliveredQuantity) - Number(i.quantity));
  }
  d.status = 'void';
  d.voidedAt = new Date().toISOString();
  d.voidReason = reason;
  d.voidedBy = { id: user.id, name: user.name };
  d.updatedAt = d.voidedAt;
  order.updatedAt = d.voidedAt;
  ledgerAdd(
    customer,
    'delivery_void',
    fixed(-Number(sumMoneyStr(d.items.map((i) => lineTotal(i.quantity, i.unitPrice))))),
    { type: 'delivery', id: d.id, code: d.code },
    reason,
    user,
  );
}

function voidCollection(c, reason, user) {
  const customer = customers.find((x) => x.id === c.customerId);
  c.status = 'void';
  c.voidedAt = new Date().toISOString();
  c.voidReason = reason;
  c.voidedBy = { id: user.id, name: user.name };
  c.updatedAt = c.voidedAt;
  ledgerAdd(
    customer,
    'collection_void',
    c.amount,
    { type: 'collection', id: c.id, code: c.code },
    reason,
    user,
  );
}

function voidOrder(o, reason, user) {
  if (deliveries.some((d) => d.orderId === o.id && d.status === 'active')) return 'DELIVERY_EXISTS';
  o.status = 'void';
  o.voidedAt = new Date().toISOString();
  o.voidReason = reason;
  o.voidedBy = { id: user.id, name: user.name };
  o.updatedAt = o.voidedAt;
  // Money already collected stays as the customer's advance (step-5b decision 3).
  refreshCustomer(customers.find((c) => c.id === o.customerId));
  return null;
}
for (const c of customers) refreshCustomer(c);

/** Someone with an account in another business only (for "add existing user"). */
const OUTSIDER = {
  id: 'u4',
  name: 'Example Accountant',
  email: 'accountant@example.com',
  phone: '+8801700000004',
  isActive: true,
};
/** Members of example-cement as GET users shows them (platform owners are not listed). */
const members = [
  { id: 'u2', name: 'Example Manager', email: 'manager@example.com', phone: null, role: 'manager' },
  {
    id: 'u3',
    name: 'Example Salesman',
    email: 'salesman@example.com',
    phone: null,
    role: 'salesman',
  },
].map((m) => ({ ...m, isActive: true, isPlatformOwner: false, lastLoginAt: null }));
const normalizePhone = (v) => {
  const c = String(v)
    .replace(/[\s\-().]/g, '')
    .replace(/[০-৯]/g, (d) => String(d.charCodeAt(0) - 2534));
  const cand = /^01\d{9}$/.test(c) ? `+880${c.slice(1)}` : /^8801\d{9}$/.test(c) ? `+${c}` : c;
  return /^\+[1-9]\d{7,14}$/.test(cand) ? cand : null;
};
const hide = (perms, row, fields, perm) => {
  if (perms.includes(perm)) return row;
  const copy = { ...row };
  for (const f of fields) delete copy[f];
  return copy;
};
const pageOf = (items, page) => ({
  items: items.slice((page - 1) * 10, page * 10),
  page,
  pageSize: 10,
  total: items.length,
});
const match = (q, ...values) =>
  !q || values.some((v) => v && String(v).toLowerCase().includes(q.toLowerCase()));

http
  .createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      const url = new URL(req.url, 'http://x');
      const path = url.pathname.replace(/^\/api\/v1/, '');
      const body = raw ? JSON.parse(raw) : {};
      const cookies = cookiesOf(req);
      if (req.method !== 'GET' && req.headers.origin && !ORIGINS.includes(req.headers.origin))
        return err(res, 403, 'Origin not allowed', 'ORIGIN_NOT_ALLOWED');
      currentDelay =
        delay.ms > 0 && (!delay.paths || delay.paths.some((p) => path.startsWith(p)))
          ? delay.ms
          : 0;
      if (path === '/health') return send(res, 200, { status: 'ok' });
      if (path === '/__test/delay' && req.method === 'POST') {
        delay = {
          ms: Math.min(Math.max(Number(body.ms) || 0, 0), MAX_DELAY_MS),
          paths: Array.isArray(body.paths) && body.paths.length > 0 ? body.paths : null,
        };
        currentDelay = 0; // answer the control call itself at once
        return send(res, 200, delay);
      }
      if (path === '/auth/login') {
        const u =
          USERS[
            String(body.identifier ?? '')
              .trim()
              .toLowerCase()
          ];
        if (!u || u.password !== body.password)
          return err(res, 401, 'Invalid credentials', 'INVALID_CREDENTIALS');
        issue(res, u.user.email);
        return send(res, 200, { user: u.user });
      }
      if (path === '/auth/refresh') {
        const email = refresh.get(cookies.jesan_rt);
        if (!email) return err(res, 401, 'Unauthorized');
        refresh.delete(cookies.jesan_rt);
        issue(res, email);
        return send(res, 200, { status: 'ok' });
      }
      if (path === '/auth/logout') {
        res.setHeader('Set-Cookie', [
          'jesan_at=; Max-Age=0; Path=/',
          'jesan_rt=; Max-Age=0; Path=/api/v1/auth',
        ]);
        res.writeHead(204);
        return res.end();
      }
      const email = access.get(cookies.jesan_at);
      if (!email) return err(res, 401, 'Unauthorized');
      const me = USERS[email];
      if (path === '/auth/me') return send(res, 200, { user: me.user, businesses: me.businesses });

      const m = path.match(/^\/b\/([^/]+)\/(.+)$/);
      if (!m || m[1] !== 'example-cement') return err(res, 403, 'Access denied');
      const perms = me.businesses[0].permissions;
      const need = (p) => (perms.includes(p) ? true : (err(res, 403, 'Access denied'), false));
      const rest = m[2];
      const page = Number(url.searchParams.get('page') ?? 1);
      const active = url.searchParams.get('active') ?? 'true';
      const activeOk = (r) => active === 'all' || r.isActive === (active === 'true');
      const search = url.searchParams.get('search') ?? '';

      if (rest === 'product-units')
        return (
          need('product.view') &&
          send(res, 200, {
            defaultUnitKey: 'bag',
            items: [{ key: 'bag', nameEn: 'Bag', nameBn: 'বস্তা', decimals: 0 }],
          })
        );
      if (rest === 'product-categories' && req.method === 'GET')
        return need('product.view') && send(res, 200, { items: categories.filter(activeOk) });
      if (rest === 'products' && req.method === 'GET') {
        if (!need('product.view')) return;
        const cat = url.searchParams.get('categoryId');
        const list = products.filter(
          (p) =>
            activeOk(p) &&
            (!cat || p.category.id === cat) &&
            match(search, p.nameEn, p.nameBn, p.code),
        );
        return send(res, 200, {
          ...pageOf(list, page),
          items: pageOf(list, page).items.map((p) =>
            hide(perms, p, COST_FIELDS, 'product.cost.view'),
          ),
        });
      }
      if (rest === 'products' && req.method === 'POST') {
        if (!need('product.manage')) return;
        if ('defaultSalePrice' in body)
          return invalid(res, [
            {
              field: 'defaultSalePrice',
              code: 'DEFAULT_SALE_PRICE_NOT_ALLOWED',
              message: 'property defaultSalePrice should not exist',
            },
          ]);
        for (const [field, code] of [
          ['purchasePrice', 'PURCHASE_PRICE_NOT_ALLOWED'],
          ['lastPurchasePrice', 'LAST_PURCHASE_PRICE_NOT_ALLOWED'],
        ])
          if (field in body) return err(res, 400, `${field} cannot be set`, code, field);
        const cat = categories.find((c) => c.id === body.categoryId && c.isActive);
        if (!cat)
          return err(
            res,
            400,
            'Category not found or inactive',
            'CATEGORY_NOT_FOUND_OR_INACTIVE',
            'categoryId',
          );
        const name = String(body.nameEn ?? '').trim();
        if (products.some((p) => p.nameEn.toLowerCase() === name.toLowerCase()))
          return err(
            res,
            409,
            'A product with this name already exists',
            'NAME_EN_DUPLICATE',
            'nameEn',
          );
        const n = products.length + 1;
        const p = {
          id: `p${n}`,
          code: `P-${String(n).padStart(4, '0')}`,
          category: { id: cat.id, nameEn: cat.nameEn, nameBn: cat.nameBn },
          nameEn: name,
          nameBn: body.nameBn,
          unitKey: body.unitKey ?? 'bag',
          lastPurchasePrice: null,
          lastPurchasedAt: null,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        };
        products.push(p);
        return send(res, 201, hide(perms, p, COST_FIELDS, 'product.cost.view'));
      }
      // ---- Purchases ----
      if (rest === 'purchases' && req.method === 'POST') {
        if (!need('purchase.create') || !need('product.cost.view')) return;
        const key = req.headers['idempotency-key'];
        const seen = key && purchaseIdempotency.get(`${email}:${key}`);
        if (seen) return send(res, 200, purchaseView(seen, perms));
        const items = Array.isArray(body.items) ? body.items : [];
        if (items.length < 1 || items.length > 50)
          return err(res, 400, 'items must contain 1 to 50 lines', 'ITEMS_INVALID', 'items');
        const date = body.purchaseDate ?? today();
        if (date > today())
          return err(
            res,
            400,
            'Purchase date is in the future',
            'PURCHASE_DATE_IN_FUTURE',
            'purchaseDate',
          );
        const seenIds = new Set();
        for (const [n, line] of items.entries()) {
          if (seenIds.has(line.productId))
            return err(res, 400, 'Duplicate product', 'PRODUCT_DUPLICATE', `items.${n}.productId`);
          seenIds.add(line.productId);
          const prod = products.find((x) => x.id === line.productId && x.isActive);
          if (!prod)
            return err(
              res,
              400,
              'Product not found or inactive',
              'PRODUCT_NOT_FOUND_OR_INACTIVE',
              `items.${n}.productId`,
            );
          if (!/^[1-9]\d*$/.test(String(line.quantity)))
            return err(
              res,
              400,
              'Quantity is not valid',
              'QUANTITY_INVALID',
              `items.${n}.quantity`,
            );
          if (!/^\d{1,12}(\.\d{1,2})?$/.test(String(line.unitPrice)))
            return invalid(res, [
              { field: `items.${n}.unitPrice`, code: 'UNIT_PRICE_INVALID', message: 'x' },
            ]);
        }
        const supplier = suppliers.find(
          (x) => x.id === (body.supplierId ?? suppliers.find((y) => y.isPrincipal).id),
        );
        if (!supplier?.isActive)
          return err(
            res,
            400,
            'Supplier not found or inactive',
            'SUPPLIER_NOT_FOUND_OR_INACTIVE',
            'supplierId',
          );
        const n = purchases.length + 1;
        const nowIso = new Date().toISOString();
        const pu = {
          id: `pu${n}`,
          code: `PUR-${String(n).padStart(4, '0')}`,
          purchaseDate: date,
          supplierId: supplier.id,
          status: 'active',
          supplierReference: body.supplierReference ?? null,
          note: body.note ?? null,
          version: 1,
          createdBy: { id: me.user.id, name: me.user.name },
          createdAt: nowIso,
          updatedAt: nowIso,
          voidedAt: null,
          voidReason: null,
          voidedBy: null,
          items: items.map((line, i) => ({
            id: `it${n}-${i + 1}`,
            productId: line.productId,
            quantity: String(line.quantity),
            unitPrice: money(line.unitPrice),
          })),
        };
        purchases.unshift(pu);
        for (const i of pu.items) {
          moveStock(
            products.find((x) => x.id === i.productId),
            Number(i.quantity),
            'purchase',
            { type: 'purchase', id: pu.id, code: pu.code },
            null,
            me.user,
          );
          recomputeLast(i.productId);
        }
        if (key) purchaseIdempotency.set(`${email}:${key}`, pu);
        return send(res, 201, purchaseView(pu, perms));
      }
      if (rest === 'purchases/summary' && req.method === 'GET') {
        if (!need('purchase.view')) return;
        const f = Object.fromEntries(url.searchParams);
        const today = new Date().toISOString().slice(0, 10);
        const from = f.from || `${today.slice(0, 7)}-01`;
        const to = f.to || (today > from ? today : from);
        const inRange = purchases.filter(
          (pu) => pu.status === 'active' && pu.purchaseDate >= from && pu.purchaseDate <= to,
        );
        const out = {
          from,
          to,
          count: inRange.length,
          totalQuantity: qtyString(
            inRange.reduce((s, pu) => s + pu.items.reduce((a, i) => a + Number(i.quantity), 0), 0),
          ),
          totalAmount: sumMoneyStr(
            inRange.flatMap((pu) => pu.items.map((i) => lineTotal(i.quantity, i.unitPrice))),
          ),
        };
        if (!perms.includes('product.cost.view')) delete out.totalAmount;
        return send(res, 200, out);
      }
      if (rest === 'purchases' && req.method === 'GET') {
        if (!need('purchase.view')) return;
        const f = Object.fromEntries(url.searchParams);
        const list = purchases.filter(
          (pu) =>
            (!f.from || pu.purchaseDate >= f.from) &&
            (!f.to || pu.purchaseDate <= f.to) &&
            (!f.supplierId || pu.supplierId === f.supplierId) &&
            (!f.status || pu.status === f.status) &&
            (!f.productId || pu.items.some((i) => i.productId === f.productId)),
        );
        const pg = pageOf(list, page);
        return send(res, 200, { ...pg, items: pg.items.map((pu) => purchaseSummary(pu, perms)) });
      }
      let pm = rest.match(/^purchases\/([^/]+)(\/void)?$/);
      if (pm) {
        const pu = purchases.find((x) => x.id === pm[1]);
        if (!need('purchase.view')) return;
        if (!pu) return err(res, 404, 'Purchase not found', 'PURCHASE_NOT_FOUND');
        if (req.method === 'GET' && !pm[2]) return send(res, 200, purchaseView(pu, perms));
        if (req.method === 'POST' && pm[2]) {
          if (!need('purchase.void')) return;
          if (pu.status === 'void') return err(res, 409, 'Already void', 'PURCHASE_ALREADY_VOID');
          if (!body.reason || body.reason.trim().length < 3)
            return err(res, 400, 'A reason is required', 'REASON_REQUIRED', 'reason');
          const short = voidPurchase(pu, body.reason.trim(), me.user);
          if (short)
            return send(res, 409, {
              statusCode: 409,
              message: 'Not enough stock',
              code: 'STOCK_INSUFFICIENT',
              details: short,
            });
          return send(res, 200, purchaseView(pu, perms));
        }
        if (req.method === 'PATCH') {
          if (pu.status === 'void') return err(res, 409, 'Already void', 'PURCHASE_ALREADY_VOID');
          const sensitive = 'purchaseDate' in body || Array.isArray(body.items);
          if (sensitive && !need('purchase.edit')) return;
          if (!sensitive && !need('purchase.create')) return;
          if (sensitive && (!body.reason || body.reason.trim().length < 3))
            return err(res, 400, 'A reason is required', 'REASON_REQUIRED', 'reason');
          for (const change of body.items ?? []) {
            const item = pu.items.find((i) => i.id === change.id);
            if (change.quantity !== undefined) {
              const delta = Number(change.quantity) - Number(item.quantity);
              const short = moveStock(
                products.find((x) => x.id === item.productId),
                delta,
                'purchase_edit',
                { type: 'purchase', id: pu.id, code: pu.code },
                body.reason,
                me.user,
              );
              if (short)
                return send(res, 409, {
                  statusCode: 409,
                  message: 'Not enough stock',
                  code: 'STOCK_INSUFFICIENT',
                  field: `items.${item.id}.quantity`,
                  errors: [
                    {
                      field: `items.${item.id}.quantity`,
                      code: 'STOCK_INSUFFICIENT',
                      message: 'x',
                    },
                  ],
                  details: short,
                });
              item.quantity = String(change.quantity);
            }
            if (change.unitPrice !== undefined) item.unitPrice = money(change.unitPrice);
          }
          for (const k of ['purchaseDate', 'note', 'supplierReference'])
            if (k in body) pu[k] = body[k];
          pu.version += 1;
          pu.updatedAt = new Date().toISOString();
          for (const i of pu.items) recomputeLast(i.productId);
          return send(res, 200, purchaseView(pu, perms));
        }
      }
      // ---- Commission: amount received + reason (docs/API.md §10, Akij, owner-only) ----
      if (rest === 'commission-entries' && req.method === 'GET') {
        if (!need('commission.view')) return;
        const list = [...commissionEntries].sort((a, b) =>
          a.receivedDate < b.receivedDate ? 1 : -1,
        );
        const pg = pageOf(list, page);
        return send(res, 200, { ...pg, items: pg.items.map(commissionEntryView) });
      }
      if (rest === 'commission-entries' && req.method === 'POST') {
        if (!need('commission.manage')) return;
        const key = req.headers['idempotency-key'];
        const seen = key && commissionIdempotency.get(`${email}:${key}`);
        if (seen) return send(res, 200, commissionEntryView(seen));
        if (!(Number(body.amount) > 0))
          return err(res, 400, 'Amount too small', 'AMOUNT_TOO_SMALL', 'amount');
        if (body.receivedDate > today())
          return err(
            res,
            400,
            'receivedDate in the future',
            'COMMISSION_DATE_IN_FUTURE',
            'receivedDate',
          );
        if (!String(body.note ?? '').trim())
          return invalid(res, [
            { field: 'note', code: 'VALIDATION_FAILED', message: 'note is required' },
          ]);
        const e = {
          id: `ce${commissionEntries.length + 1}`,
          amount: money(body.amount),
          receivedDate: body.receivedDate,
          note: String(body.note).trim(),
          createdAt: new Date().toISOString(),
        };
        commissionEntries.push(e);
        if (key) commissionIdempotency.set(`${email}:${key}`, e);
        return send(res, 201, commissionEntryView(e));
      }
      let ceIdMatch = rest.match(/^commission-entries\/([^/]+)$/);
      if (ceIdMatch) {
        if (!need('commission.view')) return;
        const e = commissionEntries.find((x) => x.id === ceIdMatch[1]);
        if (!e) return err(res, 404, 'Entry not found', 'COMMISSION_ENTRY_NOT_FOUND');
        if (req.method === 'GET') return send(res, 200, commissionEntryView(e));
        if (req.method === 'PATCH') {
          if (!need('commission.manage')) return;
          if (body.amount !== undefined && !(Number(body.amount) > 0))
            return err(res, 400, 'Amount too small', 'AMOUNT_TOO_SMALL', 'amount');
          if (body.receivedDate !== undefined && body.receivedDate > today())
            return err(
              res,
              400,
              'receivedDate in the future',
              'COMMISSION_DATE_IN_FUTURE',
              'receivedDate',
            );
          if (body.amount !== undefined) e.amount = money(body.amount);
          if (body.receivedDate !== undefined) e.receivedDate = body.receivedDate;
          if (body.note !== undefined) e.note = String(body.note).trim();
          return send(res, 200, commissionEntryView(e));
        }
      }
      // ---- Dashboard aggregates (docs/API.md §14-ক): same rows as the other mock routes ----
      const dashMonthRange = (f) => {
        const monthStart = today().slice(0, 7) + '-01';
        return { from: f.from ?? monthStart, to: f.to ?? today() };
      };
      const dashMoney = (items) => sumMoneyStr(items);
      const dashPurchaseAmount = (p) =>
        dashMoney(p.items.map((i) => lineTotal(i.quantity, i.unitPrice)));
      const dashPurchaseQty = (p) => p.items.reduce((a, i) => a + Number(i.quantity), 0);
      const dashDeliveryAmount = (d) =>
        dashMoney(d.items.map((i) => lineTotal(i.quantity, i.unitPrice)));
      const dashDeliveryQty = (d) => d.items.reduce((a, i) => a + Number(i.quantity), 0);
      if (rest === 'dashboard/cashbook' && req.method === 'GET') {
        if (!need('cashbook.view')) return;
        const f = Object.fromEntries(url.searchParams);
        const { from, to } = dashMonthRange(f);
        const rows = [
          ...collections
            .filter((c) => c.status === 'active')
            .map((c) => ({
              type: 'collection',
              method: c.method,
              dir: 'in',
              amount: c.amount,
              date: c.collectionDate,
            })),
          ...expenses
            .filter((e) => e.status === 'active')
            .map((e) => ({
              type: 'expense',
              method: e.method,
              dir: 'out',
              amount: e.amount,
              date: e.expenseDate,
            })),
          ...purchases
            .filter((p) => p.status === 'active')
            .map((p) => ({
              type: 'purchase',
              method: 'cash',
              dir: 'out',
              amount: dashPurchaseAmount(p),
              date: p.purchaseDate,
            })),
        ];
        const cashMethods = new Set(['cash']);
        const bucket = () => ({ opening: 0, collectionsIn: 0, in: 0, out: 0 });
        const buckets = { cash: bucket(), bank: bucket() };
        for (const row of rows) {
          const b = buckets[cashMethods.has(row.method) ? 'cash' : 'bank'];
          const amt = Number(row.amount);
          if (row.date < from) {
            b.opening += row.dir === 'in' ? amt : -amt;
          } else if (row.date <= to) {
            if (row.dir === 'in') {
              b.in += amt;
              if (row.type === 'collection') b.collectionsIn += amt;
            } else {
              b.out += amt;
            }
          }
        }
        const view = (b) => ({
          opening: b.opening.toFixed(2),
          collectionsIn: b.collectionsIn.toFixed(2),
          in: b.in.toFixed(2),
          out: b.out.toFixed(2),
          closing: (b.opening + b.in - b.out).toFixed(2),
        });
        const cash = view(buckets.cash);
        const bank = view(buckets.bank);
        const zero = view(bucket());
        return send(res, 200, {
          from,
          to,
          cash,
          bank,
          unassigned: zero,
          availableCashAndBank: (Number(cash.closing) + Number(bank.closing)).toFixed(2),
        });
      }
      if (rest === 'dashboard/finance-summary' && req.method === 'GET') {
        if (!need('report.view')) return;
        const f = Object.fromEntries(url.searchParams);
        const { from, to } = dashMonthRange(f);
        const inRange = (date) => date >= from && date <= to;
        const salesTotal = deliveries
          .filter((d) => d.status === 'active' && inRange(d.deliveryDate))
          .reduce((a, d) => a + Number(dashDeliveryAmount(d)), 0);
        const collectionTotal = collections
          .filter((c) => c.status === 'active' && inRange(c.collectionDate))
          .reduce((a, c) => a + Number(c.amount), 0);
        const expenseTotal = expenses
          .filter((e) => e.status === 'active' && inRange(e.expenseDate))
          .reduce((a, e) => a + Number(e.amount), 0);
        const purchaseTotal = purchases
          .filter((p) => p.status === 'active' && inRange(p.purchaseDate))
          .reduce((a, p) => a + Number(dashPurchaseAmount(p)), 0);
        const commissionTotal = commissionEntries
          .filter((r) => inRange(r.receivedDate))
          .reduce((a, r) => a + Number(r.amount), 0);
        const due = customers
          .filter((c) => c.isActive !== false && Number(c.currentBalance ?? 0) > 0)
          .reduce((a, c) => a + Number(c.currentBalance ?? 0), 0);
        // Half the delivered value stands in for cost here; the real figure is
        // the FIFO cost frozen on each delivery line (docs/API.md).
        const cogs = salesTotal * 0.5;
        const body = {
          from,
          to,
          sales: fixed(salesTotal),
          collection: fixed(collectionTotal),
          customerDue: fixed(due),
          expenses: fixed(expenseTotal),
          commissionReceived: fixed(commissionTotal),
        };
        if (perms.includes('profit.view')) {
          body.totalPurchase = fixed(purchaseTotal);
          body.currentStockQuantity = qtyString(
            products.reduce((a, p) => a + Number(stockOf.get(p.id) ?? 0), 0),
          );
          body.currentStockValue = fixed(cogs);
          body.cogs = fixed(cogs);
          body.grossProfit = fixed(salesTotal - cogs);
          body.netProfit = fixed(salesTotal - cogs - expenseTotal + commissionTotal);
          body.uncostedQuantityDelivered = '0.000';
          body.uncostedQuantityOnHand = '0.000';
          body.uncostedDeliveryLines = 0;
          body.productsWithUnknownCostStock = 0;
          body.costComplete = true;
        }
        return send(res, 200, body);
      }
      if (rest === 'dashboard/kpis' && req.method === 'GET') {
        if (!need('report.view')) return;
        const f = Object.fromEntries(url.searchParams);
        const windowOf = ({ from, to }) => {
          const inRange = (date) => date >= from && date <= to;
          const active = deliveries.filter((d) => d.status === 'active' && inRange(d.deliveryDate));
          const out = {
            from,
            to,
            collection: fixed(
              collections
                .filter((c) => c.status === 'active' && inRange(c.collectionDate))
                .reduce((a, c) => a + Number(c.amount), 0),
            ),
            sales: fixed(active.reduce((a, d) => a + Number(dashDeliveryAmount(d)), 0)),
            salesQuantity: qtyString(active.reduce((a, d) => a + deliveryQty(d), 0)),
          };
          if (perms.includes('purchase.view')) {
            out.purchaseQuantity = qtyString(
              purchases
                .filter((pu) => pu.status === 'active' && inRange(pu.purchaseDate))
                .reduce((a, pu) => a + pu.items.reduce((s2, i) => s2 + Number(i.quantity), 0), 0),
            );
          }
          return out;
        };
        const current = windowOf(dashMonthRange(f));
        return send(res, 200, { current });
      }
      if (rest === 'dashboard/monthly-series' && req.method === 'GET') {
        if (!need('report.view')) return;
        const year = Number(url.searchParams.get('year') ?? new Date().getFullYear());
        const showCost = perms.includes('product.cost.view');
        const months = Array.from({ length: 12 }, (_, i) => {
          const month = `${year}-${String(i + 1).padStart(2, '0')}`;
          const inMonth = (date) => String(date).startsWith(month);
          const collection = collections
            .filter((c) => c.status === 'active' && inMonth(c.collectionDate))
            .reduce((a, c) => a + Number(c.amount), 0);
          const dl = deliveries.filter((d) => d.status === 'active' && inMonth(d.deliveryDate));
          const pu = purchases.filter((p) => p.status === 'active' && inMonth(p.purchaseDate));
          const row = {
            month,
            collection: collection.toFixed(2),
            sales: dl.reduce((a, d) => a + Number(dashDeliveryAmount(d)), 0).toFixed(2),
            salesQuantity: dl.reduce((a, d) => a + dashDeliveryQty(d), 0).toFixed(3),
            purchaseQuantity: pu.reduce((a, p) => a + dashPurchaseQty(p), 0).toFixed(3),
          };
          if (showCost) {
            row.purchaseAmount = pu
              .reduce((a, p) => a + Number(dashPurchaseAmount(p)), 0)
              .toFixed(2);
          }
          return row;
        });
        return send(res, 200, { year, months });
      }
      if (rest === 'dashboard/commission-series' && req.method === 'GET') {
        if (!need('commission.view')) return;
        const year = Number(url.searchParams.get('year') ?? new Date().getFullYear());
        const months = Array.from({ length: 12 }, (_, i) => {
          const month = `${year}-${String(i + 1).padStart(2, '0')}`;
          const received = commissionEntries
            .filter((r) => String(r.receivedDate).startsWith(month))
            .reduce((a, r) => a + Number(r.amount), 0);
          return { month, received: received.toFixed(2) };
        });
        const lifetimeReceived = commissionEntries.reduce((a, r) => a + Number(r.amount), 0);
        return send(res, 200, {
          year,
          months,
          yearReceived: months.reduce((a, m) => a + Number(m.received), 0).toFixed(2),
          lifetimeReceived: lifetimeReceived.toFixed(2),
        });
      }
      if (rest === 'commission-summary' && req.method === 'GET') {
        if (!need('commission.view')) return;
        const year = String(url.searchParams.get('year') ?? new Date().getFullYear());
        const yearEntries = commissionEntries.filter((r) => r.receivedDate.startsWith(year));
        return send(res, 200, {
          year: Number(year),
          totalReceived: sumMoneyStr(yearEntries.map((r) => r.amount)),
          entryCount: yearEntries.length,
        });
      }
      if (rest === 'purchase-counters' && req.method === 'GET') {
        if (!need('commission.view')) return;
        const year = String(url.searchParams.get('year') ?? new Date().getFullYear());
        const months = Array.from({ length: 12 }, (_, i) => {
          const month = `${year}-${String(i + 1).padStart(2, '0')}`;
          const quantity = purchases
            .filter((pu) => pu.status !== 'void' && pu.purchaseDate.startsWith(month))
            .flatMap((pu) => pu.items.map((item) => Number(item.quantity)))
            .reduce((sum, qty) => sum + qty, 0);
          return { month, quantity: String(quantity) };
        });
        return send(res, 200, { year: Number(year), months });
      }
      // ---- Orders, deliveries and collections (docs/API.md §11) ----
      if (rest === 'collection-methods' && req.method === 'GET')
        return need('collection.create') && send(res, 200, { items: COLLECTION_METHODS });
      if (rest === 'orders' && req.method === 'POST') {
        if (!need('sale.create')) return;
        const key = req.headers['idempotency-key'];
        const seen = key && salesIdempotency.get(`${email}:${key}`);
        if (seen) return send(res, 200, orderView(seen, perms));
        const customer = customers.find((c) => c.id === body.customerId && c.isActive);
        if (!customer)
          return err(
            res,
            400,
            'Customer not found or inactive',
            'CUSTOMER_NOT_FOUND_OR_INACTIVE',
            'customerId',
          );
        if (!['today', 'two_days', 'one_week'].includes(body.deliveryWindow))
          return err(
            res,
            400,
            'Unknown delivery window',
            'DELIVERY_WINDOW_INVALID',
            'deliveryWindow',
          );
        const items = Array.isArray(body.items) ? body.items : [];
        if (items.length < 1 || items.length > 50)
          return err(res, 400, 'items must contain 1 to 50 lines', 'ITEMS_INVALID', 'items');
        const date = body.orderDate ?? today();
        if (date > today())
          return err(res, 400, 'Order date is in the future', 'ORDER_DATE_IN_FUTURE', 'orderDate');
        if (body.deliverBy && body.deliverBy < date)
          return err(
            res,
            400,
            'Promised date is before the order',
            'DELIVER_BY_INVALID',
            'deliverBy',
          );
        const seenIds = new Set();
        for (const [n, line] of items.entries()) {
          if (seenIds.has(line.productId))
            return err(res, 400, 'Duplicate product', 'PRODUCT_DUPLICATE', `items.${n}.productId`);
          seenIds.add(line.productId);
          const product = products.find((x) => x.id === line.productId && x.isActive);
          if (!product)
            return err(
              res,
              400,
              'Product not found or inactive',
              'PRODUCT_NOT_FOUND_OR_INACTIVE',
              `items.${n}.productId`,
            );
          if (!/^[1-9]\d*$/.test(String(line.quantity)))
            return err(
              res,
              400,
              'Quantity is not valid',
              'QUANTITY_INVALID',
              `items.${n}.quantity`,
            );
          if (!/^\d{1,12}(\.\d{1,2})?$/.test(String(line.unitPrice)))
            return invalid(res, [
              { field: `items.${n}.unitPrice`, code: 'UNIT_PRICE_INVALID', message: 'x' },
            ]);
        }
        const n = orders.length + 1;
        const nowIso = new Date().toISOString();
        const o = {
          id: `o${n}`,
          code: `ORD-${String(n).padStart(4, '0')}`,
          customerId: customer.id,
          orderDate: date,
          deliveryWindow: body.deliveryWindow,
          deliverBy: body.deliverBy ?? null,
          note: body.note ?? null,
          status: 'active',
          version: 1,
          createdBy: { id: me.user.id, name: me.user.name },
          createdAt: nowIso,
          updatedAt: nowIso,
          voidedAt: null,
          voidReason: null,
          voidedBy: null,
          items: items.map((line, i) => ({
            id: `oi${n}-${i + 1}`,
            productId: line.productId,
            quantity: String(line.quantity),
            deliveredQuantity: '0',
            unitPrice: money(line.unitPrice),
          })),
        };
        orders.unshift(o);
        refreshCustomer(customer);
        if (key) salesIdempotency.set(`${email}:${key}`, o);
        return send(res, 201, orderView(o, perms));
      }
      if (rest === 'orders' && req.method === 'GET') {
        if (!perms.includes('sale.view.all') && !perms.includes('sale.view.own'))
          return err(res, 403, 'Access denied');
        const f = Object.fromEntries(url.searchParams);
        const mine = !perms.includes('sale.view.all');
        const list = orders.filter((o) => {
          const status = o.status === 'void' ? 'void' : orderStatusOf(o);
          return (
            (!mine || o.createdBy.id === me.user.id) &&
            (!f.customerId || o.customerId === f.customerId) &&
            (!f.from || o.orderDate >= f.from) &&
            (!f.to || o.orderDate <= f.to) &&
            (!f.status ||
              (f.status === 'open'
                ? o.status === 'active' && status !== 'delivered'
                : f.status === status))
          );
        });
        const pg = pageOf(list, page);
        return send(res, 200, {
          ...pg,
          items: pg.items.map((o) => orderSummaryView(o, perms)),
        });
      }
      let om = rest.match(/^orders\/([^/]+)(\/void)?$/);
      if (om) {
        const o = orders.find((x) => x.id === om[1]);
        if (!perms.includes('sale.view.all') && !perms.includes('sale.view.own'))
          return err(res, 403, 'Access denied');
        const mine = !perms.includes('sale.view.all');
        if (!o || (mine && o.createdBy.id !== me.user.id))
          return err(res, 404, 'Order not found', 'ORDER_NOT_FOUND');
        if (req.method === 'GET' && !om[2]) return send(res, 200, orderView(o, perms));
        if (req.method === 'POST' && om[2]) {
          if (!need('sale.void')) return;
          if (o.status === 'void') return err(res, 409, 'Already void', 'ORDER_ALREADY_VOID');
          if (!body.reason || body.reason.trim().length < 3)
            return err(res, 400, 'A reason is required', 'REASON_REQUIRED', 'reason');
          const blocked = voidOrder(o, body.reason.trim(), me.user);
          if (blocked) return err(res, 409, 'Active deliveries exist', blocked);
          return send(res, 200, orderView(o, perms));
        }
        if (req.method === 'PATCH') {
          if (!need('sale.edit')) return;
          if (o.status === 'void') return err(res, 409, 'Already void', 'ORDER_ALREADY_VOID');
          if (!body.reason || body.reason.trim().length < 3)
            return err(res, 400, 'A reason is required', 'REASON_REQUIRED', 'reason');
          for (const change of body.items ?? []) {
            const line = o.items.find((i) => i.id === change.id);
            if (!line)
              return err(
                res,
                400,
                'Line not found',
                'ORDER_ITEM_NOT_FOUND',
                `items.${change.id}.quantity`,
              );
            if (change.quantity !== undefined) {
              if (Number(change.quantity) < Number(line.deliveredQuantity))
                return err(
                  res,
                  400,
                  'Below what is delivered',
                  'ORDER_QUANTITY_TOO_SMALL',
                  `items.${line.id}.quantity`,
                );
              line.quantity = String(change.quantity);
            }
            if (change.unitPrice !== undefined) line.unitPrice = money(change.unitPrice);
          }
          for (const k of ['orderDate', 'deliveryWindow', 'deliverBy', 'note'])
            if (k in body) o[k] = body[k];
          o.version += 1;
          o.updatedAt = new Date().toISOString();
          refreshCustomer(customers.find((c) => c.id === o.customerId));
          return send(res, 200, orderView(o, perms));
        }
      }
      if (rest === 'deliveries' && req.method === 'POST') {
        if (!need('delivery.create')) return;
        const key = req.headers['idempotency-key'];
        const seen = key && salesIdempotency.get(`${email}:${key}`);
        if (seen) return send(res, 200, deliveryView(seen, perms, true));
        const o = orders.find((x) => x.id === body.orderId);
        if (!o) return err(res, 404, 'Order not found', 'ORDER_NOT_FOUND', 'orderId');
        if (o.status === 'void') return err(res, 409, 'Order is void', 'ORDER_ALREADY_VOID');
        const customer = customers.find((c) => c.id === o.customerId);
        const date = body.deliveryDate ?? today();
        if (date > today())
          return err(res, 400, 'In the future', 'DELIVERY_DATE_IN_FUTURE', 'deliveryDate');
        if (date < o.orderDate)
          return err(res, 400, 'Before the order', 'DELIVERY_DATE_INVALID', 'deliveryDate');
        const items = Array.isArray(body.items) ? body.items : [];
        if (items.length < 1)
          return err(res, 400, 'items must contain 1 line at least', 'ITEMS_INVALID', 'items');
        const seenLines = new Set();
        for (const [n, line] of items.entries()) {
          const orderItem = o.items.find((i) => i.id === line.orderItemId);
          if (!orderItem)
            return err(
              res,
              400,
              'Not this order',
              'ORDER_ITEM_NOT_FOUND',
              `items.${n}.orderItemId`,
            );
          if (seenLines.has(line.orderItemId))
            return err(res, 400, 'Twice', 'ORDER_ITEM_DUPLICATE', `items.${n}.orderItemId`);
          seenLines.add(line.orderItemId);
          if (!/^[1-9]\d*$/.test(String(line.quantity)))
            return err(
              res,
              400,
              'Quantity is not valid',
              'QUANTITY_INVALID',
              `items.${n}.quantity`,
            );
          const remaining = Number(orderItem.quantity) - Number(orderItem.deliveredQuantity);
          if (Number(line.quantity) > remaining)
            return send(res, 400, {
              statusCode: 400,
              message: 'More than is left to deliver on this order line',
              code: 'DELIVERY_QUANTITY_TOO_LARGE',
              field: `items.${n}.quantity`,
              errors: [
                { field: `items.${n}.quantity`, code: 'DELIVERY_QUANTITY_TOO_LARGE', message: 'x' },
              ],
              details: { remaining: qtyString(remaining) },
            });
          const available = stockOf.get(orderItem.productId) ?? 0;
          if (Number(line.quantity) > available)
            return send(res, 409, {
              statusCode: 409,
              message: 'Not enough stock',
              code: 'STOCK_INSUFFICIENT',
              field: `items.${n}.quantity`,
              errors: [{ field: `items.${n}.quantity`, code: 'STOCK_INSUFFICIENT', message: 'x' }],
              details: {
                productId: orderItem.productId,
                available: qtyString(available),
                required: String(line.quantity),
              },
            });
        }
        const lines = items.map((line, i) => {
          const orderItem = o.items.find((x) => x.id === line.orderItemId);
          return {
            id: `di${deliveries.length + 1}-${i + 1}`,
            orderItemId: orderItem.id,
            productId: orderItem.productId,
            quantity: String(line.quantity),
            unitPrice: orderItem.unitPrice,
          };
        });
        const amount = sumMoneyStr(lines.map((i) => lineTotal(i.quantity, i.unitPrice)));
        const balanceAfter = fixed(addMoney(customer.currentBalance, amount));
        const overLimit =
          customer.creditLimit !== null && Number(balanceAfter) > Number(customer.creditLimit);
        if (
          overLimit &&
          CREDIT_LIMIT_MODE === 'block' &&
          !perms.includes('delivery.credit.override')
        )
          return send(res, 409, {
            statusCode: 409,
            message: 'Credit limit exceeded',
            code: 'CREDIT_LIMIT_EXCEEDED',
            field: 'items',
            errors: [{ field: 'items', code: 'CREDIT_LIMIT_EXCEEDED', message: 'x' }],
            details: { creditLimit: customer.creditLimit, balanceAfter },
          });
        const n = deliveries.length + 1;
        const nowIso = new Date().toISOString();
        const d = {
          id: `d${n}`,
          code: `DEL-${String(n).padStart(4, '0')}`,
          orderId: o.id,
          customerId: customer.id,
          deliveryDate: date,
          transportReference: body.transportReference ?? null,
          note: body.note ?? null,
          status: 'active',
          creditLimitExceeded: overLimit,
          version: 1,
          createdBy: { id: me.user.id, name: me.user.name },
          createdAt: nowIso,
          updatedAt: nowIso,
          voidedAt: null,
          voidReason: null,
          voidedBy: null,
          items: lines,
        };
        deliveries.unshift(d);
        for (const i of d.items) {
          moveStock(
            products.find((p) => p.id === i.productId),
            -Number(i.quantity),
            'delivery',
            { type: 'delivery', id: d.id, code: d.code },
            null,
            me.user,
          );
          const line = o.items.find((x) => x.id === i.orderItemId);
          line.deliveredQuantity = qtyString(Number(line.deliveredQuantity) + Number(i.quantity));
        }
        o.updatedAt = nowIso;
        ledgerAdd(
          customer,
          'delivery',
          amount,
          { type: 'delivery', id: d.id, code: d.code },
          null,
          me.user,
        );
        if (key) salesIdempotency.set(`${email}:${key}`, d);
        return send(res, 201, deliveryView(d, perms, true));
      }
      if (rest === 'deliveries' && req.method === 'GET') {
        if (!need('delivery.view')) return;
        const f = Object.fromEntries(url.searchParams);
        const list = deliveries.filter(
          (d) =>
            (!f.orderId || d.orderId === f.orderId) &&
            (!f.customerId || d.customerId === f.customerId) &&
            (!f.status || d.status === f.status) &&
            (!f.from || d.deliveryDate >= f.from) &&
            (!f.to || d.deliveryDate <= f.to),
        );
        const pg = pageOf(list, page);
        return send(res, 200, { ...pg, items: pg.items.map((d) => deliveryView(d, perms, false)) });
      }
      let dm = rest.match(/^deliveries\/([^/]+)(\/void)?$/);
      if (dm) {
        if (!need('delivery.view')) return;
        const d = deliveries.find((x) => x.id === dm[1]);
        if (!d) return err(res, 404, 'Delivery not found', 'DELIVERY_NOT_FOUND');
        if (req.method === 'GET' && !dm[2]) return send(res, 200, deliveryView(d, perms, true));
        if (req.method === 'POST' && dm[2]) {
          if (!need('delivery.void')) return;
          if (d.status === 'void') return err(res, 409, 'Already void', 'DELIVERY_ALREADY_VOID');
          if (!body.reason || body.reason.trim().length < 3)
            return err(res, 400, 'A reason is required', 'REASON_REQUIRED', 'reason');
          voidDelivery(d, body.reason.trim(), me.user);
          return send(res, 200, deliveryView(d, perms, true));
        }
        if (req.method === 'PATCH') {
          if (!need('delivery.edit')) return;
          if (d.status === 'void') return err(res, 409, 'Already void', 'DELIVERY_ALREADY_VOID');
          if (!body.reason || body.reason.trim().length < 3)
            return err(res, 400, 'A reason is required', 'REASON_REQUIRED', 'reason');
          const o = orders.find((x) => x.id === d.orderId);
          const customer = customers.find((c) => c.id === d.customerId);
          const before = sumMoneyStr(d.items.map((i) => lineTotal(i.quantity, i.unitPrice)));
          for (const change of body.items ?? []) {
            const line = d.items.find((i) => i.id === change.id);
            if (!line) continue;
            const delta = Number(change.quantity) - Number(line.quantity);
            const orderLine = o.items.find((x) => x.id === line.orderItemId);
            const remaining =
              Number(orderLine.quantity) - Number(orderLine.deliveredQuantity) - delta;
            if (remaining < 0)
              return send(res, 400, {
                statusCode: 400,
                message: 'More than is left',
                code: 'DELIVERY_QUANTITY_TOO_LARGE',
                field: `items.${line.id}.quantity`,
                errors: [
                  {
                    field: `items.${line.id}.quantity`,
                    code: 'DELIVERY_QUANTITY_TOO_LARGE',
                    message: 'x',
                  },
                ],
                details: {
                  remaining: qtyString(
                    Number(orderLine.quantity) - Number(orderLine.deliveredQuantity),
                  ),
                },
              });
            const short = moveStock(
              products.find((p) => p.id === line.productId),
              -delta,
              'delivery_edit',
              { type: 'delivery', id: d.id, code: d.code },
              body.reason,
              me.user,
            );
            if (short)
              return send(res, 409, {
                statusCode: 409,
                message: 'Not enough stock',
                code: 'STOCK_INSUFFICIENT',
                field: `items.${line.id}.quantity`,
                errors: [
                  { field: `items.${line.id}.quantity`, code: 'STOCK_INSUFFICIENT', message: 'x' },
                ],
                details: short,
              });
            line.quantity = String(change.quantity);
            orderLine.deliveredQuantity = qtyString(Number(orderLine.deliveredQuantity) + delta);
          }
          for (const k of ['deliveryDate', 'transportReference', 'note'])
            if (k in body) d[k] = body[k];
          d.version += 1;
          d.updatedAt = new Date().toISOString();
          const after = sumMoneyStr(d.items.map((i) => lineTotal(i.quantity, i.unitPrice)));
          if (after !== before)
            ledgerAdd(
              customer,
              'delivery_edit',
              fixed(addMoney(after, -before)),
              { type: 'delivery', id: d.id, code: d.code },
              body.reason,
              me.user,
            );
          else refreshCustomer(customer);
          return send(res, 200, deliveryView(d, perms, true));
        }
      }
      if (rest === 'collections' && req.method === 'POST') {
        if (!need('collection.create')) return;
        const key = req.headers['idempotency-key'];
        const seen = key && salesIdempotency.get(`${email}:${key}`);
        if (seen) return send(res, 200, collectionView(seen));
        // An inactive customer may still pay off an older order (step-5b decision 8).
        const customer = customers.find((c) => c.id === body.customerId);
        if (!customer)
          return err(res, 404, 'Customer not found', 'CUSTOMER_NOT_FOUND', 'customerId');
        if (!COLLECTION_METHODS.includes(body.method))
          return err(res, 400, 'Unknown method', 'COLLECTION_METHOD_UNKNOWN', 'method');
        if (!/^\d{1,12}(\.\d{1,2})?$/.test(String(body.amount ?? '')) || Number(body.amount) <= 0)
          return err(res, 400, 'Amount is too small', 'AMOUNT_TOO_SMALL', 'amount');
        const date = body.collectionDate ?? today();
        if (date > today())
          return err(res, 400, 'In the future', 'COLLECTION_DATE_IN_FUTURE', 'collectionDate');
        if (body.orderId) {
          const o = orders.find((x) => x.id === body.orderId && x.customerId === customer.id);
          if (!o) return err(res, 404, 'Order not found', 'ORDER_NOT_FOUND', 'orderId');
        }
        const n = collections.length + 1;
        const nowIso = new Date().toISOString();
        const c = {
          id: `col${n}`,
          code: `COL-${String(n).padStart(4, '0')}`,
          customerId: customer.id,
          orderId: body.orderId ?? null,
          collectionDate: date,
          method: body.method,
          amount: money(body.amount),
          reference: body.reference ?? null,
          note: body.note ?? null,
          status: 'active',
          version: 1,
          createdBy: { id: me.user.id, name: me.user.name },
          createdAt: nowIso,
          updatedAt: nowIso,
          voidedAt: null,
          voidReason: null,
          voidedBy: null,
        };
        collections.unshift(c);
        ledgerAdd(
          customer,
          'collection',
          fixed(-Number(c.amount)),
          { type: 'collection', id: c.id, code: c.code },
          null,
          me.user,
        );
        if (key) salesIdempotency.set(`${email}:${key}`, c);
        return send(res, 201, collectionView(c));
      }
      if (rest === 'collections' && req.method === 'GET') {
        if (!need('collection.view')) return;
        const f = Object.fromEntries(url.searchParams);
        const list = collections.filter(
          (c) =>
            (!f.customerId || c.customerId === f.customerId) &&
            (!f.orderId || c.orderId === f.orderId) &&
            (!f.method || c.method === f.method) &&
            (!f.status || c.status === f.status) &&
            (!f.from || c.collectionDate >= f.from) &&
            (!f.to || c.collectionDate <= f.to),
        );
        const pg = pageOf(list, page);
        return send(res, 200, { ...pg, items: pg.items.map(collectionView) });
      }
      let cm = rest.match(/^collections\/([^/]+)(\/void)?$/);
      if (cm) {
        if (!need('collection.view')) return;
        const c = collections.find((x) => x.id === cm[1]);
        if (!c) return err(res, 404, 'Collection not found', 'COLLECTION_NOT_FOUND');
        if (req.method === 'GET' && !cm[2]) return send(res, 200, collectionView(c));
        if (req.method === 'POST' && cm[2]) {
          if (!need('collection.void')) return;
          if (c.status === 'void') return err(res, 409, 'Already void', 'COLLECTION_ALREADY_VOID');
          if (!body.reason || body.reason.trim().length < 3)
            return err(res, 400, 'A reason is required', 'REASON_REQUIRED', 'reason');
          voidCollection(c, body.reason.trim(), me.user);
          return send(res, 200, collectionView(c));
        }
        if (req.method === 'PATCH') {
          if (!need('collection.edit')) return;
          if (c.status === 'void') return err(res, 409, 'Already void', 'COLLECTION_ALREADY_VOID');
          if (!body.reason || body.reason.trim().length < 3)
            return err(res, 400, 'A reason is required', 'REASON_REQUIRED', 'reason');
          const customer = customers.find((x) => x.id === c.customerId);
          const before = c.amount;
          for (const k of ['collectionDate', 'method', 'reference', 'note'])
            if (k in body) c[k] = body[k];
          if (body.amount !== undefined) c.amount = money(body.amount);
          c.version += 1;
          c.updatedAt = new Date().toISOString();
          if (c.amount !== before)
            ledgerAdd(
              customer,
              'collection_edit',
              fixed(-addMoney(c.amount, -before)),
              { type: 'collection', id: c.id, code: c.code },
              body.reason,
              me.user,
            );
          else refreshCustomer(customer);
          return send(res, 200, collectionView(c));
        }
      }
      // ---- Expenses and the cash book (docs/API.md §13) ----
      if (rest === 'expense-categories' && req.method === 'GET') {
        if (!need('expense.view')) return;
        const activeQ = url.searchParams.get('active') ?? 'true';
        const ok = (c) => activeQ === 'all' || c.isActive === (activeQ === 'true');
        return send(res, 200, { items: expenseCategories.filter(ok).map(expenseCategoryView) });
      }
      if (rest === 'expense-categories' && req.method === 'POST') {
        if (!need('expense.category.manage')) return;
        const nameEn = String(body.nameEn ?? '').trim();
        const nameBn = String(body.nameBn ?? '').trim();
        if (expenseCategories.some((c) => c.nameEn.toLowerCase() === nameEn.toLowerCase()))
          return err(res, 409, 'Name already used', 'NAME_EN_DUPLICATE', 'nameEn');
        if (expenseCategories.some((c) => c.nameBn === nameBn))
          return err(res, 409, 'Name already used', 'NAME_BN_DUPLICATE', 'nameBn');
        const cat = {
          id: `ec${expenseCategories.length + 1}`,
          nameEn,
          nameBn,
          sortOrder: body.sortOrder ?? expenseCategories.length + 1,
          isActive: true,
          version: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        expenseCategories = [...expenseCategories, cat];
        return send(res, 201, expenseCategoryView(cat));
      }
      let ecm = rest.match(/^expense-categories\/([^/]+)$/);
      if (ecm && req.method === 'PATCH') {
        if (!need('expense.category.manage')) return;
        const cat = expenseCategories.find((c) => c.id === ecm[1]);
        if (!cat) return err(res, 404, 'Not found', 'EXPENSE_CATEGORY_NOT_FOUND');
        if ('isActive' in body && (!body.reason || body.reason.trim().length < 3))
          return err(res, 400, 'A reason is required', 'REASON_REQUIRED', 'reason');
        for (const k of ['nameEn', 'nameBn', 'sortOrder', 'isActive'])
          if (k in body) cat[k] = body[k];
        cat.version += 1;
        cat.updatedAt = new Date().toISOString();
        return send(res, 200, expenseCategoryView(cat));
      }
      if (rest === 'expense-methods' && req.method === 'GET')
        return need('expense.create') && send(res, 200, { items: EXPENSE_METHODS });
      if (rest === 'expenses' && req.method === 'POST') {
        if (!need('expense.create')) return;
        const key = req.headers['idempotency-key'];
        const seen = key && expenseIdempotency.get(`${email}:${key}`);
        if (seen) return send(res, 200, expenseView(seen));
        const cat = expenseCategories.find((c) => c.id === body.categoryId && c.isActive);
        if (!cat)
          return err(
            res,
            400,
            'Expense type not found or inactive',
            'EXPENSE_CATEGORY_NOT_FOUND_OR_INACTIVE',
            'categoryId',
          );
        if (!EXPENSE_METHODS.includes(body.method))
          return err(res, 400, 'Unknown method', 'EXPENSE_METHOD_UNKNOWN', 'method');
        if (!/^\d{1,12}(\.\d{1,2})?$/.test(String(body.amount ?? '')) || Number(body.amount) <= 0)
          return err(res, 400, 'Amount is too small', 'AMOUNT_TOO_SMALL', 'amount');
        const date = body.expenseDate ?? today();
        if (date > today())
          return err(res, 400, 'In the future', 'EXPENSE_DATE_IN_FUTURE', 'expenseDate');
        const n = expenses.length + 1;
        const nowIso = new Date().toISOString();
        const e = {
          id: `exp${n}`,
          code: `EXP-${String(n).padStart(4, '0')}`,
          categoryId: cat.id,
          expenseDate: date,
          method: body.method,
          amount: money(body.amount),
          note: body.note ?? null,
          proofNote: body.proofNote ?? null,
          status: 'active',
          version: 1,
          createdBy: { id: me.user.id, name: me.user.name },
          createdAt: nowIso,
          updatedAt: nowIso,
          voidedAt: null,
          voidReason: null,
          voidedBy: null,
        };
        expenses.unshift(e);
        if (key) expenseIdempotency.set(`${email}:${key}`, e);
        return send(res, 201, expenseView(e));
      }
      if (rest === 'expenses' && req.method === 'GET') {
        if (!need('expense.view')) return;
        const f = Object.fromEntries(url.searchParams);
        const list = expenses.filter(
          (e) =>
            (!f.categoryId || e.categoryId === f.categoryId) &&
            (!f.method || e.method === f.method) &&
            (!f.status || e.status === f.status) &&
            (!f.from || e.expenseDate >= f.from) &&
            (!f.to || e.expenseDate <= f.to),
        );
        const pg = pageOf(list, page);
        return send(res, 200, { ...pg, items: pg.items.map(expenseView) });
      }
      let em = rest.match(/^expenses\/([^/]+)(\/void)?$/);
      if (em) {
        if (!need('expense.view')) return;
        const e = expenses.find((x) => x.id === em[1]);
        if (!e) return err(res, 404, 'Expense not found', 'EXPENSE_NOT_FOUND');
        if (req.method === 'GET' && !em[2]) return send(res, 200, expenseView(e));
        if (req.method === 'POST' && em[2]) {
          if (!need('expense.void')) return;
          if (e.status === 'void') return err(res, 409, 'Already void', 'EXPENSE_ALREADY_VOID');
          if (!body.reason || body.reason.trim().length < 3)
            return err(res, 400, 'A reason is required', 'REASON_REQUIRED', 'reason');
          e.status = 'void';
          e.voidedAt = new Date().toISOString();
          e.voidReason = body.reason.trim();
          e.voidedBy = { id: me.user.id, name: me.user.name };
          e.updatedAt = e.voidedAt;
          return send(res, 200, expenseView(e));
        }
        if (req.method === 'PATCH') {
          if (!need('expense.edit')) return;
          if (e.status === 'void') return err(res, 409, 'Already void', 'EXPENSE_ALREADY_VOID');
          if (!body.reason || body.reason.trim().length < 3)
            return err(res, 400, 'A reason is required', 'REASON_REQUIRED', 'reason');
          for (const k of ['expenseDate', 'categoryId', 'method', 'note', 'proofNote'])
            if (k in body) e[k] = body[k];
          if (body.amount !== undefined) e.amount = money(body.amount);
          e.version += 1;
          e.updatedAt = new Date().toISOString();
          return send(res, 200, expenseView(e));
        }
      }
      if (rest === 'cash-book' && req.method === 'GET') {
        if (!need('cashbook.view')) return;
        const f = Object.fromEntries(url.searchParams);
        const monthStart = today().slice(0, 7) + '-01';
        const from = f.from ?? monthStart;
        const to = f.to ?? today();
        const full = cashBookCompute(from, to);
        const dayPage = pageOf(full.days, page);
        return send(res, 200, {
          ...full,
          days: dayPage.items,
          page,
          pageSize: 10,
          total: full.days.length,
        });
      }
      // ---- Reports (docs/API.md §13) ----
      const monthRange = (f) => {
        const monthStart = today().slice(0, 7) + '-01';
        return { from: f.from ?? monthStart, to: f.to ?? today() };
      };
      const deliveryQty = (d) => d.items.reduce((a, i) => a + Number(i.quantity), 0);
      const deliveryAmount = (d) =>
        Number(sumMoneyStr(d.items.map((i) => lineTotal(i.quantity, i.unitPrice))));
      if (rest === 'reports/sales' && req.method === 'GET') {
        if (!need('report.view')) return;
        const f = Object.fromEntries(url.searchParams);
        const { from, to } = monthRange(f);
        const groupBy = f.groupBy ?? 'date';
        const active = deliveries.filter(
          (d) => d.status === 'active' && d.deliveryDate >= from && d.deliveryDate <= to,
        );
        const totalQuantity = qtyString(active.reduce((a, d) => a + deliveryQty(d), 0));
        const totalAmount = fixed(active.reduce((a, d) => a + deliveryAmount(d), 0));
        const byKey = new Map();
        if (groupBy === 'customer') {
          for (const d of active) {
            const c = customers.find((x) => x.id === d.customerId);
            const bucket = byKey.get(d.customerId) ?? {
              label: `${c.code} ${c.nameEn}`,
              quantity: 0,
              amount: 0,
            };
            bucket.quantity += deliveryQty(d);
            bucket.amount += deliveryAmount(d);
            byKey.set(d.customerId, bucket);
          }
        } else if (groupBy === 'product' || groupBy === 'category') {
          for (const d of active) {
            for (const i of d.items) {
              const p = products.find((x) => x.id === i.productId);
              const key = groupBy === 'product' ? p.id : p.category.id;
              const label = groupBy === 'product' ? `${p.code} ${p.nameEn}` : p.category.nameEn;
              const bucket = byKey.get(key) ?? { label, quantity: 0, amount: 0 };
              bucket.quantity += Number(i.quantity);
              bucket.amount += Number(lineTotal(i.quantity, i.unitPrice));
              byKey.set(key, bucket);
            }
          }
        } else {
          for (const d of active) {
            const bucket = byKey.get(d.deliveryDate) ?? {
              label: d.deliveryDate,
              quantity: 0,
              amount: 0,
            };
            bucket.quantity += deliveryQty(d);
            bucket.amount += deliveryAmount(d);
            byKey.set(d.deliveryDate, bucket);
          }
        }
        const groups = [...byKey.entries()].map(([key, b]) => ({
          key,
          label: b.label,
          quantity: qtyString(b.quantity),
          amount: fixed(b.amount),
        }));
        const sortByQuantity = groupBy === 'customer' && f.sort === 'quantity';
        groups.sort((a, b) =>
          groupBy === 'date'
            ? a.key < b.key
              ? 1
              : -1
            : sortByQuantity
              ? Number(b.quantity) - Number(a.quantity)
              : Number(b.amount) - Number(a.amount),
        );
        const pg = pageOf(groups, page);
        return send(res, 200, {
          from,
          to,
          groupBy,
          items: pg.items,
          totalQuantity,
          totalAmount,
          page,
          pageSize: 10,
          total: groups.length,
        });
      }
      if (rest === 'reports/collections' && req.method === 'GET') {
        if (!need('report.view')) return;
        const f = Object.fromEntries(url.searchParams);
        const { from, to } = monthRange(f);
        const groupBy = f.groupBy ?? 'date';
        const active = collections.filter(
          (c) => c.status === 'active' && c.collectionDate >= from && c.collectionDate <= to,
        );
        const totalAmount = fixed(active.reduce((a, c) => a + Number(c.amount), 0));
        const byKey = new Map();
        for (const c of active) {
          const key = groupBy === 'method' ? c.method : c.collectionDate;
          const bucket = byKey.get(key) ?? { count: 0, amount: 0 };
          bucket.count += 1;
          bucket.amount += Number(c.amount);
          byKey.set(key, bucket);
        }
        const groups = [...byKey.entries()].map(([key, b]) => ({
          key,
          count: b.count,
          amount: fixed(b.amount),
        }));
        groups.sort((a, b) =>
          groupBy === 'date' ? (a.key < b.key ? 1 : -1) : a.key.localeCompare(b.key),
        );
        const pg = pageOf(groups, page);
        return send(res, 200, {
          from,
          to,
          groupBy,
          items: pg.items,
          totalAmount,
          page,
          pageSize: 10,
          total: groups.length,
        });
      }
      if (rest === 'reports/dues' && req.method === 'GET') {
        if (!need('report.view')) return;
        const list = customers
          .filter((c) => c.isActive && Number(c.currentBalance) !== 0)
          .sort((a, b) => a.nameEn.localeCompare(b.nameEn));
        const pg = pageOf(list, page);
        const items = pg.items.map((c) => {
          const bal = Number(c.currentBalance);
          const due = bal > 0 ? bal : 0;
          const advance = bal < 0 ? -bal : 0;
          return {
            id: c.id,
            code: c.code,
            nameEn: c.nameEn,
            nameBn: c.nameBn,
            currentBalance: fixed(bal),
            dueAmount: fixed(due),
            advanceAmount: fixed(advance),
            // Simplified for the mock: FIFO aging isn't replicated, the whole due is "recent".
            aging: { d0To7: fixed(due), d8To30: '0.00', d30Plus: '0.00' },
          };
        });
        const totalDue = fixed(list.reduce((a, c) => a + Math.max(Number(c.currentBalance), 0), 0));
        const totalAdvance = fixed(
          list.reduce((a, c) => a + Math.max(-Number(c.currentBalance), 0), 0),
        );
        return send(res, 200, {
          items,
          totalDue,
          totalAdvance,
          page,
          pageSize: 10,
          total: list.length,
        });
      }
      if (rest === 'reports/stock' && req.method === 'GET') {
        if (!need('report.view')) return;
        const list = products.filter((p) => p.isActive);
        const pg = pageOf(list, page);
        const items = pg.items.map((p) => ({
          id: p.id,
          code: p.code,
          nameEn: p.nameEn,
          nameBn: p.nameBn,
          unitKey: p.unitKey,
          currentStock: qtyString(stockOf.get(p.id) ?? 0),
          isActive: p.isActive,
        }));
        return send(res, 200, { items, page, pageSize: 10, total: list.length });
      }
      if (rest === 'reports/stock-movements' && req.method === 'GET') {
        if (!need('report.view')) return;
        const f = Object.fromEntries(url.searchParams);
        const { from, to } = monthRange(f);
        const inRange = movements.filter((m) => m.movementDate >= from && m.movementDate <= to);
        const byProduct = new Map();
        for (const m of inRange) {
          const bucket = byProduct.get(m.productId) ?? { net: 0, byKind: new Map() };
          bucket.net += Number(m.quantity);
          bucket.byKind.set(m.kind, (bucket.byKind.get(m.kind) ?? 0) + Number(m.quantity));
          byProduct.set(m.productId, bucket);
        }
        const groups = [...byProduct.entries()].map(([productId, b]) => {
          const p = products.find((x) => x.id === productId);
          return {
            productId,
            code: p.code,
            nameEn: p.nameEn,
            nameBn: p.nameBn,
            unitKey: p.unitKey,
            net: qtyString(b.net),
            byKind: [...b.byKind.entries()].map(([kind, quantity]) => ({
              kind,
              quantity: qtyString(quantity),
            })),
          };
        });
        groups.sort((a, b) => Number(b.net) - Number(a.net));
        const pg = pageOf(groups, page);
        return send(res, 200, {
          from,
          to,
          items: pg.items,
          page,
          pageSize: 10,
          total: groups.length,
        });
      }
      if (rest === 'reports/expenses' && req.method === 'GET') {
        if (!need('report.view')) return;
        const f = Object.fromEntries(url.searchParams);
        const { from, to } = monthRange(f);
        const groupBy = f.groupBy ?? 'category';
        const active = expenses.filter(
          (e) => e.status === 'active' && e.expenseDate >= from && e.expenseDate <= to,
        );
        const totalAmount = fixed(active.reduce((a, e) => a + Number(e.amount), 0));
        const byKey = new Map();
        for (const e of active) {
          const key =
            groupBy === 'month' ? e.expenseDate.slice(0, 7).replace('-', '') : e.categoryId;
          const label =
            groupBy === 'month'
              ? e.expenseDate.slice(0, 7)
              : expenseCategories.find((c) => c.id === e.categoryId).nameEn;
          const bucket = byKey.get(key) ?? { label, count: 0, amount: 0 };
          bucket.count += 1;
          bucket.amount += Number(e.amount);
          byKey.set(key, bucket);
        }
        const items = [...byKey.entries()]
          .map(([key, b]) => ({ key, label: b.label, count: b.count, amount: fixed(b.amount) }))
          .sort((a, b) => Number(b.amount) - Number(a.amount));
        return send(res, 200, { from, to, groupBy, items, totalAmount });
      }
      if (rest === 'reports/daily-summary' && req.method === 'GET') {
        if (!need('report.view')) return;
        const date = url.searchParams.get('date') || today();
        const dayOrders = orders.filter((o) => o.status === 'active' && o.orderDate === date);
        const dayDeliveries = deliveries.filter(
          (d) => d.status === 'active' && d.deliveryDate === date,
        );
        const dayCollections = collections.filter(
          (c) => c.status === 'active' && c.collectionDate === date,
        );
        const dayExpenses = expenses.filter((e) => e.status === 'active' && e.expenseDate === date);
        const stat = (list, amountOf) => ({
          count: list.length,
          amount: fixed(list.reduce((a, x) => a + amountOf(x), 0)),
        });
        const out = {
          date,
          orders: stat(dayOrders, (o) => deliveryAmount(o)),
          deliveries: stat(dayDeliveries, (d) => deliveryAmount(d)),
          collections: stat(dayCollections, (c) => Number(c.amount)),
          expenses: stat(dayExpenses, (e) => Number(e.amount)),
        };
        if (perms.includes('cashbook.view')) {
          const cb = cashBookCompute(date, date);
          out.cash = {
            openingBalance: cb.openingBalance,
            closingBalance: cb.closingBalance,
            net: cb.totals.net,
          };
        }
        return send(res, 200, out);
      }
      let lm = rest.match(/^customers\/([^/]+)\/ledger$/);
      if (lm && req.method === 'GET') {
        if (!need('customer.due.view')) return;
        const customer = customers.find((c) => c.id === lm[1]);
        if (!customer)
          return err(res, 404, 'Customer not found', 'CUSTOMER_NOT_FOUND', 'customerId');
        refreshCustomer(customer);
        const f = Object.fromEntries(url.searchParams);
        const list = ledger.filter(
          (e) =>
            e.customerId === customer.id &&
            (!f.from || e.entryDate >= f.from) &&
            (!f.to || e.entryDate <= f.to),
        );
        const pg = pageOf(list, page);
        return send(res, 200, {
          customer: {
            id: customer.id,
            code: customer.code,
            nameEn: customer.nameEn,
            openingBalance: customer.openingBalance,
            deliveredAmount: customer.deliveredAmount,
            collectedAmount: customer.collectedAmount,
            currentBalance: customer.currentBalance,
            creditLimit: customer.creditLimit,
          },
          ...pg,
          items: pg.items.map((e) => {
            const copy = { ...e };
            delete copy.customerId;
            return copy;
          }),
        });
      }
      // ---- Stock ----
      if (rest === 'stock' && req.method === 'GET') {
        if (!need('stock.view')) return;
        const cat = url.searchParams.get('categoryId');
        const list = products
          .filter(
            (p) =>
              activeOk(p) &&
              (!cat || p.category.id === cat) &&
              match(search, p.nameEn, p.nameBn, p.code),
          )
          .sort((a, b) => (a.nameEn < b.nameEn ? -1 : 1));
        const pg = pageOf(list, page);
        return send(res, 200, { ...pg, items: pg.items.map((p) => stockRow(p, perms)) });
      }
      let sm = rest.match(/^stock\/([^/]+)\/movements$/);
      if (sm && req.method === 'GET') {
        if (!need('stock.view')) return;
        const p = products.find((x) => x.id === sm[1]);
        if (!p) return err(res, 404, 'Product not found', 'PRODUCT_NOT_FOUND');
        const kind = url.searchParams.get('kind');
        const list = movements.filter((m) => m.productId === p.id && (!kind || m.kind === kind));
        const pg = pageOf(list, page);
        const row = stockRow(p, perms);
        delete row.lastPurchasePrice;
        delete row.lastPurchasedAt;
        return send(res, 200, {
          product: row,
          ...pg,
          items: pg.items.map((m) => {
            const copy = { ...m };
            delete copy.productId;
            return copy;
          }),
        });
      }
      if (rest === 'stock/adjustments' && req.method === 'POST') {
        if (!need('stock.adjust')) return;
        const p = products.find((x) => x.id === body.productId);
        if (!p) return err(res, 404, 'Product not found', 'PRODUCT_NOT_FOUND');
        if (!/^-?[1-9]\d*$/.test(String(body.quantity ?? '')))
          return err(res, 400, 'Quantity is not valid', 'QUANTITY_INVALID', 'quantity');
        if (!body.reason || body.reason.trim().length < 3)
          return err(res, 400, 'A reason is required', 'REASON_REQUIRED', 'reason');
        const q = Number(body.quantity);
        const used = adjustedToday.get(`${email}:${p.id}`) ?? 0;
        if (!perms.includes('stock.adjust.large') && used + Math.abs(q) > ADJUST_LIMIT)
          return send(res, 403, {
            statusCode: 403,
            message: 'This adjustment is above your daily limit; send a change request instead',
            code: 'ADJUSTMENT_APPROVAL_REQUIRED',
            field: 'quantity',
            errors: [{ field: 'quantity', code: 'ADJUSTMENT_APPROVAL_REQUIRED', message: 'x' }],
            details: { limit: String(ADJUST_LIMIT), usedToday: String(used) },
          });
        const short = moveStock(
          p,
          q,
          'adjustment',
          { type: 'adjustment', id: null, code: null },
          body.reason.trim(),
          me.user,
        );
        if (short)
          return send(res, 409, {
            statusCode: 409,
            message: 'Not enough stock',
            code: 'STOCK_INSUFFICIENT',
            field: 'quantity',
            errors: [{ field: 'quantity', code: 'STOCK_INSUFFICIENT', message: 'x' }],
            details: short,
          });
        adjustedToday.set(`${email}:${p.id}`, used + Math.abs(q));
        return send(res, 201, stockRow(p, perms));
      }
      if (rest === 'change-requests' || rest.startsWith('change-requests/')) {
        const sub = rest.slice('change-requests'.length).replace(/^\//, '');
        const records = {
          product: products,
          customer: customers,
          product_category: categories,
          purchase: purchases,
          product_stock: products,
          sales_order: orders,
          delivery: deliveries,
          collection: collections,
        };
        /** Field rules, including the dynamic purchase line fields (items.<id>.quantity). */
        const ruleOf = (type, field) => {
          if (type === 'purchase') {
            if (field === 'purchaseDate')
              return { see: null, apply: 'purchase.edit', label: 'Purchase date' };
            if (field === 'note' || field === 'supplierReference')
              return {
                see: null,
                apply: 'purchase.create',
                label: field === 'note' ? 'Note' : 'Paper number',
              };
            const m = /^items\.([^.]+)\.(quantity|unitPrice)$/.exec(field);
            if (m)
              return m[2] === 'quantity'
                ? { see: null, apply: 'purchase.edit', label: 'Bags' }
                : { see: 'product.cost.view', apply: 'purchase.edit', label: 'Price' };
            return undefined;
          }
          if (type === 'product_stock')
            return field === 'adjustBy'
              ? { see: null, apply: 'stock.adjust.large', label: 'Stock change' }
              : undefined;
          if (type === 'sales_order') {
            if (['orderDate', 'deliveryWindow', 'deliverBy', 'note'].includes(field))
              return { see: null, apply: 'sale.edit', label: field };
            const line = /^items\.([^.]+)\.(quantity|unitPrice)$/.exec(field);
            if (line)
              return {
                see: null,
                apply: 'sale.edit',
                label: line[2] === 'quantity' ? 'Quantity' : 'Price',
              };
            return undefined;
          }
          if (type === 'delivery') {
            if (['deliveryDate', 'transportReference', 'note'].includes(field))
              return { see: null, apply: 'delivery.edit', label: field };
            const line = /^items\.([^.]+)\.quantity$/.exec(field);
            return line ? { see: null, apply: 'delivery.edit', label: 'Quantity' } : undefined;
          }
          if (type === 'collection') {
            if (field === 'amount')
              return { see: 'collection.view', apply: 'collection.edit', label: 'Amount' };
            if (['collectionDate', 'method', 'reference', 'note'].includes(field))
              return { see: null, apply: 'collection.edit', label: field };
            return undefined;
          }
          return CHANGE_FIELDS[type]?.[field];
        };
        const valueOf = (type, rec, field) => {
          const line =
            ['purchase', 'sales_order', 'delivery'].includes(type) &&
            /^items\.([^.]+)\.(quantity|unitPrice)$/.exec(field);
          if (line) return rec.items.find((i) => i.id === line[1])?.[line[2]];
          if (type === 'product_stock') return null;
          return rec[field];
        };
        const visible = (type, field) => {
          const rule = ruleOf(type, field);
          return rule && (!rule.see || perms.includes(rule.see));
        };
        const only = (type, obj) =>
          obj && Object.fromEntries(Object.entries(obj).filter(([k]) => visible(type, k)));
        const labelOf = (type, rec) =>
          type === 'product_category'
            ? rec.nameEn
            : ['purchase', 'sales_order', 'delivery', 'collection'].includes(type)
              ? rec.code
              : `${rec.code} ${rec.nameEn}`;
        const stockLine = (product, delta) => {
          const before = stockOf.get(product.id) ?? 0;
          return {
            key: `stock.${product.id}`,
            label: `Stock ${product.code}`,
            before: qtyString(before),
            after: qtyString(before + delta),
            delta: `${delta >= 0 ? '+' : ''}${delta}`,
            unit: product.unitKey,
          };
        };
        const impactOf = (type, rec, change, kind = 'edit') => {
          if (type === 'purchase') {
            const lines = [];
            for (const item of rec.items) {
              const product = products.find((x) => x.id === item.productId);
              const q = change[`items.${item.id}.quantity`];
              const delta =
                kind === 'void'
                  ? -Number(item.quantity)
                  : q !== undefined
                    ? Number(q) - Number(item.quantity)
                    : 0;
              if (delta !== 0) lines.push(stockLine(product, delta));
            }
            return lines;
          }
          if (type === 'product_stock') return [stockLine(rec, Number(change.adjustBy))];
          if (type === 'sales_order') {
            if (kind === 'void')
              return [
                {
                  key: 'order.remainingQuantity',
                  label: 'Left to deliver',
                  before: qtyString(
                    rec.items.reduce(
                      (a, i) => a + Number(i.quantity) - Number(i.deliveredQuantity),
                      0,
                    ),
                  ),
                  after: '0',
                },
              ];
            const before = sumMoneyStr(rec.items.map((i) => lineTotal(i.quantity, i.unitPrice)));
            const after = sumMoneyStr(
              rec.items.map((i) =>
                lineTotal(
                  change[`items.${i.id}.quantity`] ?? i.quantity,
                  change[`items.${i.id}.unitPrice`] ?? i.unitPrice,
                ),
              ),
            );
            return [{ key: 'order.totalAmount', label: 'Order total', before, after }];
          }
          if (type === 'delivery' || type === 'collection') {
            const amount =
              type === 'collection'
                ? rec.amount
                : sumMoneyStr(rec.items.map((i) => lineTotal(i.quantity, i.unitPrice)));
            return [
              {
                key: 'customer.currentBalance',
                label: 'Customer balance',
                before: customers.find((c) => c.id === rec.customerId).currentBalance,
                after: fixed(
                  addMoney(
                    customers.find((c) => c.id === rec.customerId).currentBalance,
                    kind === 'void' ? (type === 'collection' ? amount : -amount) : 0,
                  ),
                ),
              },
            ];
          }
          return Object.entries(only(type, change)).flatMap(([field, after]) => {
            const before = rec[field];
            const line = {
              key: `${type}.${field}`,
              label: CHANGE_FIELDS[type][field].label,
              before,
              after,
            };
            if (field === 'isActive' && after === false) line.note = INACTIVE_NOTE;
            const lines = [line];
            if (type === 'customer' && field === 'openingBalance' && visible(type, field)) {
              const delta = (Number(after) - Number(before)).toFixed(2);
              lines.push({
                key: 'customer.currentBalance',
                label: 'Current balance',
                before: rec.currentBalance,
                after: (Number(rec.currentBalance) + Number(delta)).toFixed(2),
                delta: `${Number(delta) >= 0 ? '+' : ''}${delta}`,
              });
            }
            return lines;
          });
        };
        const summaryOf = (type, snap, change) =>
          Object.keys(change ?? {})
            .map((f) =>
              visible(type, f)
                ? `${ruleOf(type, f).label}: ${snap[f]} → ${change[f]}`
                : `${ruleOf(type, f).label} changed`,
            )
            .join('; ');
        const view = (cr, full) => {
          const rec = records[cr.entityType].find((x) => x.id === cr.entityId);
          const base = {
            id: cr.id,
            entityType: cr.entityType,
            entityId: cr.entityId,
            entityLabel: cr.entityLabel,
            kind: cr.kind,
            summary:
              cr.kind === 'void'
                ? `Void ${cr.entityType.replace('_', ' ')}`
                : summaryOf(cr.entityType, cr.snapshot, cr.proposedChange),
            status: cr.status,
            requestedBy: cr.requestedBy,
            requestedAt: cr.requestedAt,
            decidedBy: cr.decidedBy,
            decidedAt: cr.decidedAt,
          };
          if (!full) return base;
          const stale =
            cr.status === 'stale' ||
            (cr.status === 'pending' &&
              cr.entityType !== 'product_stock' &&
              rec.updatedAt > cr.requestedAt);
          return {
            ...base,
            reason: cr.reason,
            snapshot: cr.kind === 'void' ? null : only(cr.entityType, cr.snapshot),
            proposedChange: cr.kind === 'void' ? null : only(cr.entityType, cr.proposedChange),
            impact:
              cr.status === 'pending'
                ? impactOf(cr.entityType, rec, cr.proposedChange ?? {}, cr.kind)
                : null,
            isStale: stale,
            decisionNote: cr.decisionNote,
            appliedAt: cr.appliedAt,
          };
        };
        const readBody = () => {
          const type = body.entityType;
          const list = records[type];
          if (!list)
            return [
              null,
              err(res, 400, 'Unknown record type', 'ENTITY_TYPE_UNKNOWN', 'entityType'),
            ];
          const rec = list.find((x) => x.id === body.entityId);
          if (!rec)
            return [null, err(res, 404, 'Record not found', 'RECORD_NOT_FOUND', 'entityId')];
          const change = {};
          const kind = body.kind === 'void' ? 'void' : 'edit';
          if (kind === 'void') {
            if (!['purchase', 'sales_order', 'delivery', 'collection'].includes(type))
              return [null, err(res, 400, 'Cannot be voided', 'VOID_NOT_SUPPORTED', 'kind')];
            return [{ type, rec, change, kind }, null];
          }
          for (const [k, v] of Object.entries(body.proposedChange ?? {})) {
            if (!ruleOf(type, k))
              return [
                null,
                err(
                  res,
                  400,
                  'Field cannot be changed by request',
                  'FIELD_NOT_CHANGEABLE',
                  `proposedChange.${k}`,
                ),
              ];
            if (!visible(type, k)) return [null, err(res, 403, 'Access denied', 'ACCESS_DENIED')];
            const asIs =
              k === 'isActive' ||
              k === 'adjustBy' ||
              k.endsWith('.quantity') ||
              [
                'purchaseDate',
                'note',
                'supplierReference',
                'orderDate',
                'deliveryWindow',
                'deliverBy',
                'deliveryDate',
                'collectionDate',
                'method',
                'transportReference',
                'reference',
              ].includes(k);
            change[k] = asIs ? v : money(v);
          }
          if (!Object.keys(change).length)
            return [null, err(res, 400, 'Empty change', 'PROPOSED_CHANGE_EMPTY', 'proposedChange')];
          return [{ type, rec, change, kind }, null];
        };

        if (sub === 'preview' && req.method === 'POST') {
          if (!perms.includes('change.request') && !perms.includes('change.approve'))
            return err(res, 403, 'Access denied');
          const [ok] = readBody();
          if (!ok) return;
          return send(res, 200, {
            entityLabel: labelOf(ok.type, ok.rec),
            impact: impactOf(ok.type, ok.rec, ok.change, ok.kind),
          });
        }
        if (sub === '' && req.method === 'POST') {
          if (!need('change.request')) return;
          const key = req.headers['idempotency-key'];
          const seen = key && idempotency.get(`${email}:${key}`);
          if (seen) return send(res, 200, view(seen, true));
          if (!body.reason || body.reason.trim().length < 3)
            return err(
              res,
              400,
              'reason must be longer than or equal to 3 characters',
              'REASON_TOO_SHORT',
              'reason',
            );
          const [ok] = readBody();
          if (!ok) return;
          const pending = changeRequests.find(
            (c) => c.entityId === ok.rec.id && c.status === 'pending',
          );
          if (pending) {
            // The id only when the requester may open it (own, or change.view.all).
            const visibleToMe =
              pending.requestedBy.id === me.user.id || perms.includes('change.view.all');
            return send(res, 409, {
              statusCode: 409,
              message: 'This record already has a pending change request',
              code: 'CHANGE_REQUEST_PENDING_EXISTS',
              ...(visibleToMe ? { changeRequestId: pending.id } : {}),
            });
          }
          const cr = {
            id: `cr${changeRequests.length + 1}`,
            entityType: ok.type,
            entityId: ok.rec.id,
            entityLabel: labelOf(ok.type, ok.rec),
            kind: ok.kind,
            snapshot: Object.fromEntries(
              Object.keys(ok.change).map((k) => [k, valueOf(ok.type, ok.rec, k)]),
            ),
            proposedChange: ok.kind === 'void' ? null : ok.change,
            status: 'pending',
            reason: body.reason.trim(),
            requestedBy: { id: me.user.id, name: me.user.name },
            requestedAt: new Date().toISOString(),
            decidedBy: null,
            decidedAt: null,
            decisionNote: null,
            appliedAt: null,
          };
          changeRequests.unshift(cr);
          if (key) idempotency.set(`${email}:${key}`, cr);
          return send(res, 201, view(cr, true));
        }
        const filterList = (list) => {
          const status = url.searchParams.get('status');
          const type = url.searchParams.get('entityType');
          const eid = url.searchParams.get('entityId');
          return list.filter(
            (c) =>
              (!status || c.status === status) &&
              (!type || c.entityType === type) &&
              (!eid || c.entityId === eid),
          );
        };
        if (sub === 'mine' && req.method === 'GET') {
          if (!need('change.view.own')) return;
          const list = filterList(changeRequests.filter((c) => c.requestedBy.id === me.user.id));
          const pg = pageOf(list, page);
          return send(res, 200, { ...pg, items: pg.items.map((c) => view(c, false)) });
        }
        if (sub === '' && req.method === 'GET') {
          if (!need('change.view.all')) return;
          const pg = pageOf(filterList(changeRequests), page);
          return send(res, 200, { ...pg, items: pg.items.map((c) => view(c, false)) });
        }
        if (sub === 'pending-count' && req.method === 'GET') {
          if (!need('change.view.all')) return;
          return send(res, 200, {
            count: changeRequests.filter((c) => c.status === 'pending').length,
          });
        }
        const m2 = sub.match(/^([^/]+)(?:\/(approve|reject|cancel))?$/);
        const cr = m2 && changeRequests.find((c) => c.id === m2[1]);
        const own = cr && cr.requestedBy.id === me.user.id;
        if (!cr || !(own ? perms.includes('change.view.own') : perms.includes('change.view.all')))
          return err(res, 404, 'Change request not found', 'CHANGE_REQUEST_NOT_FOUND');
        const action = m2[2];
        if (!action && req.method === 'GET') return send(res, 200, view(cr, true));
        if (req.method !== 'POST') return err(res, 404, 'Not Found', 'ROUTE_NOT_FOUND');
        if (action === 'cancel') {
          if (!own) return err(res, 404, 'Change request not found', 'CHANGE_REQUEST_NOT_FOUND');
          if (cr.status !== 'pending')
            return err(res, 409, 'Already decided', 'CHANGE_REQUEST_ALREADY_DECIDED');
          cr.status = 'cancelled';
          cr.decidedAt = new Date().toISOString();
          return send(res, 200, view(cr, true));
        }
        if (!need('change.approve')) return;
        if (own)
          return err(
            res,
            403,
            'You cannot decide your own change request',
            'SELF_DECISION_FORBIDDEN',
          );
        if (cr.status !== 'pending')
          return err(res, 409, 'Already decided', 'CHANGE_REQUEST_ALREADY_DECIDED');
        const rec = records[cr.entityType].find((x) => x.id === cr.entityId);
        const decided = () => {
          cr.decidedBy = { id: me.user.id, name: me.user.name };
          cr.decidedAt = new Date().toISOString();
          cr.decisionNote = body.note?.trim() || null;
        };
        if (action === 'reject') {
          if (!body.note || body.note.trim().length < 3)
            return err(
              res,
              400,
              'note must be longer than or equal to 3 characters',
              'NOTE_TOO_SHORT',
              'note',
            );
          cr.status = 'rejected';
          decided();
          return send(res, 200, view(cr, true));
        }
        if (cr.entityType !== 'product_stock' && rec.updatedAt > cr.requestedAt) {
          cr.status = 'stale';
          return err(res, 409, 'The record changed after this request was made', 'STALE_REQUEST');
        }
        const stockShort = (details) =>
          send(res, 409, {
            statusCode: 409,
            message: 'Not enough stock',
            code: 'STOCK_INSUFFICIENT',
            details,
          });
        if (cr.kind === 'void') {
          const voidPermission = {
            purchase: 'purchase.void',
            sales_order: 'sale.void',
            delivery: 'delivery.void',
            collection: 'collection.void',
          }[cr.entityType];
          if (!need(voidPermission)) return;
          if (cr.entityType === 'purchase') {
            const short = voidPurchase(rec, cr.reason, cr.requestedBy);
            if (short) return stockShort(short);
          } else if (cr.entityType === 'sales_order') {
            const blocked = voidOrder(rec, cr.reason, cr.requestedBy);
            if (blocked) return err(res, 409, 'Active deliveries exist', blocked);
          } else if (cr.entityType === 'delivery') {
            voidDelivery(rec, cr.reason, cr.requestedBy);
          } else {
            voidCollection(rec, cr.reason, cr.requestedBy);
          }
        } else {
          for (const f of Object.keys(cr.proposedChange))
            if (!perms.includes(ruleOf(cr.entityType, f).apply))
              return err(res, 403, 'Access denied');
          if (cr.entityType === 'product_stock') {
            const short = moveStock(
              rec,
              Number(cr.proposedChange.adjustBy),
              'adjustment',
              { type: 'adjustment', id: null, code: null },
              cr.reason,
              cr.requestedBy,
            );
            if (short) return stockShort(short);
          } else if (cr.entityType === 'purchase') {
            for (const [f, v] of Object.entries(cr.proposedChange)) {
              const m = /^items\.([^.]+)\.(quantity|unitPrice)$/.exec(f);
              if (!m) rec[f] = v;
              else if (m[2] === 'unitPrice') rec.items.find((i) => i.id === m[1]).unitPrice = v;
              else {
                const item = rec.items.find((i) => i.id === m[1]);
                const short = moveStock(
                  products.find((x) => x.id === item.productId),
                  Number(v) - Number(item.quantity),
                  'purchase_edit',
                  { type: 'purchase', id: rec.id, code: rec.code },
                  cr.reason,
                  cr.requestedBy,
                );
                if (short) return stockShort(short);
                item.quantity = String(v);
              }
            }
            rec.updatedAt = new Date().toISOString();
            for (const i of rec.items) recomputeLast(i.productId);
          } else if (['sales_order', 'delivery', 'collection'].includes(cr.entityType)) {
            for (const [f, v] of Object.entries(cr.proposedChange)) {
              const line = /^items\.([^.]+)\.(quantity|unitPrice)$/.exec(f);
              if (!line) {
                rec[f] = v;
                continue;
              }
              const item = rec.items.find((i) => i.id === line[1]);
              if (line[2] === 'unitPrice') item.unitPrice = v;
              else item.quantity = String(v);
            }
            rec.updatedAt = new Date().toISOString();
            refreshCustomer(customers.find((c) => c.id === rec.customerId));
          } else {
            Object.assign(rec, cr.proposedChange, { updatedAt: new Date().toISOString() });
          }
        }
        cr.status = 'approved';
        decided();
        cr.appliedAt = cr.decidedAt;
        return send(res, 200, view(cr, true));
      }
      if (rest === 'users' && req.method === 'GET')
        return need('users.view') && send(res, 200, pageOf(members, page));
      if (rest === 'users/lookup' && req.method === 'POST') {
        if (!need('users.manage')) return;
        const id = String(body.identifier ?? '')
          .trim()
          .toLowerCase();
        if (!id)
          return err(
            res,
            400,
            'identifier should not be empty',
            'IDENTIFIER_REQUIRED',
            'identifier',
          );
        const phone = normalizePhone(id);
        const known = Object.values(USERS).map((u) => u.user);
        const hit = [...known, OUTSIDER].find(
          (u) => u.email === id || (phone && u.phone === phone),
        );
        if (!hit) return err(res, 404, 'User not found', 'USER_NOT_FOUND');
        const member = members.find((m) => m.id === hit.id);
        return send(res, 200, {
          id: hit.id,
          name: hit.name,
          isActive: hit.isActive,
          isPlatformOwner: Boolean(hit.isPlatformOwner),
          hasAccess: Boolean(hit.isPlatformOwner || member),
          role: member?.role ?? null,
        });
      }
      let r = rest.match(/^users\/([^/]+)\/access$/);
      if (r && req.method === 'POST') {
        if (!need('users.manage')) return;
        const hit = [OUTSIDER, ...members].find((u) => u.id === r[1]);
        if (!hit) return err(res, 404, 'User not found', 'USER_NOT_FOUND');
        const existing = members.find((m) => m.id === hit.id);
        if (existing) existing.role = body.roleKey;
        else
          members.push({
            id: hit.id,
            name: hit.name,
            email: hit.email,
            phone: hit.phone,
            isActive: hit.isActive,
            isPlatformOwner: false,
            lastLoginAt: null,
            role: body.roleKey,
          });
        return send(res, 200, { id: hit.id, role: body.roleKey });
      }
      r = rest.match(/^products\/([^/]+)$/);
      if (r && req.method === 'GET') {
        const p = products.find((x) => x.id === r[1]);
        return (
          need('product.view') &&
          (p
            ? send(res, 200, hide(perms, p, COST_FIELDS, 'product.cost.view'))
            : err(res, 404, 'Product not found', 'PRODUCT_NOT_FOUND'))
        );
      }
      if (r && req.method === 'PATCH') {
        const p = products.find((x) => x.id === r[1]);
        if (!p) return err(res, 404, 'Product not found', 'PRODUCT_NOT_FOUND');
        for (const [field, code] of [
          ['purchasePrice', 'PURCHASE_PRICE_NOT_ALLOWED'],
          ['lastPurchasePrice', 'LAST_PURCHASE_PRICE_NOT_ALLOWED'],
        ])
          if (field in body) return err(res, 400, `${field} cannot be set`, code, field);
        if ('isActive' in body) {
          if (!need('product.deactivate')) return;
          if (!body.reason || body.reason.trim().length < 3)
            return err(res, 400, 'A reason is required', 'REASON_REQUIRED', 'reason');
          p.isActive = body.isActive;
        } else if (!need('product.manage')) return;
        for (const k of ['nameEn', 'nameBn']) if (k in body) p[k] = body[k];
        p.updatedAt = new Date().toISOString();
        return send(res, 200, hide(perms, p, COST_FIELDS, 'product.cost.view'));
      }
      const dueFields = [
        'openingBalance',
        'currentBalance',
        'creditLimit',
        'deliveredAmount',
        'collectedAmount',
      ];
      if (rest === 'customers' && req.method === 'GET') {
        if (!need('customer.view')) return;
        const q = search.replace(/^0/, '');
        const list = customers.filter(
          (c) =>
            activeOk(c) &&
            (match(search, c.nameEn, c.nameBn, c.code) || Boolean(q && c.phone.includes(q))),
        );
        return send(res, 200, {
          ...pageOf(list, page),
          items: pageOf(list, page).items.map((c) =>
            hide(perms, c, dueFields, 'customer.due.view'),
          ),
        });
      }
      if (rest === 'customers' && req.method === 'POST') {
        if (!need('customer.manage')) return;
        if (
          ('openingBalance' in body || 'creditLimit' in body) &&
          !perms.includes('customer.due.view')
        )
          return err(res, 403, 'Access denied');
        const phone = normalizePhone(body.phone ?? '');
        if (!phone) return err(res, 400, 'Phone number is not valid', 'PHONE_INVALID', 'phone');
        if (customers.some((c) => c.phone === phone))
          return err(
            res,
            409,
            'A customer with this phone number already exists',
            'PHONE_DUPLICATE',
            'phone',
          );
        const n = customers.length + 1;
        const c = {
          id: `cu${n}`,
          code: `C-${String(n).padStart(5, '0')}`,
          nameEn: body.nameEn,
          nameBn: body.nameBn ?? null,
          phone,
          address: body.address ?? null,
          area: body.area ?? null,
          openingBalance: body.openingBalance
            ? `${body.openingBalance}`.includes('.')
              ? body.openingBalance
              : `${body.openingBalance}.00`
            : '0.00',
          currentBalance: '0.00',
          creditLimit: body.creditLimit ?? null,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        };
        c.currentBalance = c.openingBalance;
        customers.push(c);
        return send(res, 201, hide(perms, c, dueFields, 'customer.due.view'));
      }
      r = rest.match(/^customers\/([^/]+)$/);
      if (r && req.method === 'GET') {
        const c = customers.find((x) => x.id === r[1]);
        return (
          need('customer.view') &&
          (c
            ? send(res, 200, hide(perms, c, dueFields, 'customer.due.view'))
            : err(res, 404, 'Customer not found', 'CUSTOMER_NOT_FOUND'))
        );
      }
      if (rest === 'suppliers' && req.method === 'GET')
        return need('supplier.view') && send(res, 200, pageOf(suppliers.filter(activeOk), page));
      r = rest.match(/^suppliers\/([^/]+)$/);
      if (r) return need('supplier.view') && send(res, 200, suppliers[0]);

      // ---- Accounts ----
      if (rest === 'accounts/summary' && req.method === 'GET') {
        if (!need('ledger.view')) return;
        return send(res, 200, {
          from: url.searchParams.get('from') || '2025-01-01',
          to: url.searchParams.get('to') || '2025-01-31',
          totalIn: '250000.00',
          totalOut: '180000.00',
          net: '70000.00',
          totalDue: '45000.00',
          totalAdvance: '12000.00',
          byType: [
            { type: 'collection', in: '200000.00', out: '0.00' },
            { type: 'expense', in: '0.00', out: '50000.00' },
            { type: 'purchase', in: '0.00', out: '120000.00' },
            { type: 'manual', in: '50000.00', out: '10000.00' },
          ],
        });
      }
      if (rest === 'accounts/ledger' && req.method === 'GET') {
        if (!need('ledger.view')) return;
        const typeFilter = url.searchParams.get('type');
        let items = [
          {
            id: 'le-1',
            type: 'collection',
            direction: 'in',
            amount: '50000.00',
            method: 'cash',
            referenceType: 'collection',
            referenceId: 'col-1',
            entryDate: '2025-01-15',
            note: 'Monthly collection',
            status: 'active',
            createdBy: { id: 'u1', name: 'Admin' },
            createdAt: '2025-01-15T10:00:00Z',
          },
          {
            id: 'le-2',
            type: 'expense',
            direction: 'out',
            amount: '10000.00',
            method: 'bkash',
            referenceType: 'expense',
            referenceId: 'exp-1',
            entryDate: '2025-01-16',
            note: null,
            status: 'active',
            createdBy: { id: 'u1', name: 'Admin' },
            createdAt: '2025-01-16T11:00:00Z',
          },
          {
            id: 'le-3',
            type: 'manual',
            direction: 'in',
            amount: '5000.00',
            method: null,
            referenceType: null,
            referenceId: null,
            entryDate: '2025-01-17',
            note: 'Misc income',
            status: 'void',
            createdBy: { id: 'u1', name: 'Admin' },
            createdAt: '2025-01-17T09:00:00Z',
          },
        ];
        if (typeFilter) items = items.filter((e) => e.type === typeFilter);
        return send(res, 200, { items, page: page || 1, pageSize: 10, total: items.length });
      }
      if (rest === 'accounts/entries' && req.method === 'POST') {
        if (!need('ledger.entry.create')) return;
        const ik = req.headers['idempotency-key'];
        if (!ik) return err(res, 400, 'Idempotency key required', 'IDEMPOTENCY_KEY_REQUIRED');
        return send(res, 201, {
          id: 'le-new-' + Date.now(),
          type: 'manual',
          direction: body.direction || 'in',
          amount: body.amount || '0.00',
          method: body.method || null,
          referenceType: null,
          referenceId: null,
          entryDate: body.entryDate || '2025-01-20',
          note: body.note || null,
          status: 'active',
          createdBy: { id: 'u1', name: 'Admin' },
          createdAt: new Date().toISOString(),
        });
      }
      if (rest === 'accounts/payments' && req.method === 'POST') {
        if (!need('payment.create')) return;
        const ik = req.headers['idempotency-key'];
        if (!ik) return err(res, 400, 'Idempotency key required', 'IDEMPOTENCY_KEY_REQUIRED');
        return send(res, 201, {
          id: 'le-pay-' + Date.now(),
          type: 'supplier_payment',
          direction: 'out',
          amount: body.amount || '0.00',
          method: body.method || 'cash',
          referenceType: null,
          referenceId: null,
          entryDate: body.paymentDate || '2025-01-20',
          note: body.note || null,
          status: 'active',
          createdBy: { id: 'u1', name: 'Admin' },
          createdAt: new Date().toISOString(),
        });
      }

      return err(res, 404, 'Not Found', 'ROUTE_NOT_FOUND');
    });
  })
  .listen(PORT, () => console.log(`mock jesan-api on ${PORT}`));
