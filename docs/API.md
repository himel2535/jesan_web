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
9. [ত্রুটির রূপ ও কোড](#৯-ত্রুটির-রূপ-ও-কোড)
10. [রোল ও অনুমতি](#১০-রোল-ও-অনুমতি)

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
| তালিকা | প্রতি পাতায় ১০টা, `?page=1` থেকে শুরু |

- request body-তে অঘোষিত কোনো ফিল্ড পাঠালে 400 (`property x should not exist`)।
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
| POST | `/b/:businessSlug/users/:userId/access` | হ্যাঁ | `users.manage` (owner-only) | 200 |
| PATCH | `/b/:businessSlug/users/:userId/role` | হ্যাঁ | `users.manage` (owner-only) | 200 |
| DELETE | `/b/:businessSlug/users/:userId/access` | হ্যাঁ | `users.manage` (owner-only) | 204 |
| PATCH | `/b/:businessSlug/users/:userId/status` | হ্যাঁ | `users.manage` (owner-only) | 204 |
| POST | `/b/:businessSlug/users/:userId/reset-password` | হ্যাঁ | `users.manage` (owner-only) | 204 |

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
| ডাটাবেস পাওয়া যায় না | 503 | `{ "status": "error", "database": "down" }` |

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
- এক IP থেকে প্রতি মিনিটে ১০টার বেশি চেষ্টায় **429** (অংশ ৯)।
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
        "collection.create",
        "commission.manage",
        "commission.view",
        "customer.due.view",
        "customer.manage",
        "customer.view",
        "expense.create",
        "ledger.entry.create",
        "ledger.view",
        "payment.create",
        "product.cost.view",
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

ত্রুটি: বর্তমান পাসওয়ার্ড ভুল হলে 400 `Current password is incorrect`; নতুন পাসওয়ার্ড নিয়ম না মানলে 400 (নিচে)।

**পাসওয়ার্ডের নিয়ম:** ১০ থেকে ১২৮ অক্ষর; ইউজারের নিজের email বা phone হতে পারবে না; চিহ্ন বা বড় হাতের অক্ষর বাধ্যতামূলক নয়।

**forgot-password এখন নেই।** পাসওয়ার্ড ভুলে গেলে মালিক Settings থেকে `reset-password` দিয়ে নতুন পাসওয়ার্ড বসাবেন।

---

## ৮. Settings API

সব পথ `/api/v1/b/:businessSlug/...`। ছক দেখা ও সব বদল শুধু **platform owner** পারেন (owner-only অনুমতি); ইউজারের তালিকা দেখতে `users.view` যথেষ্ট (ম্যানেজারের ডিফল্টে আছে)। প্রতিটা বদল সার্ভারের audit log-এ লেখা হয় এবং সঙ্গে সঙ্গে কার্যকর হয়।

### `GET roles/permissions`: রোল × অনুমতির ছক

- `permissions`: এই ব্যবসার ধরনে প্রযোজ্য সব অনুমতি, কোডে ঘোষণার ক্রমে (Settings পাতার সারির ক্রম হিসেবে ব্যবহার করুন)। `ownerOnly: true` মানে কোনো রোলকে দেওয়া যায় না (ছকে ওই সারি নিষ্ক্রিয় দেখান)।
- `roles`: চারটা রোল, Settings-এর কলামের ক্রমে। প্রতিটায় চালু অনুমতির তালিকা।
- `locked: true` (শুধু `owner` রোলে): এই রোলের অনুমতি বদলানো যায় না; সবসময় সব owner-only-বহির্ভূত অনুমতি।

Response 200 (`permissions` সংক্ষিপ্ত; আসলে ৩২টা, অংশ ১০-এর টেবিলে সব):

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

ত্রুটি: `owner` রোল → 400; অজানা রোল → 404 `Unknown role`; অজানা অনুমতি → 400 `Unknown permission: x`; owner-only অনুমতি → 400 `"commission.view" is owner-only and cannot be given to a role`।

### `GET users?page=1`: ব্যবসার ইউজার

প্রতি পাতায় ১০ জন; `page` ১ থেকে শুরু।

```json
{
  "items": [
    {
      "id": "01a1e86e-9e22-720b-bd46-0235039e175b",
      "name": "Rahim Uddin",
      "email": "manager@example.com",
      "phone": "+8801712345678",
      "isActive": true,
      "lastLoginAt": "2026-11-17T07:35:26.027Z",
      "role": "manager"
    }
  ],
  "page": 1,
  "pageSize": 10,
  "total": 1
}
```

`lastLoginAt` কখনো লগইন না করলে `null`। মোট পাতা = `Math.ceil(total / pageSize)`।

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

ত্রুটি: একই email বা phone আগে থেকে থাকলে 409 `A user with this email or phone already exists; grant them access instead` (তখন নিচের `access` endpoint দিয়ে ওই ইউজারকে এই ব্যবসায় যোগ করুন); অজানা রোল 400 `Unknown role`; email ও phone কোনোটাই না থাকলে 400।

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

## ৯. ত্রুটির রূপ ও কোড

সব ত্রুটির রূপ একই:

```json
{ "message": "Access denied", "error": "Forbidden", "statusCode": 403 }
```

- `message` সাধারণত স্ট্রিং; **request body-র validation ত্রুটিতে স্ট্রিংয়ের তালিকা**:

```json
{
  "message": [
    "password must be shorter than or equal to 128 characters",
    "password should not be empty",
    "password must be a string"
  ],
  "error": "Bad Request",
  "statusCode": 400
}
```

- `message` ইংরেজিতে, ডেভেলপারের জন্য। ইউজারকে দেখানোর বার্তা frontend-এর অনুবাদ ফাইল থেকে `statusCode` অনুযায়ী বেছে নিন; `message`-এর লেখার উপর নির্ভর করবেন না।

| Status | কখন | উদাহরণ `message` | frontend কী করবে |
|---|---|---|---|
| 400 | ফর্মের ভুল, নিয়ম ভাঙা | তালিকা (উপরে), `Password must be at least 10 characters`, `Current password is incorrect`, `"commission.view" is owner-only and cannot be given to a role` | ফর্মে ত্রুটি দেখান |
| 401 | লগইন নেই বা token শেষ | `Unauthorized`; লগইনে `Invalid credentials` | একবার refresh (অংশ ৩); লগইনের 401-এ শুধু বার্তা |
| 403 | অনুমতি বা ব্যবসার অ্যাক্সেস নেই | `Access denied` | "অনুমতি নেই" দেখান; refresh নয় |
| 403 | অবিশ্বস্ত origin থেকে বদলানোর অনুরোধ | `Origin not allowed` | কনফিগারেশনের ভুল (`CORS_ORIGIN`) |
| 404 | জিনিসটা নেই | `User not found`, `Unknown role` | "পাওয়া যায়নি" |
| 409 | আগে থেকে আছে | `A user with this email or phone already exists; grant them access instead` | বিদ্যমান ইউজারকে যোগ করার পথ দেখান |
| 429 | এক IP থেকে প্রতি মিনিটে বেশি লগইন চেষ্টা | `ThrottlerException: Too Many Requests` | `Retry-After` header-এর সেকেন্ড পর্যন্ত অপেক্ষা |
| 503 | ডাটাবেস কনফিগার করা নেই বা পাওয়া যায় না | `Database is not configured: set DATABASE_URL` | "সার্ভার সাময়িকভাবে বন্ধ" |
| 500 | অপ্রত্যাশিত | `Internal server error` | সাধারণ ত্রুটি |

429-এর আসল উত্তর (এর `error` ফিল্ড নেই):

```
HTTP/1.1 429 Too Many Requests
Retry-After: 60

{"statusCode":429,"message":"ThrottlerException: Too Many Requests"}
```

---

## ১০. রোল ও অনুমতি

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
| `product.view` | dealership | | ✓ | | ✓ | পণ্য ও category দেখা |
| `product.manage` | dealership | | ✓ | | | পণ্য ও category বানানো, বদলানো |
| `product.cost.view` | dealership | | ✓ | | | কেনা-দাম দেখা |
| `customer.view` | dealership | | ✓ | ✓ | ✓ | গ্রাহকের তালিকা |
| `customer.manage` | dealership | | ✓ | | ✓ | গ্রাহক যোগ ও বদল |
| `customer.due.view` | dealership | | ✓ | ✓ | | গ্রাহকের বাকি দেখা |
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

`dealership` module-এর অনুমতি শুধু `type: "dealership"` ব্যবসায় প্রযোজ্য; ভবিষ্যতের অন্য ধরনের ব্যবসা (যেমন manufacturing) নিজের অনুমতি আনবে। বিজনেস ফিচারগুলো এখনো তৈরি হয়নি; অনুমতিগুলো আগে থেকে ঘোষণা করা আছে, যাতে Settings-এর ছক এখনই তৈরি করা যায়।

### frontend-এ কীভাবে ব্যবহার করবেন

- ব্যবসার কার্ড ও switcher: `me.businesses`।
- বর্তমান ব্যবসার অনুমতি: `me.businesses.find(b => b.slug === slug).permissions`। sidebar-এর মেনু, বাটন ও কলাম দেখানো বা লুকানো এখান থেকে, যেমন `permissions.includes('sale.create')`।
- এটা শুধু দেখানোর সুবিধার জন্য। **আসল যাচাই সার্ভারে**: অনুমতি না থাকলে API 403 দেয়, আর টাকার সংবেদনশীল ফিল্ড (কমিশন, লাভ, কেনা-দাম) response-এ পাঠায়ই না।
- অনুমতি বা রোল বদলালে সার্ভারে সঙ্গে সঙ্গে কার্যকর হয়; frontend-এ হালনাগাদ দেখতে `me` আবার আনুন (যেমন ব্যবসা বদলানোর সময় বা Settings-এ সেভের পর)।
