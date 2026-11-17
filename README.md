# jesan-web

Jesan Enterprise (জিসান এন্টারপ্রাইজ) মাল্টি-বিজনেস ERP প্ল্যাটফর্মের frontend। Backend আলাদা repo: **jesan-api**।

বর্তমান অবস্থা: লগইন, সেশন (cookie, সার্ভারে যাচাই), Enterprise Dashboard (ব্যবসার কার্ড), ব্যবসার ভেতরের কাঠামো `/b/[slug]` (অনুমতি অনুযায়ী মেনু, ব্যবসা বদল), ব্যবহারকারী মেনু ও পাসওয়ার্ড বদল, এবং ব্যবসার Settings: রোল × অনুমতির ছক (শুধু platform owner) ও ইউজার ব্যবস্থাপনা (`/b/[slug]/settings`)। থিম, ভাষা ও API ক্লায়েন্ট আগের ধাপের। ব্যবসার ফিচারগুলো এখন "শীঘ্রই আসছে"। লগইন পেজের নিচে backend-এর `/health` অনুযায়ী "Backend: চলছে/বন্ধ" দেখায়।

## প্রযুক্তি

Next.js 16 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS 4 (CSS-first) · next-intl · TanStack Query · Vitest · ESLint 9 · Prettier। ভার্সন ও কারণ: [DECISIONS.md](./DECISIONS.md)।

## লোকালে চালানো (Node 22)

1. Node 22 নাও (nvm থাকলে রুটে `.nvmrc` আছে):

   ```bash
   nvm use
   ```

2. ভার্সন দেখো (Node ≥ 22.22.2 লাগবে):

   ```bash
   node -v
   ```

3. প্যাকেজ ইনস্টল (lockfile মেনে):

   ```bash
   npm ci
   ```

4. env ফাইল বানাও (লোকালে ডিফল্ট মানেই চলে; API অন্য ঠিকানায় থাকলে `API_INTERNAL_URL` বদলাও):

   ```bash
   cp .env.example .env.local
   ```

5. ডেভ সার্ভার চালাও, তারপর http://localhost:3000 খোলো:

   ```bash
   npm run dev
   ```

jesan-api (localhost:4000) চালু রেখে http://localhost:3000 খুললে লগইন পেজ আসবে। API বন্ধ থাকলে লগইন পেজে "Backend: বন্ধ" দেখানো স্বাভাবিক। প্রথমবার dev বা build-এ ফন্ট নামাতে ইন্টারনেট লাগে।

সব UI উপাদান দুই থিমে একসাথে দেখতে ডেভে http://localhost:3000/dev/ui খোলো (production-এ এই পেজ নেই)। ভাষা ও থিম উপরের বার থেকে বদলায়, পছন্দ cookie-তে মনে থাকে।

## স্ক্রিপ্ট

| কমান্ড                             | কাজ                       |
| --------------------------------- | ------------------------- |
| `npm run dev`                     | ডেভ সার্ভার                |
| `npm run build` / `npm run start` | production build ও চালানো |
| `npm run lint`                    | ESLint                    |
| `npm run type-check`              | `tsc --noEmit`            |
| `npm test` / `npm run test:watch` | Vitest টেস্ট               |
| `npm run format` / `format:check` | Prettier                  |

## Environment variable

| নাম                | ডিফল্ট                          | কাজ                                                                                                                                      |
| ------------------ | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `API_INTERNAL_URL` | `http://localhost:4000/api/v1` | শুধু সার্ভারে: jesan-api-এর আসল ঠিকানা। ব্রাউজার এটা দেখে না; সে এই সাইটের `/api/v1/*` ডাকে, Next সেটা এখানে পাঠায়। **build-এর সময় পড়া হয়।** |
| `APP_ORIGIN`       | (খালি = অনুরোধ থেকে)            | ঐচ্ছিক: এই সাইটের public origin, যেমন `https://app.example.com`। সার্ভার session refresh করার সময় এটা `Origin` header হিসেবে পাঠায়।        |

আসল মান `.env.local`-এ রাখো; এটা git-এ যায় না।

## API ও সেশন কীভাবে যুক্ত

- ব্রাউজার কখনো সরাসরি jesan-api-তে যায় না। সে এই সাইটের `/api/v1/*` ডাকে, `next.config.ts`-এর `rewrites` সেটা `API_INTERNAL_URL`-এ পাঠায়। ফলে API-র দুটো cookie (`jesan_at`, `jesan_rt`) এই সাইটের নামে বসে।
- পেজ খোলার সময় সার্ভার cookie দিয়ে `GET /auth/me` ডেকে সেশন যাচাই করে। access cookie না থাকলে `/api/v1/auth/resume` সার্ভারে একবার refresh করে পেজে ফেরায়, না হলে `/login`।
- টোকেন কখনো JavaScript-এ থাকে না (cookie গুলো HttpOnly)।

## ডিপ্লয়ের শর্ত

1. **`API_INTERNAL_URL` build-এর আগে দিতে হবে।** Next-এর `rewrites` `next build`-এর সময় তৈরি হয়ে থাকে; পরে env বদলালে নতুন build লাগবে।
2. **jesan-api-র `CORS_ORIGIN`-এ web সাইটের origin থাকতে হবে** (হুবহু, স্কিম ও পোর্টসহ, যেমন `https://app.example.com`)। ব্রাউজার ও সার্ভার দুই পথেই POST-এর `Origin` হিসেবে এটাই যায়; না মিললে API 403 `Origin not allowed` দেয়।
3. Proxy থাকায় web ও API আলাদা ডোমেইনে থাকলেও চলে (যেমন `xxx.vercel.app` ও `xxx.up.railway.app`); cookie সবসময় web সাইটের নামে।
4. Proxy-র পেছনে চললে `APP_ORIGIN` দেওয়া ভালো, যাতে refresh-এর `Origin` ঠিক থাকে।
5. লেটেন্সি কমাতে web, API ও database একই region-এ (প্রপোজাল ৯.২-এর ১০ নম্বর)।

## ফোল্ডার

```
messages/                 অনুবাদ: en.json, bn.json
src/app/                  Next.js routes (App Router); (app)/ = সাইডবারসহ পেজ
src/core/                 সব ব্যবসার জন্য এক অংশ (ব্যবসার নাম নিষেধ)
src/core/api/             backend-এর সাথে যোগাযোগ (browser ও server), TanStack Query
src/core/auth/            সেশন, লগইন ও পাসওয়ার্ড ফর্ম, অনুমতি (useCan, <Can>)
src/core/module-system/   module manifest-এর ধরন ও ব্যবসার মেনু তৈরি
src/core/settings/        Settings: রোল-অনুমতির ছক, ইউজার ব্যবস্থাপনা, query key ও hooks
src/core/i18n/            ভাষা ও সংখ্যা/টাকা/তারিখের ফরম্যাট
src/core/theme/           থিম ও design token
src/core/ui/              অ্যাপের কাঠামো ও পুনর্ব্যবহারযোগ্য উপাদান
src/modules/dealership/   generic dealership module (আকিজ সিমেন্ট, পরে BSRM); manifest.ts = মেনু ও অনুমতি
src/modules/registry.ts   ব্যবসার ধরন → module
src/proxy.ts              পেজে ঢোকার আগে cookie আছে কি না দেখা
test/                     টেস্টের setup ও helper
```

প্রতিটা ফোল্ডারের README-তে তার দায়িত্ব লেখা আছে।
