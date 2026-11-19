// Mock jesan-api for Playwright (follows docs/API.md: cookies, refresh, Origin check, hidden
// fields by permission, 409s). Example data and TEST-ONLY passwords; nothing real.
import http from 'node:http';

const PORT = Number(process.env.MOCK_API_PORT ?? 4000);
const ORIGINS = ['http://localhost:3000'];

const MANAGER = [
  'collection.create',
  'customer.due.view',
  'customer.manage',
  'customer.view',
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
  'stock.adjust.large',
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
const send = (res, status, body, headers = {}) => {
  res.writeHead(status, { 'Content-Type': 'application/json', ...headers });
  res.end(body === undefined ? '' : JSON.stringify(body));
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
      if (path === '/health') return send(res, 200, { status: 'ok' });
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
          return CHANGE_FIELDS[type]?.[field];
        };
        const valueOf = (type, rec, field) => {
          const m = type === 'purchase' && /^items\.([^.]+)\.(quantity|unitPrice)$/.exec(field);
          if (m) return rec.items.find((i) => i.id === m[1])?.[m[2]];
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
            : type === 'purchase'
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
                ? 'Void purchase'
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
            if (type !== 'purchase')
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
              ['purchaseDate', 'note', 'supplierReference'].includes(k);
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
          if (!need('purchase.void')) return;
          const short = voidPurchase(rec, cr.reason, cr.requestedBy);
          if (short) return stockShort(short);
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
      const dueFields = ['openingBalance', 'currentBalance', 'creditLimit'];
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
      return err(res, 404, 'Not Found', 'ROUTE_NOT_FOUND');
    });
  })
  .listen(PORT, () => console.log(`mock jesan-api on ${PORT}`));
