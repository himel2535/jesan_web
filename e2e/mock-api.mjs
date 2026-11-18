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
];
const SALESMAN = [
  'customer.manage',
  'customer.view',
  'product.view',
  'sale.create',
  'sale.view.own',
  'stock.view',
];
const OWNER = [
  ...MANAGER,
  'product.price.edit',
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
    purchasePrice: `${500 + n}.00`,
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
const err = (res, status, message) => send(res, status, { message, statusCode: status });
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
        return err(res, 403, 'Origin not allowed');
      if (path === '/health') return send(res, 200, { status: 'ok' });
      if (path === '/auth/login') {
        const u =
          USERS[
            String(body.identifier ?? '')
              .trim()
              .toLowerCase()
          ];
        if (!u || u.password !== body.password) return err(res, 401, 'Invalid credentials');
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
            hide(perms, p, ['purchasePrice'], 'product.cost.view'),
          ),
        });
      }
      let r = rest.match(/^products\/([^/]+)$/);
      if (r && req.method === 'GET') {
        const p = products.find((x) => x.id === r[1]);
        return (
          need('product.view') &&
          (p
            ? send(res, 200, hide(perms, p, ['purchasePrice'], 'product.cost.view'))
            : err(res, 404, 'Product not found'))
        );
      }
      if (r && req.method === 'PATCH') {
        const p = products.find((x) => x.id === r[1]);
        if (!p) return err(res, 404, 'Product not found');
        if ('isActive' in body) {
          if (!need('product.deactivate')) return;
          if (!body.reason || body.reason.trim().length < 3)
            return err(res, 400, 'A reason is required');
          p.isActive = body.isActive;
        } else if (!need('product.manage')) return;
        for (const k of ['nameEn', 'nameBn']) if (k in body) p[k] = body[k];
        p.updatedAt = new Date().toISOString();
        return send(res, 200, hide(perms, p, ['purchasePrice'], 'product.cost.view'));
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
        if (!phone) return err(res, 400, 'Phone number is not valid');
        if (customers.some((c) => c.phone === phone))
          return err(res, 409, 'A customer with this phone number already exists');
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
            : err(res, 404, 'Customer not found'))
        );
      }
      if (rest === 'suppliers' && req.method === 'GET')
        return need('supplier.view') && send(res, 200, pageOf(suppliers.filter(activeOk), page));
      r = rest.match(/^suppliers\/([^/]+)$/);
      if (r) return need('supplier.view') && send(res, 200, suppliers[0]);
      return err(res, 404, 'Not Found');
    });
  })
  .listen(PORT, () => console.log(`mock jesan-api on ${PORT}`));
