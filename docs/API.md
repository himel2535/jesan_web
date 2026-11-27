# jesan-api: API রেফারেন্স (frontend-এর জন্য)

`jesan-web` (Next.js) যে API ডাকবে তার পুরো চুক্তি। এখানের প্রতিটা নমুনা চালানো API-র আসল উত্তর থেকে নেওয়া; শুধু id, নাম ও ইমেইল উদাহরণ-মান, আর পাসওয়ার্ডের জায়গায় `<password>`। কোনো আসল secret, token বা পাসওয়ার্ড এখানে নেই।

API বদলালে এই ফাইলও একই PR-এ হালনাগাদ হবে।

## সূচি

1. [সাধারণ নিয়ম](#১-সাধারণ-নিয়ম)
2. [Cookie ও token](#২-cookie-ও-token)
3. [Refresh কখন ও কীভাবে](#৩-refresh-কখন-ও-কীভাবে)
4. [CORS ও credentials](#৪-cors-ও-credentials)
5. [Endpoint তালিকা](#৫-endpoint-তালিকা)
6. [Health](#৬-health)
7. [Auth](#৭-auth)
8. [Settings API](#৮-settings-api)
9. [মাস্টার ডেটা (dealership)](#৯-মাস্টার-ডেটা-dealership)
10. [কেনা ও স্টক](#১০-কেনা-ও-স্টক)
11. [অর্ডার, ডেলিভারি ও আদায়](#১১-অর্ডার-ডেলিভারি-ও-আদায়)
12. [সংশোধনের অনুরোধ ও অনুমোদন](#১২-সংশোধনের-অনুরোধ-ও-অনুমোদন)
13. [খরচ, ক্যাশ বই ও মূল রিপোর্ট](#১৩-খরচ-ক্যাশ-বই-ও-মূল-রিপোর্ট)
14. [হিসাব (Accounts)](#১৪-হিসাব-accounts)
14-ক. [ড্যাশবোর্ড: নগদ অবস্থান ও মাসিক সারসংক্ষেপ](#১৪-ক-ড্যাশবোর্ড-নগদ-অবস্থান-ও-মাসিক-সারসংক্ষেপ)
15. [ত্রুটির রূপ ও কোড](#১৫-ত্রুটির-রূপ-ও-কোড)
16. [রোল ও অনুমতি](#১৬-রোল-ও-অনুমতি)

---

## ১. সাধারণ নিয়ম

| বিষয় | মান |
|---|---|
| Base URL (লোকাল) | `http://localhost:4000/api/v1` |
| Request/Response | JSON (`Content-Type: application/json`), UTF-8 |
| সময় | ISO 8601, UTC (`"2026-11-17T07:35:26.027Z"`) |
| id | UUID (v7, সময়ক্রমে সাজানো), স্ট্রিং |
| প্রমাণীকরণ | সব route ডিফল্টে লগইন লাগে; শুধু health ও `login`/`refresh`/`logout` খোলা |
| ব্যবসার route | `/b/:businessSlug/...`, যেমন `/b/akij-cement/users` |
| তালিকা | প্রতি পাতায় ১০টা, `?page=1` থেকে শুরু; উত্তর `{ items, page, pageSize, total }` |
| টাকা | **স্ট্রিং**, ঠিক দুই দশমিক (`"570.00"`); পাঠানোর সময়ও স্ট্রিং (`"570"` বা `"570.50"`), সংখ্যা নয় |

- request body-তে অঘোষিত কোনো ফিল্ড পাঠালে 400 (`property x should not exist`)।
- টাকা কখনো JavaScript-এর `number` হিসেবে হিসাব করবেন না (দশমিকের ভুল হয়); দেখানোর জন্য স্ট্রিংটাই ফরম্যাট করুন।
- অন্য ব্যবসার কোনো রেকর্ডের id দিলে উত্তর 404 (রেকর্ডটা "নেই"), কখনো অন্য ব্যবসার ডেটা নয়।
- response-এ এমন কোনো ফিল্ড থাকে না যা এখানে লেখা নেই। কোনো ফিল্ড দেখার অনুমতি না থাকলে সেটা response-এ **একেবারেই থাকে না** (`null` নয়)। তাই frontend-এ `if ('margin' in row)` বা `row.margin !== undefined` দিয়ে দেখুন।

---

## ২. Cookie ও token

লগইনের পর API দুটো cookie বসায়। token কখনো response body-তে আসে না।

| Cookie | কাজ | মেয়াদ | Path | ধরন |
|---|---|---|---|---|
| `jesan_at` | access token (JWT) | ১৫ মিনিট (`Max-Age=900`) | `/` | `HttpOnly; SameSite=Lax` (+ production-এ `Secure`) |
| `jesan_rt` | refresh token (এলোমেলো স্ট্রিং) | ৩০ দিন (`Max-Age=2592000`) | `/api/v1/auth` | `HttpOnly; SameSite=Lax` (+ production-এ `Secure`) |

আসল `Set-Cookie` header (মান সরানো):

```
Set-Cookie: jesan_at=<redacted>; Max-Age=900; Path=/; Expires=Tue, 17 Nov 2026 07:50:25 GMT; HttpOnly; SameSite=Lax
Set-Cookie: jesan_rt=<redacted>; Max-Age=2592000; Path=/api/v1/auth; Expires=Thu, 17 Dec 2026 07:35:25 GMT; HttpOnly; SameSite=Lax
```

- `HttpOnly`: পাতার JavaScript এগুলো পড়তে পারে না (`document.cookie`-তে দেখা যায় না)। frontend token নিয়ে কিছু করে না; ব্রাউজার নিজে পাঠায়।
- refresh cookie শুধু `/api/v1/auth/...` পথে যায়, অন্য API ডাকে যায় না।
- লগইন অবস্থা জানতে `GET /auth/me` ডাকুন (200 মানে লগইন আছে, 401 মানে নেই)।
- `Authorization: Bearer <access token>` header-ও গ্রহণযোগ্য (পরীক্ষা বা ভবিষ্যতের মোবাইল অ্যাপের জন্য)। ব্রাউজারের frontend cookie-ই ব্যবহার করবে।

---

## ৩. Refresh কখন ও কীভাবে

- **কখন:** কোনো অনুরোধে **401** এলে (access token-এর ১৫ মিনিট শেষ), একবার `POST /auth/refresh` ডাকুন। সফল (200) হলে নতুন cookie বসে যায়; তখন মূল অনুরোধটা আবার পাঠান।
- **refresh নিজে 401 দিলে:** সেশন শেষ (৩০ দিন পার, logout, পাসওয়ার্ড বদল বা রিসেট, ইউজার নিষ্ক্রিয়, বা চুরি সন্দেহে বাতিল)। API cookie মুছে দেয়; ইউজারকে লগইন পাতায় পাঠান।
- **একসাথে একটাই refresh:** অনেকগুলো অনুরোধ একসাথে 401 পেলে প্রত্যেকে আলাদা refresh ডাকবে না। একটা refresh চলুক, বাকিরা তার ফলের জন্য অপেক্ষা করুক (নিচের নমুনা)। প্রতিটা refresh পুরনো refresh token বাতিল করে; বাতিল token ১০ সেকেন্ড পরে আবার এলে API ধরে নেয় চুরি হয়েছে এবং পুরো সেশন বাতিল করে।
- **দুই ট্যাব একসাথে:** একটা ট্যাব refresh করার ১০ সেকেন্ডের মধ্যে অন্যটাও পুরনো cookie নিয়ে refresh করলে সেটা 401 পায়, কিন্তু সেশন বাতিল হয় না। ব্রাউজারে ততক্ষণে নতুন cookie এসে গেছে, তাই মূল অনুরোধটা একবার আবার পাঠালেই চলে।
- **refresh-কে retry করবেন না** (refresh-এর 401-এ আবার refresh নয়), আর `login`/`refresh`/`logout`-এর 401-এ refresh ডাকবেন না।
- ঐচ্ছিক: সক্রিয় ইউজারের জন্য ১৪ মিনিট পর পর আগেভাগে refresh করা যায়, তাতে 401 কম দেখা যায়।

```ts
const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

let refreshing: Promise<boolean> | null = null;

/** Only one refresh at a time; everyone else waits for its result. */
function refreshOnce(): Promise<boolean> {
  refreshing ??= fetch(`${API}/auth/refresh`, { method: 'POST', credentials: 'include' })
    .then((response) => response.ok)
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

const AUTH_PATHS = ['/auth/login', '/auth/refresh', '/auth/logout'];

export async function api(path: string, init: RequestInit = {}): Promise<Response> {
  const send = () =>
    fetch(`${API}${path}`, {
      ...init,
      credentials: 'include', // always: sends and receives the cookies
      headers: { 'content-type': 'application/json', ...init.headers },
    });

  let response = await send();
  if (response.status === 401 && !AUTH_PATHS.includes(path)) {
    if (await refreshOnce()) {
      response = await send(); // retry once with the new cookie
    } else {
      window.location.assign('/login'); // the session is over
    }
  }
  return response;
}
```

Next.js-এর Server Component বা Route Handler থেকে ডাকলে ব্রাউজারের cookie নিজে যায় না; আসা অনুরোধের `Cookie` header API-তে পাঠাতে হবে, আর API-র `Set-Cookie` ব্রাউজারে ফেরত দিতে হবে।

---

## ৪. CORS ও credentials

- API শুধু `CORS_ORIGIN`-এ লেখা origin-কে (হুবহু, স্কিম ও পোর্টসহ) cookie-সহ উত্তর দেয়। লোকালে ডিফল্ট `http://localhost:3000`। উত্তরে থাকে `Access-Control-Allow-Origin: http://localhost:3000` ও `Access-Control-Allow-Credentials: true`।
- প্রতিটা `fetch`-এ `credentials: 'include'` লাগবে, না হলে ব্রাউজার cookie পাঠাবে না, নেবেও না।
- **CSRF সুরক্ষা:** cookie দিয়ে লগইন করা অবস্থায় `POST`/`PUT`/`PATCH`/`DELETE` অনুরোধের `Origin` header তালিকার বাইরে হলে **403 `Origin not allowed`**। ব্রাউজার `Origin` নিজে বসায়, frontend-কে কিছু করতে হয় না। `GET`-এ এই চেক নেই।
- **লোকালে:** `localhost:3000` আর `localhost:4000` একই "সাইট" (পোর্ট ধরা হয় না), তাই cookie কোনো বাড়তি সেটিং ছাড়াই যায়।
- **ডিপ্লয়ের শর্ত:** web ও API একই সাইটে থাকতে হবে: কাস্টম ডোমেইনের সাবডোমেইন (`app.` ও `api.`) অথবা Next.js proxy (`rewrites`)। `xxx.vercel.app` আর `xxx.up.railway.app` আলাদা সাইট; সেখানে cookie যাবে না এবং `me` 401 দেবে। বিস্তারিত README-র "ডিপ্লয়ের শর্ত" অংশে।

---

## ৫. Endpoint তালিকা

সব পথ base URL (`/api/v1`)-এর পরে।

| Method | পথ | লগইন | অনুমতি | সফল status |
|---|---|---|---|---|
| GET | `/health` | না | - | 200 |
| GET | `/health/ready` | না | - | 200 (ডাটাবেস না পেলে 503) |
| POST | `/auth/login` | না | - | 200 |
| POST | `/auth/refresh` | না (refresh cookie) | - | 200 |
| POST | `/auth/logout` | না | - | 204 |
| GET | `/auth/me` | হ্যাঁ | - | 200 |
| POST | `/auth/change-password` | হ্যাঁ | - | 204 |
| GET | `/b/:businessSlug/roles/permissions` | হ্যাঁ | `roles.manage` (owner-only) | 200 |
| PUT | `/b/:businessSlug/roles/:roleKey/permissions` | হ্যাঁ | `roles.manage` (owner-only) | 200 |
| GET | `/b/:businessSlug/users?page=1` | হ্যাঁ | `users.view` | 200 |
| POST | `/b/:businessSlug/users` | হ্যাঁ | `users.manage` (owner-only) | 201 |
| POST | `/b/:businessSlug/users/lookup` | হ্যাঁ | `users.manage` (owner-only); প্রতি ইউজার মিনিটে ২০টা | 200 |
| POST | `/b/:businessSlug/users/:userId/access` | হ্যাঁ | `users.manage` (owner-only) | 200 |
| PATCH | `/b/:businessSlug/users/:userId/role` | হ্যাঁ | `users.manage` (owner-only) | 200 |
| DELETE | `/b/:businessSlug/users/:userId/access` | হ্যাঁ | `users.manage` (owner-only) | 204 |
| PATCH | `/b/:businessSlug/users/:userId/status` | হ্যাঁ | `users.manage` (owner-only) | 204 |
| POST | `/b/:businessSlug/users/:userId/reset-password` | হ্যাঁ | `users.manage` (owner-only) | 204 |
| GET | `/b/:businessSlug/product-units` | হ্যাঁ | `product.view` | 200 |
| GET | `/b/:businessSlug/product-categories?active=` | হ্যাঁ | `product.view` | 200 |
| POST | `/b/:businessSlug/product-categories` | হ্যাঁ | `product.manage` | 201 |
| PATCH | `/b/:businessSlug/product-categories/:id` | হ্যাঁ | `product.manage` (+ নিষ্ক্রিয়ে `product.deactivate`) | 200 |
| GET | `/b/:businessSlug/products?search=&categoryId=&active=&page=` | হ্যাঁ | `product.view` | 200 |
| GET | `/b/:businessSlug/products/:id` | হ্যাঁ | `product.view` | 200 |
| POST | `/b/:businessSlug/products` | হ্যাঁ | `product.manage` | 201 |
| PATCH | `/b/:businessSlug/products/:id` | হ্যাঁ | `product.manage` (+ নিষ্ক্রিয়ে `product.deactivate`) | 200 |
| GET | `/b/:businessSlug/customers?search=&active=&page=` | হ্যাঁ | `customer.view` | 200 |
| GET | `/b/:businessSlug/customers/:id` | হ্যাঁ | `customer.view` | 200 |
| POST | `/b/:businessSlug/customers` | হ্যাঁ | `customer.manage` (+ বাকি/সীমায় `customer.due.view`) | 201 |
| PATCH | `/b/:businessSlug/customers/:id` | হ্যাঁ | `customer.manage` (+ বাকি/সীমায় `customer.balance.edit`, নিষ্ক্রিয়ে `customer.deactivate`) | 200 |
| GET | `/b/:businessSlug/suppliers?active=&page=` | হ্যাঁ | `supplier.view` | 200 |
| GET | `/b/:businessSlug/suppliers/:id` | হ্যাঁ | `supplier.view` | 200 |
| POST | `/b/:businessSlug/purchases` | হ্যাঁ | `purchase.create` + `product.cost.view` | 201 (একই `Idempotency-Key` আবার: 200) |
| GET | `/b/:businessSlug/purchases?from=&to=&supplierId=&productId=&status=&page=` | হ্যাঁ | `purchase.view` | 200 |
| GET | `/b/:businessSlug/purchases/summary?from=&to=` | হ্যাঁ | `purchase.view` (টাকায় `product.cost.view`) | 200 |
| GET | `/b/:businessSlug/purchases/:id` | হ্যাঁ | `purchase.view` | 200 |
| PATCH | `/b/:businessSlug/purchases/:id` | হ্যাঁ | নোট/রেফারেন্সে `purchase.create`; তারিখ/বস্তা/দামে `purchase.edit` + `reason` | 200 |
| POST | `/b/:businessSlug/purchases/:id/void` | হ্যাঁ | `purchase.void` | 200 |
| GET | `/b/:businessSlug/stock?search=&categoryId=&active=&page=` | হ্যাঁ | `stock.view` | 200 |
| GET | `/b/:businessSlug/stock/:productId/movements?from=&to=&kind=&page=` | হ্যাঁ | `stock.view` | 200 |
| POST | `/b/:businessSlug/stock/adjustments` | হ্যাঁ | `stock.adjust` (দৈনিক সীমার বেশি হলে `stock.adjust.large`) | 201 |
| GET | `/b/:businessSlug/purchase-counters?year=` | হ্যাঁ | `commission.view` (owner-only) | 200 |
| GET | `/b/:businessSlug/commission-entries?page=` | হ্যাঁ | `commission.view` (owner-only) | 200 |
| POST | `/b/:businessSlug/commission-entries` | হ্যাঁ | `commission.manage` (owner-only) | 201 |
| GET | `/b/:businessSlug/commission-entries/:id` | হ্যাঁ | `commission.view` (owner-only) | 200 |
| PATCH | `/b/:businessSlug/commission-entries/:id` | হ্যাঁ | `commission.manage` (owner-only) | 200 |
| GET | `/b/:businessSlug/commission-summary?year=` | হ্যাঁ | `commission.view` (owner-only) | 200 |
| POST | `/b/:businessSlug/orders` | হ্যাঁ | `sale.create` | 201 (একই `Idempotency-Key`: 200) |
| GET | `/b/:businessSlug/orders?status=&customerId=&from=&to=&page=` | হ্যাঁ | `sale.view.all` বা নিজের অর্ডারে `sale.view.own` | 200 |
| GET | `/b/:businessSlug/orders/:id` | হ্যাঁ | `sale.view.all` বা নিজের অর্ডারে `sale.view.own` | 200 |
| PATCH | `/b/:businessSlug/orders/:id` | হ্যাঁ | `sale.edit` + `reason` | 200 |
| POST | `/b/:businessSlug/orders/:id/void` | হ্যাঁ | `sale.void` | 200 |
| POST | `/b/:businessSlug/deliveries` | হ্যাঁ | `delivery.create` (block মোডে সীমা পারে `delivery.credit.override`) | 201 (একই key: 200) |
| GET | `/b/:businessSlug/deliveries?orderId=&customerId=&status=&from=&to=&page=` | হ্যাঁ | `delivery.view` | 200 |
| GET | `/b/:businessSlug/deliveries/:id` | হ্যাঁ | `delivery.view` | 200 |
| PATCH | `/b/:businessSlug/deliveries/:id` | হ্যাঁ | `delivery.edit` + `reason` | 200 |
| POST | `/b/:businessSlug/deliveries/:id/void` | হ্যাঁ | `delivery.void` | 200 |
| POST | `/b/:businessSlug/collections` | হ্যাঁ | `collection.create` | 201 (একই key: 200) |
| GET | `/b/:businessSlug/collections?customerId=&orderId=&method=&status=&from=&to=&page=` | হ্যাঁ | `collection.view` | 200 |
| GET | `/b/:businessSlug/collections/:id` | হ্যাঁ | `collection.view` | 200 |
| PATCH | `/b/:businessSlug/collections/:id` | হ্যাঁ | `collection.edit` + `reason` | 200 |
| POST | `/b/:businessSlug/collections/:id/void` | হ্যাঁ | `collection.void` | 200 |
| GET | `/b/:businessSlug/collection-methods` | হ্যাঁ | `collection.create` | 200 |
| GET | `/b/:businessSlug/customers/:id/ledger?from=&to=&page=` | হ্যাঁ | `customer.due.view` | 200 |
| POST | `/b/:businessSlug/change-requests/preview` | হ্যাঁ | `change.request` বা `change.approve` | 200 |
| POST | `/b/:businessSlug/change-requests` | হ্যাঁ | `change.request` (+ রেকর্ড দেখার অনুমতি) | 201 (একই `Idempotency-Key` আবার: 200) |
| GET | `/b/:businessSlug/change-requests/mine?status=&page=` | হ্যাঁ | `change.view.own` | 200 |
| GET | `/b/:businessSlug/change-requests?status=&entityType=&entityId=&requestedBy=&from=&to=&page=` | হ্যাঁ | `change.view.all` | 200 |
| GET | `/b/:businessSlug/change-requests/pending-count` | হ্যাঁ | `change.view.all` | 200 |
| GET | `/b/:businessSlug/change-requests/:id` | হ্যাঁ | নিজের হলে `change.view.own`, নইলে `change.view.all` | 200 |
| POST | `/b/:businessSlug/change-requests/:id/approve` | হ্যাঁ | `change.approve` + সংশ্লিষ্ট সরাসরি-অনুমতি; নিজের নয় | 200 |
| POST | `/b/:businessSlug/change-requests/:id/reject` | হ্যাঁ | `change.approve`; নিজের নয় | 200 |
| POST | `/b/:businessSlug/change-requests/:id/cancel` | হ্যাঁ | `change.view.own`; শুধু নিজের | 200 |
| GET | `/b/:businessSlug/expense-categories?active=` | হ্যাঁ | `expense.view` | 200 |
| POST | `/b/:businessSlug/expense-categories` | হ্যাঁ | `expense.category.manage` | 201 |
| PATCH | `/b/:businessSlug/expense-categories/:id` | হ্যাঁ | `expense.category.manage` (নিষ্ক্রিয়ে `reason`) | 200 |
| GET | `/b/:businessSlug/expense-methods` | হ্যাঁ | `expense.create` | 200 |
| POST | `/b/:businessSlug/expenses` | হ্যাঁ | `expense.create` | 201 (একই `Idempotency-Key`: 200) |
| GET | `/b/:businessSlug/expenses?from=&to=&categoryId=&method=&status=&page=` | হ্যাঁ | `expense.view` | 200 |
| GET | `/b/:businessSlug/expenses/:id` | হ্যাঁ | `expense.view` | 200 |
| PATCH | `/b/:businessSlug/expenses/:id` | হ্যাঁ | `expense.edit` + `reason` | 200 |
| POST | `/b/:businessSlug/expenses/:id/void` | হ্যাঁ | `expense.void` | 200 |
| GET | `/b/:businessSlug/cash-book?from=&to=&page=` | হ্যাঁ | `cashbook.view` | 200 |
| GET | `/b/:businessSlug/reports/sales?groupBy=&from=&to=&page=` | হ্যাঁ | `report.view` | 200 |
| GET | `/b/:businessSlug/reports/collections?groupBy=&from=&to=&page=` | হ্যাঁ | `report.view` | 200 |
| GET | `/b/:businessSlug/reports/dues?page=` | হ্যাঁ | `report.view` | 200 |
| GET | `/b/:businessSlug/reports/stock?page=` | হ্যাঁ | `report.view` | 200 |
| GET | `/b/:businessSlug/reports/stock-movements?from=&to=&page=` | হ্যাঁ | `report.view` | 200 |
| GET | `/b/:businessSlug/reports/expenses?groupBy=&from=&to=` | হ্যাঁ | `report.view` | 200 |
| GET | `/b/:businessSlug/reports/daily-summary?date=` | হ্যাঁ | `report.view` (নগদ অংশ `cashbook.view`) | 200 |
| GET | `/b/:businessSlug/accounts/summary?from=&to=` | হ্যাঁ | `ledger.view` | 200 |
| GET | `/b/:businessSlug/accounts/ledger?from=&to=&type=&page=` | হ্যাঁ | `ledger.view` | 200 |
| POST | `/b/:businessSlug/accounts/entries` | হ্যাঁ | `ledger.entry.create` | 201 (একই `Idempotency-Key`: 200) |
| POST | `/b/:businessSlug/accounts/payments` | হ্যাঁ | `payment.create` | 201 (একই `Idempotency-Key`: 200) |
| GET | `/b/:businessSlug/dashboard/cashbook?from=&to=` | হ্যাঁ | `cashbook.view` | 200 |
| GET | `/b/:businessSlug/dashboard/finance-summary?from=&to=` | হ্যাঁ | `report.view` (খরচ ও লাভের ঘর `profit.view`) | 200 |
| GET | `/b/:businessSlug/dashboard/kpis?from=&to=&prevFrom=&prevTo=` | হ্যাঁ | `report.view` (কেনার বস্তা `purchase.view`) | 200 |
| GET | `/b/:businessSlug/dashboard/monthly-series?year=` | হ্যাঁ | `report.view` (কেনার টাকায় `product.cost.view`) | 200 |
| GET | `/b/:businessSlug/dashboard/commission-series?year=` | হ্যাঁ | `commission.view` (owner-only) | 200 |

`/b/:businessSlug/...` পথে আগে যাচাই হয় ইউজার ওই ব্যবসায় ঢুকতে পারেন কি না, তারপর অনুমতি। অজানা ব্যবসা আর ঢোকার অনুমতি নেই, দুটোই একই 403।

---

## ৬. Health

### `GET /health`

অ্যাপ বেঁচে আছে কি না। কোনো ডাটাবেস দেখে না, সবসময় দ্রুত 200।

```json
{ "status": "ok" }
```

### `GET /health/ready`

ডাটাবেস পৌঁছানো যায় কি না।

| অবস্থা | Status | Body |
|---|---|---|
| ডাটাবেস চালু | 200 | `{ "status": "ok", "database": "up" }` |
| `DATABASE_URL` নেই | 200 | `{ "status": "ok", "database": "not_configured" }` |
| ডাটাবেস পাওয়া যায় না | 503 | `{ "status": "error", "database": "down", "code": "SERVICE_UNAVAILABLE" }` |

---

## ৭. Auth

### `POST /auth/login`

email **বা** phone, একটাই `identifier` ফিল্ডে। email-এর বড়-ছোট হাতের অক্ষর ও আগে-পরের ফাঁকা জায়গা ধরা হয় না। phone `01712345678`, `8801712345678` বা `+8801712345678` যেভাবেই লিখুন, একই নম্বর।

Request:

```json
{ "identifier": "owner@example.com", "password": "<password>" }
```

Response 200 (সাথে দুটো `Set-Cookie`, অংশ ২ দেখুন):

```json
{
  "user": {
    "id": "01a1e86e-8c23-786b-8210-923026b5cbc3",
    "name": "Jesan Owner",
    "email": "owner@example.com",
    "phone": null,
    "isPlatformOwner": true
  }
}
```

ব্যর্থ হলে (ভুল পাসওয়ার্ড, অজানা ইউজার, নিষ্ক্রিয়, লক, বা phone/email কোনোটাই না) **সবসময় একই** উত্তর:

```json
{ "message": "Invalid credentials", "error": "Unauthorized", "statusCode": 401 }
```

- পরপর ৫ বার ভুল পাসওয়ার্ডে অ্যাকাউন্ট ১৫ মিনিট লক; লক অবস্থায় সঠিক পাসওয়ার্ডেও ওই একই 401। frontend কারণ জানতে পারে না, তাই বার্তা হিসেবে "ইমেইল/ফোন বা পাসওয়ার্ড ভুল, অথবা অ্যাকাউন্ট সাময়িকভাবে বন্ধ" দেখানো ভালো।
- এক IP থেকে প্রতি মিনিটে ১০টার বেশি চেষ্টায় **429** (অংশ ১৩)।
- লগইনের পর ব্যবসা ও অনুমতি পেতে `GET /auth/me` ডাকুন।

### `POST /auth/refresh`

Body লাগে না; refresh cookie থেকে পড়ে। সফল হলে দুটো নতুন cookie বসে।

```json
{ "status": "ok" }
```

ব্যর্থ হলে 401 (`{ "message": "Unauthorized", "statusCode": 401 }`) এবং দুটো cookie মুছে দেয়। তখন লগইন পাতায় পাঠান।

### `POST /auth/logout`

Body লাগে না। এই ডিভাইসের সেশন শেষ করে, access token-ও সঙ্গে সঙ্গে অকেজো, দুটো cookie মুছে দেয়। লগইন না থাকলেও 204; বারবার ডাকা নিরাপদ।

Response: **204**, body নেই।

### `GET /auth/me`

ইউজার, তিনি যে ব্যবসাগুলোতে ঢুকতে পারেন, আর প্রতিটায় রোল ও অনুমতি। frontend-এর Enterprise Dashboard (ব্যবসার কার্ড), ব্যবসা switcher, sidebar ও বাটন দেখানো এখান থেকে।

- `businesses` সাজানো থাকে dashboard-এর ক্রমে (`sortOrder`, তারপর নাম)। শুধু সক্রিয় ব্যবসা থাকে।
- `permissions` বর্ণানুক্রমে সাজানো অনুমতির key-র তালিকা।
- `isPlatformOwner: true` হলে ইউজার সব ব্যবসায় ঢুকতে পারেন এবং সব অনুমতি পান (owner-only সহ); তার `role` দেখায় `owner`।

**উদাহরণ ১: platform owner**

```json
{
  "user": {
    "id": "01a1e86e-8c23-786b-8210-923026b5cbc3",
    "name": "Jesan Owner",
    "email": "owner@example.com",
    "phone": null,
    "isActive": true,
    "isPlatformOwner": true
  },
  "businesses": [
    {
      "id": "01a1e5eb-5eaa-7284-8da2-132c3b0a60c1",
      "slug": "akij-cement",
      "nameEn": "Akij Cement",
      "nameBn": "আকিজ সিমেন্ট",
      "type": "dealership",
      "role": {
        "id": "01a1e5eb-5ea6-7ded-b2b8-34910b19362a",
        "key": "owner",
        "nameEn": "Owner",
        "nameBn": "মালিক"
      },
      "permissions": [
        "audit.view",
        "change.approve",
        "change.request",
        "change.view.all",
        "change.view.own",
        "collection.create",
        "collection.edit",
        "collection.view",
        "collection.void",
        "commission.manage",
        "commission.view",
        "customer.balance.edit",
        "customer.deactivate",
        "customer.due.view",
        "customer.manage",
        "customer.view",
        "delivery.create",
        "delivery.credit.override",
        "delivery.edit",
        "delivery.view",
        "delivery.void",
        "expense.create",
        "ledger.entry.create",
        "ledger.view",
        "payment.create",
        "product.cost.view",
        "product.deactivate",
        "product.manage",
        "product.view",
        "profit.view",
        "purchase.create",
        "purchase.edit",
        "purchase.view",
        "purchase.void",
        "reports.finance.view",
        "roles.manage",
        "sale.create",
        "sale.edit",
        "sale.view.all",
        "sale.view.own",
        "sale.void",
        "settings.manage",
        "settings.view",
        "stock.adjust",
        "stock.adjust.large",
        "stock.view",
        "summary.finance.view",
        "supplier.view",
        "users.manage",
        "users.view"
      ]
    }
  ]
}
```

**উদাহরণ ২: ম্যানেজার** (কমিশন, লাভ, টাকার সারাংশ বা ব্যবস্থাপনার কোনো অনুমতি নেই)

```json
{
  "user": {
    "id": "01a1e86e-9e22-720b-bd46-0235039e175b",
    "name": "Rahim Uddin",
    "email": "manager@example.com",
    "phone": "+8801712345678",
    "isActive": true,
    "isPlatformOwner": false
  },
  "businesses": [
    {
      "id": "01a1e5eb-5eaa-7284-8da2-132c3b0a60c1",
      "slug": "akij-cement",
      "nameEn": "Akij Cement",
      "nameBn": "আকিজ সিমেন্ট",
      "type": "dealership",
      "role": {
        "id": "01a1e5eb-5ea8-7ae4-aa8c-ede97af2b5e4",
        "key": "manager",
        "nameEn": "Manager",
        "nameBn": "ম্যানেজার"
      },
      "permissions": [
        "change.request",
        "change.view.own",
        "collection.create",
        "collection.view",
        "customer.due.view",
        "customer.manage",
        "customer.view",
        "delivery.create",
        "delivery.view",
        "product.cost.view",
        "product.manage",
        "product.view",
        "purchase.create",
        "purchase.view",
        "sale.create",
        "sale.view.all",
        "settings.view",
        "stock.adjust",
        "stock.view",
        "supplier.view",
        "users.view"
      ]
    }
  ]
}
```

কোনো ব্যবসায় অ্যাক্সেস না থাকলে `businesses` খালি তালিকা (`[]`)।

### `POST /auth/change-password`

নিজের পাসওয়ার্ড বদল। এই ডিভাইস লগইন থাকে, **অন্য সব ডিভাইস লগআউট** হয়।

Request:

```json
{ "currentPassword": "<current password>", "newPassword": "<new password>" }
```

Response: **204**, body নেই।

ত্রুটি: বর্তমান পাসওয়ার্ড ভুল হলে 400 `CURRENT_PASSWORD_INCORRECT` (`currentPassword`); নতুন পাসওয়ার্ড নিয়ম না মানলে 400 `PASSWORD_TOO_SHORT` / `PASSWORD_TOO_LONG` / `PASSWORD_MATCHES_IDENTITY` (`newPassword`)। সব code অংশ ১৩-এ।

**পাসওয়ার্ডের নিয়ম:** ১০ থেকে ১২৮ অক্ষর; ইউজারের নিজের email বা phone হতে পারবে না; চিহ্ন বা বড় হাতের অক্ষর বাধ্যতামূলক নয়।

**forgot-password এখন নেই।** পাসওয়ার্ড ভুলে গেলে মালিক Settings থেকে `reset-password` দিয়ে নতুন পাসওয়ার্ড বসাবেন।

---

## ৮. Settings API

সব পথ `/api/v1/b/:businessSlug/...`। ছক দেখা ও সব বদল শুধু **platform owner** পারেন (owner-only অনুমতি); ইউজারের তালিকা দেখতে `users.view` যথেষ্ট (ম্যানেজারের ডিফল্টে আছে)। প্রতিটা বদল সার্ভারের audit log-এ লেখা হয় এবং সঙ্গে সঙ্গে কার্যকর হয়।

### `GET roles/permissions`: রোল × অনুমতির ছক

- `permissions`: এই ব্যবসার ধরনে প্রযোজ্য সব অনুমতি, কোডে ঘোষণার ক্রমে (Settings পাতার সারির ক্রম হিসেবে ব্যবহার করুন)। `ownerOnly: true` মানে কোনো রোলকে দেওয়া যায় না (ছকে ওই সারি নিষ্ক্রিয় দেখান)।
- `roles`: চারটা রোল, Settings-এর কলামের ক্রমে। প্রতিটায় চালু অনুমতির তালিকা।
- `locked: true` (শুধু `owner` রোলে): এই রোলের অনুমতি বদলানো যায় না; সবসময় সব owner-only-বহির্ভূত অনুমতি।

Response 200 (`permissions` সংক্ষিপ্ত; আসলে ৫০টা, অংশ ১৬-এর টেবিলে সব):

```json
{
  "permissions": [
    { "key": "settings.view", "module": "core", "ownerOnly": false },
    { "key": "settings.manage", "module": "core", "ownerOnly": true },
    { "key": "users.view", "module": "core", "ownerOnly": false },
    { "key": "users.manage", "module": "core", "ownerOnly": true },
    { "key": "roles.manage", "module": "core", "ownerOnly": true },
    { "key": "audit.view", "module": "core", "ownerOnly": true },
    { "key": "product.view", "module": "dealership", "ownerOnly": false },
    { "key": "stock.view", "module": "dealership", "ownerOnly": false },
    { "key": "commission.view", "module": "dealership", "ownerOnly": true },
    { "key": "profit.view", "module": "dealership", "ownerOnly": true }
  ],
  "roles": [
    {
      "key": "owner",
      "nameEn": "Owner",
      "nameBn": "মালিক",
      "locked": true,
      "permissions": ["change.approve", "change.request", "...", "users.view"]
    },
    {
      "key": "manager",
      "nameEn": "Manager",
      "nameBn": "ম্যানেজার",
      "locked": false,
      "permissions": ["change.request", "change.view.own", "...", "users.view"]
    },
    {
      "key": "accountant",
      "nameEn": "Accountant",
      "nameBn": "হিসাবরক্ষক",
      "locked": false,
      "permissions": ["change.request", "change.view.own", "collection.create", "collection.view", "customer.due.view", "customer.view", "expense.create", "ledger.entry.create", "ledger.view", "payment.create", "settings.view"]
    },
    {
      "key": "salesman",
      "nameEn": "Salesman",
      "nameBn": "বিক্রয়কর্মী",
      "locked": false,
      "permissions": ["change.request", "change.view.own", "customer.manage", "customer.view", "product.view", "sale.create", "sale.view.own", "stock.view"]
    }
  ]
}
```

(`"..."` শুধু এই ডকুমেন্টে জায়গা বাঁচাতে; আসল উত্তরে পুরো তালিকা থাকে।)

### `PUT roles/:roleKey/permissions`: একটা রোলের অনুমতি বসানো

ওই রোলের এই ব্যবসার **পুরো** অনুমতির তালিকা পাঠান (যোগ-বিয়োগ নয়, সম্পূর্ণ তালিকা)। এক transaction-এ হয়; অন্য ব্যবসায় প্রভাব পড়ে না।

Request (`PUT /b/akij-cement/roles/salesman/permissions`):

```json
{
  "permissions": [
    "product.view",
    "customer.view",
    "customer.manage",
    "stock.view",
    "sale.create",
    "sale.view.own",
    "customer.due.view"
  ]
}
```

Response 200 (কী যোগ হলো, কী বাদ গেল):

```json
{ "role": "salesman", "added": ["customer.due.view"], "removed": [] }
```

ত্রুটি: `owner` রোল → 400 `OWNER_ROLE_FIXED`; অজানা রোল → 404 `ROLE_NOT_FOUND`; অজানা অনুমতি → 400 `PERMISSION_UNKNOWN` (`permissions`); owner-only অনুমতি → 400 `PERMISSION_OWNER_ONLY` (`permissions`)।

### `GET users?page=1`: ব্যবসার ইউজার

প্রতি পাতায় ১০ জন; `page` ১ থেকে শুরু। ক্রম: ইউজারকে এই ব্যবসায় যোগ করার ক্রমে।

```json
{
  "items": [
    {
      "id": "01a1e86e-9e22-720b-bd46-0235039e175b",
      "name": "Rahim Uddin",
      "email": "manager@example.com",
      "phone": "+8801712345678",
      "isActive": true,
      "isPlatformOwner": false,
      "lastLoginAt": "2026-11-17T07:35:26.027Z",
      "role": "manager"
    }
  ],
  "page": 1,
  "pageSize": 10,
  "total": 1
}
```

প্রতিটা item-এ ঠিক এই ফিল্ডগুলো থাকে, এর বেশি কিছু নয়:

| ফিল্ড | টাইপ | মানে |
|---|---|---|
| `id` | string (UUID) | ইউজারের id |
| `name` | string | নাম |
| `email` | string \| null | ইমেইল (না থাকলে `null`) |
| `phone` | string \| null | ফোন, `+880...` রূপে (না থাকলে `null`) |
| `isActive` | boolean | `false` = নিষ্ক্রিয়, লগইন করতে পারেন না (সব ব্যবসায়) |
| `isPlatformOwner` | boolean | platform owner কি না (নিচে দেখুন; এই তালিকায় কার্যত সবসময় `false`) |
| `lastLoginAt` | string (ISO সময়) \| null | শেষ সফল লগইন; কখনো লগইন না করলে `null` |
| `role` | string | এই ব্যবসায় রোলের key: `owner`, `manager`, `accountant`, `salesman` |

পাসওয়ার্ড, hash বা লকের তথ্য কখনো আসে না। মোট পাতা = `Math.ceil(total / pageSize)`।

**platform owner কি তালিকায় আসেন?** না। platform owner (`isPlatformOwner: true`) সব ব্যবসায় এমনিই ঢোকেন, তাঁর কোনো ব্যবসায় সদস্যপদের সারি থাকে না, আর এই API দিয়ে তাঁকে কোনো ব্যবসায় যোগ বা বদল করা যায় না। তাই তালিকায় শুধু এই ব্যবসার সদস্যরা আসেন। Settings পেজে platform owner-কে দেখাতে চাইলে `GET /auth/me`-এর `user` থেকে নিজেকে আলাদা করে দেখান।

**ইউজারকে `owner` রোল দেওয়া যায় কি?** হ্যাঁ। platform owner কোনো ইউজারকে এক বা একাধিক ব্যবসায় ব্যবসা-স্তরের `owner` রোল দিতে পারেন (তৈরির সময় `roleKey: "owner"`, অথবা `access`/`role` endpoint দিয়ে)। সেই ইউজার ওই ব্যবসায় সব অনুমতি পান **শুধু owner-only গুলো ছাড়া** (কমিশন, লাভ, Settings বদল, ইউজার ও রোল ব্যবস্থাপনা, audit)। তাই তিনি Settings API ব্যবহার করতে বা অন্যকে রোল দিতে পারেন না। কাউকে platform owner বানানো শুধু কমান্ড-লাইনে (`npm run admin:create`), API দিয়ে নয়।

### `POST users/lookup`: বিদ্যমান ইউজার খোঁজা

কেউ আগে থেকেই অন্য ব্যবসায় কাজ করেন (একই ইমেইল বা ফোন), তাঁকে এই ব্যবসায় যোগ করার আগে খোঁজার জন্য। শুধু platform owner (`users.manage`)। ইমেইল বা ফোন body-তে যায় (URL-এ নয়), যাতে সার্ভারের লগে না থাকে।

Request:

```json
{ "identifier": "manager@example.com" }
```

ইমেইলের বড়-ছোট হাতের অক্ষর ধরা হয় না; ফোন `01712345678` বা `+8801712345678` দুভাবেই চলে।

Response 200:

```json
{
  "id": "01a1e86e-9e22-720b-bd46-0235039e175b",
  "name": "Rahim Uddin",
  "isActive": true,
  "isPlatformOwner": false,
  "hasAccess": false,
  "role": null
}
```

| ফিল্ড | মানে |
|---|---|
| `hasAccess` | এই ব্যবসায় আগে থেকে ঢুকতে পারেন কি না (platform owner হলে সবসময় `true`) |
| `role` | এই ব্যবসায় বর্তমান রোলের key; সদস্য না হলে বা platform owner হলে `null` |

উত্তরে ইমেইল, ফোন বা অন্য কোন কোন ব্যবসায় আছেন, তা থাকে না। পরের ধাপ: `hasAccess: false` হলে `POST users/:id/access` দিয়ে রোলসহ যোগ করুন; `isPlatformOwner: true` হলে কিছু করার নেই।

- না মিললে (বা identifier ইমেইল/ফোন না হলে) **404** `User not found`; খালি হলে 400।
- **Rate limit:** প্রতি ইউজার প্রতি মিনিটে ২০টা খোঁজ; বেশি হলে **429** (`Retry-After` header দেখুন)।
- প্রতিটা খোঁজ audit log-এ যায় (কে, কোন ব্যবসায়, ইমেইল নাকি ফোন দিয়ে, পাওয়া গেল কি না); খোঁজার ইমেইল বা ফোন লগে রাখা হয় না।

### `POST users`: ইউজার তৈরি ও রোল বরাদ্দ

`email` বা `phone` অন্তত একটা লাগবে (দুটোও দেওয়া যায়)। phone আন্তর্জাতিক রূপে (`+880...`) জমা হয়। পাসওয়ার্ডের নিয়ম অংশ ৭-এ।

Request:

```json
{
  "name": "Rahim Uddin",
  "email": "manager@example.com",
  "phone": "01712345678",
  "password": "<password>",
  "roleKey": "manager"
}
```

Response **201**:

```json
{ "id": "01a1e86e-9e22-720b-bd46-0235039e175b", "role": "manager" }
```

ত্রুটি: একই email বা phone আগে থেকে থাকলে 409 `USER_ALREADY_EXISTS`। এই উত্তরে বিদ্যমান ইউজারের id **থাকে না**; id পেতে `POST users/lookup` দিয়ে খুঁজুন, তারপর `access` endpoint দিয়ে যোগ করুন; অজানা রোল 400 `ROLE_NOT_FOUND` (`roleKey`); email ও phone কোনোটাই না থাকলে 400 `EMAIL_OR_PHONE_REQUIRED`; ভুল ফোন 400 `PHONE_INVALID` (`phone`)।

### `POST users/:userId/access`: বিদ্যমান ইউজারকে এই ব্যবসায় যোগ

যেমন Akij-এর একজন হিসাবরক্ষককে BSRM-এও দেওয়া। আগে থেকে থাকলে রোল বদলায়।

Request: `{ "roleKey": "accountant" }` → Response 200: `{ "id": "<userId>", "role": "accountant" }`

### `PATCH users/:userId/role`: রোল বদল

Request: `{ "roleKey": "salesman" }` → Response 200: `{ "id": "<userId>", "role": "salesman" }`

### `DELETE users/:userId/access`: এই ব্যবসা থেকে সরানো

ইউজার মোছা হয় না, শুধু এই ব্যবসায় আর ঢুকতে পারেন না (সঙ্গে সঙ্গে)। Response: **204**।

### `PATCH users/:userId/status`: সক্রিয় বা নিষ্ক্রিয়

Request: `{ "isActive": false }` → Response: **204**। নিষ্ক্রিয় করলে ইউজার **সব ব্যবসা** থেকে সঙ্গে সঙ্গে লগআউট হন এবং লগইন করতে পারেন না। নিজেকে নিষ্ক্রিয় করা যায় না (400)।

### `POST users/:userId/reset-password`: নতুন পাসওয়ার্ড বসানো

Request: `{ "newPassword": "<new password>" }` → Response: **204**। ইউজারের সব সেশন শেষ হয়, আর লক থাকলে খুলে যায়। নতুন পাসওয়ার্ড ইউজারকে নিরাপদ পথে জানান।

### ইউজার-সংক্রান্ত সাধারণ ত্রুটি

- `:userId` UUID না হলে 400 `Validation failed (uuid is expected)`।
- ইউজার নেই, বা এই ব্যবসার সদস্য নন → 404 `User not found`।
- লক্ষ্য ইউজার platform owner হলে → 400 `Platform owner accounts cannot be changed here` (platform owner শুধু কমান্ড-লাইনে পরিচালিত)।

---

## ৯. মাস্টার ডেটা (dealership)

ক্যাটাগরি, পণ্য, গ্রাহক ও সরবরাহকারী। সব পথ `/api/v1/b/:businessSlug/...`; প্রতিটা ব্যবসার ডেটা সম্পূর্ণ আলাদা (একই নাম বা ফোন অন্য ব্যবসায় থাকতে পারে)। **কিছুই মোছা যায় না**, শুধু নিষ্ক্রিয় (`isActive: false`)।

### সাধারণ নিয়ম

- **তালিকার query:** `page` (১ থেকে), `search` (সর্বোচ্চ ১০০ অক্ষর), `active` = `true` (ডিফল্ট) | `false` | `all`। পণ্যে বাড়তি `categoryId`। ক্যাটাগরির তালিকা ছোট, তাই পাতা নেই।
- **অনুসন্ধান:** অংশ মিললেই হয়, বড়-ছোট হাতের অক্ষর ধরা হয় না। পণ্য: ইংরেজি নাম, বাংলা নাম, কোড। গ্রাহক: ইংরেজি নাম, বাংলা নাম, ফোন, কোড। ফোন `01712...` লিখলেও `+8801712...`-তে মেলে।
- **সাজানো:** ইংরেজি নাম অনুযায়ী (ক্যাটাগরি `sortOrder` অনুযায়ী; সরবরাহকারীতে প্রিন্সিপাল আগে)।
- **কোড:** স্বয়ংক্রিয়, বদলানো যায় না: পণ্য `P-0001`, গ্রাহক `C-00001`, সরবরাহকারী `S-001` (prefix ব্যবসার settings থেকে, যেমন অন্য ব্যবসায় `R-0001`)। একসাথে অনেক তৈরি হলেও কখনো ডুপ্লিকেট হয় না।
- **সংবেদনশীল সংশোধন:** তৈরির পরে শুরুর বাকি, ক্রেডিট সীমা বদলানো আর নিষ্ক্রিয়/সক্রিয় করা শুধু মালিক-স্তরের (platform owner ও `owner` রোল; অনুমতি `product.deactivate`, `customer.balance.edit`, `customer.deactivate`)। পণ্যে কোনো দাম হাতে বসানো বা বদলানো যায় না। এতে body-তে `reason` (৩-৫০০ অক্ষর) বাধ্যতামূলক, আর audit log-এ আগের ও পরের মান লেখা হয়। নাম, ঠিকানা, ফোন, ক্যাটাগরির বদল `product.manage` / `customer.manage` দিয়েই চলে। ম্যানেজার সংবেদনশীল বদলের জন্য "সংশোধনের অনুরোধ" পাঠান (অংশ ১২)।
- **PATCH:** শুধু যা বদলাবেন সেটা পাঠান। আগের মানের সমান মান পাঠালে সেটা বদল ধরা হয় না (অনুমতিও লাগে না)। কিছুই না বদলালে 400 `Nothing to change`।
- **লুকানো ফিল্ড:** শেষ কেনা-দাম ও তারিখ (`lastPurchasePrice`, `lastPurchasedAt`) `product.cost.view` ছাড়া, আর গ্রাহকের `openingBalance`, `currentBalance`, `creditLimit` `customer.due.view` ছাড়া response-এ থাকেই না। অনুমতি ছাড়া এগুলো পাঠালে 403।

### `GET product-units`

ব্যবসা কোন এককে বেচে (settings থেকে)। পণ্যের ফর্মের ড্রপডাউনের জন্য।

```json
{
  "defaultUnitKey": "bag",
  "items": [{ "key": "bag", "nameEn": "Bag", "nameBn": "বস্তা", "decimals": 0 }]
}
```

`decimals`: পরিমাণে কত দশমিক চলে (বস্তায় ০ = পূর্ণ সংখ্যা)।

### ক্যাটাগরি

`GET product-categories?active=true`:

```json
{
  "items": [
    {
      "id": "01a1e8a7-f6d0-7858-ba94-86452eb3eb44",
      "nameEn": "OPC",
      "nameBn": "ওপিসি",
      "sortOrder": 1,
      "isActive": true,
      "createdAt": "2026-11-17T08:38:04.236Z",
      "updatedAt": "2026-11-17T08:38:04.236Z"
    }
  ]
}
```

`POST product-categories` → 201, একই রূপের একটা ক্যাটাগরি:

```json
{ "nameEn": "Special", "nameBn": "বিশেষ", "sortOrder": 3 }
```

`PATCH product-categories/:id`: `nameEn`, `nameBn`, `sortOrder`; নিষ্ক্রিয় করতে `{ "isActive": false, "reason": "..." }`। একই নাম (বড়-ছোট হাতের অক্ষর নির্বিশেষে) থাকলে 409 `A category with this name already exists`।

### পণ্য

`GET products?search=opc%2050&page=1`, ম্যানেজারের উত্তর:

```json
{
  "items": [
    {
      "id": "01a1e8a7-f6d8-774d-b0c9-bedc6b889618",
      "code": "P-0001",
      "category": { "id": "01a1e8a7-f6d0-7858-ba94-86452eb3eb44", "nameEn": "OPC", "nameBn": "ওপিসি" },
      "nameEn": "Sample OPC 50kg",
      "nameBn": "নমুনা ওপিসি ৫০ কেজি",
      "unitKey": "bag",
      "lastPurchasePrice": null,
      "lastPurchasedAt": null,
      "isActive": true,
      "createdAt": "2026-11-17T08:38:04.236Z",
      "updatedAt": "2026-11-17T08:38:04.236Z"
    }
  ],
  "page": 1,
  "pageSize": 10,
  "total": 1
}
```

বিক্রয়কর্মীর উত্তর একই, শুধু `lastPurchasePrice` আর `lastPurchasedAt` ফিল্ড দুটো **নেই**। `GET products/:id` একটা পণ্য, একই রূপে।

**শেষ কেনা-দাম শুধু-পড়া।** `lastPurchasePrice` (টাকার স্ট্রিং) আর `lastPurchasedAt` (ISO সময়) হলো শেষ বৈধ কেনার দাম ও সময়। কেনা নিশ্চিত হলে একই transaction-এ বসে; কেনা বাতিল বা সংশোধন হলে শেষ বৈধ কেনা থেকে আবার হিসাব হয় (কেনা আসবে Step 5a-তে)। কোনো কেনা না হলে দুটোই `null`; দুটো সবসময় একসাথে থাকে বা একসাথে `null`। তৈরি বা সম্পাদনায় কেনা-দাম নেওয়া হয় না: `purchasePrice` পাঠালে 400 `PURCHASE_PRICE_NOT_ALLOWED`, `lastPurchasePrice` পাঠালে 400 `LAST_PURCHASE_PRICE_NOT_ALLOWED`। কেনার ভুল দাম ঠিক হবে কেনার রেকর্ডের সংশোধনে (`purchase.edit`, অংশ ১২-এর অনুরোধ)।

`POST products` (`unitKey` না দিলে ব্যবসার প্রধান একক):

```json
{
  "categoryId": "01a1e8a7-f6d0-7858-ba94-86452eb3eb44",
  "nameEn": "Sample OPC 40kg",
  "nameBn": "নমুনা ওপিসি ৪০ কেজি"
}
```

→ 201, তৈরি হওয়া পণ্য (`"code": "P-0005"`, `"lastPurchasePrice": null`)।

**পণ্যে বিক্রয়মূল্য নেই।** মালিক প্রতি গ্রাহকের কাছে আলাদা দামে বেচেন; দাম বসবে বিক্রির সময় ইনভয়েসে (Step 5)। `defaultSalePrice` পাঠালে 400 (অচেনা ফিল্ড), আর উত্তরেও এই ফিল্ড আসে না।

`PATCH products/:id`: `nameEn`, `nameBn`, `categoryId`, `unitKey` (`product.manage`); `isActive` (`product.deactivate` + `reason`)। উদাহরণ (মালিক):

```json
{ "isActive": false, "reason": "Akij stopped this product" }
```

ত্রুটি: একই নাম 409 `NAME_EN_DUPLICATE` (`nameEn`); অজানা বা নিষ্ক্রিয় ক্যাটাগরি 400 `CATEGORY_NOT_FOUND_OR_INACTIVE` (`categoryId`); settings-এ নেই এমন একক 400 `UNIT_UNKNOWN` (`unitKey`); কেনা-দাম পাঠালে 400 `PURCHASE_PRICE_NOT_ALLOWED` / `LAST_PURCHASE_PRICE_NOT_ALLOWED`; কারণ ছাড়া দাম বা অবস্থা বদলে 400 `REASON_REQUIRED` (`reason`)।

### গ্রাহক

`GET customers?search=sample%20store%20two`, ম্যানেজার বা হিসাবরক্ষকের উত্তর:

```json
{
  "items": [
    {
      "id": "01a1e8a7-f6e4-7bd2-b880-de1971ef4cf0",
      "code": "C-00002",
      "nameEn": "Sample Store Two",
      "nameBn": "নমুনা স্টোর দুই",
      "phone": "+8801000000002",
      "address": null,
      "area": "Sample Area",
      "openingBalance": "12500.00",
      "currentBalance": "12500.00",
      "creditLimit": null,
      "pendingDeliveryQuantity": "0",
      "deliveredAmount": "0.00",
      "collectedAmount": "0.00",
      "isActive": true,
      "createdAt": "2026-11-17T08:38:04.236Z",
      "updatedAt": "2026-11-17T08:38:04.236Z"
    }
  ],
  "page": 1,
  "pageSize": 10,
  "total": 1
}
```

- বিক্রয়কর্মীর উত্তরে `openingBalance`, `currentBalance`, `creditLimit`, `deliveredAmount`, `collectedAmount` **নেই**; `pendingDeliveryQuantity` (ডেলিভারি বাকি বস্তা) সবাই দেখেন (অংশ ১১)।
- বাকি: ধনাত্মক = গ্রাহক আমাদের কাছে দেনা; **ঋণাত্মক = অগ্রিম** (আমরা তার কাছে দেনা)।
- `currentBalance` সার্ভার নিজে হালনাগাদ রাখে (ডেলিভারি ও আদায়ে, অংশ ১১); সবসময় `openingBalance + deliveredAmount − collectedAmount`। frontend কখনো হিসাব করবে না।
- `creditLimit: null` মানে কোনো সীমা নেই।

`POST customers` (ফোন বাধ্যতামূলক, ব্যবসায় unique; বিক্রয়কর্মী শুধু নাম-ফোন-ঠিকানা দিয়ে যোগ করতে পারেন):

```json
{ "nameEn": "Karim Store", "nameBn": "করিম স্টোর", "phone": "01000000099", "area": "Sample Bazar" }
```

→ 201 (`"code": "C-00006"`, `"phone": "+8801000000099"`)। বাকি ও সীমাসহ (`customer.due.view` লাগে):

```json
{ "nameEn": "Due Shop", "phone": "01700000000", "openingBalance": "12500.50", "creditLimit": "50000" }
```

`PATCH customers/:id`: `nameEn`, `nameBn`, `phone`, `address`, `area` (`customer.manage`; `null` বা `""` দিলে খালি); `openingBalance`, `creditLimit` (`customer.balance.edit` + `reason`; `creditLimit: null` = সীমা তুলে দেওয়া); `isActive` (`customer.deactivate` + `reason`)। শুরুর বাকি বদলালে বর্তমান বাকিও একই পরিমাণ সরে। উদাহরণ (মালিক):

```json
{ "openingBalance": "13000", "creditLimit": "50000", "reason": "opening balance was mistyped" }
```

ত্রুটি: একই ফোন 409 `PHONE_DUPLICATE` (`phone`); ভুল ফোন 400 `PHONE_INVALID` (`phone`); বিক্রয়কর্মী বাকি পাঠালে 403 `ACCESS_DENIED`।

### সরবরাহকারী (শুধু দেখা)

প্রিন্সিপাল সরবরাহকারী (যেমন Akij Cement) ব্যবসার settings থেকে আসে; যোগ বা বদলের API এখন নেই।

`GET suppliers`:

```json
{
  "items": [
    {
      "id": "01a1e8a7-f5e1-74da-acca-262544b16a00",
      "code": "S-001",
      "nameEn": "Akij Cement",
      "nameBn": "আকিজ সিমেন্ট",
      "phone": null,
      "address": null,
      "isPrincipal": true,
      "isActive": true
    }
  ],
  "page": 1,
  "pageSize": 10,
  "total": 1
}
```

`GET suppliers/:id` একটা সরবরাহকারী, একই রূপে।

---

## ১০. কেনা ও স্টক

Akij থেকে নগদে কেনা, স্টক আর মাসিক কেনার কাউন্টার। সব পথ `/api/v1/b/:businessSlug/...`-এর নিচে।

### সাধারণ নিয়ম

- **তারিখ** `YYYY-MM-DD`, ব্যবসার নিজের সময়-অঞ্চলে (ডিফল্ট Asia/Dhaka): রাত ১২টার পরে Dhaka-তে নতুন দিন, সার্ভারের ঘড়ি যা-ই বলুক।
- **পরিমাণ** স্ট্রিং, দশমিকের শূন্য বাদ দিয়ে: `"500"`, `"12.5"`। বস্তা পূর্ণসংখ্যা। কত দশমিক চলে তা পণ্যের একক ঠিক করে (`GET product-units`-এর `decimals`)।
- **টাকা** স্ট্রিং, দুই দশমিকে (`"570.00"`)। লাইন-মোট = বস্তা × দাম, দুই দশমিকে **half up** রাউন্ড (যেমন `0.005` → `0.01`)। ডাটাবেসের CHECK-ও একই নিয়মে মেলায়।
- **কেনা-দাম** (লাইনের `unitPrice`, `lineTotal`, কেনার `totalAmount`, স্টকে `lastPurchasePrice` ও `lastPurchasedAt`) শুধু `product.cost.view` থাকলে উত্তরে আসে; না থাকলে ফিল্ডগুলো থাকেই না। বস্তার সংখ্যা সবাই দেখেন।
- **স্টক কখনো শূন্যের নিচে নামে না।** নামাতে চাইলে 409 `STOCK_INSUFFICIENT`, সাথে `details: { productId, available, required }`।
- কিছুই মোছা যায় না: কেনা **বাতিল** (void) হয়। স্টকের প্রতিটা বদল শুধু-যোগ-হয় খাতায় (`movements`) থাকে।

### `POST purchases`: কেনা তৈরি

অনুমতি: `purchase.create` + `product.cost.view` (দাম লিখতে দাম দেখার অনুমতি লাগে)। ঐচ্ছিক header `Idempotency-Key` (অংশ ১২-এর মতো): একই ইউজার একই key আবার পাঠালে নতুন কেনা হয় না, আগেরটা 200-এ ফেরত আসে।

```json
{
  "supplierReference": "AK-CHALLAN-5521",
  "note": "Truck 12",
  "items": [
    { "productId": "01a1efa4-085a-7532-a66e-540998a1c2b1", "quantity": "500", "unitPrice": "570" },
    { "productId": "01a1efa4-0861-7465-81f3-11c47699ba70", "quantity": "200", "unitPrice": "545.50" }
  ]
}
```

| ঘর | নিয়ম |
|---|---|
| `items` | ১–৫০টা লাইন; একটা পণ্য একবারই; পণ্য সক্রিয় ও এই ব্যবসার |
| `items[].quantity` | শূন্যের বেশি, এককের দশমিক নিয়মে |
| `items[].unitPrice` | টাকা, `0` বা বেশি |
| `purchaseDate` | ঐচ্ছিক, না দিলে আজ। ভবিষ্যৎ নয়। `purchase.edit` না থাকলে শুধু শেষ ৭ দিন (ব্যবসার Settings: `backdateLimitDays`) |
| `supplierId` | ঐচ্ছিক, না দিলে প্রিন্সিপাল সরবরাহকারী (Akij); সক্রিয় হতে হবে |
| `note` (৫০০), `supplierReference` (৬৪) | ঐচ্ছিক |

উত্তর 201 (`GET purchases/:id`-এর রূপ):

```json
{
  "id": "01a1efa4-1f90-77eb-ae86-9f04b328a9f9",
  "code": "PUR-0001",
  "purchaseDate": "2026-11-18",
  "supplier": { "id": "01a1efa4-078e-7f2f-93ce-db6c0c7f3452", "code": "S-001", "nameEn": "Akij Cement", "nameBn": "আকিজ সিমেন্ট" },
  "paymentMethod": "cash",
  "itemCount": 2,
  "totalQuantity": "700",
  "totalAmount": "394100.00",
  "status": "active",
  "supplierReference": "AK-CHALLAN-5521",
  "createdBy": { "id": "01a1efa4-1e61-737e-a3b3-3e0915c6513c", "name": "Rahim Uddin" },
  "createdAt": "2026-11-18T17:11:13.040Z",
  "note": "Truck 12",
  "version": 1,
  "items": [
    {
      "id": "01a1efa4-1f93-701a-a8a7-68d4788e6b16",
      "product": { "id": "01a1efa4-085a-7532-a66e-540998a1c2b1", "code": "P-0001", "nameEn": "Sample OPC 50kg", "nameBn": "নমুনা ওপিসি ৫০ কেজি", "unitKey": "bag" },
      "quantity": "500",
      "unitPrice": "570.00",
      "lineTotal": "285000.00"
    },
    {
      "id": "01a1efa4-1f93-701a-a8a7-6e5dc92aaa59",
      "product": { "id": "01a1efa4-0861-7465-81f3-11c47699ba70", "code": "P-0003", "nameEn": "Sample PCC 50kg", "nameBn": "নমুনা পিসিসি ৫০ কেজি", "unitKey": "bag" },
      "quantity": "200",
      "unitPrice": "545.50",
      "lineTotal": "109100.00"
    }
  ],
  "voidedAt": null,
  "voidReason": null,
  "voidedBy": null,
  "updatedAt": "2026-11-18T17:11:13.040Z"
}
```

সেভ হয় এক transaction-এ। তার মধ্যে:
- নম্বর (`PUR-0001`, ব্যবসা ধরে) নেওয়া হয়।
- কেনা আর তার লাইন লেখা হয়।
- প্রতিটা পণ্যের স্টক বাড়ে, খাতায় movement যোগ হয়।
- পণ্যের শেষ কেনা-দাম বসে, যদি এটাই নতুনতম তারিখের কেনা হয়।
- কেনার **মাসের** কাউন্টারে বস্তা যোগ হয়।

এখনকার সংস্করণে কেনা সবসময় নগদ (`paymentMethod: "cash"`) ও পুরো পরিশোধিত।

### `GET purchases?from=&to=&supplierId=&productId=&status=&page=`

অনুমতি: `purchase.view`। ১০টা করে, কেনার তারিখ অনুযায়ী নতুন আগে।
- `from`/`to` কেনার তারিখ, দুটোই অন্তর্ভুক্ত।
- `productId` দিলে শুধু সেই পণ্যের লাইন আছে এমন কেনা আসে।
- `status` হয় `active` বা `void`।

তালিকার প্রতিটা সারিতে লাইন থাকে না (`items` নেই), শুধু `itemCount`।

```json
{
  "items": [
    {
      "id": "01a1efa4-1f90-77eb-ae86-9f04b328a9f9",
      "code": "PUR-0001",
      "purchaseDate": "2026-11-18",
      "supplier": { "id": "01a1efa4-078e-7f2f-93ce-db6c0c7f3452", "code": "S-001", "nameEn": "Akij Cement", "nameBn": "আকিজ সিমেন্ট" },
      "paymentMethod": "cash",
      "itemCount": 2,
      "totalQuantity": "700",
      "totalAmount": "394100.00",
      "status": "active",
      "supplierReference": "AK-CHALLAN-5521",
      "createdBy": { "id": "01a1efa4-1e61-737e-a3b3-3e0915c6513c", "name": "Rahim Uddin" },
      "createdAt": "2026-11-18T17:11:13.040Z"
    }
  ],
  "page": 1,
  "pageSize": 10,
  "total": 1
}
```

### `GET purchases/summary?from=&to=`

অনুমতি: `purchase.view`। সক্রিয় (`active`) কেনার উপর একটা সরল যোগফল — কোনো `groupBy` বা পাতাভাগ নেই, `reports/*`-এর বদলে এখানে রাখা হয়েছে কারণ `reports/*`-এর কোনো endpoint-এ কেনা-দাম থাকে না (অংশ ৯-এর রিপোর্ট প্রসঙ্গ দেখো), কিন্তু এখানে `totalAmount` আসলে কেনা-দামের যোগফল। `from`/`to` না দিলে চলতি মাস (অন্য ranged endpoint-এর মতোই); রেঞ্জের প্রস্থে কোনো সীমা নেই। `totalAmount` শুধু `product.cost.view` থাকলে; না থাকলে ঘরটাই উত্তরে নেই।

```json
{
  "from": "2026-11-01",
  "to": "2026-11-22",
  "count": 14,
  "totalQuantity": "9800",
  "totalAmount": "5523400.00"
}
```

### `GET purchases/:id`

অনুমতি: `purchase.view`। উত্তর উপরের 201-এর রূপ। অন্য ব্যবসার বা না-থাকা id হলে 404 `PURCHASE_NOT_FOUND`।

### কেনা বাতিল ও সংশোধন

**ম্যানেজার** সংশোধন বা বাতিলের অনুরোধ পাঠান (অংশ ১২, `entityType: "purchase"`)। মালিক-স্তর সেটা অনুমোদন করেন, অথবা নিজে সরাসরি করেন। দুই পথেই একই নিয়ম, এক transaction-এ।

**বাতিল:**
- সরাসরি করার পথ: `POST purchases/:id/void`, body `{ "reason": "Entered twice" }` (৩–৫০০ অক্ষর)। অনুমতি `purchase.void`। উত্তর 200, কেনা `"status": "void"` অবস্থায়।
- স্টক উল্টো এন্ট্রিতে কমে, তারিখ **বাতিলের দিন** (মূল এন্ট্রি অপরিবর্তিত)।
- কাউন্টার থেকে বস্তা বাদ যায় **কেনার মাসে**।
- শেষ কেনা-দাম আবার হিসাব হয় শেষ বৈধ কেনা থেকে, না থাকলে `null`।
- এর মধ্যে মাল বেরিয়ে গিয়ে স্টক কম থাকলে বাতিল **আটকায়**: 409 `STOCK_INSUFFICIENT`। আগে থেকেই বাতিল হলে 409 `PURCHASE_ALREADY_VOID`।

**সংশোধন:** সরাসরি করার পথ `PATCH purchases/:id`:

```json
{
  "purchaseDate": "2026-11-17",
  "items": [{ "id": "01a1efa4-1f93-701a-a8a7-68d4788e6b16", "quantity": "490", "unitPrice": "565" }],
  "note": "Truck 12",
  "reason": "Akij challan says 490 bags"
}
```

| বদল | অনুমতি | কারণ |
|---|---|---|
| `note`, `supplierReference` | `purchase.create` | লাগে না |
| `purchaseDate`, লাইনের `quantity`, `unitPrice` | `purchase.edit` (দামে + `product.cost.view`) | বাধ্যতামূলক |

- লাইন যোগ, বাদ বা পণ্য বদল হয় না। তার জন্য বাতিল করে নতুন কেনা।
- স্টক শুধু পার্থক্যটুকু বদলায়, movement `purchase_edit` হিসেবে, **সংশোধনের দিনের** তারিখে। কমাতে গিয়ে স্টক না থাকলে 409 `STOCK_INSUFFICIENT` (`field`: `items.<id>.quantity`)।
- মোট, লাইন-মোট আর শেষ কেনা-দাম আবার হিসাব হয়।
- তারিখের মাস বদলালে বস্তা পুরনো মাসের কাউন্টার থেকে নতুন মাসে যায়।

**অনুরোধে ঘরের নাম:** `purchaseDate`, `note`, `supplierReference`, আর লাইনের জন্য `items.<itemId>.quantity` / `items.<itemId>.unitPrice` (`itemId` = লাইনের `id`)। যেমন:

```json
{
  "entityType": "purchase",
  "entityId": "01a1efa4-1f90-77eb-ae86-9f04b328a9f9",
  "kind": "edit",
  "reason": "Akij challan says 490 bags",
  "proposedChange": { "items.01a1efa4-1f93-701a-a8a7-68d4788e6b16.quantity": "490" }
}
```

প্রভাবের পূর্বরূপ (`impact`), মালিকের চোখে:

```json
[
  { "key": "stock.01a1efa4-085a-7532-a66e-540998a1c2b1", "label": "Stock P-0001", "before": "497", "after": "487", "delta": "-10", "unit": "bag" },
  { "key": "purchase.totalAmount", "label": "Purchase total", "before": "394100.00", "after": "388400.00", "delta": "-5700.00" },
  { "key": "purchaseCounter.2026-11", "label": "Bags bought in 2026-11", "delta": "-10" }
]
```

লাইনের `key`:
- `stock.<productId>`
- `purchase.totalAmount` (`product.cost.view`)
- `lastPurchasePrice.<productId>` (`product.cost.view`)
- `purchaseCounter.<YYYY-MM>`: শুধু `commission.view`, অর্থাৎ platform owner। ম্যানেজারের উত্তরে এই লাইন **থাকে না**।

### `GET stock?search=&categoryId=&active=&page=`

অনুমতি: `stock.view`। পণ্য ধরে বর্তমান স্টক, ১০টা করে, নাম অনুযায়ী। অনুসন্ধান নাম (ইংরেজি/বাংলা) ও কোডে।

```json
{
  "items": [
    {
      "id": "01a1efa4-085a-7532-a66e-540998a1c2b1",
      "code": "P-0001",
      "nameEn": "Sample OPC 50kg",
      "nameBn": "নমুনা ওপিসি ৫০ কেজি",
      "unitKey": "bag",
      "category": { "id": "01a1efa4-0853-714b-b709-2a3817325e1b", "nameEn": "OPC", "nameBn": "ওপিসি" },
      "currentStock": "500",
      "isActive": true,
      "lastPurchasePrice": "570.00",
      "lastPurchasedAt": "2026-11-17T18:00:00.000Z"
    }
  ],
  "page": 1,
  "pageSize": 10,
  "total": 1
}
```

বিক্রয়কর্মীর উত্তর একই, শুধু `lastPurchasePrice` ও `lastPurchasedAt` থাকে না। `lastPurchasedAt` হলো কেনার তারিখের শুরু, Asia/Dhaka-তে (উপরে ১৮ নভেম্বরের কেনা, তাই `2026-11-17T18:00:00.000Z`)।

### `GET stock/:productId/movements?from=&to=&kind=&page=`

অনুমতি: `stock.view`। একটা পণ্যের স্টক-ইতিহাস, নতুন আগে, ১০টা করে। সাথে পণ্যের বর্তমান অবস্থা (`product`)।
- `kind` হয় `purchase`, `purchase_edit`, `purchase_void` বা `adjustment`। Step 5b-তে যোগ হবে `delivery`, `delivery_void`।
- `from`/`to` হলো `movementDate`।

```json
{
  "product": { "id": "01a1efa4-085a-7532-a66e-540998a1c2b1", "code": "P-0001", "nameEn": "Sample OPC 50kg", "nameBn": "নমুনা ওপিসি ৫০ কেজি", "unitKey": "bag", "category": { "id": "01a1efa4-0853-714b-b709-2a3817325e1b", "nameEn": "OPC", "nameBn": "ওপিসি" }, "currentStock": "497", "isActive": true },
  "items": [
    {
      "id": "01a1efa4-2092-72b2-858e-72fd735a49a6",
      "kind": "adjustment",
      "quantity": "-3",
      "balanceAfter": "497",
      "movementDate": "2026-11-18",
      "source": { "type": "adjustment", "id": null, "code": null },
      "reason": "Three bags torn while unloading",
      "createdBy": { "id": "01a1efa4-1e61-737e-a3b3-3e0915c6513c", "name": "Rahim Uddin" },
      "createdAt": "2026-11-18T17:11:13.298Z"
    },
    {
      "id": "01a1efa4-1f9a-74a2-9b0b-079020266c28",
      "kind": "purchase",
      "quantity": "500",
      "balanceAfter": "500",
      "movementDate": "2026-11-18",
      "source": { "type": "purchase", "id": "01a1efa4-1f90-77eb-ae86-9f04b328a9f9", "code": "PUR-0001" },
      "reason": null,
      "createdBy": { "id": "01a1efa4-1e61-737e-a3b3-3e0915c6513c", "name": "Rahim Uddin" },
      "createdAt": "2026-11-18T17:11:13.050Z"
    }
  ],
  "page": 1,
  "pageSize": 10,
  "total": 2
}
```

- `quantity` চিহ্নসহ।
- `balanceAfter` হলো এই movement-এর পরের স্টক।
- `movementDate` হলো যে ব্যবসার দিনে গোনা হয়: কেনায় কেনার তারিখ, বাতিল, সংশোধন বা সমন্বয়ে সেই দিন।

### `POST stock/adjustments`: স্টক সমন্বয়

অনুমতি: `stock.adjust`। ছেঁড়া বা পাওয়া বস্তার জন্য।

```json
{ "productId": "01a1efa4-085a-7532-a66e-540998a1c2b1", "quantity": "-3", "reason": "Three bags torn while unloading" }
```

- `quantity` চিহ্নসহ, শূন্য নয়।
- `reason` বাধ্যতামূলক, ৩–৫০০ অক্ষর।
- উত্তর 201, পণ্যের স্টকের সারি (`GET stock`-এর একটা item)।
- audit-এ আগে আর পরের সংখ্যা লেখা হয়।

**সীমা:**
- `stock.adjust.large` নেই এমন ইউজার **একটা পণ্যে একদিনে** (Dhaka) মোট সর্বোচ্চ ১০ বস্তা সমন্বয় করতে পারেন (ব্যবসার Settings: `stockAdjustmentLimit`)। হিসাব হয় সব সমন্বয়ের পরম মান যোগ করে, তাই ভাগ ভাগ করে সীমা এড়ানো যায় না।
- সীমা পার হলে 403 `ADJUSTMENT_APPROVAL_REQUIRED`:

```json
{
  "statusCode": 403,
  "error": "Forbidden",
  "message": "This adjustment is above your daily limit; send a change request instead",
  "code": "ADJUSTMENT_APPROVAL_REQUIRED",
  "field": "quantity",
  "errors": [{ "field": "quantity", "code": "ADJUSTMENT_APPROVAL_REQUIRED", "message": "This adjustment is above your daily limit; send a change request instead" }],
  "details": { "limit": "10", "usedToday": "3" }
}
```

তখন অনুরোধ পাঠান (অংশ ১২):

```json
{
  "entityType": "product_stock",
  "entityId": "<productId>",
  "kind": "edit",
  "reason": "Thirty bags spoiled by water in the store",
  "proposedChange": { "adjustBy": "-30" }
}
```

- `adjustBy` একটা চিহ্নসহ **পরিমাণ**, লক্ষ্য-সংখ্যা নয়। তাই এর মধ্যে কেনা হলেও অনুরোধ stale হয় না।
- অনুমোদন দিতে লাগে `stock.adjust.large` (মালিক-স্তর)।

### `GET purchase-counters?year=`

অনুমতি: `commission.view` (**owner-only**: শুধু platform owner)। কেনার তারিখের মাস ধরে মোট কেনা বস্তা (সব পণ্য মিলিয়ে), বাতিল বাদে। সবসময় ১২টা মাস আসে:

```json
{
  "year": 2026,
  "months": [
    { "month": "2026-01", "quantity": "0" },
    { "month": "2026-11", "quantity": "700" },
    { "month": "2026-12", "quantity": "0" }
  ]
}
```

(সংক্ষিপ্ত; আসলে জানুয়ারি থেকে ডিসেম্বর সব মাস।)

### ত্রুটি

| Status | `code` (`field`) | কখন |
|---|---|---|
| 400 | `VALIDATION_FAILED` (`errors[]`, যেমন `items.0.quantity`) | body-র কাঠামো ভুল |
| 400 | `PRODUCT_DUPLICATE` (`items.<n>.productId`) | এক কেনায় একই পণ্য দুবার |
| 400 | `PRODUCT_NOT_FOUND_OR_INACTIVE` (`items.<n>.productId`) | পণ্য নেই, নিষ্ক্রিয় বা অন্য ব্যবসার |
| 400 | `QUANTITY_INVALID` (`items.<n>.quantity` / `quantity`) | শূন্য বা এককের দশমিক নিয়ম ভাঙে |
| 400 | `SUPPLIER_NOT_FOUND_OR_INACTIVE` (`supplierId`) | সরবরাহকারী নেই বা নিষ্ক্রিয় |
| 400 | `PURCHASE_DATE_INVALID` / `PURCHASE_DATE_IN_FUTURE` / `PURCHASE_DATE_TOO_OLD` (`purchaseDate`) | আসল তারিখ নয় / ভবিষ্যৎ / অনুমতির বাইরে পুরনো |
| 400 | `REASON_REQUIRED` (`reason`) | বস্তা, দাম বা তারিখ সংশোধনে কারণ নেই |
| 403 | `ACCESS_DENIED` | অনুমতি নেই |
| 403 | `ADJUSTMENT_APPROVAL_REQUIRED` (`quantity`) | দৈনিক সমন্বয়-সীমা পার |
| 404 | `PURCHASE_NOT_FOUND`, `PRODUCT_NOT_FOUND` | নেই বা অন্য ব্যবসার |
| 409 | `STOCK_INSUFFICIENT` | স্টক শূন্যের নিচে নামত (`details`-এ উপলব্ধ) |
| 409 | `PURCHASE_ALREADY_VOID` | বাতিল কেনায় বাতিল বা সংশোধন |

### কমিশন: পাওয়া টাকা ও কারণ (Akij)

সব endpoint owner-only (`commission.view`/`commission.manage`): শুধু platform owner, ব্যবসা-স্তরের `owner` রোলও না। এখন শুধু Akij Cement-এর জন্য; BSRM-এর কমিশন আলাদা module-এ ভবিষ্যতে।

কমিশনের কোনো scheme, target বা হিসাব নেই। মালিক শুধু লেখেন **কত টাকা পেলেন**, **কবে**, আর **কী কারণে** (মুক্ত লেখা)। প্রতিটা entry একই transaction-এ খাতায় (`ledger`) একটা `in` / `commission_receipt` সারি (method ছাড়া) বসায়; নিট মুনাফা (`finance-summary`) এই পাওয়া টাকাই যোগ করে। Delete নেই।

**`GET commission-entries?page=`** — `commission.view`। `receivedDate` নতুন আগে, পাতায় ১০টা:
```json
{
  "items": [
    { "id": "...", "amount": "25000.00", "receivedDate": "2026-11-25", "note": "নভেম্বরের টার্গেট বোনাস", "createdAt": "2026-11-25T10:00:00Z" }
  ],
  "page": 1, "pageSize": 10, "total": 5
}
```
`note` পুরনো রেকর্ডে `null` হতে পারে; নতুনে সবসময় থাকে।

**`POST commission-entries`** — `commission.manage`:
```json
{ "amount": "25000.00", "receivedDate": "2026-11-25", "note": "নভেম্বরের টার্গেট বোনাস" }
```
`amount` > ০ (স্ট্রিং), `receivedDate` ভবিষ্যতে নয়, `note` বাধ্যতামূলক (ফাঁকা নয়, সর্বোচ্চ ৫০০ অক্ষর)। সাড়া 201: তৈরি entry (তালিকার একটা item-এর মতো)।

**`GET commission-entries/:id`** — `commission.view`। একটা entry।

**`PATCH commission-entries/:id`** — `commission.manage`। আংশিক: `amount`, `receivedDate`, `note` যেকোনো। খাতার সারিও একই সঙ্গে ঠিক হয়, তাই নিট মুনাফা মেলে। সাড়া: হালনাগাদ entry।

**`GET commission-summary?year=`** — `commission.view`:
```json
{ "year": 2026, "totalReceived": "210000.00", "entryCount": 8 }
```
`receivedDate`-এর বছর ধরে।

### ত্রুটি (কমিশন)

| Status | `code` (`field`) | কখন |
|---|---|---|
| 400 | `VALIDATION_FAILED` (`errors[]`) | body-র কাঠামো ভুল, `note` ফাঁকা বা ৫০০ অক্ষরের বেশি |
| 400 | `AMOUNT_TOO_SMALL` (`amount`) | `amount` শূন্য বা তার নিচে |
| 400 | `COMMISSION_DATE_INVALID` (`receivedDate`) | আসল তারিখ নয় |
| 400 | `COMMISSION_DATE_IN_FUTURE` (`receivedDate`) | ভবিষ্যতের তারিখ |
| 403 | `ACCESS_DENIED` | owner-only অনুমতি নেই |
| 404 | `COMMISSION_ENTRY_NOT_FOUND` | নেই বা অন্য ব্যবসার |

> বাতিল (২০২৬-১১-২৭): `commission-scheme`, `commission-entries/suggestion`, entry-র নিচের `receipts` endpoint, এবং `calculatedAmount`/`pendingAmount`/`quantity`/`fromDate`/`toDate`। ত্রুটি-code `COMMISSION_SCHEME_NOT_SET`, `RATE_BASE_TOO_SMALL`, `TARGET_QTY_TOO_SMALL`, `COMMISSION_DATE_RANGE_INVALID`, `COMMISSION_RECEIPT_NOT_FOUND` আর আসে না।

---

## ১১. অর্ডার, ডেলিভারি ও আদায়

গ্রাহকের অর্ডার, তার আংশিক বা পুরো ডেলিভারি, আর টাকা আদায়। সব পথ `/api/v1/b/:businessSlug/...`-এর নিচে।

### প্রবাহ

1. **অর্ডার:** দাম বসে অর্ডারেই। অর্ডারে **স্টক বা টাকা বদলায় না**। শুধু গ্রাহকের "ডেলিভারি বাকি" বস্তা (`pendingDeliveryQuantity`) বাড়ে।
2. **ডেলিভারি:** একটা অর্ডারের আংশিক বা পুরো। একই transaction-এ:
   - স্টক কমে।
   - অর্ডারের ডেলিভারি-হওয়া বস্তা বাড়ে।
   - গ্রাহকের পাওনা বাড়ে (বস্তা × অর্ডারের দাম)।
   - গ্রাহকের খাতায় লাইন যোগ হয়।
3. **আদায়:** গ্রাহকের ব্যালেন্সে সরাসরি যায়।
   - অর্ডারের রেফারেন্স (`orderId`) ঐচ্ছিক, শুধু "কোন অর্ডারের জন্য অগ্রিম" জানাতে। **অর্ডারে বরাদ্দ হয় না।**
   - পাওনার বেশি আদায় চলে: ব্যালেন্স ঋণাত্মক হয়, অর্থাৎ অগ্রিম।

**গ্রাহকের সারাংশ** (অংশ ৯-এর গ্রাহকের উত্তরে নতুন ঘর):

| ঘর | মানে | দেখতে লাগে |
|---|---|---|
| `pendingDeliveryQuantity` | সক্রিয় অর্ডারে এখনো ডেলিভারি বাকি বস্তা | সবাই (`customer.view`) |
| `deliveredAmount` | সক্রিয় ডেলিভারির মোট মূল্য | `customer.due.view` |
| `collectedAmount` | সক্রিয় আদায়ের মোট | `customer.due.view` |

সবসময় `currentBalance = openingBalance + deliveredAmount − collectedAmount`। ঋণাত্মক মানে অগ্রিম।

**বাতিল ও সংশোধন:** অর্ডার, ডেলিভারি আর আদায় তিনটাই বাতিল বা সংশোধন হয় মালিক-স্তরে, সরাসরি (`PATCH` / `.../void`) অথবা ম্যানেজারের অনুরোধে (অংশ ১২)। উল্টো এন্ট্রি (স্টক ও খাতা) বসে বাতিল বা সংশোধনের **দিনের তারিখে**; মূল এন্ট্রি অপরিবর্তিত থাকে। সরাসরি `PATCH` আর বাতিলে `reason` (৩–৫০০ অক্ষর) বাধ্যতামূলক।

**তারিখ** (`orderDate`, `deliveryDate`, `collectionDate`):
- না দিলে আজ (ব্যবসার সময়-অঞ্চলে)।
- ভবিষ্যৎ নয়।
- সংশোধনের অনুমতি (`sale.edit` / `delivery.edit` / `collection.edit`) না থাকলে শুধু শেষ ৭ দিন।
- ডেলিভারি অর্ডারের তারিখের আগে হতে পারে না।

সব তৈরিতে ঐচ্ছিক `Idempotency-Key` header (অংশ ১২-এর মতো): একই key আবার এলে আগেরটাই 200-এ ফেরত আসে।

### `POST orders`: অর্ডার তৈরি

অনুমতি: `sale.create` (ম্যানেজার, বিক্রয়কর্মী)।

```json
{
  "customerId": "01a1f347-c33b-7546-b92d-f977780d6726",
  "deliveryWindow": "two_days",
  "deliverBy": "2026-11-21",
  "note": "Deliver to the back gate",
  "items": [{ "productId": "01a1f347-c333-775c-b5f9-0803c3d1f1d8", "quantity": "100", "unitPrice": "565" }]
}
```

| ঘর | নিয়ম |
|---|---|
| `customerId` | সক্রিয় গ্রাহক |
| `deliveryWindow` | `today`, `two_days` বা `one_week` |
| `deliverBy` | ঐচ্ছিক নির্দিষ্ট তারিখ, অর্ডারের তারিখের দিন বা পরে |
| `items` | ১–৫০ লাইন; একটা পণ্য একবারই; বস্তা এককের নিয়মে; দাম টাকা |

উত্তর 201 (`GET orders/:id`-এর রূপ):

```json
{
  "id": "01a1f347-cb0f-70c4-8cca-67ced2e7839b",
  "code": "ORD-0001",
  "customer": { "id": "01a1f347-c33b-7546-b92d-f977780d6726", "code": "C-00002", "nameEn": "Sample Store Two", "nameBn": "নমুনা স্টোর দুই" },
  "orderDate": "2026-11-19",
  "deliveryWindow": "two_days",
  "deliverBy": "2026-11-21",
  "totalQuantity": "100",
  "deliveredQuantity": "0",
  "remainingQuantity": "100",
  "totalAmount": "56500.00",
  "status": "active",
  "deliveryStatus": "pending",
  "createdBy": { "id": "01a1f347-c9a5-7078-a656-d3136dadcaad", "name": "Karim Mia" },
  "createdAt": "2026-11-19T10:08:50.959Z",
  "note": "Deliver to the back gate",
  "version": 1,
  "items": [
    {
      "id": "01a1f347-cb12-73d3-a3c4-2404751d778d",
      "product": { "id": "01a1f347-c333-775c-b5f9-0803c3d1f1d8", "code": "P-0001", "nameEn": "Sample OPC 50kg", "nameBn": "নমুনা ওপিসি ৫০ কেজি", "unitKey": "bag" },
      "quantity": "100",
      "deliveredQuantity": "0",
      "remainingQuantity": "100",
      "unitPrice": "565.00",
      "lineTotal": "56500.00"
    }
  ],
  "deliveries": [],
  "voidedAt": null,
  "voidReason": null,
  "voidedBy": null,
  "updatedAt": "2026-11-19T10:08:50.959Z"
}
```

- `status` হয় `active` বা `void`।
- `deliveryStatus` হয় `pending` (কিছুই যায়নি), `partial` বা `delivered`।
- `deliveries` হলো এই অর্ডারের ডেলিভারির সারাংশ (`id`, `code`, `deliveryDate`, `totalQuantity`, `totalAmount`, `status`)। বিক্রয়কর্মী নিজের অর্ডারের ডেলিভারি এখান থেকেই দেখেন।

### `GET orders?status=&customerId=&from=&to=&page=` ও `GET orders/:id`

- `sale.view.all` (ম্যানেজার) সব অর্ডার দেখেন; `sale.view.own` (বিক্রয়কর্মী) শুধু নিজের তৈরি অর্ডার। অন্যের অর্ডার বা অন্য ব্যবসার id হলে 404 `ORDER_NOT_FOUND`।
- `status` হয় `open` (pending বা partial), `pending`, `partial`, `delivered` বা `void`।
- ১০টা করে, অর্ডারের তারিখ অনুযায়ী নতুন আগে।
- তালিকায় `items`, `deliveries`, `note` থাকে না।

### `POST deliveries`: ডেলিভারি

অনুমতি: `delivery.create` (ম্যানেজার)।

```json
{
  "orderId": "01a1f347-cb0f-70c4-8cca-67ced2e7839b",
  "transportReference": "Truck DHA-11-2233",
  "items": [{ "orderItemId": "01a1f347-cb12-73d3-a3c4-2404751d778d", "quantity": "40" }]
}
```

- `orderItemId` = অর্ডারের লাইনের `id`। একটা ডেলিভারি একটাই অর্ডারের।
- `transportReference` ঐচ্ছিক (৬৪ অক্ষর): পরিবহনের ট্রিপ বা ট্রাকের নম্বর। ভাড়া গ্রাহকের কাছ থেকে নেওয়া হয় না।

উত্তর 201:

```json
{
  "id": "01a1f347-cb7f-764a-9ddb-43f5102e159f",
  "code": "DEL-0001",
  "order": { "id": "01a1f347-cb0f-70c4-8cca-67ced2e7839b", "code": "ORD-0001" },
  "customer": { "id": "01a1f347-c33b-7546-b92d-f977780d6726", "code": "C-00002", "nameEn": "Sample Store Two", "nameBn": "নমুনা স্টোর দুই" },
  "deliveryDate": "2026-11-19",
  "transportReference": "Truck DHA-11-2233",
  "totalQuantity": "40",
  "totalAmount": "22600.00",
  "creditLimitExceeded": true,
  "status": "active",
  "createdBy": { "id": "01a1f347-c91e-77e4-8e99-9c0de5cc42b0", "name": "Rahim Uddin" },
  "createdAt": "2026-11-19T10:08:51.071Z",
  "note": null,
  "version": 1,
  "items": [
    {
      "id": "01a1f347-cb82-77fa-bfff-15695043c505",
      "orderItemId": "01a1f347-cb12-73d3-a3c4-2404751d778d",
      "product": { "id": "01a1f347-c333-775c-b5f9-0803c3d1f1d8", "code": "P-0001", "nameEn": "Sample OPC 50kg", "nameBn": "নমুনা ওপিসি ৫০ কেজি", "unitKey": "bag" },
      "quantity": "40",
      "unitPrice": "565.00",
      "lineTotal": "22600.00"
    }
  ],
  "voidedAt": null,
  "voidReason": null,
  "voidedBy": null,
  "updatedAt": "2026-11-19T10:08:51.071Z"
}
```

**ক্রেডিট সীমা:** ডেলিভারির পরের ব্যালেন্স গ্রাহকের `creditLimit` ছাড়ালে কী হয়, তা ব্যবসার Settings-এর `creditLimitMode` ঠিক করে।
- `warn` (ডিফল্ট): ডেলিভারি হয়, উত্তরে `creditLimitExceeded: true` থাকে। frontend সতর্কবার্তা দেখাবে। উপরের নমুনায় শুরুর বাকি ১২,৫০০ + ২২,৬০০ = ৩৫,১০০ > সীমা ৩০,০০০।
- `block`: 409 `CREDIT_LIMIT_EXCEEDED` (`field: "items"`, `details: { creditLimit, balanceAfter }`)। `delivery.credit.override` (মালিক-স্তর) থাকলে তবুও ডেলিভারি হয়, পতাকাসহ।
- `creditLimitExceeded` শুধু `customer.due.view` থাকলে উত্তরে আসে।

**আটকায়:**
- অর্ডার-লাইনের বাকির বেশি হলে 400 `DELIVERY_QUANTITY_TOO_LARGE` (`details.remaining`):

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "More than is left to deliver on this order line",
  "code": "DELIVERY_QUANTITY_TOO_LARGE",
  "field": "items.0.quantity",
  "errors": [{ "field": "items.0.quantity", "code": "DELIVERY_QUANTITY_TOO_LARGE", "message": "More than is left to deliver on this order line" }],
  "details": { "remaining": "60" }
}
```

- স্টক কম হলে 409 `STOCK_INSUFFICIENT` (`field: "items.<n>.quantity"`)।
- বাতিল অর্ডারে 409 `ORDER_ALREADY_VOID`।
- দুজন একসাথে একই বাকির জন্য ডেলিভারি দিলে অর্ডার লক হয়; বাকির বেশি কখনো যায় না।

### `GET deliveries?orderId=&customerId=&status=&from=&to=&page=` ও `GET deliveries/:id`

অনুমতি: `delivery.view` (ম্যানেজার)। ১০টা করে, ডেলিভারির তারিখ অনুযায়ী নতুন আগে। তালিকায় `items` থাকে না। অন্য ব্যবসার id হলে 404 `DELIVERY_NOT_FOUND`।

### `POST collections`: আদায়

অনুমতি: `collection.create` (ম্যানেজার, হিসাবরক্ষক)।

```json
{
  "customerId": "01a1f347-c33b-7546-b92d-f977780d6726",
  "orderId": "01a1f347-cb0f-70c4-8cca-67ced2e7839b",
  "method": "bkash",
  "amount": "20000",
  "reference": "TRX8XK2QW"
}
```

| ঘর | নিয়ম |
|---|---|
| `method` | ব্যবসার তালিকার একটা (`GET collection-methods`) |
| `amount` | শূন্যের বেশি |
| `reference` | ঐচ্ছিক (৬৪): লেনদেনের id, চেকের নম্বর |
| `orderId` | ঐচ্ছিক; একই গ্রাহকের অর্ডার হতে হবে |
| `note` | ঐচ্ছিক (৫০০) |

উত্তর 201:

```json
{
  "id": "01a1f347-cbdc-74dd-a302-9386b165fc3c",
  "code": "COL-0001",
  "customer": { "id": "01a1f347-c33b-7546-b92d-f977780d6726", "code": "C-00002", "nameEn": "Sample Store Two", "nameBn": "নমুনা স্টোর দুই" },
  "order": { "id": "01a1f347-cb0f-70c4-8cca-67ced2e7839b", "code": "ORD-0001" },
  "collectionDate": "2026-11-19",
  "method": "bkash",
  "amount": "20000.00",
  "reference": "TRX8XK2QW",
  "note": null,
  "status": "active",
  "version": 1,
  "createdBy": { "id": "01a1f347-ca28-757a-bb72-87856e1d9e0b", "name": "Salma Akter" },
  "createdAt": "2026-11-19T10:08:51.164Z",
  "voidedAt": null,
  "voidReason": null,
  "voidedBy": null,
  "updatedAt": "2026-11-19T10:08:51.164Z"
}
```

`GET collection-methods` (`collection.create`): `{ "items": ["cash", "bkash", "nagad", "bank", "cheque"] }`। তালিকা ব্যবসার Settings (`collectionMethods`) থেকে আসে।

`GET collections?customerId=&orderId=&method=&status=&from=&to=&page=` ও `GET collections/:id`: অনুমতি `collection.view` (ম্যানেজার, হিসাবরক্ষক); ১০টা করে, নতুন আগে।

**অগ্রিম ফেরত:** অর্ডার বাতিল হলে আদায় আপনা থেকে বদলায় না; অগ্রিম গ্রাহকের জমা (ঋণাত্মক ব্যালেন্স) হিসেবে থাকে। টাকা ফেরত দিলে সেই আদায় বাতিল করুন (`POST collections/:id/void`)। এতে খাতায় উল্টো লাইন বসে, বাতিলের দিনের তারিখে।

### `GET customers/:id/ledger?from=&to=&page=`: গ্রাহকের খাতা

অনুমতি: `customer.due.view`। ব্যালেন্সের প্রতিটা বদল, নতুন আগে, ১০টা করে, সাথে গ্রাহকের সারাংশ।

```json
{
  "customer": {
    "id": "01a1f347-c33b-7546-b92d-f977780d6726",
    "code": "C-00002",
    "nameEn": "Sample Store Two",
    "openingBalance": "12500.00",
    "deliveredAmount": "22600.00",
    "collectedAmount": "20000.00",
    "currentBalance": "15100.00",
    "creditLimit": "30000.00"
  },
  "items": [
    {
      "id": "01a1f347-cbe3-77c0-b936-fd507c844417",
      "kind": "collection",
      "amount": "-20000.00",
      "entryDate": "2026-11-19",
      "source": { "type": "collection", "id": "01a1f347-cbdc-74dd-a302-9386b165fc3c", "code": "COL-0001" },
      "reason": null,
      "createdBy": { "id": "01a1f347-ca28-757a-bb72-87856e1d9e0b", "name": "Salma Akter" },
      "createdAt": "2026-11-19T10:08:51.171Z"
    },
    {
      "id": "01a1f347-cb90-76db-bd7a-e73074879778",
      "kind": "delivery",
      "amount": "22600.00",
      "entryDate": "2026-11-19",
      "source": { "type": "delivery", "id": "01a1f347-cb7f-764a-9ddb-43f5102e159f", "code": "DEL-0001" },
      "reason": null,
      "createdBy": { "id": "01a1f347-c91e-77e4-8e99-9c0de5cc42b0", "name": "Rahim Uddin" },
      "createdAt": "2026-11-19T10:08:51.088Z"
    }
  ],
  "page": 1,
  "pageSize": 10,
  "total": 2
}
```

- `amount` চিহ্নসহ: ধনাত্মক মানে পাওনা বাড়ে।
- `kind` হয় `delivery`, `delivery_edit`, `delivery_void`, `collection`, `collection_edit` বা `collection_void`।
- শুরুর বাকি খাতায় থাকে না (`customer.openingBalance`-এ আছে)।
- খাতা শুধু-যোগ-হয়: বদলানো বা মোছা ডাটাবেসই আটকায়।

### বাতিল ও সংশোধন

| দলিল | সরাসরি (মালিক-স্তর) | অনুরোধে `entityType` ও ঘর | নিয়ম |
|---|---|---|---|
| অর্ডার | `PATCH orders/:id` (`sale.edit`), `POST orders/:id/void` (`sale.void`) | `sales_order`: `orderDate`, `deliveryWindow`, `deliverBy`, `note`, `items.<itemId>.quantity`, `items.<itemId>.unitPrice` | সক্রিয় ডেলিভারি থাকলে বাতিল 409 `DELIVERY_EXISTS`; বস্তা ডেলিভারি-হওয়ার নিচে নয় (`ORDER_QUANTITY_TOO_SMALL`); দাম বদলালে আগে ডেলিভারি-হওয়া অংশের মূল্য, ব্যালেন্স ও খাতাও বদলায় |
| ডেলিভারি | `PATCH deliveries/:id` (`delivery.edit`), `POST deliveries/:id/void` (`delivery.void`) | `delivery`: `deliveryDate`, `transportReference`, `note`, `items.<itemId>.quantity` | বস্তা বাড়ানো বা কমানো (অর্ডারের বাকি পর্যন্ত); স্টক, অর্ডার, ব্যালেন্স, খাতা পার্থক্যে বদলায় |
| আদায় | `PATCH collections/:id` (`collection.edit`), `POST collections/:id/void` (`collection.void`) | `collection`: `collectionDate`, `method`, `amount`, `reference`, `note` | টাকা বদলালে ব্যালেন্স ও খাতা পার্থক্যে |

`PATCH`-এর body-তে লাইন থাকে `items: [{ "id": "<itemId>", "quantity": "...", "unitPrice": "..." }]` রূপে, সাথে `reason`।

অর্ডারের দাম সংশোধনের অনুরোধের পূর্বরূপ (আগে ডেলিভারি হওয়া ১০০ বস্তার দাম ৫৬৫ থেকে ৫৬০):

```json
[
  { "key": "order.totalAmount", "label": "Order total", "before": "56500.00", "after": "56000.00", "delta": "-500.00" },
  { "key": "customer.currentBalance", "label": "Customer balance (delivered part re-priced)", "before": "49000.00", "after": "48500.00", "delta": "-500.00" }
]
```

পূর্বরূপের লাইনের `key`:
- `order.totalAmount`
- `order.remainingQuantity`
- `customer.pendingDeliveryQuantity`
- `customer.currentBalance` (`customer.due.view`)
- `stock.<productId>`

### ত্রুটি

| Status | `code` (`field`) | কখন |
|---|---|---|
| 400 | `CUSTOMER_NOT_FOUND_OR_INACTIVE` (`customerId`) | অর্ডারে গ্রাহক নেই বা নিষ্ক্রিয় |
| 400 | `DELIVER_BY_INVALID` (`deliverBy`), `DELIVERY_WINDOW_INVALID` (`deliveryWindow`) | প্রতিশ্রুত তারিখ অর্ডারের আগে / অজানা সময়সীমা |
| 400 | `ORDER_DATE_*`, `DELIVERY_DATE_*`, `COLLECTION_DATE_*` (`_INVALID` / `_IN_FUTURE` / `_TOO_OLD`) | তারিখ আসল নয় / ভবিষ্যৎ / ৭ দিনের আগের (ডেলিভারি অর্ডারের আগে হলে `_INVALID`) |
| 400 | `ORDER_ITEM_NOT_FOUND` / `ORDER_ITEM_DUPLICATE` (`items.<n>.orderItemId`) | লাইন এই অর্ডারের নয় / একই লাইন দুবার |
| 400 | `DELIVERY_QUANTITY_TOO_LARGE` (`items.<n>.quantity`) | অর্ডার-লাইনের বাকির বেশি (`details.remaining`) |
| 400 | `ORDER_QUANTITY_TOO_SMALL` (`items.<id>.quantity`) | অর্ডারের বস্তা ডেলিভারি-হওয়ার নিচে নামানো |
| 400 | `COLLECTION_METHOD_UNKNOWN` (`method`), `AMOUNT_TOO_SMALL` / `AMOUNT_INVALID` (`amount`) | পদ্ধতি তালিকায় নেই / টাকা শূন্য |
| 404 | `ORDER_NOT_FOUND` (`orderId` যখন body-তে), `DELIVERY_NOT_FOUND`, `COLLECTION_NOT_FOUND`, `CUSTOMER_NOT_FOUND` (`customerId`) | নেই, অন্য ব্যবসার, বা (বিক্রয়কর্মীর) অন্যের অর্ডার |
| 409 | `CREDIT_LIMIT_EXCEEDED` (`items`) | block মোডে ক্রেডিট সীমা পার (`details`) |
| 409 | `STOCK_INSUFFICIENT` | স্টক কম |
| 409 | `ORDER_ALREADY_VOID`, `DELIVERY_ALREADY_VOID`, `COLLECTION_ALREADY_VOID` | বাতিল দলিলে কাজ |
| 409 | `DELIVERY_EXISTS` | সক্রিয় ডেলিভারি থাকা অর্ডার বাতিল |

---

## ১২. সংশোধনের অনুরোধ ও অনুমোদন

স্টাফ সংবেদনশীল কিছু (দাম, বাকি, ক্রেডিট সীমা, নিষ্ক্রিয়; Step 5-এ বিক্রি ও কেনার সংশোধন ও বাতিল) সরাসরি বদলাতে পারেন না। তাঁরা কারণসহ **অনুরোধ** পাঠান; `change.approve` আছে এমন কেউ (সাধারণত মালিক) প্রভাব দেখে অনুমোদন বা প্রত্যাখ্যান করেন। অনুমোদন হলে বদল এক transaction-এ প্রয়োগ হয়। মালিক-স্তর আগের মতোই সরাসরি `PATCH` (কারণসহ) করতে পারেন।

সব পথ `/api/v1/b/:businessSlug/change-requests`-এর নিচে।

### মূল ধারণা

- **`entityType`**: কোন ধরনের রেকর্ড। এখন: `product`, `customer`, `product_category`। Step 5-এ `sale`, `purchase` আসবে, API একই থাকবে।
- **`kind`**: `edit` (মান বদল, `proposedChange` লাগে) বা `void` (বাতিল, `proposedChange` নয়)। মাস্টার ডেটা বাতিল হয় না, নিষ্ক্রিয় হয় (`isActive: false` দিয়ে `edit`); তাতে `void` দিলে 400।
- **`status`**: `pending` → `approved` / `rejected` / `cancelled` / `stale`। শুধু `pending` বদলানো যায়।
- **`stale`**: অনুরোধের পরে রেকর্ডটা অন্যভাবে বদলেছে (যেমন মালিক সরাসরি বদলেছেন)। অনুমোদনের চেষ্টায় অনুরোধ `stale` হয়ে যায় আর 409 আসে; দরকার হলে নতুন অনুরোধ করুন।
- একটা রেকর্ডে একসাথে একটাই `pending` অনুরোধ (দ্বিতীয়টায় 409)।
- **নিজের অনুরোধ নিজে অনুমোদন বা প্রত্যাখ্যান করা যায় না**, মালিক হলেও (403)।
- অনুমোদনকারী শুধু `change.approve` দিয়ে হয় না: যে বদল তিনি নিজে সরাসরি করতে পারেন না (যেমন `customer.balance.edit` নেই), তা অনুমোদনও করতে পারেন না (403)।
- অনুমোদনকারী প্রস্তাবিত মান বদলাতে পারেন না। অন্য মান চাইলে প্রত্যাখ্যান (নোটসহ) করে নিজে সরাসরি বদলান।

### কোন ফিল্ড অনুরোধে বদলানো যায়

| `entityType` | ফিল্ড | দেখতে লাগে | অনুমোদনে (সরাসরি) লাগে |
|---|---|---|---|
| `product` | `isActive` | - | `product.deactivate` |
| `customer` | `openingBalance`, `creditLimit` | `customer.due.view` | `customer.balance.edit` |
| `customer` | `isActive` | - | `customer.deactivate` |
| `product_category` | `isActive` | - | `product.deactivate` |
| `purchase` | `purchaseDate`, `items.<itemId>.quantity` | - | `purchase.edit` |
| `purchase` | `items.<itemId>.unitPrice` | `product.cost.view` | `purchase.edit` |
| `purchase` | `note`, `supplierReference` | - | `purchase.create` |
| `purchase` | বাতিল (`kind: "void"`) | - | `purchase.void` |
| `product_stock` | `adjustBy` (চিহ্নসহ পরিমাণ) | - | `stock.adjust.large` |
| `sales_order` | `orderDate`, `deliveryWindow`, `deliverBy`, `note`, `items.<itemId>.quantity`, `items.<itemId>.unitPrice`; বাতিল | - | `sale.edit`; বাতিলে `sale.void` |
| `delivery` | `deliveryDate`, `transportReference`, `note`, `items.<itemId>.quantity`; বাতিল | - | `delivery.edit`; বাতিলে `delivery.void` |
| `collection` | `collectionDate`, `method`, `amount`, `reference`, `note`; বাতিল | `amount`: `collection.view` | `collection.edit`; বাতিলে `collection.void` |

- টাকা স্ট্রিং বা সংখ্যা হিসেবে পাঠানো যায় (`"565"`), উত্তরে সবসময় দুই দশমিকের স্ট্রিং (`"565.00"`)। `creditLimit: null` মানে সীমা নেই।
- নাম, ঠিকানা, ফোনের মতো সাধারণ বদল অনুরোধ ছাড়াই সরাসরি `PATCH`-এ (অংশ ৯)।
- অনুরোধকারী যে ফিল্ড দেখতে পারেন না, তার অনুরোধও করতে পারেন না (403)। তালিকার বাইরের ফিল্ড বা আগের মানের সমান মানে 400।
- অনুরোধ করতে রেকর্ড দেখার অনুমতিও লাগে (`product.view` / `customer.view`)।

### `POST preview`: জমার আগে প্রভাব দেখা

অনুমতি: `change.request` বা `change.approve`। কিছু লেখে না।

```json
{
  "entityType": "customer",
  "entityId": "01a1ed61-301f-7464-9a0f-2b4bfcba90aa",
  "kind": "edit",
  "proposedChange": { "openingBalance": "13000" }
}
```

উত্তর 200:

```json
{
  "entityLabel": "C-00002 Sample Store Two",
  "impact": [
    {
      "key": "customer.openingBalance",
      "label": "Opening balance",
      "before": "12500.00",
      "after": "13000.00"
    },
    {
      "key": "customer.currentBalance",
      "label": "Current balance",
      "before": "12500.00",
      "after": "13000.00",
      "delta": "+500.00"
    }
  ]
}
```

**প্রভাবের লাইন (`impact[]`)**: `key` (স্থির, অনুবাদের জন্য ব্যবহার করুন), `label` (ইংরেজি), আর ঐচ্ছিক `before`, `after`, `delta` (চিহ্নসহ, যেমন `"+500.00"`, `"-50"`), `unit` (যেমন `bag`), `note` (যেমন নিষ্ক্রিয়ে "While inactive it cannot be chosen for new entries; existing records stay.")। দর্শকের যে লাইন দেখার অনুমতি নেই, তা পাঠানোই হয় না।

### `POST /`: অনুরোধ পাঠানো

অনুমতি: `change.request`। ঐচ্ছিক header `Idempotency-Key` (৮–৬৪ অক্ষর, `A-Z a-z 0-9 _ -`): ফর্ম খোলার সময় একটা নতুন key বানান (যেমন `crypto.randomUUID()`), একই ফর্মের প্রতিটা চেষ্টায় সেটাই পাঠান। একই ইউজার একই key আবার পাঠালে নতুন অনুরোধ হয় না, আগেরটাই 200-এ ফেরত আসে (double-click বা নেটওয়ার্ক retry নিরাপদ)।

```json
{
  "entityType": "customer",
  "entityId": "01a1ee9e-f6cb-7897-8c69-51ef7576e6fa",
  "kind": "edit",
  "reason": "The shop asked for more credit",
  "proposedChange": { "creditLimit": "60000", "isActive": false }
}
```

`reason` বাধ্যতামূলক, ৩–৫০০ অক্ষর। `void`-এ `proposedChange` দেবেন না।

উত্তর 201 (বিস্তারিত রূপ, নিচে `GET /:id`-এর মতো):

```json
{
  "id": "01a1ee9f-0cae-76c1-aa41-a7ed1a50efab",
  "entityType": "customer",
  "entityId": "01a1ee9e-f6cb-7897-8c69-51ef7576e6fa",
  "entityLabel": "C-00002 Sample Store Two",
  "kind": "edit",
  "summary": "Active: true → false; Credit limit: 50000.00 → 60000.00",
  "status": "pending",
  "requestedBy": { "id": "01a1ee9f-0b67-723a-909d-d9eb0f5afd1c", "name": "Rahim Uddin" },
  "requestedAt": "2026-11-18T12:26:03.310Z",
  "decidedBy": null,
  "decidedAt": null,
  "reason": "The shop asked for more credit",
  "snapshot": { "isActive": true, "creditLimit": "50000.00" },
  "proposedChange": { "isActive": false, "creditLimit": "60000.00" },
  "impact": [
    { "key": "customer.isActive", "label": "Active", "before": true, "after": false, "note": "While inactive it cannot be chosen for new entries; existing records stay." },
    { "key": "customer.creditLimit", "label": "Credit limit", "before": "50000.00", "after": "60000.00" }
  ],
  "isStale": false,
  "decisionNote": null,
  "appliedAt": null
}
```

**একই রেকর্ডে আগেই অপেক্ষমাণ অনুরোধ থাকলে** 409 `CHANGE_REQUEST_PENDING_EXISTS`। অনুরোধকারী সেই অনুরোধ খুলতে পারলে (নিজের অনুরোধ, অথবা `change.view.all` আছে) উত্তরে তার `changeRequestId` থাকে, যাতে app সরাসরি সেটা খুলতে পারে:

```json
{
  "statusCode": 409,
  "error": "Conflict",
  "message": "This record already has a pending change request",
  "code": "CHANGE_REQUEST_PENDING_EXISTS",
  "changeRequestId": "01a1ee9f-0cae-76c1-aa41-a7ed1a50efab"
}
```

অন্য কারো অনুরোধ আর `change.view.all` নেই হলে একই উত্তর, শুধু `changeRequestId` ছাড়া।

### `GET mine?status=&page=` ও `GET ?status=&entityType=&entityId=&requestedBy=&from=&to=&page=`

`mine` (অনুমতি `change.view.own`): নিজের অনুরোধ। `/` (অনুমতি `change.view.all`): সবার, মালিকের ইনবক্স। দুটোই প্রতি পাতায় ১০টা, নতুন আগে। `from`/`to` হলো `requestedAt`-এর ISO তারিখ। তালিকায় শুধু সারাংশ; `snapshot`, `impact` ইত্যাদি `GET /:id`-এ।

```json
{
  "items": [
    {
      "id": "01a1ee9f-0cae-76c1-aa41-a7ed1a50efab",
      "entityType": "customer",
      "entityId": "01a1ee9e-f6cb-7897-8c69-51ef7576e6fa",
      "entityLabel": "C-00002 Sample Store Two",
      "kind": "edit",
      "summary": "Active: true → false; Credit limit: 50000.00 → 60000.00",
      "status": "pending",
      "requestedBy": { "id": "01a1ee9f-0b67-723a-909d-d9eb0f5afd1c", "name": "Rahim Uddin" },
      "requestedAt": "2026-11-18T12:26:03.310Z",
      "decidedBy": null,
      "decidedAt": null
    }
  ],
  "page": 1,
  "pageSize": 10,
  "total": 1
}
```

`summary` দর্শক অনুযায়ী তৈরি হয়: যে ফিল্ড দেখার অনুমতি নেই, তার মান থাকে না, শুধু `"Credit limit changed"`। বাতিলের অনুরোধে সারাংশ হলো handler-এর বাতিলের লেবেল (Step 5-এ যেমন বিক্রি বাতিল)।

### `GET pending-count`

অনুমতি: `change.view.all`। ব্যাজের জন্য: `{ "count": 1 }`।

### `GET :id`

নিজের অনুরোধ হলে `change.view.own`, অন্যের হলে `change.view.all` লাগে; না থাকলে (বা অন্য ব্যবসার id হলে) 404। উত্তর উপরের 201-এর রূপ।

- `snapshot`: অনুরোধের সময়ের মান (শুধু প্রস্তাবিত ফিল্ডগুলোর)। `proposedChange`: প্রস্তাবিত মান (`void`-এ `null`)। দর্শকের দেখার অনুমতি না থাকা ফিল্ড দুটোতেই বাদ।
- `impact`: শুধু `pending`-এ, **এখনকার** মান থেকে হিসাব করা; অন্য status-এ `null`।
- `isStale`: `pending` হলেও রেকর্ড এর মধ্যে বদলে গেলে `true` (অনুমোদনে 409 আসবে), আর `status: "stale"` হলেও `true`। মালিকের পর্দায় সতর্কবার্তা দেখান।

### `POST :id/approve`

অনুমতি: `change.approve` + প্রতিটা ফিল্ডের সরাসরি-অনুমতি (বাতিলে সংশ্লিষ্ট `*.void`); নিজের নয়। body ঐচ্ছিক: `{ "note": "Checked their payments" }`। উত্তর 200, বিস্তারিত রূপ, যেমন `"status": "approved"`, `"decidedBy": { "id": "...", "name": "Jesan Owner" }`, `"decisionNote": "Checked their payments"`, `"appliedAt": "2026-11-18T12:26:03.408Z"`, `"impact": null`।

দুজন একসাথে অনুমোদন দিলে একজনই সফল, অন্যজন 409। প্রয়োগে কোনো ত্রুটি হলে কিছুই বদলায় না, অনুরোধ `pending` থাকে।

### `POST :id/reject`

অনুমতি: `change.approve`; নিজের নয়। `{ "note": "The new rate starts next month" }`, নোট বাধ্যতামূলক (৩–৫০০)। রেকর্ড অপরিবর্তিত। উত্তর 200, `"status": "rejected"`।

### `POST :id/cancel`

অনুমতি: `change.view.own`; শুধু নিজের `pending` অনুরোধ (অন্যের হলে 404)। উত্তর 200, `"status": "cancelled"`।

### ত্রুটি

| Status | `code` (`field`) | কখন |
|---|---|---|
| 400 | `VALIDATION_FAILED` (`errors[]`-এ প্রতিটা ঘর) | body-র কাঠামো ভুল |
| 400 | `ENTITY_TYPE_UNKNOWN` (`entityType`), `VOID_NOT_SUPPORTED` (`kind`), `PROPOSED_CHANGE_EMPTY` / `PROPOSED_CHANGE_NOT_ALLOWED` (`proposedChange`), `FIELD_NOT_CHANGEABLE` (`proposedChange.<ঘর>`), `<ঘর>_INVALID` (`proposedChange.<ঘর>`, যেমন `CREDIT_LIMIT_INVALID`), `NOTHING_TO_CHANGE`, `IDEMPOTENCY_KEY_INVALID` (`Idempotency-Key`) | ভুল অনুরোধ |
| 403 | `ACCESS_DENIED` | অনুমতি নেই, বা লুকানো ফিল্ডের অনুরোধ, বা অনুমোদনকারীর সরাসরি-অনুমতি নেই |
| 403 | `SELF_DECISION_FORBIDDEN` | নিজের অনুরোধ অনুমোদন/প্রত্যাখ্যান |
| 404 | `CHANGE_REQUEST_NOT_FOUND`, `RECORD_NOT_FOUND` (`entityId`) | নেই, অন্য ব্যবসার, বা দেখার অনুমতি নেই |
| 409 | `CHANGE_REQUEST_PENDING_EXISTS` | একই রেকর্ডে আরেকটা pending; দেখার অনুমতি থাকলে সাথে `changeRequestId` |
| 409 | `CHANGE_REQUEST_ALREADY_DECIDED` | আগেই সিদ্ধান্ত হয়েছে (`message`-এ অবস্থা) |
| 409 | `ENTITY_TYPE_UNSUPPORTED`, `CHANGE_FIELD_UNSUPPORTED` | রেকর্ডের ধরন বা ঘর আর সমর্থিত নয় |
| 409 | `STALE_REQUEST` | stale |

---

## ১৩. খরচ, ক্যাশ বই ও মূল রিপোর্ট

দৈনিক খরচ, নগদ ও ব্যাংক/মোবাইল-ব্যাংকিং-এর ক্যাশ বই, আর ব্যবসা চালানোর শুধু-পড়া রিপোর্ট। সব পথ `/api/v1/b/:businessSlug/...`-এর নিচে। মালিকের কমিশন ও লাভ এখনো নেই (ভবিষ্যতের ধাপ); কেনা-দাম-নির্ভর কোনো কলাম এই অংশে কোথাও নেই।

### খরচের ধরন

ব্যবসা-ভিত্তিক তালিকা (বেতন, ভাড়া, বিদ্যুৎ, যানবাহন ও জ্বালানি, আপ্যায়ন, অন্যান্য — ব্যবসার Settings-এ বদলানো যায়)। মোছা নেই, শুধু নিষ্ক্রিয় (কারণ বাধ্যতামূলক); ইতিমধ্যে বসানো খরচ তার ধরন দেখাতেই থাকে।

**`GET expense-categories?active=`** (`expense.view`): তালিকা পাতাভাগ ছাড়া (ধরন অল্প, মাস্টার ডেটার ক্যাটাগরির মতো)।

**`POST expense-categories`** (`expense.category.manage`):

```json
{ "nameEn": "Office supplies", "nameBn": "অফিস সরঞ্জাম", "sortOrder": 7 }
```

**`PATCH expense-categories/:id`** (`expense.category.manage`): নাম বা `sortOrder` বদলাতে `reason` লাগে না; `isActive` বদলাতে `reason` (৩–৫০০ অক্ষর) বাধ্যতামূলক।

### খরচ

**`POST expenses`** (`expense.create`; ম্যানেজার, হিসাবরক্ষক): ঐচ্ছিক `Idempotency-Key` header।

```json
{
  "expenseDate": "2026-11-19",
  "categoryId": "01a1f347-c33b-7546-b92d-f977780d6726",
  "method": "cash",
  "amount": "5000.00",
  "note": "November office rent",
  "proofNote": "Receipt 112"
}
```

- `expenseDate` না দিলে আজ (ব্যবসার সময়-অঞ্চলে); ভবিষ্যৎ নয়; `expense.edit` না থাকলে শুধু শেষ ৭ দিন (ব্যবসার Settings: `backdateLimitDays`)।
- `method` ব্যবসার `expenseMethods`-এর একটা হতে হবে (না থাকলে `collectionMethods`-এর মান ব্যবহার হয়)।
- `categoryId` একই ব্যবসার ও active হতে হবে।
- `note` (বিবরণ) ও `proofNote` (প্রমাণ-নোট, যেমন রসিদ নম্বর) দুটোই ঐচ্ছিক, আলাদা ঘর।
- উত্তরে কোড (`EXP-0001`), `status: "active"`, `version: 1`।

**`GET expenses?from=&to=&categoryId=&method=&status=&page=`** এবং **`GET expenses/:id`** (`expense.view`): পাতাভাগ ১০ সারি।

**`GET expense-methods`** (`expense.create`): `{ "items": ["cash", "bkash", "nagad", "bank", "cheque"] }` — ব্যবসার Settings থেকে।

### সংশোধন ও বাতিল

কর্মী নিজে `PATCH`/`.../void` করতে পারেন না (403); `expense.edit` / `expense.void` (ডিফল্টে মালিক-স্তর) দিয়ে সরাসরি, নইলে অংশ ১২-র `POST change-requests` দিয়ে (`entityType: "expense"`, ঘর: `expenseDate`, `categoryId`, `method`, `amount`, `note`, `proofNote`)। বাতিলে কোনো উল্টো এন্ট্রি বসে না — ক্যাশ বই derived বলে `status: "void"` হওয়াই যথেষ্ট; প্রতিটা বদলে `version` বাড়ে। খরচের ধরন নিষ্ক্রিয়/সক্রিয় করার অনুরোধ একই পথে (`entityType: "expense_category"`, ঘর: `isActive`)।

### ক্যাশ বই

**`GET cash-book?from=&to=&page=`** (`cashbook.view`; ম্যানেজার, হিসাবরক্ষক): কোনো টেবিল নয় — আসল আদায়, খরচ ও নগদ কেনা থেকে সরাসরি গোনা। না দিলে `from`/`to` চলতি মাস; রেঞ্জের প্রস্থে কোনো সীমা নেই, ব্যবসার lifetime পর্যন্ত চাওয়া যায় (দিনের তালিকা তবু পাতাভাগ ১০ সারি)।

```json
{
  "from": "2026-11-01",
  "to": "2026-11-19",
  "openingBalance": "12000.00",
  "closingBalance": "18500.00",
  "totals": {
    "collections": "9500.00", "expenses": "2000.00", "purchases": "1000.00",
    "in": "9500.00", "out": "3000.00", "net": "6500.00",
    "cashIn": "6000.00", "cashOut": "2500.00", "cashNet": "3500.00"
  },
  "byMethod": [
    { "method": "bank", "isCash": false, "in": "3500.00", "out": "500.00", "net": "3000.00" },
    { "method": "cash", "isCash": true, "in": "6000.00", "out": "2500.00", "net": "3500.00" }
  ],
  "days": [
    { "date": "2026-11-19", "opening": "17800.00", "collections": "700.00", "expenses": "0.00", "purchases": "0.00", "in": "700.00", "out": "0.00", "closing": "18500.00" }
  ],
  "page": 1, "pageSize": 10, "total": 12
}
```

- `days` শুধু কিছু ঘটেছে এমন দিনগুলো, পুরনো থেকে নতুন; পাতাভাগ দিনের উপর (১০টা)।
- `byMethod`-এ ব্যবসার প্রতিটা পদ্ধতি থাকে, কাজ না হলেও; `isCash` ব্যবসার Settings-এর `cashMethodKeys`-এ (ডিফল্ট `cash`) আছে কিনা।
- বাতিল হওয়া আদায়/খরচ/কেনা কখনো গোনা হয় না।

### রিপোর্ট

সব শুধু-পড়া, `report.view`। তারিখ-সীমা না দিলে চলতি মাস; রেঞ্জের প্রস্থে কোনো সীমা নেই, lifetime (all-time) total চাইলে একটা পুরনো `from` দিয়ে পুরো ইতিহাস আনা যায়। কোনো রিপোর্টে কেনা-দাম, লাভ বা কমিশন নেই — কেনার মোট টাকার যোগফল লাগলে `GET purchases/summary?from=&to=` (অংশ ৫, `purchase.view` + `product.cost.view`), `reports/*`-এ নয়।

| Route | `groupBy` | উত্তরের মূল ঘর |
|---|---|---|
| `GET reports/sales?groupBy=&from=&to=&page=&sort=` | `date` (ডিফল্ট) \| `customer` \| `product` \| `category` | `items[].{key,label,quantity,amount}`, `totalQuantity`, `totalAmount` |
| `GET reports/collections?groupBy=&from=&to=&page=` | `date` (ডিফল্ট) \| `method` | `items[].{key,count,amount}`, `totalAmount` |
| `GET reports/dues?page=` | — | `items[].{code,currentBalance,dueAmount,advanceAmount,aging}`, `totalDue`, `totalAdvance` |
| `GET reports/stock?page=` | — | `items[].{code,currentStock,unitKey}` |
| `GET reports/stock-movements?from=&to=&page=` | — | `items[].{code,net,byKind[].{kind,quantity}}` |
| `GET reports/expenses?groupBy=&from=&to=` | `category` (ডিফল্ট) \| `month` | `items[].{key,label,count,amount}`, `totalAmount` |
| `GET reports/daily-summary?date=` | — | `orders`, `deliveries`, `collections`, `expenses` (সবই `{count,amount}`), `cash` |

**বিক্রয় রিপোর্ট** (`sales`): active ডেলিভারির পরিমাণ ও মূল্য, তারিখ/গ্রাহক/পণ্য/ক্যাটাগরি ধরে। `product`/`category`-তে পাতাভাগ মেমরিতে (গ্রুপের সংখ্যা সবসময় পণ্য/ক্যাটাগরির সংখ্যার মধ্যে)।

**`sort`** শুধু `groupBy=customer`-এর জন্য (অন্য `groupBy`-তে উপেক্ষিত): `amount` (ডিফল্ট, আগের মতোই — ডেলিভারির মোট, সব এককসহ) অথবা `quantity` — "কোন গ্রাহক সবচেয়ে বেশি বস্তা কিনেছে" জাতীয় তালিকার জন্য। `sort=quantity`-তে `items[].quantity`/`amount` শুধু ব্যবসার নিজের ডিফল্ট এককের (`GET product-units`-এর `defaultUnitKey`, Akij-এ `bag`) লাইন-আইটেম থেকে, যাতে ভিন্ন একক একসাথে যোগ না হয়; `totalQuantity`/`totalAmount`-ও তখন সেই ফিল্টার করা যোগফল (সব `groupBy`/`sort`-এই `status: active` বাদে বাতিল ডেলিভারি/লাইন কখনো গোনা হয় না)।

**বাকির তালিকা** (`dues`): active গ্রাহক, যার ব্যালেন্স শূন্য নয়, নামের ক্রমে। `dueAmount` ও `advanceAmount` আলাদা (একটা সময় একটাই শূন্য-বহির্ভূত)। `aging` (`d0To7`, `d8To30`, `d30Plus`): আদায় কোনো ডেলিভারিতে বরাদ্দ হয় না, তাই FIFO হিসাব — শুরুর বাকি সবচেয়ে পুরনো ধরে, গ্রাহকের খাতা পুরনো থেকে নতুন মিলিয়ে; তিন bucket-এর যোগ সবসময় `dueAmount`।

```json
{
  "items": [
    { "id": "...", "code": "C-00007", "nameEn": "City Hardware", "currentBalance": "9000.00",
      "dueAmount": "9000.00", "advanceAmount": "0.00",
      "aging": { "d0To7": "4000.00", "d8To30": "3000.00", "d30Plus": "2000.00" } }
  ],
  "totalDue": "145000.00", "totalAdvance": "8000.00", "page": 1, "pageSize": 10, "total": 214
}
```

**দৈনিক সারাংশ** (`daily-summary`): আজকের (না দিলে) অর্ডার, ডেলিভারি, আদায়, খরচ — সংখ্যা ও টাকা। `cash` অংশ (`openingBalance`, `closingBalance`, `net`) শুধু `cashbook.view` থাকলে আসে, সার্ভারে বাদ দেওয়া হয়, frontend-এ লুকানো নয়।

### ত্রুটি

| Status | `code` (`field`) | কখন |
|---|---|---|
| 400 | `EXPENSE_METHOD_UNKNOWN` (`method`) | পদ্ধতি ব্যবসার তালিকায় নেই |
| 400 | `EXPENSE_CATEGORY_NOT_FOUND_OR_INACTIVE` (`categoryId`) | ধরন নেই, অন্য ব্যবসার, বা নিষ্ক্রিয় |
| 400 | `AMOUNT_TOO_SMALL` / `AMOUNT_INVALID` (`amount`) | টাকা শূন্য বা তার কম, বা রূপ ভুল |
| 400 | `EXPENSE_DATE_*` (`_INVALID` / `_IN_FUTURE` / `_TOO_OLD`, `expenseDate`) | তারিখ আসল নয় / ভবিষ্যৎ / ৭ দিনের আগের |
| 400 | `FROM_INVALID` / `TO_INVALID` (`from` / `to`) | তারিখ আসল নয়, বা `to` < `from` |
| 404 | `EXPENSE_NOT_FOUND`, `EXPENSE_CATEGORY_NOT_FOUND` | নেই বা অন্য ব্যবসার |
| 409 | `EXPENSE_ALREADY_VOID` | বাতিল খরচে আবার বদল বা বাতিল |
| 409 | `NAME_EN_DUPLICATE` / `NAME_BN_DUPLICATE` (`nameEn` / `nameBn`) | এই নামের ধরন আগেই আছে |

---

## ১৪. হিসাব (Accounts)

ব্যবসার সব টাকার movement এক জায়গায় (general ledger): আদায়, খরচ, কেনা, কমিশন রসিদ — এগুলো নিজ নিজ module থেকেই স্বয়ংক্রিয়ভাবে বসে — আর হাতে দেওয়া entry ও সরবরাহকারীর পেমেন্ট, এই দুটো সরাসরি এখানে। সব পথ `/api/v1/b/:businessSlug/accounts/...`-এর নিচে। `GET reports/dues` (অংশ ১৩) অপরিবর্তিত; `totalDue`/`totalAdvance` এখানে আর তার হিসাব একই উৎস (গ্রাহকের `currentBalance`), কিন্তু এখানে তারিখ-নিরপেক্ষ সার্বক্ষণিক স্নাপশট।

### সারাংশ

**`GET accounts/summary?from=&to=`** (`ledger.view`): না দিলে `from`/`to` চলতি মাস। `totalIn`/`totalOut`/`net`/`byType` তারিখ-সীমার ভেতরের active এন্ট্রি থেকে; `totalDue`/`totalAdvance` তারিখ-সীমার বাইরে, সার্বক্ষণিক (active গ্রাহকদের `currentBalance` যোগ করে, ধনাত্মক ও ঋণাত্মক আলাদাভাবে)।

```json
{
  "from": "2026-11-01", "to": "2026-11-20",
  "totalIn": "9500.00", "totalOut": "3000.00", "net": "6500.00",
  "totalDue": "145000.00", "totalAdvance": "8000.00",
  "byType": [
    { "type": "collection", "in": "9500.00", "out": "0.00" },
    { "type": "expense", "in": "0.00", "out": "2000.00" },
    { "type": "purchase", "in": "0.00", "out": "1000.00" },
    { "type": "commission_receipt", "in": "0.00", "out": "0.00" },
    { "type": "manual", "in": "0.00", "out": "0.00" },
    { "type": "supplier_payment", "in": "0.00", "out": "0.00" }
  ]
}
```

- `byType`-এ ব্যবসার সবরকম ধরন সবসময় থাকে, কোনো এন্ট্রি না থাকলেও (`"0.00"`)।
- বাতিল (`status: "void"`) হওয়া এন্ট্রি কখনো গোনা হয় না।

### খাতা (ledger)

**`GET accounts/ledger?from=&to=&type=&page=`** (`ledger.view`): না দিলে `from`/`to` চলতি মাস; রেঞ্জের প্রস্থে কোনো সীমা নেই, lifetime পর্যন্ত চাওয়া যায়। পাতাভাগ ১০ সারি, নতুন থেকে পুরনো। `type` ঐচ্ছিক ফিল্টার (`collection` | `expense` | `purchase` | `commission_receipt` | `manual` | `supplier_payment`)।

```json
{
  "items": [
    { "id": "...", "type": "collection", "direction": "in", "amount": "3000.00",
      "method": "bkash", "referenceType": "collection", "referenceId": "...",
      "entryDate": "2026-11-20", "note": null, "status": "active",
      "createdBy": { "id": "...", "name": "..." }, "createdAt": "2026-11-20T10:00:00.000Z" }
  ],
  "page": 1, "pageSize": 10, "total": 37
}
```

- `referenceType`/`referenceId` উৎস দলিল দেখায় (যেমন `collection`); হাতে দেওয়া entry ও payment-এ `null`।
- উৎস দলিল বাতিল হলে এখানকার এন্ট্রিও `status: "void"` হয় (নিজে বাতিলযোগ্য নয়)।

### হাতে দেওয়া entry

**`POST accounts/entries`** (`ledger.entry.create`; হিসাবরক্ষক)। **`Idempotency-Key` header বাধ্যতামূলক** (না দিলে 400 `IDEMPOTENCY_KEY_REQUIRED`)।

```json
{ "direction": "in", "amount": "500.00", "method": "cash", "entryDate": "2026-11-20", "note": "মালিকের নগদ জমা" }
```

- `direction`: `"in"` বা `"out"`। `type` সবসময় `"manual"` বসে।
- `entryDate` না দিলে আজ (ব্যবসার সময়-অঞ্চলে); ভবিষ্যৎ নয়; সর্বোচ্চ ৭ দিন আগে, ছাড় নেই।
- `method` ঐচ্ছিক; দিলে ব্যবসার `collectionMethods`-এর একটা হতে হবে।
- একই `Idempotency-Key` দ্বিতীয়বার: 200, নতুন সারি তৈরি হয় না।

### সরবরাহকারীর পেমেন্ট

**`POST accounts/payments`** (`payment.create`; হিসাবরক্ষক)। **`Idempotency-Key` header বাধ্যতামূলক।**

```json
{ "amount": "9000.00", "method": "bank", "paymentDate": "2026-11-20", "note": "Cement Ltd চালান #112" }
```

- `type` সবসময় `"supplier_payment"`, `direction` সবসময় `"out"`।
- `method` বাধ্যতামূলক, ব্যবসার `collectionMethods`-এর একটা হতে হবে।
- `paymentDate` না দিলে আজ; ভবিষ্যৎ নয়; সর্বোচ্চ ৭ দিন আগে, ছাড় নেই।

### স্বয়ংক্রিয় এন্ট্রি

নিচের প্রতিটা নিজের module-এর create/void-এর একই transaction-এ, কোনো আলাদা call নয়:

| উৎস | `type` | `direction` |
|---|---|---|
| আদায় (`collection`) তৈরি | `collection` | `in` |
| খরচ (`expense`) তৈরি | `expense` | `out` |
| কেনা (`purchase`) তৈরি | `purchase` | `out` |
| কমিশন রসিদ (`commission_receipt`) তৈরি | `commission_receipt` | `in` |

আদায়/খরচ/কেনা বাতিল হলে সংশ্লিষ্ট এন্ট্রি `status: "void"` হয়ে যায় (নতুন উল্টো এন্ট্রি নয়)।

কেনা **সংশোধন** হলে (দাম বা পরিমাণ বদল) তার এন্ট্রির `amount` একই সারিতে হালনাগাদ হয়, নতুন সারি তৈরি হয় না; কেনার তারিখ বদলালে `entryDate`-ও সঙ্গে যায়, যাতে এন্ট্রি কেনার নিজের মাসেই গোনা হয়। আগে এটা হতো না — সংশোধিত কেনায় `accounts/summary` ও `accounts/ledger` পুরনো টাকাই দেখাত, যদিও ক্যাশ বই (যা কেনার সারি সরাসরি গোনে) নতুন টাকা দেখাত।

### ত্রুটি

| Status | `code` (`field`) | কখন |
|---|---|---|
| 400 | `IDEMPOTENCY_KEY_REQUIRED` (`Idempotency-Key`) | `entries`/`payments`-এ header নেই |
| 400 | `AMOUNT_TOO_SMALL` (`amount`) | টাকা শূন্য বা তার কম |
| 400 | `LEDGER_ENTRY_METHOD_UNKNOWN` (`method`) | পদ্ধতি ব্যবসার তালিকায় নেই |
| 400 | `ENTRY_DATE_*` (`_INVALID` / `_IN_FUTURE` / `_TOO_OLD`, `entryDate`) | তারিখ আসল নয় / ভবিষ্যৎ / ৭ দিনের আগের |
| 400 | `PAYMENT_DATE_*` (`_INVALID` / `_IN_FUTURE` / `_TOO_OLD`, `paymentDate`) | তারিখ আসল নয় / ভবিষ্যৎ / ৭ দিনের আগের |
| 400 | `FROM_INVALID` / `TO_INVALID` (`from` / `to`) | তারিখ আসল নয়, বা `to` < `from` |

---

## ১৪-ক. ড্যাশবোর্ড: নগদ অবস্থান ও মাসিক সারসংক্ষেপ

ড্যাশবোর্ডের জন্য শুধু-পড়া সমষ্টি। প্রতিটা সংখ্যা সক্রিয় (`active`) সারির যোগফল; বাতিল সারি কখনো গোনা হয় না। তারিখ ব্যবসার সময়-অঞ্চলে (Asia/Dhaka)। নতুন কোনো নিয়ম বা হিসাবের পদ্ধতি এখানে নেই: মূল বই (`accounts/ledger`) আর বিদ্যমান মডিউলের সারি থেকে সরাসরি গোনা।

### `GET dashboard/cashbook?from=&to=` (`cashbook.view`)

নগদ, ব্যাংক ও পদ্ধতিহীন সারির আলাদা অবস্থান। `from`/`to` না দিলে চলতি মাস।

- **নগদ** = ব্যবসার `cashMethodKeys` (ডিফল্ট `cash`)। **ব্যাংক** = বাকি সব পদ্ধতি (bkash, nagad, bank, cheque…)।
- **পদ্ধতিহীন** (`method` নেই, যেমন কমিশন রসিদ) আলাদা; নগদ বা ব্যাংকে যোগ হয় না।
- `opening` = `from`-এর আগের সব active সারির নিট (in − out); `closing` = `opening + in − out`।
- `collectionsIn` = শুধু আদায় (`collection`) থেকে আসা টাকা; `in` = সব টাকা ঢোকা (আদায়, কমিশন রসিদ, হাতে দেওয়া entry)।
- `availableCashAndBank` = `cash.closing + bank.closing`; পদ্ধতিহীন এতে নেই।

```json
{
  "from": "2026-11-01", "to": "2026-11-26",
  "cash": { "opening": "12000.00", "collectionsIn": "3000.00", "in": "3000.00", "out": "1200.00", "closing": "13800.00" },
  "bank": { "opening": "5000.00", "collectionsIn": "500.00", "in": "500.00", "out": "150.00", "closing": "5350.00" },
  "unassigned": { "opening": "300.00", "collectionsIn": "0.00", "in": "250.00", "out": "0.00", "closing": "550.00" },
  "availableCashAndBank": "19150.00"
}
```

### `GET dashboard/kpis?from=&to=&prevFrom=&prevTo=` (`report.view`)

ড্যাশবোর্ডের KPI কার্ডের চারটা সংখ্যা এক কলে, একটা সময়ের (`from`/`to`) এবং চাইলে তুলনার আরেকটা সময়ের (`prevFrom`/`prevTo`)। আগে প্রতিটা সংখ্যার জন্য আলাদা রিপোর্ট কল লাগত। `from`/`to` না দিলে চলতি মাস। `prevFrom` ও `prevTo` একসাথে দিতে হয়, নয়তো একসাথেই বাদ।

- `collection`: আদায় (active), `sales`: active ডেলিভারির মূল্য, `salesQuantity`: ডেলিভারি হওয়া বস্তা। তিনটাই `reports/collections` ও `reports/sales`-এর `totalAmount` / `totalQuantity`-এর সমান।
- `purchaseQuantity`: কেনা বস্তা, `purchases/summary`-র `totalQuantity`-র সমান। শুধু `purchase.view` থাকলে উত্তরে আসে; না থাকলে ঘরটাই থাকে না (রিপোর্ট দেখার অনুমতি আছে এমন হিসাবরক্ষকের জন্যও না)।
- `previous` তুলনার সময় না দিলে `null`।

```json
{
  "current":  { "from": "2026-11-01", "to": "2026-11-27", "collection": "325750.00", "sales": "485200.00", "salesQuantity": "1250.000", "purchaseQuantity": "980.000" },
  "previous": { "from": "2026-10-01", "to": "2026-10-27", "collection": "290000.00", "sales": "430000.00", "salesQuantity": "1100.000", "purchaseQuantity": "900.000" }
}
```

ত্রুটি: `from`/`to` ভুল 400 (`FROM_INVALID` / `TO_INVALID`); তুলনার সময় আধা-পাঠালে 400 `PREV_FROM_REQUIRED` (`prevFrom`) / `PREV_TO_REQUIRED` (`prevTo`); তারিখ আসল নয়, বা `prevTo` < `prevFrom` হলে 400 `PREV_FROM_INVALID` / `PREV_TO_INVALID`; অনুমতি নেই 403 `ACCESS_DENIED`।

### `GET dashboard/monthly-series?year=` (`report.view`)

একটা বছরের ১২ মাস: আদায়, বিক্রয় (সক্রিয় ডেলিভারির মূল্য), বিক্রয়ের বস্তা, কেনার বস্তা। ভবিষ্যৎ মাসও ০ হিসেবে আসে (কোনো আলাদা ধরন নেই)। `year` না দিলে চলতি বছর (ব্যবসার সময়-অঞ্চল); ২০০০–২১০০ বাইরে 400।

- `purchaseAmount` (কেনার মোট টাকা) শুধু `product.cost.view` থাকলে উত্তরে আসে; না থাকলে ঘরটাই থাকে না।

```json
{
  "year": 2026,
  "months": [
    { "month": "2026-01", "collection": "0.00", "sales": "0.00", "salesQuantity": "0.000", "purchaseQuantity": "0.000", "purchaseAmount": "0.00" },
    { "month": "2026-11", "collection": "325750.00", "sales": "485200.00", "salesQuantity": "1250.000", "purchaseQuantity": "980.000", "purchaseAmount": "310000.00" }
  ]
}
```

### `GET dashboard/commission-series?year=` (`commission.view`, owner-only)

কমিশনে পাওয়া টাকার মাসওয়ারি হিসাব (`received` = entry-র `amount`, `receivedDate`-এর মাসে ধরা)। `yearReceived` = বছরের মোট, `lifetimeReceived` = সব সময়ের মোট।

```json
{
  "year": 2026,
  "months": [ { "month": "2026-11", "received": "350000.00" } ],
  "yearReceived": "2100000.00", "lifetimeReceived": "2100000.00"
}
```

এই তিনটা endpoint-এ কোনো লেখা নেই, কোনো Idempotency-Key নেই। ত্রুটি: `from`/`to` ভুল বা অজানা তারিখ 400 (`FROM_INVALID` / `TO_INVALID`), `year` সীমার বাইরে 400 `VALIDATION_FAILED` (`year`), অনুমতি নেই 403 `ACCESS_DENIED`।

---

### `GET dashboard/finance-summary?from=&to=` (`report.view`)

আর্থিক সারসংক্ষেপের সব সংখ্যা একটা কলে, যাতে একই সময়ের দুটো ঘর কখনো আলাদা কথা না বলে। `from`/`to` না দিলে চলতি মাস।

**নিট লাভ = বিক্রয় − বিক্রিত পণ্যের ক্রয়মূল্য − খরচ + পাওয়া কমিশন।**

- **কেনার পুরো টাকা লাভ থেকে বাদ যায় না**: গুদামে পড়ে থাকা বস্তা খরচ নয়, সম্পদ। শুধু যা ডেলিভারি হয়েছে তা-ই বাদ যায়, প্রতিটা ডেলিভারি লাইনে জমা থাকা গড় ক্রয়মূল্যে (`delivery_items.cost_amount`), সঙ্গে এই সময়ে বসা কোনো সংশোধন।
- **আদায় ও বাকি লাভের হিসাবে নেই**: টাকা ঢোকা মানে আয় নয়, আর পাওনা মানে খরচ নয়। দুটোই শুধু দেখানোর জন্য।

`cogs`, `netProfit`, `totalPurchase`, `currentStockValue`, `uncostedQuantityDelivered`, `uncostedQuantityOnHand`, `uncostedDeliveryLines` শুধু `profit.view` (owner-only) থাকলে উত্তরে আসে; না থাকলে ঘরগুলো থাকেই না, বাকি সারসংক্ষেপ আসে।

```json
{
  "from": "2026-11-01", "to": "2026-11-27",
  "sales": "485200.00", "collection": "325750.00", "customerDue": "275000.00",
  "expenses": "95000.00", "commissionReceived": "125000.00",
  "totalPurchase": "310000.00",
  "currentStockQuantity": "980.000", "currentStockValue": "588000.00",
  "cogs": "454750.00", "netProfit": "60450.00",
  "uncostedQuantityDelivered": "0.000", "uncostedQuantityOnHand": "0.000",
  "uncostedDeliveryLines": 0
}
```

**`uncosted*` শূন্য না হলে** সেই বস্তাগুলোর ক্রয়মূল্য জানা নেই (দাম ছাড়া স্টক সমন্বয়ে ঢোকা), তাই `cogs` কম দেখাচ্ছে আর `netProfit` বেশি — frontend তখন লাভের পাশে সতর্কতা দেখায়। কোনো দাম বানিয়ে বসানো হয় না।

### মজুদের মূল্য: চলমান গড় (moving weighted average)

প্রতিটা পণ্যের স্টক দুটো আলাদা ভাগে থাকে, যারা কখনো মেশে না:

- **দামসহ**: যেসব বস্তার কেনা-দাম জানা। গড় = মোট মূল্য ÷ পরিমাণ, সবসময় হিসাব করে বের করা হয়, কখনো জমা রাখা হয় না — তাই গোল করা গড় কখনো আসল টাকার থেকে সরে যেতে পারে না।
- **দাম ছাড়া**: দাম ছাড়া ঢোকা বস্তা (স্টক সমন্বয়ে "পাওয়া" বস্তা)। গোনা হয়, কিন্তু মূল্য বসে না, আর **পরের কেনা কখনো এদের দাম দিয়ে দেয় না**।

উদাহরণ: হাতে ৩০ বস্তা ৬৭০ টাকায় (২০,১০০), নতুন কেনা ১০০ বস্তা ৫৮০ টাকায় (৫৮,০০০) → ১৩০ বস্তা, ৭৮,১০০ টাকা, গড় **৬০০.৭৬৯২৩১**। এরপর ৫০ বস্তা ডেলিভারি হলে তার ক্রয়মূল্য **৩০,০৩৮.৪৬**, আর বাকি ৮০ বস্তার মূল্য ৪৮,০৬১.৫৪।

- **ডেলিভারির খরচ জমে যায়**: লাইনে `unit_cost`/`cost_amount` বসে যায় এবং পরের কেনা তা কখনো বদলায় না।
- **হিসাবের ক্রম ব্যবসার তারিখ অনুযায়ী** (একই দিনে হলে এন্ট্রির ক্রমে)। ১ জানুয়ারির কেনা ১০ জানুয়ারি টাইপ করলেও ৫ জানুয়ারির ডেলিভারির আগেই গোনা হয়।
- **পুরনো কেনা সংশোধন বা বাতিল হলে** পুরনো ডেলিভারির জমা খরচ বদলানো হয় না; পুরো ইতিহাস আবার হিসাব করে পার্থক্যটা আজকের তারিখে একটা সংশোধন হিসেবে বসে (`inventory_cost_corrections`) — যেভাবে এই সিস্টেমে সব উল্টো এন্ট্রি বাতিলের তারিখে বসে। ফলে বন্ধ হয়ে যাওয়া মাসের রিপোর্ট আর বদলায় না।
- **কেনা বাতিল হলে** বস্তাগুলো যে দামে ঢুকেছিল সেই দামেই বের হয়, আজকের গড়ে নয়।
- **ডেলিভারি বাতিল বা কমলে** বস্তা যে দামে বেরিয়েছিল ঠিক সেই দামেই ফেরত ঢোকে, তাই গড় অপরিবর্তিত থাকে।
- **ব্যবসার তারিখের ক্রমে স্টক ঋণাত্মক হয়ে গেলে** (যে কেনা মাল দিয়েছে তার আগের তারিখে ডেলিভারি) কাজটা 409 `BACKDATED_STOCK_NEGATIVE` দিয়ে আটকে যায় (`details`: `productId`, `date`, `shortfall`) — আন্দাজে কোনো দাম বসানো হয় না।

পুরনো ডেটায় খরচ বসাতে: `npm run inventory:cost-backfill -- --dry-run` (কিছু লেখে না, রিপোর্ট দেয়), তারপর দেখে নিয়ে `-- --commit`। migration শুধু খালি ঘর যোগ করে, নিজে কোনো হিসাব করে না।

## ১৫. ত্রুটির রূপ ও কোড

### রূপ

সব ত্রুটিতে আগের ফিল্ডগুলো (`statusCode`, `error`, `message`) অপরিবর্তিত, সাথে যোগ হয়েছে:

- **`code`**: স্থির, মেশিন-পড়ার মতো নাম (`UPPER_SNAKE`)। **সব** ত্রুটিতে থাকে। বার্তার ভাষা বদলালেও code বদলায় না; frontend বার্তা বাছবে `code` দেখে।
- **`field`**: ত্রুটিটা একটা ঘরের হলে সেই ঘরের নাম (request body-র key; ভেতরের ঘর dot দিয়ে, যেমন `proposedChange.creditLimit`; header হলে `Idempotency-Key`)। ঘরের নয় এমন ত্রুটিতে থাকে না।
- **`errors[]`**: ঘরের ত্রুটি থাকলে সবসময়, প্রতিটা `{ field, code, message }`। form-এ ঘরের নিচে বার্তা দেখাতে শুধু এটাই পড়ুন।

একটা ব্যবসার নিয়মের ত্রুটি (এক ঘর):

```json
{
  "statusCode": 409,
  "error": "Conflict",
  "message": "A customer with this phone number already exists",
  "code": "PHONE_DUPLICATE",
  "field": "phone",
  "errors": [
    { "field": "phone", "code": "PHONE_DUPLICATE", "message": "A customer with this phone number already exists" }
  ]
}
```

form-এর কাঠামোর ত্রুটি (`message` আগের মতোই স্ট্রিংয়ের তালিকা; প্রতি ঘরে `errors[]`-এ একটা এন্ট্রি):

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": [
    "property defaultDiscount should not exist",
    "nameEn should not be empty",
    "phone must be shorter than or equal to 20 characters",
    "phone must be a string"
  ],
  "code": "VALIDATION_FAILED",
  "errors": [
    { "field": "defaultDiscount", "code": "DEFAULT_DISCOUNT_NOT_ALLOWED", "message": "property defaultDiscount should not exist" },
    { "field": "nameEn", "code": "NAME_EN_REQUIRED", "message": "nameEn should not be empty" },
    { "field": "phone", "code": "PHONE_INVALID", "message": "phone must be a string" }
  ]
}
```

ঘর ছাড়া ত্রুটি:

```json
{ "message": "Access denied", "error": "Forbidden", "statusCode": 403, "code": "ACCESS_DENIED" }
```

- `message` ইংরেজিতে, ডেভেলপারের জন্য। ইউজারকে দেখানোর বাংলা ও ইংরেজি বার্তা frontend-এর অনুবাদ ফাইলে `code` অনুযায়ী রাখুন; অজানা code এলে `statusCode` অনুযায়ী সাধারণ বার্তা।
- ত্রুটিতে কখনো অন্য ইউজার বা অন্য রেকর্ডের তথ্য (id, নাম, ফোন, ইমেইল) থাকে না। অন্য ব্যবসার id আর না-থাকা id-র উত্তর হুবহু এক। লগইনের সব ব্যর্থতায় একই `INVALID_CREDENTIALS`।

### form-এর কাঠামোর code (`VALIDATION_FAILED`-এর `errors[]`-এ)

রূপ `<ঘর>_<সমস্যা>`; ঘরের নাম `camelCase` থেকে `UPPER_SNAKE` (`nameEn` → `NAME_EN`, `proposedChange.creditLimit` → `CREDIT_LIMIT`)। প্রতি ঘরে একটাই code: আগে `REQUIRED`, তারপর `INVALID`, তারপর বাকিগুলো।

| সমস্যা | কখন আসে | উদাহরণ |
|---|---|---|
| `REQUIRED` | ঘরটা বাধ্যতামূলক কিন্তু খালি বা নেই | `NAME_EN_REQUIRED`, `REASON_REQUIRED`, `NOTE_REQUIRED` |
| `INVALID` | ধরন বা রূপ ভুল (সংখ্যার জায়গায় লেখা, টাকা `"570.50"` রূপে নয়, ভুল uuid, তালিকার বাইরের মান) | `PHONE_INVALID`, `CREDIT_LIMIT_INVALID`, `CATEGORY_ID_INVALID`, `KIND_INVALID` |
| `TOO_SHORT` | নির্দিষ্ট অক্ষরের চেয়ে ছোট | `REASON_TOO_SHORT` (৩), `NOTE_TOO_SHORT` (৩) |
| `TOO_LONG` | নির্দিষ্ট অক্ষরের চেয়ে বড় | `NAME_EN_TOO_LONG` (১২০), `REASON_TOO_LONG` (৫০০) |
| `TOO_SMALL` | সংখ্যা সর্বনিম্নের নিচে | `PAGE_TOO_SMALL` |
| `TOO_LARGE` | সংখ্যা সর্বোচ্চের উপরে | `SORT_ORDER_TOO_LARGE` (১০০০০) |
| `NOT_ALLOWED` | এই endpoint এই ঘর নেয় না | `DEFAULT_SALE_PRICE_NOT_ALLOWED` (পণ্যে বিক্রয়মূল্য নেই), `PURCHASE_PRICE_NOT_ALLOWED` / `LAST_PURCHASE_PRICE_NOT_ALLOWED` (কেনা-দাম শুধু কেনা থেকে) |

query string-এর ভুলও (`?page=0`) একই রূপে আসে, `field` হলো query-র নাম।

### ব্যবসার নিয়মের code

| code | status | `field` | কখন আসে |
|---|---|---|---|
| **সাধারণ** | | | |
| `VALIDATION_FAILED` | 400 | - (`errors[]`-এ ঘরগুলো) | form-এর কাঠামো ভুল (উপরের টেবিল) |
| `BAD_REQUEST` | 400 | - | অন্য কোনো ভুল অনুরোধ (যেমন ভাঙা JSON) |
| `ID_INVALID` | 400 | - | পথের id (`/products/:id`) সঠিক uuid নয় |
| `NOTHING_TO_CHANGE` | 400 | - | সংশোধনে পাঠানো সব মান আগের মতোই |
| `REASON_REQUIRED` | 400 | `reason` | দাম, বাকি, সীমা বা সক্রিয়-অবস্থা বদলে কারণ লেখা হয়নি |
| `UNAUTHENTICATED` | 401 | - | লগইন নেই বা সেশন শেষ (একবার refresh, অংশ ৩) |
| `ACCESS_DENIED` | 403 | - | এই কাজ বা ব্যবসার অনুমতি নেই |
| `ORIGIN_NOT_ALLOWED` | 403 | - | অবিশ্বস্ত ওয়েবসাইট থেকে বদলানোর অনুরোধ (কনফিগারেশনের ভুল) |
| `NOT_FOUND` | 404 | - | জিনিসটা নেই (নির্দিষ্ট code না থাকলে) |
| `ROUTE_NOT_FOUND` | 404 | - | এমন কোনো API পথ নেই |
| `CONFLICT` | 409 | - | অন্য কোনো সংঘাত (নির্দিষ্ট code না থাকলে) |
| `RATE_LIMITED` | 429 | - | অল্প সময়ে বেশি চেষ্টা; `Retry-After` সেকেন্ড পর্যন্ত অপেক্ষা |
| `SERVICE_UNAVAILABLE` | 503 | - | ডাটাবেস পাওয়া যাচ্ছে না, সার্ভার সাময়িক বন্ধ |
| `INTERNAL_ERROR` | 500 | - | অপ্রত্যাশিত ত্রুটি |
| **লগইন ও পাসওয়ার্ড** | | | |
| `INVALID_CREDENTIALS` | 401 | - | লগইন ব্যর্থ (ভুল পাসওয়ার্ড, অজানা ইউজার, নিষ্ক্রিয় বা লক, সবই একই) |
| `CURRENT_PASSWORD_INCORRECT` | 400 | `currentPassword` | পাসওয়ার্ড বদলে বর্তমান পাসওয়ার্ড ভুল |
| `PASSWORD_TOO_SHORT` | 400 | `password` / `newPassword` | নতুন পাসওয়ার্ড ১০ অক্ষরের কম |
| `PASSWORD_TOO_LONG` | 400 | `password` / `newPassword` | নতুন পাসওয়ার্ড ১২৮ অক্ষরের বেশি |
| `PASSWORD_MATCHES_IDENTITY` | 400 | `password` / `newPassword` | পাসওয়ার্ড ইউজারের নিজের ইমেইল বা ফোন |
| **Settings: ইউজার ও রোল** | | | |
| `USER_NOT_FOUND` | 404 | - | ইউজার নেই বা এই ব্যবসার নয়; খোঁজে কেউ মেলেনি |
| `USER_ALREADY_EXISTS` | 409 | - | এই ইমেইল বা ফোনের ইউজার আগে থেকে আছে (কে, তা বলা হয় না; `users/lookup` দিয়ে খুঁজুন) |
| `EMAIL_OR_PHONE_REQUIRED` | 400 | - | নতুন ইউজারে ইমেইল ও ফোন দুটোই নেই |
| `PHONE_INVALID` | 400 | `phone` | ফোন নম্বর বাংলাদেশের সঠিক মোবাইল নম্বর নয় |
| `ROLE_NOT_FOUND` | 400 / 404 | `roleKey` (400-এ) | অজানা রোল |
| `OWNER_ROLE_FIXED` | 400 | - | `owner` রোলের অনুমতি বদলানোর চেষ্টা |
| `PERMISSION_UNKNOWN` | 400 | `permissions` | তালিকায় অজানা অনুমতি (বা এই ধরনের ব্যবসায় প্রযোজ্য নয়) |
| `PERMISSION_OWNER_ONLY` | 400 | `permissions` | owner-only অনুমতি রোলে দেওয়ার চেষ্টা |
| `OWN_STATUS_CHANGE_FORBIDDEN` | 400 | - | নিজেকে নিষ্ক্রিয় বা সক্রিয় করার চেষ্টা |
| `PLATFORM_OWNER_PROTECTED` | 400 | - | platform owner অ্যাকাউন্ট এই API দিয়ে বদলানোর চেষ্টা |
| **মাস্টার ডেটা** | | | |
| `NAME_EN_DUPLICATE` | 409 | `nameEn` | এই ব্যবসায় একই ইংরেজি নামের পণ্য বা ক্যাটাগরি আছে (ছোট-বড় হাতের অক্ষর আলাদা ধরা হয় না) |
| `PHONE_DUPLICATE` | 409 | `phone` | এই ব্যবসায় একই ফোনের গ্রাহক আছে |
| `RECORD_DUPLICATE` | 409 | - | অন্য কোনো একই-রকম রেকর্ড আছে |
| `CATEGORY_NOT_FOUND_OR_INACTIVE` | 400 | `categoryId` | পণ্যের ক্যাটাগরি নেই বা নিষ্ক্রিয় |
| `UNIT_UNKNOWN` | 400 | `unitKey` | ব্যবসার Settings-এ এই একক নেই |
| `PRODUCT_NOT_FOUND` | 404 | - | পণ্য নেই (বা অন্য ব্যবসার) |
| `CATEGORY_NOT_FOUND` | 404 | - | ক্যাটাগরি নেই (বা অন্য ব্যবসার) |
| `CUSTOMER_NOT_FOUND` | 404 | - | গ্রাহক নেই (বা অন্য ব্যবসার) |
| `SUPPLIER_NOT_FOUND` | 404 | - | সরবরাহকারী নেই (বা অন্য ব্যবসার) |
| **কেনা ও স্টক** (অংশ ১০) | | | |
| `PURCHASE_NOT_FOUND` | 404 | - | কেনা নেই (বা অন্য ব্যবসার) |
| `PRODUCT_DUPLICATE` | 400 | `items.<n>.productId` | এক কেনায় একই পণ্য দুবার |
| `PRODUCT_NOT_FOUND_OR_INACTIVE` | 400 | `items.<n>.productId` | কেনার লাইনের পণ্য নেই, নিষ্ক্রিয় বা অন্য ব্যবসার |
| `QUANTITY_INVALID` | 400 | `items.<n>.quantity` / `quantity` / `proposedChange.items.<id>.quantity` | পরিমাণ শূন্য, বা এককের দশমিক নিয়ম ভাঙে (বস্তা পূর্ণসংখ্যা) |
| `UNIT_PRICE_INVALID` | 400 | `items.<id>.unitPrice` (অনুরোধে `proposedChange.` সামনে) | সংশোধনের দাম টাকার রূপে নয় |
| `SUPPLIER_NOT_FOUND_OR_INACTIVE` | 400 | `supplierId` (প্রিন্সিপাল না থাকলে নেই) | সরবরাহকারী নেই বা নিষ্ক্রিয় |
| `PURCHASE_DATE_INVALID` | 400 | `purchaseDate` | ক্যালেন্ডারে নেই এমন তারিখ (যেমন ৩০ ফেব্রুয়ারি) |
| `PURCHASE_DATE_IN_FUTURE` | 400 | `purchaseDate` | আজকের (ব্যবসার সময়-অঞ্চলে) পরের তারিখ |
| `PURCHASE_DATE_TOO_OLD` | 400 | `purchaseDate` | `purchase.edit` ছাড়া শেষ ৭ দিনের (Settings) আগের তারিখ |
| `PURCHASE_ALREADY_VOID` | 409 | - | বাতিল কেনা আবার বাতিল বা সংশোধনের চেষ্টা |
| `STOCK_INSUFFICIENT` | 409 | সংশোধনে `items.<id>.quantity`, সমন্বয়ে `quantity`, বাতিলে নেই | স্টক শূন্যের নিচে নামত; `details`: `productId`, `available`, `required` |
| `ADJUSTMENT_APPROVAL_REQUIRED` | 403 | `quantity` | আজ এই পণ্যে নিজের সমন্বয়ের মোট দৈনিক সীমা পার; `details`: `limit`, `usedToday`; অনুরোধ পাঠাতে হবে |
| `ADJUST_BY_INVALID` | 400 | `proposedChange.adjustBy` | বড় সমন্বয়ের অনুরোধে পরিমাণ শূন্য বা এককের নিয়ম ভাঙে |
| `NOTE_INVALID` / `SUPPLIER_REFERENCE_INVALID` | 400 | `proposedChange.note` / `.supplierReference` | অনুরোধে লেখা খুব লম্বা বা লেখা নয় |
| **অর্ডার, ডেলিভারি ও আদায়** (অংশ ১১) | | | |
| `ORDER_NOT_FOUND` | 404 | `orderId` (body-তে থাকলে) | অর্ডার নেই, অন্য ব্যবসার, বা (বিক্রয়কর্মীর) অন্যের অর্ডার |
| `DELIVERY_NOT_FOUND` | 404 | - | ডেলিভারি নেই বা অন্য ব্যবসার |
| `COLLECTION_NOT_FOUND` | 404 | - | আদায় নেই বা অন্য ব্যবসার |
| `CUSTOMER_NOT_FOUND` | 404 | `customerId` | আদায়ে বা খাতায় গ্রাহক নেই (বা অন্য ব্যবসার) |
| `CUSTOMER_NOT_FOUND_OR_INACTIVE` | 400 | `customerId` | অর্ডারে গ্রাহক নেই বা নিষ্ক্রিয় |
| `DELIVER_BY_INVALID` | 400 | `deliverBy` | প্রতিশ্রুত তারিখ আসল নয় বা অর্ডারের আগে |
| `DELIVERY_WINDOW_INVALID` | 400 | `deliveryWindow` | সময়সীমা `today`, `two_days`, `one_week`-এর বাইরে |
| `ORDER_DATE_INVALID` / `_IN_FUTURE` / `_TOO_OLD` | 400 | `orderDate` | অর্ডারের তারিখ আসল নয় (বা প্রথম ডেলিভারির পরে) / ভবিষ্যৎ / ৭ দিনের আগের |
| `DELIVERY_DATE_INVALID` / `_IN_FUTURE` / `_TOO_OLD` | 400 | `deliveryDate` | ডেলিভারির তারিখ আসল নয় বা অর্ডারের আগে / ভবিষ্যৎ / ৭ দিনের আগের |
| `COLLECTION_DATE_INVALID` / `_IN_FUTURE` / `_TOO_OLD` | 400 | `collectionDate` | আদায়ের তারিখ আসল নয় / ভবিষ্যৎ / ৭ দিনের আগের |
| `ORDER_ITEM_NOT_FOUND` | 400 | `items.<n>.orderItemId` | ডেলিভারির লাইন এই অর্ডারের নয় |
| `ORDER_ITEM_DUPLICATE` | 400 | `items.<n>.orderItemId` | একই অর্ডার-লাইন এক ডেলিভারিতে দুবার |
| `DELIVERY_QUANTITY_TOO_LARGE` | 400 | `items.<n>.quantity` / `items.<id>.quantity` | অর্ডার-লাইনের বাকির বেশি; `details.remaining` |
| `ORDER_QUANTITY_TOO_SMALL` | 400 | `items.<id>.quantity` | অর্ডারের বস্তা ডেলিভারি-হওয়ার নিচে নামানো |
| `COLLECTION_METHOD_UNKNOWN` | 400 | `method` | পদ্ধতি ব্যবসার তালিকায় নেই |
| `AMOUNT_TOO_SMALL` / `AMOUNT_INVALID` | 400 | `amount` | আদায়ের টাকা শূন্য / সংশোধনে টাকার রূপ ভুল |
| `TRANSPORT_REFERENCE_INVALID` / `REFERENCE_INVALID` | 400 | অনুরোধের ঘর | লেখা খুব লম্বা |
| `CREDIT_LIMIT_EXCEEDED` | 409 | `items` | block মোডে ক্রেডিট সীমা পার; `details`: `creditLimit`, `balanceAfter` |
| `ORDER_ALREADY_VOID` | 409 | - | বাতিল অর্ডারে ডেলিভারি, সংশোধন বা বাতিল |
| `DELIVERY_ALREADY_VOID` | 409 | - | বাতিল ডেলিভারিতে সংশোধন বা বাতিল |
| `COLLECTION_ALREADY_VOID` | 409 | - | বাতিল আদায়ে সংশোধন বা বাতিল |
| `DELIVERY_EXISTS` | 409 | - | সক্রিয় ডেলিভারি থাকা অর্ডার বাতিল; আগে ডেলিভারি বাতিল করুন |
| **সংশোধনের অনুরোধ** (অংশ ১২) | | | |
| `ENTITY_TYPE_UNKNOWN` | 400 | `entityType` | এই ধরনের রেকর্ডের অনুরোধ হয় না |
| `VOID_NOT_SUPPORTED` | 400 | `kind` | এই রেকর্ড বাতিল হয় না; নিষ্ক্রিয় করুন |
| `PROPOSED_CHANGE_EMPTY` | 400 | `proposedChange` | বদলের অনুরোধে কোনো ঘর নেই |
| `PROPOSED_CHANGE_NOT_ALLOWED` | 400 | `proposedChange` | বাতিলের অনুরোধে প্রস্তাবিত মান পাঠানো হয়েছে |
| `FIELD_NOT_CHANGEABLE` | 400 | `proposedChange.<ঘর>` | এই ঘর অনুরোধে বদলানো যায় না (সরাসরি সম্পাদনা করুন) |
| `<ঘর>_INVALID` | 400 | `proposedChange.<ঘর>` | প্রস্তাবিত মানের রূপ ভুল: `OPENING_BALANCE_INVALID`, `CREDIT_LIMIT_INVALID`, `IS_ACTIVE_INVALID` |
| `IDEMPOTENCY_KEY_INVALID` | 400 | `Idempotency-Key` | header ৮–৬৪ অক্ষরের অক্ষর, সংখ্যা, `-` বা `_` নয় |
| `RECORD_NOT_FOUND` | 404 | `entityId` | যে রেকর্ডের অনুরোধ, তা নেই (বা অন্য ব্যবসার) |
| `CHANGE_REQUEST_NOT_FOUND` | 404 | - | অনুরোধ নেই, অন্য ব্যবসার, বা দেখার অনুমতি নেই |
| `CHANGE_REQUEST_PENDING_EXISTS` | 409 | - | এই রেকর্ডে আগেই একটা অপেক্ষমাণ অনুরোধ আছে; অনুরোধকারী সেটা খুলতে পারলে (নিজের, বা `change.view.all`) উত্তরে `changeRequestId` |
| `CHANGE_REQUEST_ALREADY_DECIDED` | 409 | - | অনুরোধ আর অপেক্ষমাণ নয় (অনুমোদিত, প্রত্যাখ্যাত, তুলে নেওয়া বা stale) |
| `SELF_DECISION_FORBIDDEN` | 403 | - | নিজের অনুরোধ নিজে অনুমোদন বা প্রত্যাখ্যান |
| `STALE_REQUEST` | 409 | - | অনুরোধের পরে রেকর্ড বদলেছে; অনুরোধ এখন stale, নতুন করে করতে হবে |
| `ENTITY_TYPE_UNSUPPORTED` | 409 | - | এই ধরনের রেকর্ড আর বদলানো যায় না (module সরানো হয়েছে) |
| `CHANGE_FIELD_UNSUPPORTED` | 409 | - | অনুরোধের কোনো ঘর আর নেই (যেমন সরানো বিক্রয়মূল্য) |
| **খরচ, ক্যাশ বই ও রিপোর্ট** (অংশ ১৩) | | | |
| `EXPENSE_METHOD_UNKNOWN` | 400 | `method` | পদ্ধতি ব্যবসার তালিকায় নেই |
| `EXPENSE_CATEGORY_NOT_FOUND_OR_INACTIVE` | 400 | `categoryId` | ধরন নেই, অন্য ব্যবসার, বা নিষ্ক্রিয় |
| `EXPENSE_DATE_INVALID` / `_IN_FUTURE` / `_TOO_OLD` | 400 | `expenseDate` | তারিখ আসল নয় / ভবিষ্যৎ / ৭ দিনের আগের |
| `FROM_INVALID` / `TO_INVALID` | 400 | `from` / `to` | তারিখ আসল নয়, বা `to` < `from` |
| `PREV_FROM_REQUIRED` / `PREV_TO_REQUIRED` | 400 | `prevFrom` / `prevTo` | তুলনার সময়ের একটা দিক পাঠানো হয়েছে, অন্যটা নয় |
| `PREV_FROM_INVALID` / `PREV_TO_INVALID` | 400 | `prevFrom` / `prevTo` | তারিখ আসল নয়, বা `prevTo` < `prevFrom` |
| `EXPENSE_NOT_FOUND` | 404 | - | খরচ নেই বা অন্য ব্যবসার |
| `EXPENSE_CATEGORY_NOT_FOUND` | 404 | - | ধরন নেই বা অন্য ব্যবসার |
| `EXPENSE_ALREADY_VOID` | 409 | - | বাতিল খরচে আবার বদল বা বাতিলের চেষ্টা |
| **হিসাব** (অংশ ১৪) | | | |
| `IDEMPOTENCY_KEY_REQUIRED` | 400 | `Idempotency-Key` | `accounts/entries` বা `accounts/payments`-এ header নেই |
| `LEDGER_ENTRY_METHOD_UNKNOWN` | 400 | `method` | পদ্ধতি ব্যবসার তালিকায় নেই |
| `ENTRY_DATE_INVALID` / `_IN_FUTURE` / `_TOO_OLD` | 400 | `entryDate` | তারিখ আসল নয় / ভবিষ্যৎ / ৭ দিনের আগের |
| `PAYMENT_DATE_INVALID` / `_IN_FUTURE` / `_TOO_OLD` | 400 | `paymentDate` | তারিখ আসল নয় / ভবিষ্যৎ / ৭ দিনের আগের |

429-এর আসল উত্তর (`Retry-After` header আগের মতোই):

```
HTTP/1.1 429 Too Many Requests
Retry-After: 60

{"statusCode":429,"message":"ThrottlerException: Too Many Requests","code":"RATE_LIMITED"}
```

---

## ১৬. রোল ও অনুমতি

### রোল

| `key` | `nameEn` | `nameBn` | কী পায় |
|---|---|---|---|
| `owner` | Owner | মালিক | owner-only ছাড়া সব অনুমতি; বদলানো যায় না |
| `manager` | Manager | ম্যানেজার | ডিফল্ট নিচের টেবিলে; মালিক বদলাতে পারেন |
| `accountant` | Accountant | হিসাবরক্ষক | ডিফল্ট নিচের টেবিলে; মালিক বদলাতে পারেন |
| `salesman` | Salesman | বিক্রয়কর্মী | ডিফল্ট নিচের টেবিলে; মালিক বদলাতে পারেন |

**platform owner** (`user.isPlatformOwner: true`) কোনো রোল নয়, ইউজারের বৈশিষ্ট্য: সব ব্যবসা, সব অনুমতি, owner-only সহ। ব্যবসা-স্তরের `owner` রোল (যেমন কোনো অংশীদার) owner-only অনুমতি **পায় না**।

রোল ব্যবসাভেদে আলাদা হতে পারে: একজন Akij-এ ম্যানেজার আর BSRM-এ হিসাবরক্ষক হতে পারেন। অনুমতিও ব্যবসাভেদে আলাদা হতে পারে (মালিক প্রতিটা ব্যবসার ছক আলাদা বদলান)।

### অনুমতির তালিকা

✓ = ডিফল্টে পায়। owner-only অনুমতি শুধু platform owner পান; কাউকে দেওয়া যায় না।

| অনুমতি | module | owner-only | manager | accountant | salesman | মানে |
|---|---|---|---|---|---|---|
| `settings.view` | core | | ✓ | ✓ | | ব্যবসার Settings দেখা |
| `settings.manage` | core | **হ্যাঁ** | | | | Settings বদলানো |
| `users.view` | core | | ✓ | | | ইউজারের তালিকা দেখা |
| `users.manage` | core | **হ্যাঁ** | | | | ইউজার তৈরি, রোল বদল, নিষ্ক্রিয়, রিসেট |
| `roles.manage` | core | **হ্যাঁ** | | | | রোলের অনুমতি দেখা ও বদলানো |
| `audit.view` | core | **হ্যাঁ** | | | | audit log দেখা (API পরে) |
| `change.request` | core | | ✓ | ✓ | ✓ | সংশোধন/বাতিলের অনুরোধ পাঠানো |
| `change.view.own` | core | | ✓ | ✓ | ✓ | নিজের অনুরোধ দেখা ও তুলে নেওয়া |
| `change.view.all` | core | | | | | সবার অনুরোধ দেখা, ব্যাজ |
| `change.approve` | core | | | | | অনুরোধ অনুমোদন ও প্রত্যাখ্যান (+ সংশ্লিষ্ট সরাসরি-অনুমতি) |
| `product.view` | dealership | | ✓ | | ✓ | পণ্য ও category দেখা |
| `product.manage` | dealership | | ✓ | | | পণ্য ও category বানানো, বদলানো |
| `product.cost.view` | dealership | | ✓ | | | কেনা-দাম দেখা, যেখানেই থাকুক (পণ্যের শেষ কেনা-দাম, পরে কেনার লাইন ও স্টকের মূল্য) |
| `product.deactivate` | dealership | | | | | পণ্য ও ক্যাটাগরি নিষ্ক্রিয়/সক্রিয় (কারণসহ) |
| `customer.view` | dealership | | ✓ | ✓ | ✓ | গ্রাহকের তালিকা |
| `customer.manage` | dealership | | ✓ | | ✓ | গ্রাহক যোগ ও বদল |
| `customer.due.view` | dealership | | ✓ | ✓ | | গ্রাহকের বাকি ও ক্রেডিট সীমা দেখা |
| `customer.balance.edit` | dealership | | | | | তৈরির পরে শুরুর বাকি ও ক্রেডিট সীমা বদল (কারণসহ) |
| `customer.deactivate` | dealership | | | | | গ্রাহক নিষ্ক্রিয়/সক্রিয় (কারণসহ) |
| `collection.create` | dealership | | ✓ | ✓ | | টাকা আদায়ের এন্ট্রি |
| `collection.view` | dealership | | ✓ | ✓ | | আদায় দেখা |
| `collection.edit` | dealership | | | | | আদায় সংশোধন সরাসরি বা অনুমোদন |
| `collection.void` | dealership | | | | | আদায় বাতিল সরাসরি বা অনুমোদন |
| `supplier.view` | dealership | | ✓ | | | সরবরাহকারী দেখা |
| `purchase.view` | dealership | | ✓ | | | কেনা দেখা (দাম শুধু `product.cost.view`-এ) |
| `purchase.create` | dealership | | ✓ | | | কেনার এন্ট্রি, নোট ও রেফারেন্স সংশোধন |
| `purchase.edit` | dealership | | | | | কেনার তারিখ, বস্তা, দাম সংশোধন সরাসরি বা অনুমোদন; ৭ দিনের বেশি পুরনো তারিখে কেনা |
| `purchase.void` | dealership | | | | | কেনা বাতিল সরাসরি বা অনুমোদন |
| `stock.view` | dealership | | ✓ | | ✓ | স্টকের পরিমাণ ও ইতিহাস (দাম নয়) |
| `stock.adjust` | dealership | | ✓ | | | দৈনিক সীমার মধ্যে স্টক সমন্বয় |
| `stock.adjust.large` | dealership | | | | | সীমা ছাড়া সমন্বয়, বড় সমন্বয়ের অনুমোদন |
| `sale.create` | dealership | | ✓ | | ✓ | গ্রাহকের অর্ডার তৈরি |
| `sale.view.all` | dealership | | ✓ | | | সব অর্ডার দেখা |
| `sale.view.own` | dealership | | | | ✓ | শুধু নিজের অর্ডার দেখা |
| `sale.edit` | dealership | | | | | অর্ডার সংশোধন (দাম, বস্তা, তারিখ, সময়সীমা) সরাসরি বা অনুমোদন |
| `sale.void` | dealership | | | | | অর্ডার বাতিল সরাসরি বা অনুমোদন |
| `delivery.view` | dealership | | ✓ | | | ডেলিভারি দেখা |
| `delivery.create` | dealership | | ✓ | | | ডেলিভারি দেওয়া |
| `delivery.edit` | dealership | | | | | ডেলিভারি সংশোধন সরাসরি বা অনুমোদন |
| `delivery.void` | dealership | | | | | ডেলিভারি বাতিল সরাসরি বা অনুমোদন |
| `delivery.credit.override` | dealership | | | | | block মোডে ক্রেডিট সীমা পার হয়েও ডেলিভারি |
| `ledger.view` | dealership | | | ✓ | | খাতা দেখা |
| `ledger.entry.create` | dealership | | | ✓ | | খাতায় এন্ট্রি |
| `payment.create` | dealership | | | ✓ | | পেমেন্ট এন্ট্রি |
| `expense.view` | dealership | | ✓ | ✓ | | খরচ দেখা |
| `expense.create` | dealership | | ✓ | ✓ | | খরচ এন্ট্রি |
| `expense.edit` | dealership | | | | | খরচ সংশোধন সরাসরি বা অনুমোদন |
| `expense.void` | dealership | | | | | খরচ বাতিল সরাসরি বা অনুমোদন |
| `expense.category.manage` | dealership | | ✓ | | | খরচের ধরন তৈরি, বদল, নিষ্ক্রিয়/সক্রিয় |
| `cashbook.view` | dealership | | ✓ | ✓ | | দৈনিক ক্যাশ বই দেখা |
| `report.view` | dealership | | ✓ | ✓ | | বিক্রয়/আদায়/বাকি/স্টক/খরচ/দৈনিক সারাংশ রিপোর্ট দেখা |
| `summary.finance.view` | dealership | | | | | মোট আয়ের সারাংশ (ভবিষ্যতের ধাপ) |
| `reports.finance.view` | dealership | | | | | লাভ ও কমিশনের আর্থিক রিপোর্ট (ভবিষ্যতের ধাপ) |
| `commission.view` | dealership | **হ্যাঁ** | | | | কমিশনে পাওয়া টাকার তালিকা ও সারাংশ দেখা |
| `commission.manage` | dealership | **হ্যাঁ** | | | | কমিশনে পাওয়া টাকা (পরিমাণ, তারিখ, কারণ) যোগ ও সংশোধন |
| `profit.view` | dealership | **হ্যাঁ** | | | | লাভ দেখা |

`dealership` module-এর অনুমতি শুধু `type: "dealership"` ব্যবসায় প্রযোজ্য; ভবিষ্যতের অন্য ধরনের ব্যবসা (যেমন manufacturing) নিজের অনুমতি আনবে। এখন পর্যন্ত মাস্টার ডেটা, কেনা ও স্টক (অংশ ১০), অর্ডার, ডেলিভারি ও আদায় (অংশ ১১), খরচ, ক্যাশ বই ও রিপোর্ট (অংশ ১৩), আর Akij কমিশনে পাওয়া টাকা ও কারণ (অংশ ১০-এর শেষে) তৈরি হয়েছে; `summary.finance.view` ও `reports.finance.view` ভবিষ্যতের লাভের ধাপের জন্য আগে থেকে ঘোষণা করা আছে, এখনো কোনো endpoint নেই।

তৈরির পরে বাকি বা সীমা বদল আর নিষ্ক্রিয় করার তিনটা অনুমতি (`customer.balance.edit`, `product.deactivate`, `customer.deactivate`), কেনার সংশোধন ও বাতিল (`purchase.edit`, `purchase.void`), বড় স্টক সমন্বয় (`stock.adjust.large`), অর্ডার, ডেলিভারি ও আদায়ের সংশোধন ও বাতিল (`sale.edit`, `sale.void`, `delivery.edit`, `delivery.void`, `collection.edit`, `collection.void`), খরচের সংশোধন ও বাতিল (`expense.edit`, `expense.void`), ক্রেডিট সীমা পারের অনুমতি (`delivery.credit.override`), আর `change.view.all` ও `change.approve`, কোনো স্টাফ রোলের ডিফল্টে নেই; ব্যবসা-স্তরের `owner` রোল ও platform owner এগুলো পান (owner-only নয়, তাই মালিক চাইলে কাউকে দিতে পারেন)। স্টাফ এসব বদল অনুরোধের মাধ্যমে করেন (অংশ ১২)।

### frontend-এ কীভাবে ব্যবহার করবেন

- ব্যবসার কার্ড ও switcher: `me.businesses`।
- বর্তমান ব্যবসার অনুমতি: `me.businesses.find(b => b.slug === slug).permissions`। sidebar-এর মেনু, বাটন ও কলাম দেখানো বা লুকানো এখান থেকে, যেমন `permissions.includes('sale.create')`।
- এটা শুধু দেখানোর সুবিধার জন্য। **আসল যাচাই সার্ভারে**: অনুমতি না থাকলে API 403 দেয়, আর টাকার সংবেদনশীল ফিল্ড (কমিশন, লাভ, কেনা-দাম) response-এ পাঠায়ই না।
- অনুমতি বা রোল বদলালে সার্ভারে সঙ্গে সঙ্গে কার্যকর হয়; frontend-এ হালনাগাদ দেখতে `me` আবার আনুন (যেমন ব্যবসা বদলানোর সময় বা Settings-এ সেভের পর)।
