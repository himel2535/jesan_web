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
10. [সংশোধনের অনুরোধ ও অনুমোদন](#১০-সংশোধনের-অনুরোধ-ও-অনুমোদন)
11. [ত্রুটির রূপ ও কোড](#১১-ত্রুটির-রূপ-ও-কোড)
12. [রোল ও অনুমতি](#১২-রোল-ও-অনুমতি)

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
| POST | `/b/:businessSlug/change-requests/preview` | হ্যাঁ | `change.request` বা `change.approve` | 200 |
| POST | `/b/:businessSlug/change-requests` | হ্যাঁ | `change.request` (+ রেকর্ড দেখার অনুমতি) | 201 (একই `Idempotency-Key` আবার: 200) |
| GET | `/b/:businessSlug/change-requests/mine?status=&page=` | হ্যাঁ | `change.view.own` | 200 |
| GET | `/b/:businessSlug/change-requests?status=&entityType=&entityId=&requestedBy=&from=&to=&page=` | হ্যাঁ | `change.view.all` | 200 |
| GET | `/b/:businessSlug/change-requests/pending-count` | হ্যাঁ | `change.view.all` | 200 |
| GET | `/b/:businessSlug/change-requests/:id` | হ্যাঁ | নিজের হলে `change.view.own`, নইলে `change.view.all` | 200 |
| POST | `/b/:businessSlug/change-requests/:id/approve` | হ্যাঁ | `change.approve` + সংশ্লিষ্ট সরাসরি-অনুমতি; নিজের নয় | 200 |
| POST | `/b/:businessSlug/change-requests/:id/reject` | হ্যাঁ | `change.approve`; নিজের নয় | 200 |
| POST | `/b/:businessSlug/change-requests/:id/cancel` | হ্যাঁ | `change.view.own`; শুধু নিজের | 200 |

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
- এক IP থেকে প্রতি মিনিটে ১০টার বেশি চেষ্টায় **429** (অংশ ১১)।
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
        "commission.manage",
        "commission.view",
        "customer.balance.edit",
        "customer.deactivate",
        "customer.due.view",
        "customer.manage",
        "customer.view",
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
        "purchase.view",
        "purchase.void",
        "reports.finance.view",
        "roles.manage",
        "sale.create",
        "sale.view.all",
        "sale.view.own",
        "sale.void",
        "settings.manage",
        "settings.view",
        "stock.adjust",
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
        "customer.due.view",
        "customer.manage",
        "customer.view",
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

ত্রুটি: বর্তমান পাসওয়ার্ড ভুল হলে 400 `CURRENT_PASSWORD_INCORRECT` (`currentPassword`); নতুন পাসওয়ার্ড নিয়ম না মানলে 400 `PASSWORD_TOO_SHORT` / `PASSWORD_TOO_LONG` / `PASSWORD_MATCHES_IDENTITY` (`newPassword`)। সব code অংশ ১১-এ।

**পাসওয়ার্ডের নিয়ম:** ১০ থেকে ১২৮ অক্ষর; ইউজারের নিজের email বা phone হতে পারবে না; চিহ্ন বা বড় হাতের অক্ষর বাধ্যতামূলক নয়।

**forgot-password এখন নেই।** পাসওয়ার্ড ভুলে গেলে মালিক Settings থেকে `reset-password` দিয়ে নতুন পাসওয়ার্ড বসাবেন।

---

## ৮. Settings API

সব পথ `/api/v1/b/:businessSlug/...`। ছক দেখা ও সব বদল শুধু **platform owner** পারেন (owner-only অনুমতি); ইউজারের তালিকা দেখতে `users.view` যথেষ্ট (ম্যানেজারের ডিফল্টে আছে)। প্রতিটা বদল সার্ভারের audit log-এ লেখা হয় এবং সঙ্গে সঙ্গে কার্যকর হয়।

### `GET roles/permissions`: রোল × অনুমতির ছক

- `permissions`: এই ব্যবসার ধরনে প্রযোজ্য সব অনুমতি, কোডে ঘোষণার ক্রমে (Settings পাতার সারির ক্রম হিসেবে ব্যবহার করুন)। `ownerOnly: true` মানে কোনো রোলকে দেওয়া যায় না (ছকে ওই সারি নিষ্ক্রিয় দেখান)।
- `roles`: চারটা রোল, Settings-এর কলামের ক্রমে। প্রতিটায় চালু অনুমতির তালিকা।
- `locked: true` (শুধু `owner` রোলে): এই রোলের অনুমতি বদলানো যায় না; সবসময় সব owner-only-বহির্ভূত অনুমতি।

Response 200 (`permissions` সংক্ষিপ্ত; আসলে ৩৯টা, অংশ ১২-এর টেবিলে সব):

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
      "permissions": ["collection.create", "customer.due.view", "...", "users.view"]
    },
    {
      "key": "manager",
      "nameEn": "Manager",
      "nameBn": "ম্যানেজার",
      "locked": false,
      "permissions": ["collection.create", "customer.due.view", "...", "users.view"]
    },
    {
      "key": "accountant",
      "nameEn": "Accountant",
      "nameBn": "হিসাবরক্ষক",
      "locked": false,
      "permissions": ["collection.create", "customer.due.view", "customer.view", "expense.create", "ledger.entry.create", "ledger.view", "payment.create", "settings.view"]
    },
    {
      "key": "salesman",
      "nameEn": "Salesman",
      "nameBn": "বিক্রয়কর্মী",
      "locked": false,
      "permissions": ["customer.manage", "customer.view", "product.view", "sale.create", "sale.view.own", "stock.view"]
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
- **সংবেদনশীল সংশোধন:** তৈরির পরে শুরুর বাকি, ক্রেডিট সীমা বদলানো আর নিষ্ক্রিয়/সক্রিয় করা শুধু মালিক-স্তরের (platform owner ও `owner` রোল; অনুমতি `product.deactivate`, `customer.balance.edit`, `customer.deactivate`)। পণ্যে কোনো দাম হাতে বসানো বা বদলানো যায় না। এতে body-তে `reason` (৩-৫০০ অক্ষর) বাধ্যতামূলক, আর audit log-এ আগের ও পরের মান লেখা হয়। নাম, ঠিকানা, ফোন, ক্যাটাগরির বদল `product.manage` / `customer.manage` দিয়েই চলে। ম্যানেজার সংবেদনশীল বদলের জন্য "সংশোধনের অনুরোধ" পাঠান (অংশ ১০)।
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

**শেষ কেনা-দাম শুধু-পড়া।** `lastPurchasePrice` (টাকার স্ট্রিং) আর `lastPurchasedAt` (ISO সময়) হলো শেষ বৈধ কেনার দাম ও সময়। কেনা নিশ্চিত হলে একই transaction-এ বসে; কেনা বাতিল বা সংশোধন হলে শেষ বৈধ কেনা থেকে আবার হিসাব হয় (কেনা আসবে Step 5a-তে)। কোনো কেনা না হলে দুটোই `null`; দুটো সবসময় একসাথে থাকে বা একসাথে `null`। তৈরি বা সম্পাদনায় কেনা-দাম নেওয়া হয় না: `purchasePrice` পাঠালে 400 `PURCHASE_PRICE_NOT_ALLOWED`, `lastPurchasePrice` পাঠালে 400 `LAST_PURCHASE_PRICE_NOT_ALLOWED`। কেনার ভুল দাম ঠিক হবে কেনার রেকর্ডের সংশোধনে (`purchase.edit`, অংশ ১০-এর অনুরোধ)।

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

- বিক্রয়কর্মীর উত্তরে `openingBalance`, `currentBalance`, `creditLimit` **নেই**।
- বাকি: ধনাত্মক = গ্রাহক আমাদের কাছে দেনা; **ঋণাত্মক = অগ্রিম** (আমরা তার কাছে দেনা)।
- `currentBalance` সার্ভার নিজে হালনাগাদ রাখে (পরের ধাপে বিক্রি ও আদায়ে); frontend কখনো হিসাব করবে না।
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

## ১০. সংশোধনের অনুরোধ ও অনুমোদন

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

## ১১. ত্রুটির রূপ ও কোড

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
| **সংশোধনের অনুরোধ** (অংশ ১০) | | | |
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

429-এর আসল উত্তর (`Retry-After` header আগের মতোই):

```
HTTP/1.1 429 Too Many Requests
Retry-After: 60

{"statusCode":429,"message":"ThrottlerException: Too Many Requests","code":"RATE_LIMITED"}
```

---

## ১২. রোল ও অনুমতি

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
| `collection.create` | dealership | | ✓ | ✓ | | বাকি আদায়ের এন্ট্রি |
| `supplier.view` | dealership | | ✓ | | | সরবরাহকারী দেখা |
| `purchase.view` | dealership | | ✓ | | | কেনা দেখা |
| `purchase.create` | dealership | | ✓ | | | কেনার এন্ট্রি |
| `purchase.void` | dealership | | | | | কেনা বাতিল |
| `stock.view` | dealership | | ✓ | | ✓ | স্টকের পরিমাণ (দাম নয়) |
| `stock.adjust` | dealership | | ✓ | | | স্টক adjustment |
| `sale.create` | dealership | | ✓ | | ✓ | বিক্রির invoice |
| `sale.view.all` | dealership | | ✓ | | | সব বিক্রি দেখা |
| `sale.view.own` | dealership | | | | ✓ | শুধু নিজের বিক্রি দেখা |
| `sale.void` | dealership | | | | | বিক্রি বাতিল |
| `ledger.view` | dealership | | | ✓ | | খাতা দেখা |
| `ledger.entry.create` | dealership | | | ✓ | | খাতায় এন্ট্রি |
| `payment.create` | dealership | | | ✓ | | পেমেন্ট এন্ট্রি |
| `expense.create` | dealership | | | ✓ | | খরচ এন্ট্রি |
| `summary.finance.view` | dealership | | | | | মোট আয়ের সারাংশ |
| `reports.finance.view` | dealership | | | | | আর্থিক রিপোর্ট |
| `commission.view` | dealership | **হ্যাঁ** | | | | কমিশন দেখা |
| `commission.manage` | dealership | **হ্যাঁ** | | | | কমিশন scheme |
| `profit.view` | dealership | **হ্যাঁ** | | | | লাভ দেখা |

`dealership` module-এর অনুমতি শুধু `type: "dealership"` ব্যবসায় প্রযোজ্য; ভবিষ্যতের অন্য ধরনের ব্যবসা (যেমন manufacturing) নিজের অনুমতি আনবে। এখন পর্যন্ত মাস্টার ডেটা (পণ্য, গ্রাহক, সরবরাহকারী) তৈরি হয়েছে; কেনা, বিক্রি, স্টক, খাতা ও কমিশনের অনুমতি আগে থেকে ঘোষণা করা আছে, যাতে Settings-এর ছক এখনই তৈরি করা যায়।

তৈরির পরে বাকি বা সীমা বদল আর নিষ্ক্রিয় করার তিনটা অনুমতি (`customer.balance.edit`, `product.deactivate`, `customer.deactivate`), আর `change.view.all` ও `change.approve`, কোনো স্টাফ রোলের ডিফল্টে নেই; ব্যবসা-স্তরের `owner` রোল ও platform owner এগুলো পান (owner-only নয়, তাই মালিক চাইলে কাউকে দিতে পারেন)। স্টাফ এসব বদল অনুরোধের মাধ্যমে করেন (অংশ ১০)।

### frontend-এ কীভাবে ব্যবহার করবেন

- ব্যবসার কার্ড ও switcher: `me.businesses`।
- বর্তমান ব্যবসার অনুমতি: `me.businesses.find(b => b.slug === slug).permissions`। sidebar-এর মেনু, বাটন ও কলাম দেখানো বা লুকানো এখান থেকে, যেমন `permissions.includes('sale.create')`।
- এটা শুধু দেখানোর সুবিধার জন্য। **আসল যাচাই সার্ভারে**: অনুমতি না থাকলে API 403 দেয়, আর টাকার সংবেদনশীল ফিল্ড (কমিশন, লাভ, কেনা-দাম) response-এ পাঠায়ই না।
- অনুমতি বা রোল বদলালে সার্ভারে সঙ্গে সঙ্গে কার্যকর হয়; frontend-এ হালনাগাদ দেখতে `me` আবার আনুন (যেমন ব্যবসা বদলানোর সময় বা Settings-এ সেভের পর)।
