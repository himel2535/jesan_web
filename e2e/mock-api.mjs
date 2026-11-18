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
      if (rest === 'change-requests' || rest.startsWith('change-requests/')) {
        const sub = rest.slice('change-requests'.length).replace(/^\//, '');
        const records = { product: products, customer: customers, product_category: categories };
        const visible = (type, field) => {
          const rule = CHANGE_FIELDS[type]?.[field];
          return rule && (!rule.see || perms.includes(rule.see));
        };
        const only = (type, obj) =>
          obj && Object.fromEntries(Object.entries(obj).filter(([k]) => visible(type, k)));
        const labelOf = (type, rec) =>
          type === 'product_category' ? rec.nameEn : `${rec.code} ${rec.nameEn}`;
        const impactOf = (type, rec, change) =>
          Object.entries(only(type, change)).flatMap(([field, after]) => {
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
        const summaryOf = (type, snap, change) =>
          Object.keys(change ?? {})
            .map((f) =>
              visible(type, f)
                ? `${CHANGE_FIELDS[type][f].label}: ${snap[f]} → ${change[f]}`
                : `${CHANGE_FIELDS[type][f].label} changed`,
            )
            .join('; ');
        const view = (cr, full) => {
          const rec = records[cr.entityType].find((x) => x.id === cr.entityId);
          const base = {
            id: cr.id,
            entityType: cr.entityType,
            entityId: cr.entityId,
            entityLabel: cr.entityLabel,
            kind: 'edit',
            summary: summaryOf(cr.entityType, cr.snapshot, cr.proposedChange),
            status: cr.status,
            requestedBy: cr.requestedBy,
            requestedAt: cr.requestedAt,
            decidedBy: cr.decidedBy,
            decidedAt: cr.decidedAt,
          };
          if (!full) return base;
          const stale =
            cr.status === 'stale' || (cr.status === 'pending' && rec.updatedAt > cr.requestedAt);
          return {
            ...base,
            reason: cr.reason,
            snapshot: only(cr.entityType, cr.snapshot),
            proposedChange: only(cr.entityType, cr.proposedChange),
            impact:
              cr.status === 'pending' ? impactOf(cr.entityType, rec, cr.proposedChange) : null,
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
          for (const [k, v] of Object.entries(body.proposedChange ?? {})) {
            if (!CHANGE_FIELDS[type][k])
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
            change[k] = k === 'isActive' ? v : money(v);
          }
          if (!Object.keys(change).length)
            return [null, err(res, 400, 'Empty change', 'PROPOSED_CHANGE_EMPTY', 'proposedChange')];
          return [{ type, rec, change }, null];
        };

        if (sub === 'preview' && req.method === 'POST') {
          if (!perms.includes('change.request') && !perms.includes('change.approve'))
            return err(res, 403, 'Access denied');
          const [ok] = readBody();
          if (!ok) return;
          return send(res, 200, {
            entityLabel: labelOf(ok.type, ok.rec),
            impact: impactOf(ok.type, ok.rec, ok.change),
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
            snapshot: Object.fromEntries(Object.keys(ok.change).map((k) => [k, ok.rec[k]])),
            proposedChange: ok.change,
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
        if (rec.updatedAt > cr.requestedAt) {
          cr.status = 'stale';
          return err(res, 409, 'The record changed after this request was made', 'STALE_REQUEST');
        }
        for (const f of Object.keys(cr.proposedChange))
          if (!perms.includes(CHANGE_FIELDS[cr.entityType][f].apply))
            return err(res, 403, 'Access denied');
        Object.assign(rec, cr.proposedChange, { updatedAt: new Date().toISOString() });
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
